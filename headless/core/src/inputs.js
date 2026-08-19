// Reading a query from a local file, inside an allowlist.
//
// Empty by default: without a list the server would be an arbitrary-file reader for anything that can
// call a tool, including text that arrived inside a result.

import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_INPUT_BYTES = 64 * 1024 * 1024;

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * The realpath of `candidate` if it resolves inside one of `roots`, else null.
 *
 * realpath on both sides, so a symlink anywhere along either path cannot land outside.
 */
export async function containedRealPath(roots, candidate) {
    let real;
    try { real = await fs.realpath(candidate); } catch { return null; }
    for (const root of roots ?? []) {
        let realRoot;
        try { realRoot = await fs.realpath(root); } catch { continue; }
        const rel = path.relative(realRoot, real);
        if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return real;
    }
    return null;
}

export function parseInputDirs(value) {
    return String(value ?? '').split(path.delimiter).map(s => s.trim()).filter(Boolean);
}

/**
 * @param {string} candidate  a path the caller supplied
 * @param {{inputDirs: string[]}} opts
 * @returns {Promise<{path: string, text: string, name: string, bytes: number}>}
 */
export async function resolveInputPath(candidate, { inputDirs = [] } = {}) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
        throw coded('INVALID_INPUT', 'a path is required');
    }
    if (!inputDirs.length) {
        throw coded('INPUT_PATH_REFUSED',
            'reading queries from files is off — set MMSEQS2_AGENT_INPUT_DIRS to the directories ' +
            'this server may read from');
    }
    const real = await containedRealPath(inputDirs, candidate);
    if (!real) {
        throw coded('INPUT_PATH_REFUSED',
            `${candidate} is not inside MMSEQS2_AGENT_INPUT_DIRS (${inputDirs.join(path.delimiter)})`);
    }
    const stat = await fs.lstat(real);
    if (!stat.isFile()) throw coded('INPUT_PATH_REFUSED', `${candidate} is not a regular file`);
    if (stat.size > MAX_INPUT_BYTES) {
        throw coded('INPUT_PATH_REFUSED', `${candidate} is ${stat.size} bytes, over ${MAX_INPUT_BYTES}`);
    }
    return {
        path: real,
        name: path.basename(real),
        bytes: stat.size,
        text: await fs.readFile(real, 'utf8'),
    };
}

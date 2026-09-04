// Read local query files only through explicitly allowed roots.

import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_INPUT_BYTES = 64 * 1024 * 1024;
export const DEFAULT_INPUT_TTL_SECONDS = 3600;

/** Compute a directory tree's total file size. */
export async function treeBytes(dir) {
    let total = 0;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return 0; }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) total += await treeBytes(full);
        else {
            try { total += (await fs.lstat(full)).size; } catch { /* Ignore vanished files. */ }
        }
    }
    return total;
}

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/** Resolve a candidate only when its real path stays inside an allowed root. */
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
    return String(value ?? '').split(path.delimiter)
        .map(s => s.trim())
        .filter(s => s && path.isAbsolute(s) && !s.includes('${'));
}

/** First allowed directory in which `relative` names a real file. */
async function firstResolvable(inputDirs, relative) {
    for (const root of inputDirs) {
        const real = await containedRealPath([root], path.join(root, relative));
        if (real && await fs.lstat(real).then(st => st.isFile()).catch(() => false)) {
            return { real, root };
        }
    }
    return null;
}

export const LISTED_NAMES = 20;

/** Return a bounded listing to help resolve refused paths. */
async function listing(dirs) {
    const parts = [];
    for (const dir of dirs) {
        const names = (await fs.readdir(dir).catch(() => []))
            .filter(name => !name.startsWith('.'));
        if (!names.length) continue;
        const shown = names.slice(0, LISTED_NAMES).join(', ');
        parts.push(names.length > LISTED_NAMES
            ? `${dir} holds ${shown} … (${names.length} entries)`
            : `${dir} holds ${shown}`);
    }
    return parts.join('; ');
}

/** Read an absolute or root-relative file after containment checks. */
export async function resolveInputPath(candidate, { inputDirs = [], touchDirs = [] } = {}) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
        throw coded('INVALID_INPUT', 'a path is required');
    }
    if (!inputDirs.length) {
        throw coded('INPUT_PATH_REFUSED',
            'reading queries from files is off — set FOLDSEEK_SERVER_INPUT_DIRS to the directories ' +
            'this server may read from');
    }
    const found = path.isAbsolute(candidate)
        ? await containedRealPath(inputDirs, candidate).then(real => (real ? { real, root: null } : null))
        : await firstResolvable(inputDirs, candidate);
    if (!found) {
        const what = await listing(inputDirs);
        throw coded('INPUT_PATH_REFUSED',
            `${candidate} did not resolve in any readable directory (${inputDirs.join(path.delimiter)})`
            + (what ? `. ${what}` : ''));
    }
    const real = found.real;
    const stat = await fs.lstat(real);
    if (!stat.isFile()) throw coded('INPUT_PATH_REFUSED', `${candidate} is not a regular file`);
    if (stat.size > MAX_INPUT_BYTES) {
        throw coded('INPUT_PATH_REFUSED', `${candidate} is ${stat.size} bytes, over ${MAX_INPUT_BYTES}`);
    }
    // Refresh only managed drop-folder inputs.
    if (touchDirs.length && await containedRealPath(touchDirs, real)) {
        const at = new Date();
        await fs.utimes(real, at, at).catch(() => {});
    }
    return {
        path: real,
        name: path.basename(real),
        bytes: stat.size,
        // Report which root resolved a relative name.
        ...(found.root ? { root: found.root } : {}),
        text: await fs.readFile(real, 'utf8'),
    };
}

export const DROP_MARKER = '.foldseek-drop';

/** Derive the shared import and export directories together. */
export const sharedPaths = shared => ({
    exportsDir: path.join(shared, 'exports'),
    importsDir: path.join(shared, 'imports'),
});

/** Create and safely claim the shared directories. */
export async function ensureSharedDirs(shared) {
    const { exportsDir, importsDir } = sharedPaths(shared);
    await fs.mkdir(exportsDir, { recursive: true });
    await fs.mkdir(importsDir, { recursive: true });

    // Never put an existing unclaimed directory under input expiry.
    const names = await fs.readdir(importsDir);
    if (names.length && !names.includes(DROP_MARKER)) {
        throw coded('SHARED_DIR_OCCUPIED',
            `${importsDir} already existed and holds ${names.length} entr${names.length === 1 ? 'y' : 'ies'}`
            + ' — refusing to claim it, because everything in it would expire on the input TTL. Point'
            + ' FOLDSEEK_SERVER_SHARED_DIR at a directory with no imports/ of its own, or move those'
            + ' files out.');
    }
    await fs.writeFile(path.join(importsDir, DROP_MARKER), JSON.stringify({
        kind: 'foldseek-server drop directory', createdAt: new Date().toISOString(),
    })).catch(() => {});
    return { exportsDir, importsDir };
}

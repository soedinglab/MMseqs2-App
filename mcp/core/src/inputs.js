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

export const LISTED_NAMES = 20;

/** Return a bounded listing to help resolve refused paths. */
async function listing(dir) {
    const names = (await fs.readdir(dir).catch(() => [])).filter(name => !name.startsWith('.'));
    if (!names.length) return '';
    const shown = names.slice(0, LISTED_NAMES).join(', ');
    return names.length > LISTED_NAMES
        ? `${dir} holds ${shown} … (${names.length} entries)`
        : `${dir} holds ${shown}`;
}

/** Read an absolute or relative file from the shared imports directory. */
export async function resolveInputPath(candidate, { inputDir = null, touch = true } = {}) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
        throw coded('INVALID_INPUT', 'a path is required');
    }
    if (!inputDir) {
        throw coded('INPUT_PATH_REFUSED',
            'reading queries from files is unavailable — use a local or loopback connection with ' +
            'MARV_SHARED_DIR');
    }
    const wanted = path.isAbsolute(candidate) ? candidate : path.join(inputDir, candidate);
    const real = await containedRealPath([inputDir], wanted);
    if (!real) {
        const what = await listing(inputDir);
        throw coded('INPUT_PATH_REFUSED',
            `${candidate} did not resolve inside the shared imports directory (${inputDir})`
            + (what ? `. ${what}` : ''));
    }
    const stat = await fs.lstat(real);
    if (!stat.isFile()) throw coded('INPUT_PATH_REFUSED', `${candidate} is not a regular file`);
    if (stat.size > MAX_INPUT_BYTES) {
        throw coded('INPUT_PATH_REFUSED', `${candidate} is ${stat.size} bytes, over ${MAX_INPUT_BYTES}`);
    }
    if (touch) {
        const at = new Date();
        await fs.utimes(real, at, at).catch(() => {});
    }
    return {
        path: real,
        name: path.basename(real),
        bytes: stat.size,
        text: await fs.readFile(real, 'utf8'),
    };
}

export const DROP_MARKER = '.foldseek-drop';

/** Derive the shared import and export directories together. */
export const sharedPaths = shared => ({
    exportsDir: path.join(shared, 'exports'),
    importsDir: path.join(shared, 'imports'),
});

/** Return verified host and mount-relative paths for the shared directory. */
export async function describeSharedDir(shared, { exposeLocalPaths = true } = {}) {
    if (!shared) throw coded('SHARED_DIR_UNAVAILABLE', 'no shared directory is configured');
    if (!exposeLocalPaths) {
        throw coded('LOCAL_PATHS_WITHHELD', 'local shared-directory paths are not exposed here');
    }
    const localPath = path.resolve(shared);
    const { exportsDir, importsDir } = sharedPaths(localPath);
    try {
        await Promise.all([fs.access(localPath), fs.access(exportsDir), fs.access(importsDir)]);
    } catch (err) {
        throw coded('SHARED_DIR_UNAVAILABLE',
            `the shared directory is not ready at ${localPath}: ${err.message}`);
    }
    return {
        localPath,
        mountName: path.basename(localPath),
        imports: { localPath: importsDir, pathFromMount: 'imports' },
        exports: { localPath: exportsDir, pathFromMount: 'exports' },
    };
}

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
            + ' MARV_SHARED_DIR at a directory with no imports/ of its own, or move those'
            + ' files out.');
    }
    await fs.writeFile(path.join(importsDir, DROP_MARKER), JSON.stringify({
        kind: 'marv drop directory', createdAt: new Date().toISOString(),
    })).catch(() => {});
    return { exportsDir, importsDir };
}

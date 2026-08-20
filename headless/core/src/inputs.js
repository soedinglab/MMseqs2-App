// Reading a query from a local file, inside an allowlist.
//
// Empty by default: without a list the server would be an arbitrary-file reader for anything that can
// call a tool, including text that arrived inside a result.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_INPUT_BYTES = 64 * 1024 * 1024;
export const DEFAULT_INPUT_TTL_SECONDS = 3600;
export const DEFAULT_INPUT_QUOTA_BYTES = 1024 * 1024 * 1024;

/** Total size of a tree. Shared with the collectors so there is one walker, not two. */
export async function treeBytes(dir) {
    let total = 0;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return 0; }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) total += await treeBytes(full);
        else {
            try { total += (await fs.lstat(full)).size; } catch { /* vanished mid-walk */ }
        }
    }
    return total;
}

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
    return String(value ?? '').split(path.delimiter)
        .map(s => s.trim())
        .filter(s => s && path.isAbsolute(s) && !s.includes('${'));
}

/** First allowed directory in which `relative` names a real file. */
async function firstResolvable(inputDirs, relative) {
    for (const root of inputDirs) {
        const real = await containedRealPath([root], path.join(root, relative));
        if (real && await fs.lstat(real).then(st => st.isFile()).catch(() => false)) return real;
    }
    return null;
}

/**
 * @param {string} candidate  an absolute path, or one relative to an allowed directory
 * @param {{inputDirs: string[]}} opts
 * @returns {Promise<{path: string, text: string, name: string, bytes: number}>}
 */
export async function resolveInputPath(candidate, { inputDirs = [] } = {}) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
        throw coded('INVALID_INPUT', 'a path is required');
    }
    if (!inputDirs.length) {
        throw coded('INPUT_PATH_REFUSED',
            'reading queries from files is off — set FOLDSEEK_SERVER_INPUT_DIRS to the directories ' +
            'this server may read from');
    }
    const real = path.isAbsolute(candidate)
        ? await containedRealPath(inputDirs, candidate)
        : await firstResolvable(inputDirs, candidate);
    if (!real) {
        throw coded('INPUT_PATH_REFUSED',
            `${candidate} did not resolve inside FOLDSEEK_SERVER_INPUT_DIRS ` +
            `(${inputDirs.join(path.delimiter)})`);
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

/**
 * Hostnames `queryUrl` may fetch from. Empty means the capability is off.
 *
 * The allowlist is the real boundary. The scheme and address checks below are defence against a
 * mistyped entry, not against someone who controls DNS for a host you listed.
 */
export function parseUrlHosts(value) {
    return String(value ?? '').split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => /^[a-z0-9.:_-]+$/.test(s) && s !== '.' && s !== '..');
}

const PRIVATE_V4 = [
    /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
];

function privateAddress(address) {
    if (address === '::1' || address.startsWith('fc') || address.startsWith('fd')
        || address.startsWith('fe80')) return true;
    return PRIVATE_V4.some(re => re.test(address));
}

async function refuseUrl(raw, hosts) {
    let url;
    try { url = new URL(raw); } catch { return `${JSON.stringify(raw)} is not a URL`; }
    if (url.protocol !== 'https:') return `${url.protocol}// is not allowed; use https`;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!hosts.includes(host)) {
        return `${host} is not in FOLDSEEK_SERVER_URL_HOSTS (${hosts.join(', ')})`;
    }
    if (privateAddress(host)) return `${host} is a private address`;

    const { lookup } = await import('node:dns/promises');
    const resolved = await lookup(host, { all: true }).catch(() => []);
    for (const { address } of resolved) {
        if (privateAddress(address)) return `${host} resolves to the private address ${address}`;
    }
    return null;
}

const MAX_REDIRECTS = 2;

/**
 * Fetch a structure the caller named by URL. Every redirect hop is re-checked, and the body is
 * counted as it arrives so a lying content-length cannot get past the cap.
 *
 * @returns {Promise<{url: string, text: string, name: string, bytes: number}>}
 */
export async function resolveInputUrl(raw, {
    urlHosts = [], fetchImpl = globalThis.fetch, maxBytes = MAX_INPUT_BYTES, signal,
} = {}) {
    if (!urlHosts.length) {
        throw coded('INPUT_URL_REFUSED',
            'fetching queries by URL is off — set FOLDSEEK_SERVER_URL_HOSTS to the hostnames this ' +
            'server may fetch from');
    }

    let target = raw;
    for (let hop = 0; ; hop++) {
        const problem = await refuseUrl(target, urlHosts);
        if (problem) throw coded('INPUT_URL_REFUSED', problem);

        const res = await fetchImpl(target, { redirect: 'manual', signal });
        if (res.status >= 300 && res.status < 400) {
            const next = res.headers?.get?.('location');
            if (!next) throw coded('INPUT_URL_REFUSED', `${res.status} with no location`);
            if (hop >= MAX_REDIRECTS) throw coded('INPUT_URL_REFUSED', 'too many redirects');
            target = new URL(next, target).toString();
            continue;
        }
        if (!res.ok) throw coded('INPUT_URL_REFUSED', `${res.status} from ${new URL(target).host}`);

        const declared = Number(res.headers?.get?.('content-length'));
        if (Number.isFinite(declared) && declared > maxBytes) {
            throw coded('INPUT_URL_REFUSED', `${declared} bytes, over ${maxBytes}`);
        }
        const text = await readCapped(res, maxBytes);
        return {
            url: target,
            name: path.basename(new URL(target).pathname) || 'query',
            bytes: Buffer.byteLength(text),
            text,
        };
    }
}

/** Counted as it arrives, so a missing or dishonest content-length changes nothing. */
async function readCapped(res, maxBytes) {
    if (typeof res.body?.getReader !== 'function') {
        const text = await res.text();
        if (Buffer.byteLength(text) > maxBytes) {
            throw coded('INPUT_URL_REFUSED', `over ${maxBytes} bytes`);
        }
        return text;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw coded('INPUT_URL_REFUSED', `over ${maxBytes} bytes`);
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
}

// --- staged inputs: bytes pushed in over HTTP, referenced later by an opaque id -------------------

export const INPUT_ID = /^in_[0-9a-f]{16}$/;
const BODY = 'body';
const META = 'meta.json';

export const inputsRoot = store => path.join(store.stateDir, 'inputs');

/** An entry name, never a path component. */
function safeName(raw) {
    const base = path.basename(String(raw ?? '').replace(/\\/g, '/')).trim();
    return /^[\w.-]{1,128}$/.test(base) && base !== '.' && base !== '..' ? base : 'query';
}

async function* chunksOf(source) {
    if (typeof source === 'string' || Buffer.isBuffer(source)) { yield Buffer.from(source); return; }
    for await (const chunk of source) yield Buffer.from(chunk);
}

/**
 * Write bytes under a fresh id and return a handle.
 *
 * @param {AsyncIterable|Buffer|string} source
 */
export async function stageInput(source, {
    store, name = 'query', maxBytes = MAX_INPUT_BYTES, quotaBytes = DEFAULT_INPUT_QUOTA_BYTES,
} = {}) {
    const root = inputsRoot(store);
    const used = await treeBytes(root);
    if (used >= quotaBytes) {
        throw coded('INPUT_QUOTA_EXCEEDED',
            `${used} bytes already staged, at the ${quotaBytes} limit — wait for expiry or raise it`);
    }

    const inputId = `in_${crypto.randomBytes(8).toString('hex')}`;
    const scratch = path.join(root, `.staging-${inputId.slice(3)}`);
    await fs.mkdir(scratch, { recursive: true });

    try {
        const hash = crypto.createHash('sha256');
        const handle = await fs.open(path.join(scratch, BODY), 'w');
        let bytes = 0;
        try {
            for await (const chunk of chunksOf(source)) {
                bytes += chunk.byteLength;
                if (bytes > maxBytes) {
                    throw coded('INPUT_TOO_LARGE', `over the ${maxBytes} byte limit`);
                }
                if (used + bytes > quotaBytes) {
                    throw coded('INPUT_QUOTA_EXCEEDED', `would exceed the ${quotaBytes} byte quota`);
                }
                hash.update(chunk);
                await handle.write(chunk);
            }
        } finally {
            await handle.close();
        }
        if (bytes === 0) throw coded('INVALID_INPUT', 'the body was empty');

        // Re-measured now the bytes are on disk: concurrent uploads can each pass the first check and
        // jointly exceed the quota. The loser removes its own scratch, never another's input.
        if ((await treeBytes(root)) > quotaBytes) {
            throw coded('INPUT_QUOTA_EXCEEDED', `staging this would exceed the ${quotaBytes} byte quota`);
        }

        const meta = {
            inputId,
            name: safeName(name),
            bytes,
            createdAt: new Date().toISOString(),
            contentSha256: hash.digest('hex'),
        };
        await fs.writeFile(path.join(scratch, META), JSON.stringify(meta));
        await fs.rename(scratch, path.join(root, inputId));
        return meta;
    } catch (err) {
        await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
        throw err;
    }
}

/**
 * Read a staged input. Touches the directory, so the TTL runs from last use, and does not consume:
 * one upload normally backs several searches.
 */
export async function resolveStagedInput(id, {
    store, ttlSeconds = DEFAULT_INPUT_TTL_SECONDS, now = new Date(),
} = {}) {
    const unknown = () => coded('INPUT_ID_UNKNOWN',
        `no staged input ${JSON.stringify(id)} — it may have expired; upload it again`);
    if (typeof id !== 'string' || !INPUT_ID.test(id)) throw unknown();

    const root = inputsRoot(store);
    // The id cannot traverse, so this is here for a symlink swapped in where a directory should be.
    const dir = await containedRealPath([root], path.join(root, id));
    if (!dir) throw unknown();
    const stat = await fs.lstat(dir).catch(() => null);
    if (!stat?.isDirectory()) throw unknown();
    if ((now.getTime() - stat.mtimeMs) / 1000 > ttlSeconds) throw unknown();

    const meta = await fs.readFile(path.join(dir, META), 'utf8').then(JSON.parse).catch(() => null);
    const text = await fs.readFile(path.join(dir, BODY), 'utf8').catch(() => null);
    if (!meta || text === null) throw unknown();

    await fs.utimes(dir, now, now).catch(() => {});
    return { inputId: meta.inputId, name: meta.name, bytes: meta.bytes, text };
}

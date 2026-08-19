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
            'reading queries from files is off — set FOLDSEEK_SERVER_INPUT_DIRS to the directories ' +
            'this server may read from');
    }
    const real = await containedRealPath(inputDirs, candidate);
    if (!real) {
        throw coded('INPUT_PATH_REFUSED',
            `${candidate} is not inside FOLDSEEK_SERVER_INPUT_DIRS (${inputDirs.join(path.delimiter)})`);
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
    return String(value ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
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

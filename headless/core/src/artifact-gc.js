// Deleting public artifacts, and nothing else.
//
// The only reachable root is the artifact directory, which is a sibling of the ticket cache rather
// than its parent — so source results, ticket metadata and selections are not merely spared, they are
// out of reach. Every candidate is re-validated immediately before the unlink, and every attempt is
// audited whether it succeeded, was skipped, or failed.

import fs from 'node:fs/promises';
import path from 'node:path';

import { ARTIFACT_ID } from './artifacts.js';

const BUILD_PREFIX = '.build-';
const READY = 'READY';

export const DEFAULT_TTL_SECONDS = 7200;
export const DEFAULT_STALE_BUILD_SECONDS = 3600;
export const DEFAULT_MAX_DELETIONS = 200;

export const DEFAULT_AUDIT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * An audit sink that appends one JSON object per line, rotating once at `maxBytes` so the log is
 * bounded at two generations rather than growing for the life of the state directory.
 */
export function fileAudit(file, { maxBytes = DEFAULT_AUDIT_MAX_BYTES } = {}) {
    return async (entry) => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const size = await fs.stat(file).then(s => s.size).catch(() => 0);
        if (size >= maxBytes) await fs.rename(file, `${file}.1`).catch(() => {});
        await fs.appendFile(file, `${JSON.stringify(entry)}\n`);
    };
}

/** Routine outcomes: an operator asking for detail can have them, a running server should not. */
const ROUTINE_RESULTS = new Set(['kept']);
const ROUTINE_REASONS = new Set(['WITHIN_TTL', 'BUILD_IN_PROGRESS', 'INCOMPLETE_RECENT']);

/**
 * The newest timestamp anywhere in a build directory.
 *
 * A directory's own mtime only moves when an entry is added or removed — appending to an existing file
 * leaves it alone (measured). A build streaming one large row file for an hour would therefore look
 * abandoned if the directory alone were consulted.
 */
async function newestMtimeMs(dir, depth = 2) {
    let newest = await fs.lstat(dir).then(s => s.mtimeMs).catch(() => 0);
    if (depth === 0) return newest;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return newest; }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const at = entry.isDirectory()
            ? await newestMtimeMs(full, depth - 1)
            : await fs.lstat(full).then(s => s.mtimeMs).catch(() => 0);
        if (at > newest) newest = at;
    }
    return newest;
}

async function directoryBytes(dir) {
    let total = 0;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return 0; }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) total += await directoryBytes(full);
        else {
            try { total += (await fs.lstat(full)).size; } catch { /* vanished mid-walk */ }
        }
    }
    return total;
}

/**
 * Re-checked immediately before deletion rather than when the candidate was listed: the gap between
 * the two is where a swapped symlink would land.
 */
async function refuseUnsafe(root, name) {
    if (!ARTIFACT_ID.test(name) && !name.startsWith(BUILD_PREFIX)) return 'UNRECOGNIZED_NAME';
    if (name.includes('/') || name.includes('\\') || name.includes('..') || path.isAbsolute(name)) {
        return 'UNSAFE_NAME';
    }
    const dir = path.join(root, name);
    let stat;
    try { stat = await fs.lstat(dir); } catch { return 'VANISHED'; }
    if (stat.isSymbolicLink()) return 'SYMLINK';
    if (!stat.isDirectory()) return 'NOT_A_DIRECTORY';

    const realRoot = await fs.realpath(root);
    const real = await fs.realpath(dir);
    if (path.relative(realRoot, real) !== name) return 'ESCAPES_ROOT';
    return null;
}

async function ageSeconds(store, dir, name, now) {
    const stamp = await store.lastAccessedAt(name).catch(() => null);
    if (stamp) {
        const at = Date.parse(stamp);
        if (Number.isFinite(at)) return (now.getTime() - at) / 1000;
    }
    // No readable access record or manifest: fall back to the directory itself, which makes an
    // unreadable artifact look older rather than immortal.
    try { return (now.getTime() - (await fs.lstat(dir)).mtimeMs) / 1000; } catch { return Infinity; }
}

/**
 * @param {object} store  createArtifactStore instance
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]   report what would go, delete nothing
 * @param {(entry: object) => any} [opts.audit]
 * @returns {Promise<object>} a report; never throws for a single unusable entry
 */
export async function collectArtifacts(store, {
    ttlSeconds = store.ttlSeconds ?? DEFAULT_TTL_SECONDS,
    staleBuildSeconds = DEFAULT_STALE_BUILD_SECONDS,
    maxDeletions = DEFAULT_MAX_DELETIONS,
    dryRun = false,
    audit = null,
    auditKeeps = false,
    now = store.now(),
} = {}) {
    const root = store.root;
    const report = {
        startedAt: now.toISOString(),
        dryRun,
        examined: 0,
        deleted: 0,
        wouldDelete: 0,
        kept: 0,
        skipped: 0,
        errors: 0,
        bytesReclaimed: 0,
        remaining: 0,
        maxDeletions,
    };

    let names;
    try { names = await fs.readdir(root); } catch { return report; }

    const record = async (entry) => {
        if (!audit) return;
        const routine = ROUTINE_RESULTS.has(entry.result) && ROUTINE_REASONS.has(entry.reason);
        if (routine && !auditKeeps) return;
        await audit({ ts: now.toISOString(), ...entry }).catch?.(() => {});
    };

    const candidates = [];
    for (const name of names) {
        const isArtifact = ARTIFACT_ID.test(name);
        const isScratch = name.startsWith(BUILD_PREFIX);
        if (!isArtifact && !isScratch) {
            report.skipped += 1;
            await record({ artifactId: name, reason: 'UNRECOGNIZED_NAME', result: 'skipped' });
            continue;
        }
        report.examined += 1;
        const dir = path.join(root, name);

        if (isScratch) {
            const age = (now.getTime() - await newestMtimeMs(dir)) / 1000;
            if (age <= staleBuildSeconds) {
                report.kept += 1;
                await record({ artifactId: name, reason: 'BUILD_IN_PROGRESS', result: 'kept' });
            } else {
                candidates.push({ name, dir, age, reason: 'STALE_BUILD' });
            }
            continue;
        }

        if (store.isActive?.(name)) {
            report.skipped += 1;
            await record({ artifactId: name, reason: 'ACTIVE', result: 'skipped' });
            continue;
        }

        const ready = await fs.access(path.join(dir, READY)).then(() => true).catch(() => false);
        const age = await ageSeconds(store, dir, name, now);
        if (!ready) {
            if (age <= staleBuildSeconds) {
                report.kept += 1;
                await record({ artifactId: name, reason: 'INCOMPLETE_RECENT', result: 'kept' });
            } else {
                candidates.push({ name, dir, age, reason: 'INCOMPLETE' });
            }
            continue;
        }
        if (age <= ttlSeconds) {
            report.kept += 1;
            await record({ artifactId: name, reason: 'WITHIN_TTL', result: 'kept', ageSeconds: Math.round(age) });
            continue;
        }
        candidates.push({ name, dir, age, reason: 'EXPIRED' });
    }

    // Oldest first, so a bounded run removes the least useful artifacts rather than an arbitrary set.
    candidates.sort((a, b) => b.age - a.age);

    for (const candidate of candidates) {
        if (report.deleted + report.wouldDelete >= maxDeletions) {
            report.remaining += 1;
            continue;
        }
        const unsafe = await refuseUnsafe(root, candidate.name);
        if (unsafe) {
            report.skipped += 1;
            await record({ artifactId: candidate.name, reason: unsafe, result: 'skipped' });
            continue;
        }

        const bytes = await directoryBytes(candidate.dir);
        const entry = {
            artifactId: candidate.name,
            reason: candidate.reason,
            ageSeconds: Math.round(candidate.age),
            bytes,
        };

        if (dryRun) {
            report.wouldDelete += 1;
            report.bytesReclaimed += bytes;
            await record({ ...entry, result: 'would-delete' });
            continue;
        }
        try {
            // The real directory is walked; a manifest is never the authority on what to remove.
            await fs.rm(candidate.dir, { recursive: true, force: true });
            report.deleted += 1;
            report.bytesReclaimed += bytes;
            await record({ ...entry, result: 'deleted' });
        } catch (err) {
            report.errors += 1;
            await record({ ...entry, result: 'error', error: err.message });
        }
    }

    report.finishedAt = new Date(now.getTime()).toISOString();
    return report;
}

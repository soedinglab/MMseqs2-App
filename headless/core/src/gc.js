// Deleting derived state: public artifacts, and cached result payloads.

import fs from 'node:fs/promises';
import path from 'node:path';

import { ARTIFACT_ID, DEFAULT_ARTIFACT_TTL_SECONDS, ROOT_MARKER } from './artifacts.js';
import {
    containedRealPath, treeBytes, inputsRoot, INPUT_ID, DEFAULT_INPUT_TTL_SECONDS,
} from './inputs.js';

const BUILD_PREFIX = '.build-';
const READY = 'READY';

export const DEFAULT_TTL_SECONDS = DEFAULT_ARTIFACT_TTL_SECONDS;

/** The expensive thing: a network round trip and a multi-MB parse, so it is kept for a day. */
export const DEFAULT_RESULT_TTL_SECONDS = 86400;

const DEFAULT_STALE_BUILD_SECONDS = 3600;
const DEFAULT_MAX_DELETIONS = 200;

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

async function readdirSafe(dir, withFileTypes = false) {
    try { return await fs.readdir(dir, { withFileTypes }); } catch { return []; }
}

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

    const real = await containedRealPath([root], dir);
    if (real !== path.join(await fs.realpath(root), name)) return 'ESCAPES_ROOT';
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

    // Only roots we created. An export directory can be any folder the operator names, and a typo
    // would otherwise aim the sweep at one we have never written to.
    if (!names.includes(ROOT_MARKER)) {
        report.refused = 'NOT_AN_ARTIFACT_ROOT';
        return report;
    }

    const record = async (entry) => {
        if (!audit) return;
        const routine = ROUTINE_RESULTS.has(entry.result) && ROUTINE_REASONS.has(entry.reason);
        if (routine && !auditKeeps) return;
        await audit({ ts: now.toISOString(), scope: 'artifacts', ...entry }).catch?.(() => {});
    };

    const candidates = [];
    for (const name of names) {
        if (name === ROOT_MARKER) continue;
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

        const bytes = await treeBytes(candidate.dir);
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

const RESULT_PAYLOAD = /^(?:result-\d+|foldmason|folddisco)\.json$/;

/** Re-checked immediately before the unlink, for the same reason the artifact sweep re-checks. */
async function refuseUnsafePayload(root, relative) {
    if (!RESULT_PAYLOAD.test(path.basename(relative))) return 'UNRECOGNIZED_NAME';
    if (relative.includes('..')) return 'UNSAFE_NAME';
    const full = path.join(root, relative);
    let stat;
    try { stat = await fs.lstat(full); } catch { return 'VANISHED'; }
    if (stat.isSymbolicLink()) return 'SYMLINK';
    if (!stat.isFile()) return 'NOT_A_FILE';
    const real = await containedRealPath([root], full);
    if (real !== path.join(await fs.realpath(root), relative)) return 'ESCAPES_ROOT';
    return null;
}

/**
 * Expire cached result payloads under `<stateDir>/tickets/**`.
 *
 * @param {object} store  a Store
 * @returns {Promise<object>} a report; never throws for a single unusable entry
 */
export async function collectResultCache(store, {
    ttlSeconds = DEFAULT_RESULT_TTL_SECONDS,
    maxDeletions = DEFAULT_MAX_DELETIONS,
    dryRun = false,
    audit = null,
    auditKeeps = false,
    now = new Date(),
} = {}) {
    const root = path.join(store.stateDir, 'tickets');
    const report = {
        startedAt: now.toISOString(),
        dryRun,
        examined: 0,
        deleted: 0,
        wouldDelete: 0,
        kept: 0,
        preserved: 0,
        skipped: 0,
        errors: 0,
        bytesReclaimed: 0,
        remaining: 0,
        maxDeletions,
    };

    const record = async (entry) => {
        if (!audit) return;
        const routine = ROUTINE_RESULTS.has(entry.result) && ROUTINE_REASONS.has(entry.reason);
        if (routine && !auditKeeps) return;
        await audit({ ts: now.toISOString(), scope: 'results', ...entry }).catch?.(() => {});
    };

    const candidates = [];
    for (const a of await readdirSafe(root)) {
        for (const b of await readdirSafe(path.join(root, a))) {
            for (const id of await readdirSafe(path.join(root, a, b))) {
                for (const entry of await readdirSafe(path.join(root, a, b, id), true)) {
                    if (!RESULT_PAYLOAD.test(entry.name)) {
                        report.preserved += 1;
                        continue;
                    }
                    const relative = path.join(a, b, id, entry.name);
                    // A payload name that is not a plain file is deliberate, so it leaves a trace.
                    if (!entry.isFile()) {
                        report.skipped += 1;
                        await record({
                            file: relative, result: 'skipped',
                            reason: entry.isSymbolicLink() ? 'SYMLINK' : 'NOT_A_FILE',
                        });
                        continue;
                    }
                    report.examined += 1;
                    let stat;
                    try { stat = await fs.lstat(path.join(root, relative)); } catch { continue; }
                    const age = (now.getTime() - stat.mtimeMs) / 1000;
                    if (age <= ttlSeconds) {
                        report.kept += 1;
                        await record({
                            file: relative, reason: 'WITHIN_TTL', result: 'kept',
                            ageSeconds: Math.round(age),
                        });
                        continue;
                    }
                    candidates.push({ relative, age, bytes: stat.size, ticket: id });
                }
            }
        }
    }

    candidates.sort((x, y) => y.age - x.age);

    for (const candidate of candidates) {
        if (report.deleted + report.wouldDelete >= maxDeletions) {
            report.remaining += 1;
            continue;
        }
        const unsafe = await refuseUnsafePayload(root, candidate.relative);
        if (unsafe) {
            report.skipped += 1;
            await record({ file: candidate.relative, reason: unsafe, result: 'skipped' });
            continue;
        }

        const entry = {
            file: candidate.relative,
            ticket: candidate.ticket,
            reason: 'EXPIRED',
            ageSeconds: Math.round(candidate.age),
            bytes: candidate.bytes,
        };
        if (dryRun) {
            report.wouldDelete += 1;
            report.bytesReclaimed += candidate.bytes;
            await record({ ...entry, result: 'would-delete' });
            continue;
        }
        try {
            // A single file, never a directory: the directory is what holds the metadata we keep.
            await fs.rm(path.join(root, candidate.relative), { force: true });
            report.deleted += 1;
            report.bytesReclaimed += candidate.bytes;
            await record({ ...entry, result: 'deleted' });
        } catch (err) {
            report.errors += 1;
            await record({ ...entry, result: 'error', error: err.message });
        }
    }

    report.finishedAt = new Date(now.getTime()).toISOString();
    return report;
}

/**
 * Expire staged inputs under `<stateDir>/inputs/`.
 *
 * @param {object} store  a Store
 * @returns {Promise<object>} a report; never throws for a single unusable entry
 */
export async function collectStagedInputs(store, {
    ttlSeconds = DEFAULT_INPUT_TTL_SECONDS,
    maxDeletions = DEFAULT_MAX_DELETIONS,
    dryRun = false,
    audit = null,
    auditKeeps = false,
    now = new Date(),
} = {}) {
    const root = inputsRoot(store);
    const report = {
        startedAt: now.toISOString(),
        dryRun,
        examined: 0,
        deleted: 0,
        wouldDelete: 0,
        kept: 0,
        preserved: 0,
        skipped: 0,
        errors: 0,
        bytesReclaimed: 0,
        remaining: 0,
        maxDeletions,
    };

    const record = async (entry) => {
        if (!audit) return;
        const routine = ROUTINE_RESULTS.has(entry.result) && ROUTINE_REASONS.has(entry.reason);
        if (routine && !auditKeeps) return;
        await audit({ ts: now.toISOString(), scope: 'inputs', ...entry }).catch?.(() => {});
    };

    const candidates = [];
    for (const entry of await readdirSafe(root, true)) {
        if (!INPUT_ID.test(entry.name)) {
            // A scratch directory from an upload still in flight, or anything else. Not ours to judge.
            report.preserved += 1;
            continue;
        }
        if (!entry.isDirectory()) {
            report.skipped += 1;
            await record({
                inputId: entry.name, result: 'skipped',
                reason: entry.isSymbolicLink() ? 'SYMLINK' : 'NOT_A_DIRECTORY',
            });
            continue;
        }
        report.examined += 1;
        const dir = path.join(root, entry.name);
        let stat;
        try { stat = await fs.lstat(dir); } catch { continue; }
        const age = (now.getTime() - stat.mtimeMs) / 1000;
        if (age <= ttlSeconds) {
            report.kept += 1;
            await record({
                inputId: entry.name, reason: 'WITHIN_TTL', result: 'kept',
                ageSeconds: Math.round(age),
            });
            continue;
        }
        candidates.push({ name: entry.name, dir, age });
    }

    candidates.sort((x, y) => y.age - x.age);

    for (const candidate of candidates) {
        if (report.deleted + report.wouldDelete >= maxDeletions) {
            report.remaining += 1;
            continue;
        }
        const real = await containedRealPath([root], candidate.dir);
        if (real !== path.join(await fs.realpath(root), candidate.name)) {
            report.skipped += 1;
            await record({ inputId: candidate.name, reason: 'ESCAPES_ROOT', result: 'skipped' });
            continue;
        }

        const bytes = await treeBytes(candidate.dir);
        const entry = {
            inputId: candidate.name,
            reason: 'EXPIRED',
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

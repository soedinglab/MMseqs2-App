// The only code here that deletes anything. Every test asserts both what went and what stayed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createArtifactStore, collectArtifacts, collectResultCache, fileAudit, Store } from '../src/index.js';

const HOUR = 3600 * 1000;
const id = n => String(n).repeat(64).slice(0, 64);

const tmpDir = () => fsp.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-gc-'));

/**
 * A store whose clock the test drives, over a root the test populates by hand. The clock starts at
 * real time because build scratch directories carry real mtimes — a fabricated "now" hours away from
 * the filesystem's would make a fresh scratch dir look stale.
 */
async function fixture({ now = new Date(), ttlSeconds = 7200 } = {}) {
    const stateDir = await tmpDir();
    const root = path.join(stateDir, 'artifacts');
    await fsp.mkdir(root, { recursive: true });
    const clock = { at: now };
    const store = createArtifactStore({ root, ttlSeconds, clock: () => clock.at });
    const lines = [];
    const make = (name, opts = {}) => artifact(root, name, { now: clock.at, ...opts });
    return { stateDir, root, store, clock, make, lines, audit: async e => { lines.push(e); } };
}

/** A READY artifact whose last access was `hoursAgo`. */
async function artifact(root, name, { hoursAgo = 0, ready = true, now = new Date(), files = 1 } = {}) {
    const dir = path.join(root, name);
    await fsp.mkdir(path.join(dir, 'search'), { recursive: true });
    for (let i = 0; i < files; i++) {
        await fsp.writeFile(path.join(dir, 'search', `db-${i}.rows.jsonl`), `${'{"x":1}\n'.repeat(64)}`);
    }
    await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ createdAt: new Date(now.getTime() - hoursAgo * HOUR).toISOString() }));
    await fsp.writeFile(path.join(dir, 'access.json'), JSON.stringify({ lastAccessedAt: new Date(now.getTime() - hoursAgo * HOUR).toISOString() }));
    if (ready) await fsp.writeFile(path.join(dir, 'READY'), '');
    return dir;
}

const exists = p => fs.existsSync(p);

test('an expired artifact goes, a fresh one stays, and both are audited', async () => {
    const { root, store, make, audit, lines } = await fixture();
    await make(id(1), { hoursAgo: 3 });
    await make(id(2), { hoursAgo: 1 });

    const report = await collectArtifacts(store, { audit });

    assert.equal(report.deleted, 1);
    assert.equal(report.kept, 1);
    assert.equal(exists(path.join(root, id(1))), false, 'three hours old, TTL is two');
    assert.equal(exists(path.join(root, id(2))), true);
    assert.ok(report.bytesReclaimed > 0);

    const deleted = lines.find(l => l.result === 'deleted');
    assert.equal(deleted.artifactId, id(1));
    assert.equal(deleted.reason, 'EXPIRED');
    assert.ok(deleted.bytes > 0 && deleted.ageSeconds >= 7200 && deleted.ts);

    // A routine keep is not written: a server sweeping every few minutes would otherwise append a
    // line per live artifact forever. An operator asking for detail gets them.
    assert.equal(lines.some(l => l.result === 'kept'), false);
    const verbose = [];
    await collectArtifacts(store, { audit: async e => { verbose.push(e); }, auditKeeps: true });
    assert.equal(verbose.find(l => l.result === 'kept').reason, 'WITHIN_TTL');
});

test('the TTL boundary is exact', async () => {
    const { root, store, make } = await fixture();
    await make(id(1), { hoursAgo: 2 });          // exactly at the TTL
    assert.equal((await collectArtifacts(store)).deleted, 0, 'age == ttl is not yet expired');
    assert.equal(exists(path.join(root, id(1))), true);
});

test('dry run deletes nothing and reports everything it would', async () => {
    const { root, store, make, audit, lines } = await fixture();
    await make(id(1), { hoursAgo: 5 });
    await make(id(2), { hoursAgo: 4 });

    const report = await collectArtifacts(store, { dryRun: true, audit });
    assert.equal(report.deleted, 0);
    assert.equal(report.wouldDelete, 2);
    assert.ok(report.bytesReclaimed > 0, 'it still reports what would be reclaimed');
    assert.equal(exists(path.join(root, id(1))), true);
    assert.equal(exists(path.join(root, id(2))), true);
    assert.equal(lines.filter(l => l.result === 'would-delete').length, 2);
});

test('the deletion bound stops the run and reports the remainder, oldest first', async () => {
    const { root, store, make } = await fixture();
    await make(id(1), { hoursAgo: 10 });
    await make(id(2), { hoursAgo: 5 });
    await make(id(3), { hoursAgo: 3 });

    const report = await collectArtifacts(store, { maxDeletions: 1 });
    assert.equal(report.deleted, 1);
    assert.equal(report.remaining, 2);
    assert.equal(exists(path.join(root, id(1))), false, 'the oldest goes first');
    assert.equal(exists(path.join(root, id(2))), true);
    assert.equal(exists(path.join(root, id(3))), true);
});

test('a symlink pointing out of the root is refused, and its target survives', async () => {
    const { root, store, stateDir, make, audit, lines } = await fixture();
    const outside = path.join(stateDir, 'precious');
    await fsp.mkdir(outside, { recursive: true });
    await fsp.writeFile(path.join(outside, 'keep.txt'), 'do not delete me');
    await fsp.symlink(outside, path.join(root, id(7)));

    const report = await collectArtifacts(store, { audit });

    assert.equal(report.deleted, 0);
    assert.equal(exists(path.join(outside, 'keep.txt')), true, 'the target must be untouched');
    assert.equal(fs.lstatSync(path.join(root, id(7))).isSymbolicLink(), true, 'and the link itself too');
    const verbose = [];
    await collectArtifacts(store, { audit: async e => { verbose.push(e); }, auditKeeps: true });
    assert.ok(verbose.some(l => l.artifactId === id(7)), 'the entry was examined and left alone');
});

test('a symlinked artifact that looks expired is still refused', async () => {
    const { root, store, stateDir, make, audit, lines } = await fixture();
    const outside = path.join(stateDir, 'elsewhere');
    await artifact(outside, 'real', { hoursAgo: 99 });
    await fsp.symlink(path.join(outside, 'real'), path.join(root, id(8)));

    const report = await collectArtifacts(store, { audit });
    assert.equal(report.deleted, 0);
    assert.equal(exists(path.join(outside, 'real', 'READY')), true);
    assert.equal(lines.find(l => l.artifactId === id(8)).reason, 'SYMLINK');
});

test('anything that is not an artifact id is skipped, never deleted', async () => {
    const { root, store, make, audit, lines } = await fixture();
    for (const name of ['not-an-id', 'A'.repeat(64), `${id(1)}x`, 'artifact-gc-audit.jsonl', '..hidden']) {
        await fsp.writeFile(path.join(root, name), 'x');
    }
    const report = await collectArtifacts(store, { audit });

    assert.equal(report.deleted, 0);
    assert.equal(report.skipped, 5);
    for (const line of lines) assert.equal(line.reason, 'UNRECOGNIZED_NAME');
    assert.equal(fs.readdirSync(root).length, 5, 'everything stayed');
});

test('stale build scratch is removed, a fresh one is left alone', async () => {
    const { root, store, make, clock } = await fixture();
    const stale = path.join(root, '.build-oldXYZ');
    const fresh = path.join(root, '.build-newXYZ');
    await fsp.mkdir(stale, { recursive: true });
    await fsp.mkdir(fresh, { recursive: true });
    const old = new Date(clock.at.getTime() - 2 * HOUR);
    await fsp.utimes(stale, old, old);

    const report = await collectArtifacts(store);
    assert.equal(report.deleted, 1);
    assert.equal(exists(stale), false);
    assert.equal(exists(fresh), true, 'a build in progress must not be swept out from under itself');
});

test('an artifact without READY is a failed build: kept while recent, removed once stale', async () => {
    const { root, store, make, clock } = await fixture();
    await make(id(1), { hoursAgo: 0, ready: false });
    assert.equal((await collectArtifacts(store)).deleted, 0, 'it may be mid-rename');

    clock.at = new Date(clock.at.getTime() + 2 * HOUR);
    const report = await collectArtifacts(store, { now: clock.at });
    assert.equal(report.deleted, 1);
    assert.equal(exists(path.join(root, id(1))), false);
});

test('an artifact being built right now is never collected', async () => {
    const { root, store, make, audit, lines } = await fixture();
    await make(id(1), { hoursAgo: 9 });

    let reportDuringBuild;
    await store.build(id(2), async (scratch) => {
        await fsp.writeFile(path.join(scratch, 'x.json'), '{}');
        // The GC runs while this build holds the id — the exact race the active set exists for.
        assert.equal(store.isActive(id(2)), true);
        reportDuringBuild = await collectArtifacts(store, { audit });
        return null;                                  // an invalid manifest: the build will fail
    }).catch(() => {});

    assert.equal(reportDuringBuild.deleted, 1, 'the unrelated expired artifact still goes');
    assert.equal(store.isActive(id(2)), false, 'and the flag is released either way');
    assert.equal(lines.some(l => l.reason === 'ACTIVE'), false, 'the scratch dir is not yet the artifact');
});

test('a failure to delete is audited and does not stop the run', async () => {
    const { root, store, make, audit, lines } = await fixture();
    await make(id(1), { hoursAgo: 9 });
    await make(id(2), { hoursAgo: 8 });

    const real = fsp.rm;
    let calls = 0;
    fsp.rm = async (...args) => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        return real(...args);
    };
    try {
        const report = await collectArtifacts(store, { audit });
        assert.equal(report.errors, 1);
        assert.equal(report.deleted, 1, 'the second candidate is still attempted');
        const failure = lines.find(l => l.result === 'error');
        assert.match(failure.error, /EACCES/);
    } finally {
        fsp.rm = real;
    }
});

test('the ticket cache, its results and its selections are untouched by a sweep', async () => {
    const { root, store, stateDir, make } = await fixture();
    const ticketDir = path.join(stateDir, 'tickets', 'T1', 'ab', 'T1abcdef');
    await fsp.mkdir(ticketDir, { recursive: true });
    const before = {};
    for (const [name, body] of Object.entries({
        'ticket.json': '{"id":"T1abcdef","lastStatus":"COMPLETE"}',
        'result-0.json': '{"results":[]}',
        'selections.json': '{"draft":{"name":"draft","ids":["0#1"]}}',
        'foldmason.json': '{"entries":[]}',
    })) {
        await fsp.writeFile(path.join(ticketDir, name), body);
        before[name] = body;
    }
    await make(id(1), { hoursAgo: 99 });

    const report = await collectArtifacts(store);
    assert.equal(report.deleted, 1);
    for (const [name, body] of Object.entries(before)) {
        assert.equal(fs.readFileSync(path.join(ticketDir, name), 'utf8'), body, `${name} must be byte-identical`);
    }
});

test('a missing artifact root is not an error', async () => {
    const stateDir = await tmpDir();
    const store = createArtifactStore({ root: path.join(stateDir, 'artifacts') });
    const report = await collectArtifacts(store);
    assert.equal(report.examined, 0);
    assert.equal(report.deleted, 0);
});

test('the audit log is a real file outside the artifact root', async () => {
    const { root, store, stateDir, make } = await fixture();
    await make(id(1), { hoursAgo: 9 });
    const logFile = path.join(stateDir, 'artifact-gc-audit.jsonl');

    await collectArtifacts(store, { audit: fileAudit(logFile) });

    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].result, 'deleted');
    assert.equal(path.dirname(logFile), stateDir, 'never inside the directory the GC walks');
});

test('the audit log rotates instead of growing without end', async () => {
    const { root, store, stateDir, make } = await fixture();
    const logFile = path.join(stateDir, 'artifact-gc-audit.jsonl');
    await fsp.writeFile(logFile, 'x'.repeat(1200));

    await make(id(1), { hoursAgo: 9 });
    await collectArtifacts(store, { audit: fileAudit(logFile, { maxBytes: 1024 }) });

    assert.equal(fs.existsSync(`${logFile}.1`), true, 'the old generation is kept, once');
    const current = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    assert.equal(current.length, 1, 'the live log starts again from the rotation');
    assert.equal(JSON.parse(current[0]).result, 'deleted');
});

test('a build streaming into one file is not mistaken for an abandoned one', async () => {
    const { root, store, clock } = await fixture();
    const scratch = path.join(root, '.build-slowXYZ');
    await fsp.mkdir(scratch, { recursive: true });
    const rows = path.join(scratch, 'rows.jsonl');
    await fsp.writeFile(rows, '{"a":1}\n');

    // Age the directory itself past the stale bound, as a long build would: appending to a file that
    // already exists does not move the directory's mtime.
    const old = new Date(clock.at.getTime() - 2 * HOUR);
    await fsp.utimes(scratch, old, old);
    await fsp.appendFile(rows, '{"b":2}\n');

    const report = await collectArtifacts(store);
    assert.equal(report.deleted, 0, 'the newest file inside it is what says whether it is alive');
    assert.equal(fs.existsSync(rows), true);

    // With nothing written for over the bound, it is genuinely abandoned.
    await fsp.utimes(rows, old, old);
    assert.equal((await collectArtifacts(store)).deleted, 1);
    assert.equal(fs.existsSync(scratch), false);
});

// -------------------------------------------------------------------------------------------------
// The result cache, which is walked rather than structurally out of reach — so every test here
// asserts what stayed as well as what went.
// -------------------------------------------------------------------------------------------------

/** A ticket directory holding the four kinds of file, each with a chosen age. */
async function ticketCache({ hoursAgo = 0, now = new Date(), id: ticket = 'ABcdEFgh12345678' } = {}) {
    const stateDir = await tmpDir();
    const store = new Store(stateDir);
    const dir = store.ticketDir(ticket);
    await fsp.mkdir(dir, { recursive: true });

    const at = new Date(now.getTime() - hoursAgo * HOUR);
    const payloads = ['result-0.json', 'result-12.json', 'foldmason.json', 'folddisco.json'];
    for (const name of payloads) {
        await fsp.writeFile(path.join(dir, name), JSON.stringify({ rows: [1, 2, 3] }));
        await fsp.utimes(path.join(dir, name), at, at);
    }
    await fsp.writeFile(path.join(dir, 'ticket.json'), JSON.stringify({ id: ticket, kind: 'search' }));
    await fsp.writeFile(path.join(dir, 'selections.json'), JSON.stringify({ keep: { ids: ['0#1'] } }));
    for (const name of ['ticket.json', 'selections.json']) {
        await fsp.utimes(path.join(dir, name), at, at);
    }

    const lines = [];
    return {
        stateDir, store, dir, ticket, payloads, lines,
        audit: async e => { lines.push(e); },
        bytes: name => fs.statSync(path.join(dir, name)).size,
        read: name => fs.readFileSync(path.join(dir, name), 'utf8'),
    };
}

test('an expired result payload goes and a fresh one stays', async () => {
    const now = new Date();
    const { store, dir, audit, lines } = await ticketCache({ hoursAgo: 25, now });
    const fresh = path.join(dir, 'result-1.json');
    await fsp.writeFile(fresh, '{}');

    const report = await collectResultCache(store, { now, audit });

    assert.equal(report.deleted, 4);
    assert.equal(report.kept, 1);
    assert.equal(exists(fresh), true);
    for (const name of ['result-0.json', 'result-12.json', 'foldmason.json', 'folddisco.json']) {
        assert.equal(exists(path.join(dir, name)), false, `${name} is 25 hours old, the TTL is 24`);
    }
    const deleted = lines.find(l => l.result === 'deleted');
    assert.equal(deleted.scope, 'results');
    assert.equal(deleted.reason, 'EXPIRED');
    assert.ok(deleted.bytes > 0 && deleted.ageSeconds >= 86400 && deleted.file && deleted.ticket);
});

test('ticket metadata and selections come out of a sweep byte-identical', async () => {
    const now = new Date();
    const { store, read } = await ticketCache({ hoursAgo: 400, now });
    const before = { ticket: read('ticket.json'), selections: read('selections.json') };

    const report = await collectResultCache(store, { now });

    assert.equal(report.deleted, 4, 'the payloads were removed, so the sweep did run');
    assert.equal(report.preserved, 2, 'and it saw the two files it may not touch');
    assert.equal(read('ticket.json'), before.ticket);
    assert.equal(read('selections.json'), before.selections);
});

test('a sweep never removes a directory, however empty it leaves it', async () => {
    const now = new Date();
    const { store, stateDir, dir } = await ticketCache({ hoursAgo: 400, now });
    for (const name of ['ticket.json', 'selections.json']) await fsp.rm(path.join(dir, name));

    await collectResultCache(store, { now });

    assert.deepEqual(fs.readdirSync(dir), [], 'every payload went');
    assert.equal(exists(dir), true, 'the directory itself stays: the layout is not ours to prune');
    assert.equal(exists(path.join(stateDir, 'tickets')), true);
});

test('a payload read inside the window survives the next sweep', async () => {
    const now = new Date();
    const { store, dir, ticket } = await ticketCache({ hoursAgo: 30, now });

    // Reading is what resets the clock: the TTL is since last use, not since fetch.
    assert.ok(await store.readResult(ticket, 'search', 0));

    const report = await collectResultCache(store, { now });
    assert.equal(exists(path.join(dir, 'result-0.json')), true, 'it was just used');
    assert.equal(report.kept, 1);
    assert.equal(report.deleted, 3, 'the ones nobody read still expired');
});

test('a dry run reports and deletes nothing', async () => {
    const now = new Date();
    const { store, dir, audit, lines } = await ticketCache({ hoursAgo: 400, now });

    const report = await collectResultCache(store, { now, dryRun: true, audit });

    assert.equal(report.deleted, 0);
    assert.equal(report.wouldDelete, 4);
    assert.ok(report.bytesReclaimed > 0);
    assert.equal(fs.readdirSync(dir).length, 6, 'nothing was removed');
    assert.equal(lines.every(l => l.result === 'would-delete'), true);
});

test('the result TTL is a threshold, and the sweep is bounded', async () => {
    // A second either side, rather than exactly on the boundary: an mtime comes from the filesystem,
    // whose timestamp precision is not ours to assert.
    const now = new Date();
    const { store, dir } = await ticketCache({ hoursAgo: 0, now });
    const at = seconds => new Date(now.getTime() - seconds * 1000);
    await fsp.utimes(path.join(dir, 'result-0.json'), at(86399), at(86399));
    await fsp.utimes(path.join(dir, 'result-12.json'), at(86401), at(86401));

    const report = await collectResultCache(store, { now });
    assert.equal(exists(path.join(dir, 'result-0.json')), true, 'a second inside the TTL stays');
    assert.equal(exists(path.join(dir, 'result-12.json')), false, 'a second outside it goes');
    assert.equal(report.deleted, 1);

    const many = await ticketCache({ hoursAgo: 400, now });
    const bounded = await collectResultCache(many.store, { now, maxDeletions: 2 });
    assert.equal(bounded.deleted, 2);
    assert.equal(bounded.remaining, 2);
});

test('a payload name that is a symlink or a directory is refused, not followed', async () => {
    const now = new Date();
    const { store, dir, audit, lines } = await ticketCache({ hoursAgo: 400, now });
    const outside = path.join(await tmpDir(), 'precious.json');
    await fsp.writeFile(outside, 'do not delete me');

    await fsp.rm(path.join(dir, 'result-0.json'));
    await fsp.symlink(outside, path.join(dir, 'result-0.json'));
    await fsp.rm(path.join(dir, 'foldmason.json'));
    await fsp.mkdir(path.join(dir, 'foldmason.json'));
    const old = new Date(now.getTime() - 400 * HOUR);
    await fsp.lutimes(path.join(dir, 'result-0.json'), old, old);
    await fsp.utimes(path.join(dir, 'foldmason.json'), old, old);

    const report = await collectResultCache(store, { now, audit });

    assert.equal(exists(outside), true, 'the symlink target is untouched');
    assert.equal(exists(path.join(dir, 'result-0.json')), true, 'and so is the link itself');
    assert.equal(exists(path.join(dir, 'foldmason.json')), true);
    assert.deepEqual(lines.filter(l => l.result === 'skipped').map(l => l.reason).sort(),
        ['NOT_A_FILE', 'SYMLINK']);
    assert.equal(report.deleted, 2, 'the two real expired payloads still went');
});

test('an empty state directory is not an error', async () => {
    const report = await collectResultCache(new Store(await tmpDir()));
    assert.deepEqual([report.examined, report.deleted, report.errors], [0, 0, 0]);
});

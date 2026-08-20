// Bytes pushed in over HTTP and referenced later by an id. What may be staged, and what may be read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    Store, stageInput, resolveStagedInput, collectStagedInputs, inputsRoot, INPUT_ID,
} from '../src/index.js';

const PDB = 'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C\n';

const store = async () => new Store(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-staged-')));

/** A body delivered in pieces, the way an http request arrives. */
async function* stream(text, pieces = 3) {
    const size = Math.ceil(text.length / pieces);
    for (let at = 0; at < text.length; at += size) yield Buffer.from(text.slice(at, at + size));
}

test('a staged input round trips, and the id is server-generated', async () => {
    const s = await store();
    const staged = await stageInput(PDB, { store: s, name: '1abc.cif' });

    assert.match(staged.inputId, INPUT_ID);
    assert.equal(staged.bytes, PDB.length);
    assert.equal(staged.name, '1abc.cif');
    assert.match(staged.contentSha256, /^[0-9a-f]{64}$/);

    const read = await resolveStagedInput(staged.inputId, { store: s });
    assert.equal(read.text, PDB);
    assert.equal(read.name, '1abc.cif');
    assert.equal(read.bytes, PDB.length);

    // Two of the same bytes are two inputs: independent ids, independent clocks.
    const again = await stageInput(PDB, { store: s, name: '1abc.cif' });
    assert.notEqual(again.inputId, staged.inputId);
    assert.equal(again.contentSha256, staged.contentSha256);
});

test('a streamed body is written whole', async () => {
    const s = await store();
    const text = PDB.repeat(50);
    const staged = await stageInput(stream(text), { store: s });
    assert.equal((await resolveStagedInput(staged.inputId, { store: s })).text, text);
    assert.equal(staged.bytes, text.length);
});

test('reading does not consume, and moves the clock', async () => {
    const s = await store();
    const staged = await stageInput(PDB, { store: s });
    const dir = path.join(inputsRoot(s), staged.inputId);
    const before = fs.statSync(dir).mtimeMs;

    // Two searches off one upload is the normal shape of the work.
    const later = new Date(Date.now() + 5000);
    assert.ok(await resolveStagedInput(staged.inputId, { store: s, now: later }));
    assert.ok(await resolveStagedInput(staged.inputId, { store: s, now: later }));
    assert.ok(fs.statSync(dir).mtimeMs > before, 'the ttl runs from last use');
});

test('an expired input is refused before any collector has run', async () => {
    const s = await store();
    const staged = await stageInput(PDB, { store: s });
    assert.ok(fs.existsSync(path.join(inputsRoot(s), staged.inputId)), 'still on disk');

    await assert.rejects(
        () => resolveStagedInput(staged.inputId, { store: s, ttlSeconds: 60,
            now: new Date(Date.now() + 61_000) }),
        err => err.code === 'INPUT_ID_UNKNOWN');
});

test('an id that is not one, or names nothing, is one indistinguishable refusal', async () => {
    const s = await store();
    for (const id of ['in_0123456789abcdef', 'nope', '', '../etc', 'in_XYZ', 'in_0123456789abcde',
        null, 42, 'in_0123456789abcdef/../..']) {
        await assert.rejects(() => resolveStagedInput(id, { store: s }),
            err => err.code === 'INPUT_ID_UNKNOWN', JSON.stringify(id));
    }
});

test('a symlink where an input directory should be is refused, not followed', async () => {
    const s = await store();
    const staged = await stageInput(PDB, { store: s });
    const dir = path.join(inputsRoot(s), staged.inputId);

    const elsewhere = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-out-'));
    await fsp.writeFile(path.join(elsewhere, 'body'), 'ATOM SOMEONE ELSE\n');
    await fsp.writeFile(path.join(elsewhere, 'meta.json'),
        JSON.stringify({ inputId: staged.inputId, name: 'x', bytes: 1 }));
    await fsp.rm(dir, { recursive: true });
    await fsp.symlink(elsewhere, dir);

    await assert.rejects(() => resolveStagedInput(staged.inputId, { store: s }),
        err => err.code === 'INPUT_ID_UNKNOWN');
});

test('a name is an entry name, never a path', async () => {
    const s = await store();
    for (const [given, expected] of [
        ['../../etc/passwd', 'passwd'],
        ['/absolute/1abc.cif', '1abc.cif'],
        ['C:\\win\\1abc.cif', '1abc.cif'],
        ['..', 'query'],
        ['', 'query'],
        ['has space.cif', 'query'],
        ['1abc.cif', '1abc.cif'],
    ]) {
        const staged = await stageInput(PDB, { store: s, name: given });
        assert.equal(staged.name, expected, given);
        // Whatever was asked for, the directory is the id and nothing else.
        assert.deepEqual(fs.readdirSync(path.join(inputsRoot(s), staged.inputId)).sort(),
            ['body', 'meta.json']);
    }
    assert.deepEqual(fs.readdirSync(inputsRoot(s)).filter(n => !INPUT_ID.test(n)), [],
        'nothing outside the id convention was created');
});

test('the size cap and the quota each refuse, and leave nothing behind', async () => {
    const s = await store();
    const big = PDB.repeat(100);

    await assert.rejects(() => stageInput(stream(big), { store: s, maxBytes: 100 }),
        err => err.code === 'INPUT_TOO_LARGE');
    assert.deepEqual(fs.readdirSync(inputsRoot(s)), [], 'no scratch directory survived');

    await assert.rejects(() => stageInput(big, { store: s, quotaBytes: 50 }),
        err => err.code === 'INPUT_QUOTA_EXCEEDED');
    assert.deepEqual(fs.readdirSync(inputsRoot(s)), []);

    // A quota already met refuses before reading a body at all.
    const s2 = await store();
    await stageInput(big, { store: s2 });
    await assert.rejects(() => stageInput(PDB, { store: s2, quotaBytes: 100 }),
        err => err.code === 'INPUT_QUOTA_EXCEEDED' && /already staged/.test(err.message));
    assert.equal(fs.readdirSync(inputsRoot(s2)).length, 1, 'the existing input is untouched');
});

test('an empty body is not an input', async () => {
    const s = await store();
    await assert.rejects(() => stageInput('', { store: s }), err => err.code === 'INVALID_INPUT');
    assert.deepEqual(fs.readdirSync(inputsRoot(s)), []);
});

test('a half-written input is not readable', async () => {
    const s = await store();
    const root = inputsRoot(s);
    await fsp.mkdir(root, { recursive: true });

    // What a crash mid-upload leaves: a scratch directory, which is not an id.
    const scratch = path.join(root, '.staging-0123456789abcdef');
    await fsp.mkdir(scratch);
    await fsp.writeFile(path.join(scratch, 'body'), PDB);

    await assert.rejects(() => resolveStagedInput('in_0123456789abcdef', { store: s }),
        err => err.code === 'INPUT_ID_UNKNOWN');

    // And an id directory missing its metadata is not readable either.
    const partial = path.join(root, 'in_aaaaaaaaaaaaaaaa');
    await fsp.mkdir(partial);
    await fsp.writeFile(path.join(partial, 'body'), PDB);
    await assert.rejects(() => resolveStagedInput('in_aaaaaaaaaaaaaaaa', { store: s }),
        err => err.code === 'INPUT_ID_UNKNOWN');
});

// --- expiry: the only copy of those bytes, so only expiry removes one ---------------------------

test('an expired input is collected and a fresh one is not', async () => {
    const s = await store();
    const now = new Date();
    const old = await stageInput(PDB, { store: s, name: 'old.cif' });
    const fresh = await stageInput(PDB, { store: s, name: 'fresh.cif' });

    const past = new Date(now.getTime() - 2 * 3600 * 1000);
    await fsp.utimes(path.join(inputsRoot(s), old.inputId), past, past);

    const lines = [];
    const report = await collectStagedInputs(s, { now, audit: async e => { lines.push(e); } });

    assert.equal(report.deleted, 1);
    assert.equal(report.kept, 1);
    assert.equal(fs.existsSync(path.join(inputsRoot(s), old.inputId)), false);
    assert.equal(fs.existsSync(path.join(inputsRoot(s), fresh.inputId)), true);
    assert.ok(report.bytesReclaimed > 0);

    const deleted = lines.find(l => l.result === 'deleted');
    assert.equal(deleted.scope, 'inputs');
    assert.equal(deleted.reason, 'EXPIRED');
    assert.equal(deleted.inputId, old.inputId);
});

test('a read inside the window saves an input from the next sweep', async () => {
    const s = await store();
    const now = new Date();
    const staged = await stageInput(PDB, { store: s });

    // 90 minutes: past the collector's 1h default, comfortably inside the 2h the read allows. Not on
    // either boundary — an mtime comes from the filesystem, whose precision is not ours to assert.
    const past = new Date(now.getTime() - 90 * 60 * 1000);
    await fsp.utimes(path.join(inputsRoot(s), staged.inputId), past, past);

    // Using it is what keeps it: the TTL is since last use, and the read moved it to now.
    assert.ok(await resolveStagedInput(staged.inputId, { store: s, ttlSeconds: 7200, now }));
    assert.equal((await collectStagedInputs(s, { now })).deleted, 0,
        'without the read this would have been collected');
    assert.equal(fs.existsSync(path.join(inputsRoot(s), staged.inputId)), true);
});

test('a sweep touches nothing that is not an in_ directory', async () => {
    const s = await store();
    const now = new Date();
    const root = inputsRoot(s);
    const staged = await stageInput(PDB, { store: s });
    const past = new Date(now.getTime() - 2 * 3600 * 1000);

    // An upload in flight, and a name that matches the pattern but is not a directory.
    const scratch = path.join(root, '.staging-ffffffffffffffff');
    await fsp.mkdir(scratch);
    await fsp.writeFile(path.join(scratch, 'body'), PDB);
    await fsp.writeFile(path.join(root, 'in_1111111111111111'), 'not a directory');
    const outside = path.join(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-out-')), 'keep');
    await fsp.writeFile(outside, 'precious');
    await fsp.symlink(path.dirname(outside), path.join(root, 'in_2222222222222222'));
    for (const n of [scratch, path.join(root, 'in_1111111111111111'), path.join(root, staged.inputId)]) {
        await fsp.utimes(n, past, past);
    }
    await fsp.lutimes(path.join(root, 'in_2222222222222222'), past, past);

    const lines = [];
    const report = await collectStagedInputs(s, { now, audit: async e => { lines.push(e); } });

    assert.equal(report.deleted, 1, 'only the real expired input');
    assert.equal(report.preserved, 1, 'the scratch directory was left alone');
    assert.deepEqual(lines.filter(l => l.result === 'skipped').map(l => l.reason).sort(),
        ['NOT_A_DIRECTORY', 'SYMLINK']);
    assert.equal(fs.existsSync(scratch), true);
    assert.equal(fs.existsSync(outside), true, 'the symlink target is untouched');
    assert.equal(fs.existsSync(path.join(root, 'in_2222222222222222')), true);
});

test('a dry run reports and deletes nothing, and the sweep is bounded', async () => {
    const s = await store();
    const now = new Date();
    const past = new Date(now.getTime() - 2 * 3600 * 1000);
    for (let i = 0; i < 3; i++) {
        const staged = await stageInput(PDB, { store: s });
        await fsp.utimes(path.join(inputsRoot(s), staged.inputId), past, past);
    }

    const dry = await collectStagedInputs(s, { now, dryRun: true });
    assert.equal(dry.deleted, 0);
    assert.equal(dry.wouldDelete, 3);
    assert.equal(fs.readdirSync(inputsRoot(s)).length, 3);

    const bounded = await collectStagedInputs(s, { now, maxDeletions: 2 });
    assert.equal(bounded.deleted, 2);
    assert.equal(bounded.remaining, 1);
});

test('an absent inputs directory is not an error', async () => {
    const report = await collectStagedInputs(await store());
    assert.deepEqual([report.examined, report.deleted, report.errors], [0, 0, 0]);
});

// --- a host that cannot expand a config placeholder must not create an allowlist ------------------

test('an unexpanded placeholder or a relative path is not an allowlist entry', async () => {
    const { parseInputDirs, parseUrlHosts } = await import('../src/index.js');

    // What Claude Desktop hands over when a user_config key has no value.
    for (const junk of ['${user_config.input_dirs}', '[]', 'relative/dir', '.', '..', '']) {
        assert.deepEqual(parseInputDirs(junk), [], junk);
    }
    assert.deepEqual(parseInputDirs(`/data${path.delimiter}\${user_config.x}${path.delimiter}rel`),
        ['/data'], 'the good entry survives and the rest do not');

    for (const junk of ['${user_config.url_hosts}', '[]', 'has space', '', ',,']) {
        assert.deepEqual(parseUrlHosts(junk), [], junk);
    }
    assert.deepEqual(parseUrlHosts('Files.Lab.test, ${user_config.x} ,alphafold.ebi.ac.uk'),
        ['files.lab.test', 'alphafold.ebi.ac.uk']);
});

// --- a relative queryPath, so neither side hardcodes the other's absolute prefix ------------------

test('a path relative to an allowed directory resolves, whatever the caller calls it', async () => {
    const { resolveInputPath } = await import('../src/index.js');
    const a = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-roota-'));
    const b = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-rootb-'));
    await fsp.mkdir(path.join(b, 'nested'), { recursive: true });
    await fsp.writeFile(path.join(b, 'nested', 'q.cif'), PDB);

    // The caller names it relatively; the server finds it under the second root without either side
    // knowing the other's absolute prefix — the sandbox case in one line.
    const found = await resolveInputPath('nested/q.cif', { inputDirs: [a, b] });
    assert.equal(found.path, path.join(b, 'nested', 'q.cif'));
    assert.equal(found.name, 'q.cif');
    assert.equal(found.text, PDB);

    // Absolute still works, and containment still holds for both forms.
    assert.equal((await resolveInputPath(path.join(b, 'nested', 'q.cif'), { inputDirs: [a, b] })).text, PDB);
    for (const bad of ['../escape.cif', 'nested/../../escape.cif', 'missing.cif']) {
        await assert.rejects(() => resolveInputPath(bad, { inputDirs: [a, b] }),
            err => err.code === 'INPUT_PATH_REFUSED', bad);
    }

    // A relative path cannot reach a sibling of a root, even one that exists.
    await fsp.writeFile(path.join(path.dirname(b), 'outside.cif'), PDB);
    await assert.rejects(() => resolveInputPath('../outside.cif', { inputDirs: [b] }),
        err => err.code === 'INPUT_PATH_REFUSED');
});

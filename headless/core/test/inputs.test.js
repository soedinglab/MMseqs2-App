// Reading a query from a local file: what the allowlist accepts, and how a ref resolves against it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PDB = 'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C\n';

// --- a host that cannot expand a config placeholder must not create an allowlist ------------------

test('an unexpanded placeholder or a relative path is not an allowlist entry', async () => {
    const { parseInputDirs } = await import('../src/index.js');

    // What Claude Desktop hands over when a user_config key has no value.
    for (const junk of ['${user_config.input_dirs}', '[]', 'relative/dir', '.', '..', '']) {
        assert.deepEqual(parseInputDirs(junk), [], junk);
    }
    assert.deepEqual(parseInputDirs(`/data${path.delimiter}\${user_config.x}${path.delimiter}rel`),
        ['/data'], 'the good entry survives and the rest do not');

});

// --- a relative queryRef, so neither side hardcodes the other's absolute prefix ------------------

test('a path relative to an allowed directory resolves, whatever the caller calls it', async () => {
    const { resolveInputPath } = await import('../src/index.js');
    // realpath, because the resolver returns one and macOS /var is a symlink to /private/var.
    const a = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-roota-')));
    const b = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-rootb-')));
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

// --- the shared workspace: derived, claimed, and swept on its own clock --------------------------

test('both halves are derived from one directory', async () => {
    const { sharedPaths, ensureSharedDirs, DROP_MARKER } = await import('../src/index.js');
    const shared = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-shared-'));

    assert.deepEqual(sharedPaths('/a/b'),
        { exportsDir: path.join('/a/b', 'exports'), importsDir: path.join('/a/b', 'imports') });

    const { exportsDir, importsDir } = await ensureSharedDirs(shared);
    assert.equal((await fsp.stat(exportsDir)).isDirectory(), true);
    assert.equal((await fsp.stat(importsDir)).isDirectory(), true);
    assert.equal((await fsp.stat(path.join(importsDir, DROP_MARKER))).isFile(), true,
        'the marker is what makes the sweep safe, so it is written up front');
});

test('an unclaimed directory is refused, examined and audited nothing', async () => {
    const { collectDroppedInputs } = await import('../src/index.js');
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-notours-'));
    await fsp.writeFile(path.join(dir, 'somebody.cif'), PDB);
    const seen = [];

    const report = await collectDroppedInputs(dir, { ttlSeconds: 0, audit: e => seen.push(e) });
    assert.equal(report.refused, 'NOT_A_DROP_DIRECTORY');
    assert.equal(report.examined, 0);
    assert.deepEqual(seen, []);
    assert.equal(await fsp.readFile(path.join(dir, 'somebody.cif'), 'utf8'), PDB, 'and nothing went');
});

test('an aged drop goes, a fresh one stays, and the marker is never a candidate', async () => {
    const { ensureSharedDirs, collectDroppedInputs, DROP_MARKER } = await import('../src/index.js');
    const shared = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-shared-'));
    const { importsDir } = await ensureSharedDirs(shared);

    const old = path.join(importsDir, 'stale.cif');
    const fresh = path.join(importsDir, 'live.cif');
    await fsp.writeFile(old, PDB);
    await fsp.writeFile(fresh, PDB);
    // 90 minutes against a 1 h TTL, so neither side sits on the boundary: mtime precision is the
    // filesystem's, not ours.
    const then = new Date(Date.now() - 90 * 60 * 1000);
    await fsp.utimes(old, then, then);

    const report = await collectDroppedInputs(importsDir, { ttlSeconds: 3600 });
    assert.equal(report.deleted, 1);
    assert.equal(report.kept, 1);
    assert.equal(report.preserved, 1, 'the marker');
    assert.ok(report.bytesReclaimed >= PDB.length);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(fresh), true);
    assert.equal(fs.existsSync(path.join(importsDir, DROP_MARKER)), true);
    assert.equal(fs.existsSync(path.join(shared, 'exports')), true, 'the other half is untouched');
});

test('a dry run reports without deleting, and a symlink is skipped rather than followed', async () => {
    const { ensureSharedDirs, collectDroppedInputs } = await import('../src/index.js');
    const shared = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-shared-'));
    const { importsDir } = await ensureSharedDirs(shared);
    const outside = path.join(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-out-')), 'keep.cif');
    await fsp.writeFile(outside, PDB);

    const dropped = path.join(importsDir, 'stale.cif');
    await fsp.writeFile(dropped, PDB);
    await fsp.symlink(outside, path.join(importsDir, 'link.cif'));
    const then = new Date(Date.now() - 90 * 60 * 1000);
    await fsp.utimes(dropped, then, then);

    const dry = await collectDroppedInputs(importsDir, { ttlSeconds: 3600, dryRun: true });
    assert.equal(dry.wouldDelete, 1);
    assert.equal(dry.deleted, 0);
    assert.equal(dry.skipped, 1, 'the symlink');
    assert.equal(fs.existsSync(dropped), true);

    await collectDroppedInputs(importsDir, { ttlSeconds: 3600 });
    assert.equal(fs.existsSync(dropped), false);
    assert.equal(fs.existsSync(outside), true, 'a link out of the directory is not a way out of it');
});

test('the two halves expire on their own clocks, and without a shared folder neither runs', async () => {
    const { createClient, ensureSharedDirs } = await import('../src/index.js');
    const stateDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-state-'));
    const shared = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-shared-'));
    const { importsDir } = await ensureSharedDirs(shared);

    const dropped = path.join(importsDir, 'q.cif');
    await fsp.writeFile(dropped, PDB);
    const then = new Date(Date.now() - 45 * 60 * 1000);
    await fsp.utimes(dropped, then, then);

    const client = createClient({ baseUrl: 'https://example.test', stateDir, sharedDir: shared });
    const report = await client.collectGarbage();
    assert.deepEqual(Object.keys(report), ['artifacts', 'results', 'inputs']);
    // Past the 30 min artifact TTL, inside the 1 h input one: derived data expires fast, a file
    // somebody put there does not.
    assert.equal(report.inputs.kept, 1);
    assert.equal(fs.existsSync(dropped), true);

    const plain = createClient({
        baseUrl: 'https://example.test',
        stateDir: await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-state-')),
    });
    assert.deepEqual((await plain.collectGarbage()).inputs, { skipped: 'NO_SHARED_DIR' });
});

test('a name in two roots resolves in the first, and the refusal stays bounded', async () => {
    const { resolveInputPath, LISTED_NAMES } = await import('../src/index.js');
    const first = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-r1-')));
    const second = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-r2-')));
    await fsp.writeFile(path.join(first, 'q.cif'), PDB);
    await fsp.writeFile(path.join(second, 'q.cif'), `${PDB}ATOM      2\n`);

    const found = await resolveInputPath('q.cif', { inputDirs: [first, second] });
    assert.equal(found.root, first, 'first root wins, and says so');
    assert.equal(found.text, PDB);

    // A large directory must not turn one refusal into a large reply.
    for (let i = 0; i < LISTED_NAMES * 6; i += 1) {
        await fsp.writeFile(path.join(second, `f${i}.cif`), '');
    }
    const refused = await resolveInputPath('nope.cif', { inputDirs: [second] }).catch(err => err);
    assert.equal(refused.code, 'INPUT_PATH_REFUSED');
    assert.match(refused.message, /\(121 entries\)/);
    assert.ok(refused.message.length < 1024, `refusal is ${refused.message.length} bytes`);
    assert.equal(refused.message.split(', ').length, LISTED_NAMES, 'exactly the cap, then a count');
});

test('reading a dropped file postpones its expiry, and a library file is left alone', async () => {
    const { resolveInputPath, ensureSharedDirs, collectDroppedInputs } = await import('../src/index.js');
    const shared = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-shared-')));
    const { importsDir } = await ensureSharedDirs(shared);
    const library = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-lib-')));

    const dropped = path.join(importsDir, 'q.cif');
    const curated = path.join(library, 'ref.cif');
    await fsp.writeFile(dropped, PDB);
    await fsp.writeFile(curated, PDB);
    const then = new Date(Date.now() - 90 * 60 * 1000);
    await fsp.utimes(dropped, then, then);
    await fsp.utimes(curated, then, then);

    const roots = { inputDirs: [importsDir, library], touchDirs: [importsDir] };
    await resolveInputPath('q.cif', roots);
    await resolveInputPath('ref.cif', roots);

    // A file still being searched cannot expire mid-workflow, so the read moved its clock.
    const swept = await collectDroppedInputs(importsDir, { ttlSeconds: 3600 });
    assert.equal(swept.kept, 1);
    assert.equal(fs.existsSync(dropped), true);
    // The library is not ours to write to, so its mtime is where it was.
    assert.equal(Math.round((await fsp.stat(curated)).mtimeMs), Math.round(then.getTime()));
});

test('a directory that was already there is not claimed, so its files are never swept', async () => {
    const { ensureSharedDirs, collectDroppedInputs, DROP_MARKER } = await import('../src/index.js');
    const shared = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-occupied-'));
    const importsDir = path.join(shared, 'imports');
    await fsp.mkdir(importsDir, { recursive: true });
    const theirs = path.join(importsDir, 'thesis.tex');
    await fsp.writeFile(theirs, 'x');
    const then = new Date(Date.now() - 90 * 60 * 1000);
    await fsp.utimes(theirs, then, then);

    // Being inside imports/ is enough to be swept, so the claim is what has to be earned.
    const refused = await ensureSharedDirs(shared).catch(err => err);
    assert.equal(refused.code, 'SHARED_DIR_OCCUPIED');
    assert.match(refused.message, /1 entry/);
    assert.equal(fs.existsSync(path.join(importsDir, DROP_MARKER)), false, 'unclaimed');

    const swept = await collectDroppedInputs(importsDir, { ttlSeconds: 3600 });
    assert.equal(swept.refused, 'NOT_A_DROP_DIRECTORY');
    assert.equal(fs.existsSync(theirs), true);

    // Ours already, so a restart re-claims it without complaint.
    await fsp.rm(theirs);
    await ensureSharedDirs(shared);
    await ensureSharedDirs(shared);
    assert.equal(fs.existsSync(path.join(importsDir, DROP_MARKER)), true);
});

// --- the declared ranking must be the order the file is in ---------------------------------------

test('live: ranking.field is the field the exported rows are actually sorted by',
    { skip: process.env.FOLDSEEK_SERVER_LIVE_TESTS !== '1' }, async () => {
        const { createClient } = await import('../src/index.js');
        const shared = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-rank-'));
        const state = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-rank-st-'));

        // One ticket per mode. tmalign is the case that was wrong: the file is ordered by `eval`,
        // which holds a TM-score there, while the frontend's table defaults to `score`.
        const cases = [
            ['https://search.foldseek.com', 'zXdtIy4ZBaW9CmHXTKyfeMdLSDBOlvftku3N5g'],
            ['https://search.foldseek.com', 'yLD2rYR4rmA9tZJJSYTMmicsGxn_GZGTPqk9-Q'],
            ['https://search-dev.foldseek.com', 'IiM6hkv4AFhNjwMpLsTCU7toi1rtmUWuKnG8Cg'],
            ['https://search-dev.foldseek.com', 'Em2-GqHdTPHD14Kt1w29H-WVJV_ihngbZCfj1A'],
        ];
        for (const [baseUrl, ticket] of cases) {
            const client = createClient({ baseUrl, sharedDir: shared, stateDir: state });
            const out = await client.exportResult(ticket);
            const manifest = JSON.parse(
                await fsp.readFile(path.join(out.artifactRoot, 'manifest.json'), 'utf8'));
            const { field, direction } = manifest.ranking;

            const rowFile = manifest.files.find(f => f.role === 'rows');
            const lines = (await fsp.readFile(path.join(out.artifactRoot, rowFile.path), 'utf8'))
                .trim().split('\n').map(l => JSON.parse(l));
            const values = lines.map(r => r[field]).filter(v => typeof v === 'number');
            assert.ok(values.length > 1, `${ticket}: ${field} is not numeric in the rows`);

            const ordered = values.every((v, i) => (i === 0 ? true
                : (direction === 'higher' ? values[i - 1] >= v : values[i - 1] <= v)));
            assert.ok(ordered,
                `${manifest.state.tool}/${manifest.state.mode}: rows are not ${direction}-first `
                + `in ${field}, so ranking describes a sort the file does not have`);
        }
    });

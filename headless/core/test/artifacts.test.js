// The file artifact: what it contains for each job type, and every way a directory can fail to be a
// cache hit. The clock is injected, so nothing here sleeps.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { createClient, artifactCacheKey, serverNamespaceFor, validateArtifactManifest } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

const CATALOG = [{ path: 'bfmd', name: 'BFMD', version: '1.0', status: 'COMPLETE', taxonomy: true }];

const FOLDMASON = {
    entries: [
        { name: '1abc_AB-_-_-_A_3_0-B_6_3', aa: 'MAC-MAC', ss: 'DDDDDDD', ca: '1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6' },
        { name: 'AF-P00001-F1-model_v4', aa: 'MACWMAC', ss: 'DDDDDDD', ca: '1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7' },
    ],
    scores: [0.9, 0.8, -1, 0.7, 0.6, 0.5, 0.4],
    statistics: { msaLDDT: 0.72 },
    tree: '(1abc,AF-P00001);',
};

const tmpDir = () => fsp.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-artifact-'));

/** A client whose network answers from fixtures, with a clock the test drives. */
async function makeClient({ type = 'structuresearch', result = null, now = new Date('2026-08-18T00:00:00Z'),
    baseUrl = 'https://example.test', stateDir = null } = {}) {
    const clock = { at: now };
    const fetched = [];
    const fetchImpl = async (url) => {
        fetched.push(url);
        const body = url.includes('/ticket/type/') ? { type }
            : url.includes('/databases') ? CATALOG
                : url.includes('/result/foldmason/') ? FOLDMASON
                    : url.includes('/result/') ? result
                        : { id: 'T1', status: 'COMPLETE' };
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    };
    const client = createClient({
        baseUrl,
        stateDir: stateDir ?? await tmpDir(),
        fetchImpl,
        artifacts: { clock: () => clock.at },
    });
    return { client, clock, fetched };
}

const roles = descriptor => descriptor.files.map(f => f.role).sort();
const fileOf = (descriptor, role) => descriptor.files.find(f => f.role === role);
const readFile = (descriptor, role) =>
    fs.readFileSync(path.join(path.dirname(descriptor.localPath), fileOf(descriptor, role).path), 'utf8');

test('a foldseek export writes rows, taxonomy and a database map, with counts that agree', async () => {
    const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json') });
    const out = await client.exportResult('T1abcd');

    assert.equal(out.schema, 'mmseqs2-agent/result-artifact@1');
    assert.equal(out.cacheHit, false);
    assert.match(out.artifactId, /^[0-9a-f]{64}$/);
    assert.deepEqual(roles(out), ['databases', 'rows', 'taxonomy']);

    const rows = fileOf(out, 'rows');
    assert.equal(rows.path, 'search/db-4.rows.jsonl', 'only the database with hits gets a file');
    assert.equal(rows.rows, 150);
    assert.equal(out.counts.parsedRows, 150);
    assert.equal(out.counts.exportedRows, 150);

    const lines = readFile(out, 'rows').trim().split('\n');
    assert.equal(lines.length, 150);
    const first = JSON.parse(lines[0]);
    assert.equal(typeof first.eval, 'number', 'metrics are numbers, not display strings');
    assert.equal(first.id, `4#${first.groupId}`);
    assert.equal(first.href, undefined);

    const taxonomy = JSON.parse(readFile(out, 'taxonomy'));
    assert.equal(taxonomy.nodes.length, 53, 'every node, not a capped listing');
    assert.equal(taxonomy.nodes[0].parentTaxId, null);
    assert.deepEqual(out.integrityIssues, []);
});

test('a folddisco export adds motif patterns and records saturation', async () => {
    const { client } = await makeClient({ type: 'folddisco', result: load('folddisco-pdb.raw.json') });
    const out = await client.exportResult('T2abcd');

    assert.deepEqual(roles(out), ['databases', 'motif-patterns', 'rows']);
    assert.equal(out.resultKind, 'folddisco');
    assert.equal(fileOf(out, 'rows').rows, 1000);
    assert.deepEqual(out.completeness,
        { complete: false, saturated: true, capSource: 'worker-fixed', rowCap: 1000 });

    const patterns = JSON.parse(readFile(out, 'motif-patterns'));
    assert.equal(patterns.patterns.reduce((a, p) => a + p.hits, 0), 1000, 'every hit is accounted for');

    const row = JSON.parse(readFile(out, 'rows').split('\n')[0]);
    assert.equal(typeof row.idfscore, 'number');
    assert.equal(typeof row.motifPattern, 'string');
});

test('a foldmason export writes the roster, both fastas, columns, the map, coordinates and the tree', async () => {
    const { client } = await makeClient({ type: 'foldmasoneasymsa' });
    const out = await client.exportResult('T3abcd');

    assert.deepEqual(roles(out), [
        'msa-columns', 'msa-coordinates', 'msa-entries', 'msa-fasta-3di', 'msa-fasta-aa',
        'msa-residue-map', 'msa-tree',
    ]);
    assert.equal(out.completeness.complete, true);

    assert.equal(fileOf(out, 'msa-columns').rows, 7, 'every column of the alignment');
    const columns = readFile(out, 'msa-columns').trim().split('\n').map(JSON.parse);
    assert.equal(columns[0].lddt, 0.9);
    assert.equal(columns[2].lddt, null, '-1 is absence, exported as null');
    assert.ok(columns[0].consensus.letters.length > 0, 'composition travels with the column');

    const maps = readFile(out, 'msa-residue-map').trim().split('\n').map(JSON.parse);
    assert.equal(maps.length, 2);
    assert.deepEqual(maps[0].tokens, ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    assert.deepEqual(maps[0].occupiedColumns, ['0-2', '4-6']);
    assert.deepEqual(maps[0].gaps, ['3'], 'the gap is stated, so columns can be mapped offline');

    const gz = fileOf(out, 'msa-coordinates');
    const raw = zlib.gunzipSync(fs.readFileSync(
        path.join(path.dirname(out.localPath), gz.path))).toString('utf8');
    assert.equal(Buffer.byteLength(raw), gz.uncompressedBytes);
    assert.equal(JSON.parse(raw).entries.length, 2);

    assert.match(readFile(out, 'msa-fasta-aa'), /^>1abc/);
    assert.equal(JSON.parse(readFile(out, 'msa-tree')).newick, '(1abc,AF-P00001);');
});

test('a complex export keeps chain-level facts and reports the grouping', async () => {
    const chain = (target, complexid) => ({
        target, complexid, query: 'q', eval: 1e-4, prob: 0.9, score: 100, seqId: 0.5,
        complexqtm: 0.8, complexttm: 0.7, qLen: 10, dbLen: 10,
    });
    const { client } = await makeClient({
        type: 'complexsearch',
        result: {
            // mode has no "complex-" prefix: server.go strips it before the job is built
        type: 'complexsearch', mode: '3diaa', queries: [{ header: 'q', sequence: 'AAAA' }],
            results: [{ db: 'pdb100', alignments: [[chain('1abc_A', 7), chain('1abc_B', 7), chain('2xyz_A', 9)]] }],
        },
    });
    const out = await client.exportResult('T4abcd');

    assert.equal(out.resultKind, 'complexsearch');
    assert.equal(out.counts.serverAlignments, 3);
    assert.equal(out.counts.parsedRows, 2);
    assert.equal(out.counts.grouping, 'complexid');

    const rows = readFile(out, 'rows').trim().split('\n').map(JSON.parse);
    const grouped = rows.find(r => r.chainCount === 2);
    assert.deepEqual(grouped.chains.map(c => c.target), ['1abc_A', '1abc_B']);
});

test('the cache key separates servers, entries and schema versions', () => {
    const key = (over = {}) => artifactCacheKey({
        serverNamespace: 'https://a.test/api', ticketId: 'T1', normalizedEntry: 0, ...over,
    });
    const ids = new Set([
        key(),
        key({ serverNamespace: 'https://b.test/api' }),
        key({ normalizedEntry: 1 }),
        key({ ticketId: 'T2' }),
    ]);
    assert.equal(ids.size, 4, 'each component must move the key');
    assert.equal(key(), key(), 'and the same inputs must give the same key');

    // The separator is what stops ("T1", 11) and ("T11", 1) colliding.
    assert.notEqual(key({ ticketId: 'T1', normalizedEntry: 11 }),
        key({ ticketId: 'T11', normalizedEntry: 1 }));

    assert.equal(serverNamespaceFor({ baseUrl: 'https://Example.TEST/', apiPath: '/api/' }),
        'https://example.test/api');
});

test('a second export is a hit that rebuilds nothing and moves the access time', async () => {
    const stateDir = await tmpDir();
    const { client, clock } = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });

    const first = await client.exportResult('T1abcd');
    assert.equal(first.cacheHit, false);
    const built = fs.statSync(path.join(path.dirname(first.localPath), 'manifest.json')).mtimeMs;
    const before = await client.artifacts.lastAccessedAt(first.artifactId);

    clock.at = new Date('2026-08-18T01:30:00Z');
    const second = await client.exportResult('T1abcd');

    assert.equal(second.cacheHit, true);
    assert.equal(second.artifactId, first.artifactId);
    assert.equal(fs.statSync(path.join(path.dirname(first.localPath), 'manifest.json')).mtimeMs, built,
        'a hit must not rewrite the artifact');
    const after = await client.artifacts.lastAccessedAt(first.artifactId);
    assert.notEqual(after, before);
    assert.equal(after, '2026-08-18T01:30:00.000Z');
    assert.equal(second.expiresAt, '2026-08-18T02:00:00.000Z', 'thirty minutes from last access');
});

test('an artifact that is not intact is never a hit', async () => {
    const cases = {
        'missing READY': dir => fs.rmSync(path.join(dir, 'READY')),
        'truncated row file': dir => fs.writeFileSync(path.join(dir, 'search/db-4.rows.jsonl'), '{}\n'),
        'malformed manifest': dir => fs.writeFileSync(path.join(dir, 'manifest.json'), '{not json'),
        'manifest failing validation': (dir) => {
            const file = path.join(dir, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
            delete manifest.completeness;
            fs.writeFileSync(file, JSON.stringify(manifest));
        },
        'a deleted data file': dir => fs.rmSync(path.join(dir, 'search/db-4.rows.jsonl')),
        'a file that lost its final newline': (dir) => {
            const file = path.join(dir, 'search/db-4.rows.jsonl');
            const text = fs.readFileSync(file, 'utf8');
            fs.writeFileSync(file, `${text.slice(0, -1)} `);       // same byte count, no trailing \n
        },
    };

    for (const [name, damage] of Object.entries(cases)) {
        const stateDir = await tmpDir();
        const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });
        const first = await client.exportResult('T1abcd');
        const dir = path.dirname(first.localPath);

        damage(dir);
        assert.equal((await client.artifacts.read(first.artifactId)).ok, false, `${name} must not read back`);

        const rebuilt = await client.exportResult('T1abcd');
        assert.equal(rebuilt.cacheHit, false, `${name} must rebuild`);
        assert.equal(rebuilt.artifactId, first.artifactId);
        assert.equal((await client.artifacts.read(first.artifactId)).ok, true, `${name} must be intact again`);
    }
});

test('row counts are verified on request, not on every hit', async () => {
    const stateDir = await tmpDir();
    const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });
    const out = await client.exportResult('T1abcd');
    const dir = path.dirname(out.localPath);

    // A manifest that lies about its row count is still a hit by default: verifying it costs a full
    // read of the artifact, and the failures that actually happen change the byte count.
    const file = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.files.find(f => f.role === 'rows').rows = 3;
    fs.writeFileSync(file, JSON.stringify(manifest));

    assert.equal((await client.artifacts.read(out.artifactId)).ok, true, 'the cheap check passes');
    const strict = await client.artifacts.read(out.artifactId, { verifyRows: true });
    assert.equal(strict.ok, false, 'the exhaustive check catches it');
    assert.equal(strict.reason, 'ROWS_MISMATCH');
});

test('the manifest is valid, self-consistent, and uses safe index-based paths', async () => {
    const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json') });
    const out = await client.exportResult('T1abcd');
    const manifest = JSON.parse(fs.readFileSync(out.localPath, 'utf8'));

    assert.deepEqual(validateArtifactManifest(manifest), { ok: true, errors: [] });
    assert.equal(manifest.state.serverNamespace, 'https://example.test/api');
    assert.equal(manifest.ranking.sortKey, 'score');
    assert.deepEqual(Object.keys(manifest.metricSemantics.eval).sort(),
        ['crossDatabaseComparable', 'direction', 'label', 'sortOrder'],
        'the map key is the field, so the value does not repeat it');
    assert.equal(manifest.metricSemantics.eval.label, 'E-Value');

    for (const file of manifest.files) {
        assert.ok(!file.path.includes('..') && !file.path.startsWith('/'), file.path);
        assert.ok(!file.path.includes('bfmd'), 'a database id must not reach a filename');
        assert.equal(fs.statSync(path.join(path.dirname(out.localPath), file.path)).size, file.bytes);
    }
    // The index -> id mapping is what makes db-4 readable.
    const databases = JSON.parse(readFile(out, 'databases')).databases;
    assert.equal(databases.find(d => d.safeName === 'db-4').id, 'bfmd');
});

test('the descriptor stays small and carries no file contents', async () => {
    const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json') });
    const out = await client.exportResult('T1abcd');

    const text = JSON.stringify(out);
    assert.ok(text.length < 2000, `descriptor is ${text.length} bytes`);
    assert.equal(text.includes('ATOM'), false);
    assert.equal(text.includes('"nodes"'), false);
    assert.match(out.uri, /^mmseqs2-artifact:\/\/[0-9a-f]{64}\/$/);
    assert.equal(out.manifestUri, `${out.uri}manifest.json`);
});

test('local paths can be withheld for a client that cannot use them', async () => {
    const fetchImpl = async (url) => ({
        ok: true, status: 200,
        json: async () => (url.includes('/ticket/type/') ? { type: 'structuresearch' }
            : url.includes('/databases') ? CATALOG
                : url.includes('/result/') ? load('foldseek-bfmd.raw.json')
                    : { id: 'T1', status: 'COMPLETE' }),
        text: async () => '',
    });
    const client = createClient({
        baseUrl: 'https://example.test',
        stateDir: await tmpDir(),
        fetchImpl,
        artifacts: { exposeLocalPaths: false },
    });
    const out = await client.exportResult('T1abcd');
    assert.equal(out.localPath, undefined);
    assert.match(out.manifestUri, /^mmseqs2-artifact:/);
});

test('an unfinished ticket exports nothing', async () => {
    const fetchImpl = async (url) => ({
        ok: true, status: 200,
        json: async () => (url.includes('/ticket/type/') ? { type: 'structuresearch' } : { id: 'T1', status: 'RUNNING' }),
        text: async () => '',
    });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });
    await assert.rejects(() => client.exportResult('T1abcd'), e => e.code === 'RESULT_NOT_READY');
});

test('the same unit exports the same bytes regardless of selections made in between', async () => {
    const stateDir = await tmpDir();
    const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });

    const first = await client.exportResult('T1abcd');
    const rowsBefore = readFile(first, 'rows');

    const table = await client.getResult('T1abcd', 0);
    await table.select({ db: 'bfmd', limit: 3 }).save('draft');

    await fsp.rm(path.dirname(first.localPath), { recursive: true, force: true });
    const second = await client.exportResult('T1abcd');

    assert.equal(second.artifactId, first.artifactId, 'workflow state is not part of the identity');
    assert.equal(readFile(second, 'rows'), rowsBefore);
    const manifest = fs.readFileSync(second.localPath, 'utf8');
    assert.equal(manifest.includes('draft'), false, 'an artifact holds no selection state');
});

test('the export-triggered sweep is throttled, and the marker survives a new client', async () => {
    const stateDir = await tmpDir();
    const sweeps = [];
    const audit = async (entry) => { sweeps.push(entry); };

    const first = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });
    await first.client.exportResult('T1abcd');
    const marker = path.join(stateDir, 'artifact-gc-state.json');
    assert.equal(fs.existsSync(marker), true, 'the sweep time is recorded outside the artifact root');
    const recorded = JSON.parse(fs.readFileSync(marker, 'utf8')).lastSweepAt;

    // A second export moments later must not walk the directory again.
    const throttled = await first.client.collectGarbage({ minIntervalSeconds: 600, audit });
    assert.equal(throttled.throttled, true);
    assert.equal(throttled.lastSweepAt, recorded);
    assert.equal(sweeps.length, 0, 'nothing was examined, so nothing was audited');

    // A brand new client — a restarted server — reads the same marker rather than sweeping again.
    const second = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });
    assert.equal((await second.client.collectGarbage({ minIntervalSeconds: 600 })).throttled, true);

    // An explicit call always sweeps: that is what the operator mode and the startup sweep use.
    const forced = await second.client.collectGarbage();
    assert.equal(forced.throttled, undefined);
    assert.equal(forced.artifacts.examined, 1);
    assert.equal(forced.results.examined, 1, 'one sweep covers both kinds of derived state');
});

test('a search that found nothing still exports, and says so', async () => {
    const { client } = await makeClient({
        result: { type: 'structuresearch', mode: '3diaa', queries: [], results: [] },
    });
    // Recording that a search found nothing is a real answer, so the export succeeds and the manifest
    // carries the zero. `exportAvailable` on the summary is what says there are no data files to fetch.
    const out = await client.exportResult('T9abcd');
    assert.equal(out.counts.parsedRows, 0);
    assert.equal(out.counts.exportedRows, 0);
    assert.deepEqual(out.files.map(f => f.role), ['databases']);
    assert.deepEqual(out.integrityIssues, []);

    const summary = await client.getResultSummary('T9abcd');
    assert.equal(summary.exportAvailable, false, 'nothing worth fetching beyond the manifest');
});

test('a manifest that fails its own schema is never published', async () => {
    const stateDir = await tmpDir();
    const { client } = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir });
    const store = client.artifacts;
    const id = 'b'.repeat(64);

    await assert.rejects(
        () => store.build(id, async () => ({ schema: 'mmseqs2-agent/result-artifact@1' })),
        e => e.code === 'EXPORT_FAILED');
    assert.equal(fs.existsSync(store.dirFor(id)), false);
    assert.deepEqual(fs.readdirSync(store.root).filter(n => n.startsWith('.build-')), [],
        'the scratch directory is removed too');
});

test('an expired artifact rebuilds from the cached result, without refetching it', async () => {
    const stateDir = await tmpDir();
    const now = new Date('2026-08-18T00:00:00Z');
    const first = await makeClient({ result: load('foldseek-bfmd.raw.json'), stateDir, now });
    const built = await first.client.exportResult('T1abcd');
    assert.ok(first.fetched.some(u => u.includes('/result/')), 'the first export did fetch the result');

    // Past the 30-minute artifact TTL, well inside the 24-hour result TTL.
    first.clock.at = new Date(now.getTime() + 45 * 60 * 1000);
    const swept = await first.client.collectGarbage();
    assert.equal(swept.artifacts.deleted, 1, 'the artifact expired');
    assert.equal(swept.results.deleted, 0, 'the payload that produced it did not');

    // A second client over the same state directory, so nothing is answered from memory.
    const second = await makeClient({
        result: load('foldseek-bfmd.raw.json'), stateDir, now: first.clock.at,
    });
    const rebuilt = await second.client.exportResult('T1abcd');

    assert.equal(rebuilt.artifactId, built.artifactId, 'same inputs, same handle');
    assert.equal(rebuilt.counts.parsedRows, built.counts.parsedRows);
    assert.deepEqual(second.fetched.filter(u => u.includes('/result/')), [],
        'the expensive fetch and parse came off disk — which is what makes a 30-minute TTL cheap');
    assert.deepEqual(second.fetched.map(u => u.replace('https://example.test', '')), ['/api/databases'],
        'only the database catalog, which is ~1 KB and memoised for the process');
});

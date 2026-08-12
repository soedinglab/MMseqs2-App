// Client behaviour that does not need a server: what it refuses to send, what it caches, and how it
// reports a deployment that does not serve a job type. The fetch is stubbed so these assert the
// request the client *would* make, which is the part that can silently drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createClient, assertTaxFilter, idForHit, kindForJobType, UnsupportedOnDeploymentError } from '../src/index.js';
import { Store, summarizeRequest } from '../src/store.js';

const DATABASES = [
    { path: 'pdb100', name: 'PDB', status: 'COMPLETE', complex: true, motif: false, interface: false },
    { path: 'afdb50', name: 'AFDB', status: 'COMPLETE', complex: false, motif: false, interface: false },
    { path: 'pdb_folddisco', name: 'PDB motif', status: 'COMPLETE', complex: false, motif: true, interface: false },
];

const QUERY = [
    'ATOM      1  N   MET A   1      11.104   6.134  -6.504  1.00  0.00           N',
    'ATOM      2  CA  MET A   1      11.639   6.071  -5.147  1.00  0.00           C',
    'ATOM      3  CA  ALA A   2      12.719   5.518  -4.897  1.00  0.00           C',
].join('\n');

async function tmpDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-test-'));
}

/** Records every request and answers from a small routing table. */
function stubFetch(routes = {}) {
    const calls = [];
    const impl = async (url, init = {}) => {
        calls.push({ url, method: init.method ?? 'GET', body: init.body, headers: init.headers });
        for (const [fragment, respond] of Object.entries(routes)) {
            if (url.includes(fragment)) return respond();
        }
        return { ok: true, status: 200, json: async () => ({ databases: DATABASES }), text: async () => '' };
    };
    impl.calls = calls;
    return impl;
}

const ok = body => () => ({ ok: true, status: 200, json: async () => body, text: async () => String(body) });
const fail = (status, text = '') => () => ({ ok: false, status, json: async () => ({}), text: async () => text });

async function makeClient(routes) {
    return createClient({
        baseUrl: 'https://example.test',
        stateDir: await tmpDir(),
        fetchImpl: stubFetch(routes),
    });
}

test('createClient demands a baseUrl rather than defaulting to a production server', () => {
    assert.throws(() => createClient({}), /baseUrl.*required/s);
    assert.throws(() => createClient({ baseUrl: '' }), /baseUrl.*required/s);
});

test('the /api prefix is added to the site origin, and is overridable', async () => {
    const plain = await makeClient();
    assert.equal(plain.apiRoot, 'https://example.test/api');

    const prefixed = createClient({
        baseUrl: 'https://example.test/', apiPath: '/mmseqs/api',
        stateDir: await tmpDir(), fetchImpl: stubFetch(),
    });
    assert.equal(prefixed.apiRoot, 'https://example.test/mmseqs/api');
});

test('a search sends database[] once per database, plus mode and taxfilter', async () => {
    const fetchImpl = stubFetch({ '/ticket': ok({ id: 'TICKET1', status: 'PENDING' }) });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });

    await client.submitFoldseekSearch({ query: QUERY, databases: ['pdb100', 'afdb50'], taxFilter: '9606,!10090' });

    const post = fetchImpl.calls.find(c => c.method === 'POST');
    const sent = new URLSearchParams(post.body);
    assert.deepEqual(sent.getAll('database[]'), ['pdb100', 'afdb50']);
    assert.equal(sent.get('mode'), '3diaa');
    assert.equal(sent.get('taxfilter'), '9606,!10090');
    assert.equal(sent.get('iterativesearch'), 'false');
});

test('multimer search is the same route with a complex- mode', async () => {
    const fetchImpl = stubFetch({ '/ticket': ok({ id: 'TICKET2', status: 'PENDING' }) });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });

    await client.submitMultimerSearch({ query: QUERY, databases: ['pdb100'], mode: '3diaa' });

    const post = fetchImpl.calls.find(c => c.method === 'POST');
    assert.ok(post.url.endsWith('/api/ticket'), post.url);
    assert.equal(new URLSearchParams(post.body).get('mode'), 'complex-3diaa');
});

test('nothing is submitted when validation fails', async () => {
    const fetchImpl = stubFetch({ '/ticket': ok({ id: 'NOPE', status: 'PENDING' }) });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });

    const rejections = [
        [() => client.submitFoldseekSearch({ query: QUERY, databases: ['pdb_folddisco'] }), /cannot be used for search/],
        [() => client.submitFoldseekSearch({ query: QUERY, databases: ['nope'] }), /not available/],
        [() => client.submitFoldseekSearch({ query: QUERY, databases: [] }), /at least one database/],
        [() => client.submitFoldseekSearch({ query: QUERY, databases: ['pdb100'], taxFilter: 'human' }), /invalid taxon filter/],
        [() => client.submitMultimerSearch({ query: QUERY, databases: ['afdb50'] }), /cannot be used for complexsearch/],
        [() => client.submitMultimerSearch({ query: QUERY, databases: ['pdb100'], iterativeSearch: true }), /does not support iterative/],
        [() => client.submitFoldMason({ files: [{ name: 'a.pdb', content: QUERY }] }), /at least 2/],
        [() => client.submitFoldDisco({ query: QUERY, databases: ['pdb_folddisco'], motif: '' }), /motif is empty/],
        [() => client.submitFoldDisco({ query: QUERY, databases: ['pdb_folddisco'], motif: 'A9' }), /not in the query structure/],
        [() => client.submitFoldDisco({ query: QUERY, databases: ['afdb50'], motif: 'A1' }), /cannot be used for folddisco/],
    ];
    for (const [call, expected] of rejections) await assert.rejects(call, expected);

    assert.equal(fetchImpl.calls.filter(c => c.method === 'POST').length, 0,
        'a rejected submission must not reach the server');
});

test('a 404 on a job route reports the deployment, not a missing ticket', async () => {
    const client = await makeClient({ '/ticket/folddisco': fail(404, '404 page not found') });
    await assert.rejects(
        () => client.submitFoldDisco({ query: QUERY, databases: ['pdb_folddisco'], motif: 'A1' }),
        (err) => {
            assert.ok(err instanceof UnsupportedOnDeploymentError);
            assert.equal(err.tool, 'folddisco');
            assert.match(err.message, /config\.App/);
            return true;
        },
    );
});

test('other HTTP failures keep their status and body', async () => {
    const client = await makeClient({ '/ticket/': fail(400, 'invalid ticket') });
    await assert.rejects(() => client.pollTicket('BADTICKET'), /400.*invalid ticket/s);
});

test('a cached COMPLETE ticket is not re-polled', async () => {
    const fetchImpl = stubFetch({ '/ticket/': ok({ id: 'T', status: 'COMPLETE' }) });
    const stateDir = await tmpDir();
    const client = createClient({ baseUrl: 'https://example.test', stateDir, fetchImpl });

    await client.waitForCompletion('CACHEDTICKET');
    const afterFirst = fetchImpl.calls.length;
    await client.waitForCompletion('CACHEDTICKET');
    assert.equal(fetchImpl.calls.length, afterFirst, 'the second wait should be answered from cache');
});

test('a terminal non-COMPLETE status throws instead of returning', async () => {
    const client = await makeClient({ '/ticket/': ok({ id: 'T', status: 'ERROR' }) });
    await assert.rejects(() => client.waitForCompletion('ERRTICKET'), /finished with status ERROR/);
});

test('taxon filter grammar matches the backend regex', () => {
    for (const good of ['', '9606', '9606,10090', '9606,!10090', '1,2,!3']) {
        assert.doesNotThrow(() => assertTaxFilter(good), good);
    }
    for (const bad of ['human', '!9606', '9606,', ',9606', '9606;10090', '9606,!']) {
        assert.throws(() => assertTaxFilter(bad), /invalid taxon filter/, bad);
    }
});

test('idForHit follows the page rule: filename for pdb*, dbkey elsewhere', () => {
    const hit = { target: '6iuf.ent', dbkey: 166622 };
    assert.equal(idForHit(hit, 'pdb_folddisco'), '6iuf.ent');
    assert.equal(idForHit(hit, 'BFVD_folddisco'), 166622);
});

test('kindForJobType maps every backend job type to a cache kind', () => {
    assert.equal(kindForJobType('foldmasoneasymsa'), 'foldmason');
    assert.equal(kindForJobType('folddisco'), 'folddisco');
    assert.equal(kindForJobType('complexsearch'), 'complexsearch');
    for (const t of ['structuresearch', 'search', 'interfacesearch', undefined]) {
        assert.equal(kindForJobType(t), 'search');
    }
});

test('summarizeRequest keeps a query identifiable without storing it', () => {
    const query = 'ATOM'.repeat(50_000);
    const summary = summarizeRequest({ query, databases: ['pdb100'], mode: '3diaa' });

    assert.equal(summary.query, undefined, 'the query itself must not be cached');
    assert.equal(summary.queryBytes, Buffer.byteLength(query));
    assert.equal(summary.queryHash.length, 16);
    assert.deepEqual(summary.databases, ['pdb100']);
    assert.ok(JSON.stringify(summary).length < 300, 'a ticket record should stay small');

    const other = summarizeRequest({ query: `${query}X` });
    assert.notEqual(other.queryHash, summary.queryHash, 'different queries must be distinguishable');
});

test('summarizeRequest reduces FoldMason files to names and sizes', () => {
    const summary = summarizeRequest({ files: [{ name: 'a.pdb', content: 'xxx' }, { name: 'b.pdb', content: 'yyyy' }] });
    assert.deepEqual(summary.files, [{ name: 'a.pdb', bytes: 3 }, { name: 'b.pdb', bytes: 4 }]);
});

test('writeTicket merges, so polling does not grow the record or lose the submission', async () => {
    const store = new Store(await tmpDir());
    await store.writeTicket('AABBCCDD', { kind: 'search', submittedAt: 'T0', request: { databases: ['pdb100'] } });

    let size = 0;
    for (let i = 0; i < 25; i++) {
        await store.writeTicket('AABBCCDD', { lastStatus: 'RUNNING', lastPolledAt: `T${i}` });
        const file = path.join(store.ticketDir('AABBCCDD'), 'ticket.json');
        const now = (await fs.stat(file)).size;
        if (i > 0) assert.ok(Math.abs(now - size) < 10, 'record size must not grow with poll count');
        size = now;
    }

    const record = await store.readTicket('AABBCCDD');
    assert.equal(record.kind, 'search');
    assert.equal(record.submittedAt, 'T0');
    assert.equal(record.lastPolledAt, 'T24');
    assert.deepEqual(record.request, { databases: ['pdb100'] });
});

test('the cache shards by ticket id and refuses unsafe ones', async () => {
    const store = new Store('/tmp/state');
    assert.equal(store.ticketDir('zXdtIy4Z'), '/tmp/state/tickets/zX/dt/zXdtIy4Z');
    for (const bad of ['../../etc', 'a/b', '..', 'x']) {
        assert.throws(() => store.ticketDir(bad), /refusing/, bad);
    }
});

test('listTickets returns newest first and reads nothing outside the tree', async () => {
    const store = new Store(await tmpDir());
    assert.deepEqual(await store.listTickets(), [], 'an empty cache is not an error');

    await store.writeTicket('AAAAAAAA', { submittedAt: '2026-01-01T00:00:00Z' });
    await store.writeTicket('BBBBBBBB', { submittedAt: '2026-06-01T00:00:00Z' });
    await store.writeTicket('CCCCCCCC', { submittedAt: '2026-03-01T00:00:00Z' });

    assert.deepEqual((await store.listTickets()).map(t => t.id), ['BBBBBBBB', 'CCCCCCCC', 'AAAAAAAA']);
    assert.deepEqual((await store.listTickets({ limit: 1 })).map(t => t.id), ['BBBBBBBB']);
});

test('results are written atomically, leaving no partial file behind', async () => {
    const store = new Store(await tmpDir());
    await store.writeResult('AABBCCDD', 'search', 0, { results: [{ db: 'pdb100' }] });

    const dir = store.ticketDir('AABBCCDD');
    const entries = await fs.readdir(dir);
    assert.deepEqual(entries, ['result-0.json'], 'no .tmp- file should survive a completed write');
    assert.deepEqual(await store.readResult('AABBCCDD', 'search', 0), { results: [{ db: 'pdb100' }] });
    assert.equal(await store.readResult('AABBCCDD', 'search', 1), null, 'a missing entry reads as null');
});

test('each job type gets its own cache file', async () => {
    const store = new Store(await tmpDir());
    await store.writeResult('AABBCCDD', 'foldmason', 0, { entries: [] });
    await store.writeResult('AABBCCDD', 'folddisco', 0, { results: [] });
    await store.writeResult('AABBCCDD', 'search', 2, { results: [] });

    const entries = (await fs.readdir(store.ticketDir('AABBCCDD'))).sort();
    assert.deepEqual(entries, ['folddisco.json', 'foldmason.json', 'result-2.json']);
});

test('validateSubmission runs every check without contacting /ticket', async () => {
    const fetchImpl = stubFetch({ '/ticket': ok({ id: 'SHOULD_NOT_HAPPEN', status: 'PENDING' }) });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });

    const bad = await client.validateSubmission({
        tool: 'folddisco', query: QUERY, databases: ['afdb50'], motif: 'A9',
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.problems.length, 2, 'an unusable database and an absent residue are both reported');
    assert.ok(bad.problems.some(p => /not in the query structure/.test(p)));
    assert.ok(bad.problems.some(p => /cannot be used for folddisco/.test(p)));

    const good = await client.validateSubmission({
        tool: 'foldseek', query: QUERY, databases: ['pdb100'], taxFilter: '9606',
    });
    assert.equal(good.ok, true);
    assert.deepEqual(good.problems, []);
    assert.equal(good.would.endpoint, '/ticket');
    assert.equal(good.would.mode, '3diaa');
    assert.equal(good.would.queryBytes, Buffer.byteLength(QUERY));

    assert.equal(fetchImpl.calls.filter(c => c.method === 'POST').length, 0,
        'validation must never submit — that is the whole point');
});

test('validateSubmission reports the mode a multimer job would use', async () => {
    const client = await makeClient();
    const out = await client.validateSubmission({ tool: 'multimer', query: QUERY, databases: ['pdb100'] });
    assert.equal(out.would.mode, 'complex-3diaa');

    const clash = await client.validateSubmission({
        tool: 'multimer', query: QUERY, databases: ['pdb100'], iterativeSearch: true,
    });
    assert.ok(clash.problems.some(p => /does not support iterative/.test(p)));
});

test('validateSubmission checks FoldMason file count', async () => {
    const client = await makeClient();
    const one = await client.validateSubmission({ tool: 'foldmason', files: [{ name: 'a.pdb', content: QUERY }] });
    assert.equal(one.ok, false);
    assert.match(one.problems[0], /at least 2/);

    const two = await client.validateSubmission({
        tool: 'foldmason', files: [{ name: 'a.pdb', content: QUERY }, { name: 'b.pdb', content: QUERY }],
    });
    assert.equal(two.ok, true);
    assert.deepEqual(two.would.files, ['a.pdb', 'b.pdb']);
});

test('resultUrl points at the page, built from the origin rather than the api root', async () => {
    const client = await makeClient({ '/ticket/type/': ok({ type: 'foldmasoneasymsa' }) });
    const url = await client.resultUrl('AABBCCDD');
    assert.equal(url, 'https://example.test/result/foldmason/AABBCCDD');
    assert.ok(!url.includes('/api'), 'the /api prefix belongs to the endpoints, not the page');
});

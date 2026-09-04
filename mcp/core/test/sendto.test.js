// The send-to dispatch table, one test per cell that can be got wrong, with every request stubbed.
//
// What these assert is not "did it submit" but *what was assembled*: a complex merged instead of
// encoded, or reconstructed when it did not need to be, produces a job that runs and returns
// something wrong-looking rather than failing. The structure text is the artefact worth checking, so
// these read it back — chain letters, TER records, the suffix — rather than trusting the branch name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    createClient, ResultTable, MsaColumnSelection,
} from '../src/index.js';

/** A one-hit, one-database parsed result, for the rows that lineage is recorded against. */
const PARSED = {
    type: 'structuresearch', mode: '3diaa', queries: [{ header: 'q', sequence: 'MAC' }],
    results: [{
        db: 'afdb50', hasDescription: false, hasTaxonomy: false,
        alignments: [[{ query: 'q', target: '1abc_A', score: 300, seqId: 0.5, eval: 1e-9, prob: 1 }]],
    }],
};
import { decodeMultimer } from '../../../frontend/lib/pdbAssembly.js';

const CG2ALL = 'https://cg2all.test/predict';

const DATABASES = [
    { path: 'pdb100', name: 'PDB', status: 'COMPLETE', complex: true, motif: false, interface: false },
    { path: 'afdb50', name: 'AFDB', status: 'COMPLETE', complex: false, motif: false, interface: false },
    { path: 'BFVD', name: 'BFVD', status: 'COMPLETE', complex: false, motif: false, interface: false },
    { path: 'pdb_folddisco', name: 'PDB motif', status: 'COMPLETE', complex: false, motif: true, interface: false },
];

/** Three CA atoms, as the backend ships them: "x,y,z,x,y,z,…". */
const CA_A = '1.000,2.000,3.000,4.000,5.000,6.000,7.000,8.000,9.000';
const CA_B = '11.000,12.000,13.000,14.000,15.000,16.000,17.000,18.000,19.000';

/** What cg2all would answer with — enough to pass the "is this a structure" check. */
const REBUILT = [
    'ATOM      1  N   MET A   1       1.000   2.000   3.000  1.00  0.00           N',
    'ATOM      2  CA  MET A   1       1.100   2.100   3.100  1.00  0.00           C',
    'ATOM      3  CA  ALA A   2       4.000   5.000   6.000  1.00  0.00           C',
    'ATOM      4  CA  CYS A   3       7.000   8.000   9.000  1.00  0.00           C',
].join('\n');

const ORIGINAL_FILE = [
    'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C',
    'ATOM      2  CA  ALA A   2       4.000   5.000   6.000  1.00  0.00           C',
].join('\n');

function tmpDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-sendto-'));
}

/**
 * A stub that answers by URL fragment and records everything. Submissions are captured with their
 * form bodies decoded, since the assembled structure travels in one.
 */
function stubFetch(routes = {}) {
    const calls = [];
    const impl = async (url, init = {}) => {
        const call = { url, method: init.method ?? 'GET', body: init.body };
        // Submissions go out url-encoded, as a string — decode them back so a test can read the
        // structure that was actually sent.
        if (typeof init.body === 'string') call.form = Object.fromEntries(new URLSearchParams(init.body));
        calls.push(call);
        for (const [fragment, respond] of Object.entries(routes)) {
            if (url.includes(fragment)) return respond(url, init);
        }
        if (url.includes('/databases')) {
            return { ok: true, status: 200, json: async () => DATABASES, text: async () => '' };
        }
        if (url.includes('/ticket')) {
            return { ok: true, status: 200, json: async () => ({ id: 'TICKET1', status: 'PENDING' }), text: async () => '' };
        }
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    impl.calls = calls;
    impl.submitted = () => calls.filter(c => c.method === 'POST' && c.url.includes('/api/ticket'));
    impl.reconstructions = () => calls.filter(c => c.url === CG2ALL);
    return impl;
}

const text = body => () => ({ ok: true, status: 200, json: async () => body, text: async () => body });
const missing = () => ({ ok: false, status: 404, json: async () => ({}), text: async () => 'not found' });

/** One hit's chains, as the `format=brief` route returns them. */
function briefRoute(chains) {
    return () => ({
        ok: true,
        status: 200,
        json: async () => chains,
        text: async () => JSON.stringify(chains),
    });
}

async function makeClient(routes = {}) {
    return createClient({
        baseUrl: 'https://example.test',
        cg2allUrl: CG2ALL,
        stateDir: await tmpDir(),
        fetchImpl: stubFetch(routes),
    });
}

const monomer = () => ({ kind: 'chains', chains: [{ ca: CA_A, seq: 'MAC', chain: 'A', target: '1abc_A' }] });
const complex = () => ({
    kind: 'chains',
    chains: [
        { ca: CA_A, seq: 'MAC', chain: 'A', target: '1abc_A' },
        { ca: CA_B, seq: 'MAC', chain: 'B', target: '1abc_B' },
    ],
});

// -------------------------------------------------------------------------------------------------
// chains origin
// -------------------------------------------------------------------------------------------------

test('a complex hit is merged for Foldseek — chains kept apart, never encoded', async () => {
    const client = await makeClient();
    const built = await client.query(complex()).build('multimer');

    assert.equal(built.isMultimer, true);
    assert.equal(built.suffix, undefined, 'no FoldMason suffix on a Foldseek destination');
    assert.ok(!built.name.includes('-_-_-_'));

    const chainsSeen = new Set(built.pdb.split('\n').filter(l => l.startsWith('ATOM')).map(l => l[21]));
    assert.deepEqual([...chainsSeen].sort(), ['A', 'B'], 'both chain ids survive the merge');
    assert.equal(built.pdb.split('\n').filter(l => l === 'TER').length, 2);
});

test('a complex hit is encoded for FoldMason, and the suffix rides on the name', async () => {
    const client = await makeClient();
    const built = await client.query(complex()).build('foldmason');

    assert.ok(built.suffix.startsWith('-_-_-_'));
    assert.ok(built.name.endsWith(built.suffix), 'the name carries the boundaries FoldMason reads back');
    assert.ok(built.pdb.split('\n').filter(l => l.startsWith('ATOM')).every(l => l[21] === 'A'),
        'encoded form is one chain');

    // The round trip is the actual contract: MSA.vue decodes with exactly this call.
    const chainsBack = new Set(decodeMultimer(built.pdb, built.suffix.replace('-_-_-_', ''))
        .split('\n').filter(l => l.startsWith('ATOM')).map(l => l[21]));
    assert.deepEqual([...chainsBack].sort(), ['A', 'B']);
});

test('FoldDisco takes the original file when the database has one, and does not reconstruct', async () => {
    const fetchImpl = stubFetch({ 'bfvd.steineggerlab.workers.dev': text(ORIGINAL_FILE) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    const built = await client.query({ ...monomer(), db: 'BFVD', accession: 'A0A123' })
        .build('folddisco');

    assert.equal(built.pdb, ORIGINAL_FILE);
    assert.match(built.resolvedFrom, /bfvd\.steineggerlab\.workers\.dev\/pdb\/A0A123\.pdb$/);
    assert.equal(built.reconstructed, undefined);
    assert.equal(fetchImpl.reconstructions().length, 0, 'no cg2all call when the original file exists');
});

test('an unresolvable database falls back to reconstruction, once', async () => {
    const warnings = [];
    const fetchImpl = stubFetch({ [CG2ALL]: text(REBUILT) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
        onWarning: w => warnings.push(w),
    });

    const built = await client.query({ ...monomer(), db: 'some-private-db' }).build('folddisco');

    assert.equal(built.reconstructed, true);
    assert.ok(built.pdb.includes('cg2all'), 'the provenance remark is prepended');
    assert.equal(fetchImpl.reconstructions().length, 1);
    assert.equal(warnings.length, 0, 'an unknown database is the ordinary case, not a warning');
});

// -------------------------------------------------------------------------------------------------
// fm-entry origin
// -------------------------------------------------------------------------------------------------

/** A FoldMason entry as it is stored: one chain, boundaries in the suffix. */
async function fmEntry(client) {
    const encoded = await client.query(complex()).build('foldmason');
    return {
        kind: 'fm-entry',
        pdb: encoded.pdb,
        suffix: encoded.suffix.replace('-_-_-_', ''),
        name: encoded.name,
    };
}

test('a multi-chain FoldMason entry is decoded for Foldseek, with no reconstruction at all', async () => {
    const fetchImpl = stubFetch({ [CG2ALL]: text(REBUILT) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    const built = await client.query(await fmEntry(client)).build('foldseek');

    const chains = new Set(built.pdb.split('\n').filter(l => l.startsWith('ATOM')).map(l => l[21]));
    assert.deepEqual([...chains].sort(), ['A', 'B'], 'the original chains are back');
    assert.equal(fetchImpl.reconstructions().length, 0);
});

test('a multi-chain FoldMason entry is decoded then reconstructed for FoldDisco', async () => {
    const fetchImpl = stubFetch({ [CG2ALL]: text(REBUILT) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    const built = await client.query(await fmEntry(client)).build('folddisco');

    assert.equal(built.reconstructed, true);
    assert.equal(fetchImpl.reconstructions().length, 1);
    // What went in was the decoded form, not the encoded one — otherwise cg2all rebuilds a chimera
    // of two chains fused into one.
    const sent = await fetchImpl.reconstructions()[0].body.get('file').text();
    const chainsIn = new Set(sent.split('\n').filter(l => l.startsWith('ATOM')).map(l => l[21]));
    assert.deepEqual([...chainsIn].sort(), ['A', 'B']);
});

// -------------------------------------------------------------------------------------------------
// structure origin, and submission
// -------------------------------------------------------------------------------------------------

test('a structure origin is passed through unchanged to every destination', async () => {
    const client = await makeClient();
    const spec = { kind: 'structure', text: ORIGINAL_FILE, name: '6iuf.pdb' };
    for (const tool of ['foldseek', 'multimer', 'foldmason', 'folddisco']) {
        const built = await client.query(spec).build(tool);
        assert.equal(built.pdb, ORIGINAL_FILE, `${tool} should receive the file as-is`);
        assert.equal(built.reconstructed, undefined);
    }
});

test('sendTo submits the assembled structure, with provenance', async () => {
    const fetchImpl = stubFetch();
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    const ticket = await client.query({ ...complex(), ticket: 'SOURCE1' })
        .sendTo({ tool: 'multimer', databases: ['pdb100'] });

    assert.equal(ticket.id, 'TICKET1');
    const [submission] = fetchImpl.submitted();
    assert.equal(submission.form.mode, 'complex-3diaa');
    assert.match(submission.form.q, /^REMARK {2}99 Accession: 1abc_AB/);
    assert.match(submission.form.q, /Imported from SOURCE1/);
});

test('a FoldDisco send validates the motif against the structure it assembled', async () => {
    const fetchImpl = stubFetch({ 'bfvd.steineggerlab.workers.dev': text(ORIGINAL_FILE) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });
    const query = () => client.query({ ...monomer(), db: 'BFVD', accession: 'A0A123' });

    await assert.rejects(
        () => query().sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'], motif: 'A99' }),
        /not in the query structure/);

    const ticket = await query().sendTo({
        tool: 'folddisco', databases: ['pdb_folddisco'], motif: 'A1,A2',
    });
    assert.equal(ticket.id, 'TICKET1');
});

// -------------------------------------------------------------------------------------------------
// resolveStructureFromDb — the four known URL patterns
// -------------------------------------------------------------------------------------------------

test('RCSB is asked for .pdb first and .cif second', async () => {
    const fetchImpl = stubFetch({ '.pdb': missing, '.cif': text(ORIGINAL_FILE) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    const found = await client.resolveStructureFromDb('pdb100', '6iuf.ent_A');
    assert.equal(found.text, ORIGINAL_FILE);

    const tried = fetchImpl.calls.map(c => c.url);
    assert.deepEqual(tried, [
        'https://files.rcsb.org/download/6IUF.pdb',
        'https://files.rcsb.org/download/6IUF.cif',
    ], 'four characters, upper-cased, .pdb then .cif — 3J3Q and 7A01 have no PDB-format file');
});

test('each database keeps its own URL shape', async () => {
    const fetchImpl = stubFetch({ '': text(ORIGINAL_FILE) });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    assert.equal((await client.resolveStructureFromDb('BFVD', 'A0A123')).url,
        'https://bfvd.steineggerlab.workers.dev/pdb/A0A123.pdb');
    assert.equal((await client.resolveStructureFromDb('afdb50', 'AF-P00001-F1-model_v4')).url,
        'https://alphafold.ebi.ac.uk/files/AF-P00001-F1-model_v4.pdb');
    assert.equal((await client.resolveStructureFromDb('esmatlas30', 'MGY123')).url,
        'https://api.esmatlas.com/fetchPredictedStructure/MGY123.pdb');
});

test('an unknown database is a different failure from an unreachable one', async () => {
    const client = await makeClient({ 'bfvd.steineggerlab.workers.dev': missing });

    await assert.rejects(() => client.resolveStructureFromDb('some-private-db', 'X'),
        err => err.name === 'DatabaseNotResolvableError');
    await assert.rejects(() => client.resolveStructureFromDb('BFVD', 'X'),
        err => err.name === 'StructureFetchError' && err.status === 404);
});

// -------------------------------------------------------------------------------------------------
// Lineage — which ticket a forwarded job came out of
// -------------------------------------------------------------------------------------------------

test('a forwarded job records the ticket, row and origin it came from', async () => {
    const fetchImpl = stubFetch({
        'format=brief': briefRoute([{ target: '1abc_A', tCa: CA_A, tSeq: 'MAC' }]),
        '/result/': () => ({ ok: true, status: 200, json: async () => PARSED, text: async () => '' }),
    });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });
    const table = new ResultTable(PARSED, { ticket: 'SOURCETICKET', queryIdx: 2, app: 'foldseek', client });

    const ticket = await table.row('0#0').sendTo({ tool: 'foldseek', databases: ['afdb50'] });

    // On the ticket that was just created...
    assert.deepEqual(ticket.derivedFrom, {
        ticket: 'SOURCETICKET', origin: 'chains', tool: 'foldseek',
        queryIdx: 2, rowId: '0#0', db: 'afdb50', from: '1abc_A', name: '1abc',
    });
    // ...and in the cache, which is what a later process reads.
    const record = await client.store.readTicket('TICKET1');
    assert.equal(record.derivedFrom.ticket, 'SOURCETICKET');
    assert.equal(record.derivedFrom.rowId, '0#0');
});

test('every forwarding origin records the facts a lineage walk needs', async () => {
    const fetchImpl = stubFetch({
        'format=brief': briefRoute([{ target: '1abc_A', tCa: CA_A, tSeq: 'MAC' }]),
        '/result/folddisco/': () => ({ ok: true, status: 200, text: async () => ORIGINAL_FILE, json: async () => ({}) }),
        '/query': () => ({ ok: true, status: 200, text: async () => ORIGINAL_FILE, json: async () => ({}) }),
        'cg2all': () => ({ ok: true, status: 200, text: async () => ORIGINAL_FILE, json: async () => ({}) }),
    });
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });

    // origin: chains — a Foldseek hit
    const table = new ResultTable(PARSED, { ticket: 'SRCTICKET', queryIdx: 3, app: 'foldseek', client });
    const fromRow = await table.row('0#0').sendTo({ tool: 'foldseek', databases: ['afdb50'] });
    for (const key of ['ticket', 'queryIdx', 'origin', 'tool', 'rowId', 'db']) {
        assert.ok(fromRow.derivedFrom[key] !== undefined, `a row origin needs ${key}`);
    }
    assert.equal(fromRow.derivedFrom.origin, 'chains');
    assert.equal(fromRow.derivedFrom.tool, 'foldseek', 'tool is the destination — there is no alias');
    assert.equal(fromRow.derivedFrom.queryIdx, 3, 'the source query, not the destination');

    // origin: fm-entry — an MSA column selection, reconstructed for FoldDisco
    const alignment = {
        entries: [{ name: '1abc_AB-_-_-_A_3_0-B_6_3', aa: 'MAC-MAC', ca: CA_A + ',' + CA_A }],
    };
    const columns = new MsaColumnSelection(client, alignment, {
        ticket: 'MSASRC', queryIdx: 0, columns: [0, 1], name: 'to-folddisco__001',
    });
    const fromColumns = await columns.sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'] });
    assert.equal(fromColumns.derivedFrom.ticket, 'MSASRC');
    assert.equal(fromColumns.derivedFrom.origin, 'fm-entry');
    assert.equal(fromColumns.derivedFrom.tool, 'folddisco');
    assert.equal(fromColumns.derivedFrom.selection, 'to-folddisco__001',
        'the source selection name is preserved in lineage');
    assert.deepEqual(fromColumns.derivedFrom.columns, ['0-1']);
    assert.equal(fromColumns.derivedFrom.entryName, '1abc_AB-_-_-_A_3_0-B_6_3');
    assert.equal(fromColumns.derivedFrom.reconstructed, true, 'FoldDisco needed full atoms');
});

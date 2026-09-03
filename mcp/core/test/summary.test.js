// The orientation payload: bounded, parameterless, fresh about selections, and silent about rows.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient, resultSummary, notReadySummary, ResultTable, validateResultSummary } from '../src/index.js';
import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

const FOLDSEEK = parseResults(load('foldseek-bfmd.raw.json'));
const FOLDDISCO = parseResultsFoldDisco(load('folddisco-pdb.raw.json'));

const CATALOG = [
    { path: 'bfmd', name: 'BFMD', version: '1.0', status: 'COMPLETE', taxonomy: true },
    { path: 'pdb_folddisco', name: 'PDB motif', version: '2024', status: 'COMPLETE', motif: true },
];

const table = (parsed, tool = 'foldseek', ticket = 'T1') =>
    new ResultTable(parsed, { ticket, queryIdx: 0, tool });

function foldMasonResult() {
    return {
        entries: [
            { name: 'a', aa: 'MACWMAC', ss: 'DDDDDDD', ca: '1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7' },
            { name: 'b', aa: 'MA-WMAC', ss: 'DDDDDDD' },
        ],
        scores: [0.9, 0.8, -1, 0.7, 0.6, 0.5, 0.4],
        statistics: { msaLDDT: 0.72 },
        tree: '(a,b);',
    };
}

const base = { ticket: 'T1', queryIdx: 0, jobType: 'structuresearch', status: 'COMPLETE' };

test('a 3Di+AA search summary reports counts, ranking semantics and one hit per database', () => {
    const out = resultSummary({ ...base, table: table(FOLDSEEK), catalog: CATALOG });

    assert.equal(out.schema, 'foldseek-server/result-summary@1');
    assert.equal(out.tool, 'foldseek');
    assert.equal(out.mode, '3diaa');
    assert.equal(out.counts.parsedRows, 150);
    assert.equal(out.counts.grouping, 'none');
    assert.deepEqual(out.completeness,
        { complete: null, saturated: false, rowCap: 1000 });

    assert.deepEqual(out.ranking,
        { field: 'score', label: 'Score', direction: 'higher', crossDatabaseComparable: true },
        'field is the row key, label is what the value is called; no sortKey, no sortOrder');

    assert.equal(out.databases.length, 9);
    const bfmd = out.databases.find(d => d.id === 'bfmd');
    assert.deepEqual(Object.keys(bfmd).sort(),
        ['dbIndex', 'display', 'id', 'parsedRows', 'taxonomyTree', 'topHit', 'version'],
        'no safeName, status or per-database serverAlignments: derivable or belongs elsewhere');
    assert.equal(bfmd.display, 'BFMD', 'the catalog was reachable');
    assert.equal(bfmd.parsedRows, 150);
    assert.equal(bfmd.taxonomyTree, true);
    assert.equal(typeof bfmd.topHit.value, 'number');
    assert.match(bfmd.topHit.id, /^\d+#\d+$/);
    assert.equal(out.databases.find(d => d.id === 'pdb100').topHit, null, 'no hits, no top hit');

    assert.equal(out.availability, undefined, 'the presence of a block is its own availability flag');
    assert.equal(out.msa, undefined, 'a search has no alignment');
});

test('the top hit is the ranking metric applied by the table, and agrees with the row export', () => {
    const t = table(FOLDSEEK);
    const out = resultSummary({ ...base, table: t });
    const bfmd = out.databases.find(d => d.id === 'bfmd');

    const best = t.getTable({ db: 'bfmd', limit: 1 });
    assert.equal(bfmd.topHit.id, best.rows[0].id);
    assert.equal(bfmd.topHit.value, Number(best.rows[0].score));
});

test('a folddisco summary carries bounded motif patterns and a saturated verdict', () => {
    const out = resultSummary({
        ...base, jobType: 'folddisco', table: table(FOLDDISCO, 'folddisco'), catalog: CATALOG,
    });

    assert.equal(out.tool, 'folddisco');
    assert.equal(out.ranking.field, 'idfscore', 'the key the row file actually has');
    assert.equal(out.ranking.label, 'IDF-score');
    assert.equal(out.ranking.crossDatabaseComparable, false);
    assert.deepEqual(out.completeness,
        { complete: false, saturated: true, rowCap: 1000 });

    assert.ok(out.motifPatterns.distinct > 0);
    assert.ok(out.motifPatterns.top.length <= 5, 'a distinct count plus a sample, never every pattern');
    assert.ok(out.motifPatterns.queryResidues);
});

test('a foldmason summary describes the alignment and claims completeness', () => {
    const out = resultSummary({
        ...base, jobType: 'foldmasoneasymsa', foldMasonResult: foldMasonResult(),
    });

    assert.equal(out.tool, 'foldmason');
    assert.equal(out.ranking, null);
    assert.deepEqual(out.databases, []);
    assert.equal(out.counts.parsedRows, 2);
    assert.deepEqual(out.completeness,
        { complete: true, saturated: false, rowCap: null });

    assert.equal(out.msa.totalColumns, 7);
    assert.equal(out.msa.entryCount, undefined, 'counts.parsedRows already says how many entries');
    assert.equal(out.msa.alphabetId, undefined, 'it always equalled representation');
    assert.ok(out.msa.stats.lddt, 'the spread the entry roster cannot give');
    assert.equal(out.msa.stats.lddt.missing, 1);
    assert.equal(out.msa.statistics.msaLDDT, 0.72);
    assert.equal(out.msa.hasCoordinates, true, 'not derivable from anything else, so it lives here');
    assert.equal(out.msa.hasTree, true);
});

test('a complex search reports its grouping and ranks on qTM', () => {
    const chain = (target, complexid) => ({
        target, complexid, query: 'q', eval: 1e-4, prob: 0.9, score: 100, seqId: 0.5,
        complexqtm: 0.8, complexttm: 0.7, qLen: 10, dbLen: 10,
    });
    const parsed = parseResults({
        // mode has no "complex-" prefix: server.go strips it before the job is built
        type: 'complexsearch', mode: '3diaa', queries: [{ header: 'q', sequence: 'AAAA' }],
        results: [{ db: 'pdb100', alignments: [[chain('1abc_A', 7), chain('1abc_B', 7), chain('2xyz_A', 9)]] }],
    });
    const out = resultSummary({ ...base, jobType: 'complexsearch', table: table(parsed) });

    assert.equal(out.tool, 'multimer');
    assert.equal(out.counts.grouping, 'complexid');
    assert.equal(out.counts.serverAlignments, 3);
    assert.equal(out.counts.parsedRows, 2);
    assert.equal(out.ranking.field, 'complexqtm');
    assert.equal(out.ranking.label, 'Query TM-score');
    assert.equal(out.databases[0].topHit.value, 0.8);
});

test('tmalign and lolalign summaries name the value correctly, whatever the field is called', () => {
    const make = mode => parseResults({
        mode, queries: [{ header: 'q', sequence: 'AAAA' }],
        results: [{ db: 'pdb100', alignments: [[{ target: 'X', eval: 0.8765, prob: 0.5, score: 10, seqId: 0.4 }]] }],
    });

    const tm = resultSummary({ ...base, table: table(make('tmalign')) });
    assert.equal(tm.ranking.label, 'TM-score');
    assert.equal(tm.ranking.direction, 'higher', 'a higher score sorts first');

    for (const [mode, label] of [['tmalign', 'TM-score'], ['lolalign', 'LOL-score']]) {
        const out = resultSummary({ ...base, table: table(make(mode)) });
        const top = out.databases[0].topHit;
        assert.equal(typeof top.value, 'number', `${mode} top hit must be numeric`);
        assert.ok(validateResultSummary(out).ok, `${mode} summary must validate`);
        // Both modes carry their score in `eval`, which is the column the server sorted on.
        assert.equal(out.ranking.field, 'eval', mode);
        assert.equal(out.ranking.label, label, mode);
    }
});

test('an unfinished ticket says so without touching the result', () => {
    const out = notReadySummary({ ticket: 'T1', queryIdx: 0, status: 'RUNNING', jobType: 'structuresearch' });
    assert.equal(out.code, 'RESULT_NOT_READY');
    assert.equal(out.next, 'get_ticket_status');
    assert.equal(out.counts, undefined);
    assert.equal(out.databases, undefined);

    const failed = notReadySummary({ ticket: 'T1', queryIdx: 0, status: 'ERROR', jobType: 'structuresearch' });
    assert.equal(failed.code, 'RESULT_FAILED');
});

test('the payload is bounded: no rows, no columns, no taxa, and small on the largest fixtures', () => {
    const search = resultSummary({ ...base, table: table(FOLDSEEK), catalog: CATALOG });
    const disco = resultSummary({ ...base, jobType: 'folddisco', table: table(FOLDDISCO, 'folddisco') });

    for (const [name, out] of [['9-database search', search], ['1000-hit folddisco', disco]]) {
        const text = JSON.stringify(out);
        assert.ok(text.length < 4200, `${name} summary is ${text.length} bytes`);
        assert.equal(out.rows, undefined);
        assert.equal(out.columns, undefined);
        assert.equal(out.taxa, undefined);
        for (const db of out.databases) assert.equal(db.rows, undefined);
    }
});

test('the summary carries selection metadata only, read fresh at call time', () => {
    const selections = [
        { name: 'draft', page: 'foldseek', queryIdx: 0, size: 2, ids: ['0#1', '0#2'], createdAt: 'a', updatedAt: 'b' },
        { name: 'to-foldmason__001', page: 'foldmason', entry: 1, size: 9, createdAt: 'c', updatedAt: 'd' },
    ];
    const out = resultSummary({ ...base, table: table(FOLDSEEK), selections });

    assert.deepEqual(out.selections, [
        { name: 'draft', kind: 'rows', size: 2, queryIdx: 0, createdAt: 'a', updatedAt: 'b' },
        { name: 'to-foldmason__001', kind: 'columns', size: 9, entry: 1, createdAt: 'c', updatedAt: 'd' },
    ]);
    assert.equal(JSON.stringify(out).includes('0#1'), false, 'membership is not orientation');

    const empty = resultSummary({ ...base, table: table(FOLDSEEK) });
    assert.deepEqual(empty.selections, []);
});

test('the submission summary keeps identity and size, never the structure', () => {
    const record = {
        request: {
            databases: ['bfmd'], mode: '3diaa', taxFilter: '', queryBytes: 70123, queryHash: 'abc123',
        },
        derivedFrom: { ticket: 'SRC', queryIdx: 0, origin: 'chains', tool: 'foldseek', rowId: '0#3' },
    };
    const out = resultSummary({ ...base, table: table(FOLDSEEK), record });

    assert.equal(out.submission.mode, undefined, 'the mode is already at the top level');
    assert.equal(out.submission.databases, undefined, 'the databases are already their own list');
    assert.equal(out.submission.queryBytes, 70123);
    assert.equal(out.submission.queryHash, 'abc123');
    assert.match(out.submission.queryHeader, /AcrVA5/);
    assert.equal(out.submission.querySequenceLength, 96);
    assert.equal(JSON.stringify(out.submission).includes('ATOM'), false);
    assert.deepEqual(out.derivedFrom, record.derivedFrom, 'lineage travels with the orientation');
});

test('every summary validates against its own schema', () => {
    for (const out of [
        resultSummary({ ...base, table: table(FOLDSEEK), catalog: CATALOG }),
        resultSummary({ ...base, jobType: 'folddisco', table: table(FOLDDISCO, 'folddisco') }),
        resultSummary({ ...base, jobType: 'foldmasoneasymsa', foldMasonResult: foldMasonResult() }),
        notReadySummary({ ticket: 'T1', status: 'PENDING', jobType: null }),
    ]) {
        assert.deepEqual(validateResultSummary(out), { ok: true, errors: [] });
    }
});

// --- the client wiring: status handling and the promise not to poll in a loop -------------------

async function tmpDir() {
    return fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-summary-'));
}

function stubFetch(routes) {
    const calls = [];
    const impl = async (url) => {
        calls.push(url);
        for (const [fragment, body] of Object.entries(routes)) {
            if (url.includes(fragment)) {
                return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
            }
        }
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    impl.calls = calls;
    return impl;
}

test('a running ticket returns RESULT_NOT_READY after exactly one status read', async () => {
    const fetchImpl = stubFetch({
        '/ticket/type/': { type: 'structuresearch' },
        '/ticket/': { id: 'T1', status: 'RUNNING' },
    });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });

    const out = await client.getResultSummary('T1abcd');
    assert.equal(out.code, 'RESULT_NOT_READY');
    assert.equal(out.status, 'RUNNING');
    assert.equal(fetchImpl.calls.filter(u => u.includes('/result/')).length, 0, 'no result was fetched');
    assert.equal(fetchImpl.calls.filter(u => /\/ticket\/[^t]/.test(u)).length, 1, 'one status read, not a loop');
});

test('a completed ticket is read from cache without a second status poll', async () => {
    const fetchImpl = stubFetch({
        '/ticket/type/': { type: 'structuresearch' },
        '/ticket/': { id: 'T1', status: 'COMPLETE' },
        '/result/': load('foldseek-bfmd.raw.json'),
        '/databases': CATALOG,
    });
    const stateDir = await tmpDir();
    const client = createClient({ baseUrl: 'https://example.test', stateDir, fetchImpl });

    const first = await client.getResultSummary('T1abcd');
    assert.equal(first.status, 'COMPLETE');
    assert.equal(first.counts.parsedRows, 150);

    const before = fetchImpl.calls.length;
    const second = await client.getResultSummary('T1abcd');
    assert.equal(second.counts.parsedRows, 150);
    assert.equal(fetchImpl.calls.length, before, 'a terminal status and a cached result need no network');
});

test('queryIdx is refused on a single-result job, and accepted on a search', async () => {
    const fetchImpl = stubFetch({
        '/ticket/type/': { type: 'folddisco' },
        '/ticket/': { id: 'T1', status: 'RUNNING' },
    });
    const client = createClient({ baseUrl: 'https://example.test', stateDir: await tmpDir(), fetchImpl });

    // Refused, not collapsed: the caller meant something, and a FoldDisco ticket has no query 4.
    await assert.rejects(() => client.getResultSummary('T1abcd', 4), (e) => {
        assert.equal(e.code, 'INVALID_QUERY_IDX');
        assert.match(e.message, /one result per ticket/);
        return true;
    });
    await assert.rejects(() => client.getResultSummary('T1abcd', -1), e => e.code === 'INVALID_QUERY_IDX');
    await assert.rejects(() => client.getResultSummary('T1abcd', 1.5), e => e.code === 'INVALID_QUERY_IDX');

    // 0 is the only valid index there, and it is not reported: there is no query to index.
    const zero = await client.getResultSummary('T1abcd', 0);
    assert.equal('queryIdx' in zero, false, 'omitted where it has no meaning');
});

test('a selection made on a non-zero query records that query, not 0', async () => {
    // getResult builds the table from the route's entry index; when the table's own field was renamed
    // this silently reset to 0, so every selection claimed query 0.
    const { ResultTable } = await import('../src/results.js');
    const built = new ResultTable(FOLDSEEK, { ticket: 'T1abcd', queryIdx: 2, app: 'foldseek' });
    assert.equal(built.queryIdx, 2, 'the table keeps the query it was built for');

    const out = resultSummary({
        ...base,
        table: built,
        selections: [{ name: 'q2', page: 'foldseek', queryIdx: 2, size: 1, ids: ['0#0'],
            createdAt: 'a', updatedAt: 'b' }],
    });
    assert.equal(out.selections[0].queryIdx, 2);
    assert.equal('entry' in out.selections[0], false, 'a hit selection has no alignment row');
});

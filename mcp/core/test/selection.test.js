// Selections: choosing rows by filter, adjusting the choice, keeping it across processes, and what
// gets submitted when one is forwarded.
//
// The persistence tests deliberately build a *second* client over the same state directory rather
// than reusing the first. Reading back a selection from the object that made it proves nothing —
// the case that matters is the one where the process that chose the rows is gone, which is exactly
// what happens after forwarding a selection to FoldMason and coming back to adjust it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createClient, ResultTable, SELECT_MAX } from '../src/index.js';

const CG2ALL = 'https://cg2all.test/predict';
const CA = '1.000,2.000,3.000,4.000,5.000,6.000,7.000,8.000,9.000';

const DATABASES = [
    { path: 'afdb50', name: 'AFDB50', status: 'COMPLETE', complex: false, motif: false, interface: false },
    { path: 'afdb-swissprot', name: 'SwissProt', status: 'COMPLETE', complex: false, motif: false, interface: false },
];

/**
 * A parsed search result, shaped as parseResults leaves one: `results[i].alignments` is indexed by
 * group, each group a list of chains. Two databases, and one accession deliberately present in both
 * — the afdb siblings really do share entries, and that is the duplicate case worth covering.
 */
function parsed() {
    const hit = (target, score, taxId) => [{
        query: 'q', target, score, seqId: 0.5, eval: 1e-9, prob: 1,
        qStartPos: 1, qEndPos: 3, qLen: 3, dbStartPos: 1, dbEndPos: 3, dbLen: 3,
        taxId, taxName: taxId === '9606' ? 'Homo sapiens' : 'Escherichia coli',
    }];
    return {
        type: 'structuresearch',
        mode: '3diaa',
        queries: [{ header: 'query', sequence: 'MAC' }],
        results: [
            {
                db: 'afdb50',
                hasDescription: false,
                hasTaxonomy: true,
                alignments: [
                    hit('AF-P00001-F1-model_v4', 300, '9606'),
                    hit('AF-P00002-F1-model_v4', 200, '562'),
                    hit('AF-P00003-F1-model_v4', 100, '9606'),
                ],
                taxonomyreports: [[
                    { taxon_id: 9606, name: 'Homo sapiens', rank: 'species', depth: 0, clade_reads: 2 },
                    { taxon_id: 562, name: 'Escherichia coli', rank: 'species', depth: 0, clade_reads: 1 },
                ]],
            },
            {
                db: 'afdb-swissprot',
                hasDescription: false,
                hasTaxonomy: false,
                alignments: [
                    hit('AF-P00001-F1-model_v4', 290, '9606'),      // same entry as afdb50#0
                    hit('AF-P00009-F1-model_v4', 150, '9606'),
                ],
            },
        ],
    };
}

function tmpDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-selection-'));
}

function stubFetch(routes = {}) {
    const calls = [];
    const impl = async (url, init = {}) => {
        const call = { url, method: init.method ?? 'GET', body: init.body };
        calls.push(call);
        for (const [fragment, respond] of Object.entries(routes)) {
            if (url.includes(fragment)) return respond(url, init);
        }
        if (url.includes('/databases')) {
            return { ok: true, status: 200, json: async () => DATABASES, text: async () => '' };
        }
        if (url.includes('format=brief')) {
            const idx = new URL(url).searchParams.get('index');
            const db = new URL(url).searchParams.get('database');
            const rows = [{ target: `${db}-hit${idx}_A`, tCa: CA, tSeq: 'MAC' }];
            return { ok: true, status: 200, json: async () => rows, text: async () => '' };
        }
        if (url.endsWith('/query')) {
            return { ok: true, status: 200, text: async () => 'ATOM      1  CA  MET A   1       0.000   0.000   0.000  1.00  0.00           C', json: async () => ({}) };
        }
        if (url.includes('/result/')) {
            return { ok: true, status: 200, json: async () => parsed(), text: async () => '' };
        }
        if (url.includes('/ticket/type/')) {
            return { ok: true, status: 200, json: async () => ({ type: 'structuresearch' }), text: async () => '' };
        }
        return { ok: true, status: 200, json: async () => ({ id: 'NEWTICKET', status: 'PENDING' }), text: async () => '' };
    };
    impl.calls = calls;
    return impl;
}

/**
 * A table over the fixture, wired to a client.
 *
 * Built directly rather than through getResult() because the fixture is already parsed — running it
 * through parseResults a second time would rewrite it. What is under test here is selection, not
 * parsing, which result-views.test.js covers against captured server output.
 */
async function tableFor(stateDir, fetchImpl = stubFetch()) {
    const client = createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir, fetchImpl,
    });
    const table = new ResultTable(parsed(), { ticket: 'TICKET42', queryIdx: 0, app: 'foldseek', client });
    return { client, table, fetchImpl };
}

test('a filter spec selects rows in the table\'s own order', async () => {
    const { table } = await tableFor(await tmpDir());
    const selection = table.select({ db: 'afdb50', limit: 2 });

    assert.deepEqual(selection.ids, ['0#0', '0#1'], 'best two by score, as getTable ranks them');
    assert.equal(selection.size, 2);
});

test('selecting across every database, and by explicit id, agree on canonical ids', async () => {
    const { table } = await tableFor(await tmpDir());

    const byFilter = table.select({ db: '*', limit: 10 });
    assert.deepEqual(byFilter.ids.sort(), ['0#0', '0#1', '0#2', '1#0', '1#1']);

    // A database name and its index address the same row; both must land on one entry, not two.
    const byName = table.select(['afdb50#1', '0#1']);
    assert.deepEqual(byName.ids, ['0#1']);
});

test('a taxon filter narrows the selection the same way it narrows the table', async () => {
    const { table } = await tableFor(await tmpDir());
    const humans = table.select({ db: 'afdb50', taxonFilter: { taxon: 'Homo sapiens' }, limit: 10 });
    assert.deepEqual(humans.ids, ['0#0', '0#2']);
});

test('a selection can be added to and subtracted from, by filter or by id', async () => {
    const { table } = await tableFor(await tmpDir());
    const selection = table.select({ db: 'afdb50', limit: 3 });

    selection.add({ db: 'afdb-swissprot', limit: 1 });
    assert.deepEqual(selection.ids, ['0#0', '0#1', '0#2', '1#0']);

    selection.remove(['0#1']);
    assert.deepEqual(selection.ids, ['0#0', '0#2', '1#0']);

    // Subtracting a filter is the same operation as adding one, which is what makes
    // "the top 20, minus anything human" two calls rather than a special case.
    selection.remove({ db: 'afdb50', taxonFilter: { taxon: '9606' }, limit: 10 });
    assert.deepEqual(selection.ids, ['1#0']);

    assert.equal(selection.clear().size, 0);
});

test('the selection cap is enforced whatever limit is asked for', async () => {
    const { table } = await tableFor(await tmpDir());
    const selection = table.select({ db: '*', limit: SELECT_MAX + 5000 });
    assert.ok(selection.size <= SELECT_MAX);
});

test('an unknown row id is refused rather than silently dropped', async () => {
    const { table } = await tableFor(await tmpDir());
    assert.throws(() => table.select(['0#99']), /no hit 99/);
    assert.throws(() => table.select(['nosuchdb#0']), /unknown database/);
});

test('describe reports what is selected, and flags entries that share a name', async () => {
    const { table } = await tableFor(await tmpDir());
    const described = table.select(['0#0', '1#0', '0#1']).describe();

    assert.equal(described.size, 3);
    assert.deepEqual(described.databases, ['afdb50', 'afdb-swissprot']);
    assert.equal(described.saved, false);
    // afdb50#0 and afdb-swissprot#0 are the same AlphaFold entry; FoldMason addresses entries by
    // name, so this is worth knowing before submitting rather than after.
    assert.deepEqual(described.duplicateNames, [{ name: 'P00001', count: 2 }]);
});

test('a selection survives the process that made it', async () => {
    const stateDir = await tmpDir();

    const first = await tableFor(stateDir);
    await first.table.select({ db: 'afdb50', limit: 2 }, { name: 'shortlist' }).save();

    // A different client, a different table object, the same state directory: this is the
    // "come back to it tomorrow" case.
    const second = await tableFor(stateDir);
    const restored = await second.table.loadSelection('shortlist');
    assert.deepEqual(restored.ids, ['0#0', '0#1']);
    assert.ok(restored.savedAt, 'the stored record carries when it was written');

    restored.add(['1#1']);
    await restored.save();

    const third = await tableFor(stateDir);
    assert.deepEqual((await third.table.loadSelection('shortlist')).ids, ['0#0', '0#1', '1#1']);
});

test('selections are named, listed and deleted per ticket', async () => {
    const stateDir = await tmpDir();
    const { table } = await tableFor(stateDir);

    await table.select({ db: 'afdb50', limit: 1 }, { name: 'a' }).save();
    await table.select({ db: '*', limit: 10 }, { name: 'b' }).save();

    const listed = await table.listSelections();
    assert.deepEqual(listed.map(s => s.name).sort(), ['a', 'b']);
    assert.deepEqual(listed.find(s => s.name === 'b').size, 5);
    assert.equal(listed.find(s => s.name === 'a').page, 'foldseek');

    assert.equal(await table.deleteSelection('a'), true);
    assert.equal(await table.deleteSelection('a'), false);
    assert.equal(await table.loadSelection('a'), null);
    assert.deepEqual((await table.listSelections()).map(s => s.name), ['b']);
});

test('a missing selection reads back as null, not an empty one', async () => {
    const { table } = await tableFor(await tmpDir());
    assert.equal(await table.loadSelection('never-saved'), null);
});

test('forwarding a selection to FoldMason sends one file per row, plus the query', async () => {
    const fetchImpl = stubFetch();
    const { table } = await tableFor(await tmpDir(), fetchImpl);

    const ticket = await table.select(['0#0', '0#1']).sendTo({ tool: 'foldmason' });

    assert.equal(ticket.id, 'NEWTICKET');
    assert.equal(ticket.submittedFiles, 3, 'two hits and the original query');
    assert.deepEqual(ticket.skipped, []);

    const submission = fetchImpl.calls.find(c => c.method === 'POST');
    assert.match(submission.url, /\/ticket\/foldmason$/);
    const names = submission.body.getAll('queries[]').map(f => f.name);
    // Entries are named by accession, as the page names them — getAccession drops the chain.
    assert.deepEqual(names.sort(), ['afdb50-hit0.pdb', 'afdb50-hit1.pdb', 'query.pdb']);
});

test('includeQuery: false leaves the original query out', async () => {
    const fetchImpl = stubFetch();
    const { table } = await tableFor(await tmpDir(), fetchImpl);

    const ticket = await table.select(['0#0', '0#1'])
        .sendTo({ tool: 'foldmason', includeQuery: false });
    assert.equal(ticket.submittedFiles, 2);
});

test('two rows naming the same structure are deduplicated quietly, and reported', async () => {
    // Both databases answer with the same target name, which is what selecting one entry out of two
    // afdb siblings does. FoldMason would receive two identically named entries.
    const fetchImpl = stubFetch({
        'format=brief': () => ({
            ok: true, status: 200,
            json: async () => [{ target: 'AF-P00001-F1-model_v4', tCa: CA, tSeq: 'MAC' }],
            text: async () => '',
        }),
    });
    const { table } = await tableFor(await tmpDir(), fetchImpl);

    const ticket = await table.select(['0#0', '1#0', '0#1']).sendTo({ tool: 'foldmason' });

    assert.equal(ticket.submittedFiles, 2, 'one copy of the shared entry, plus the query');
    assert.equal(ticket.skipped.length, 2);
    assert.ok(ticket.skipped.every(s => s.reason === 'duplicate entry name'));
});

test('a multi-row selection cannot go to a single-query destination', async () => {
    const { table } = await tableFor(await tmpDir());
    await assert.rejects(
        () => table.select({ db: 'afdb50', limit: 2 }).sendTo({ tool: 'foldseek', databases: ['afdb50'] }),
        /takes one query; this selection has 2/);
});

test('a one-row selection is allowed through to a single-query destination', async () => {
    const fetchImpl = stubFetch();
    const { table } = await tableFor(await tmpDir(), fetchImpl);

    const ticket = await table.select(['0#0']).sendTo({ tool: 'foldseek', databases: ['afdb50'] });
    assert.equal(ticket.id, 'NEWTICKET');
    assert.ok(fetchImpl.calls.some(c => c.url.endsWith('/api/ticket') && c.method === 'POST'));
});

test('rows resolve their structure only when something is actually sent', async () => {
    const fetchImpl = stubFetch();
    const { table } = await tableFor(await tmpDir(), fetchImpl);

    const before = fetchImpl.calls.length;
    const set = table.select({ db: '*', limit: 10 }).toQuerySet();
    assert.equal(set.length, 5);
    assert.equal(fetchImpl.calls.length, before,
        'building a query set fetches nothing — a thousand rows would be a thousand requests');
});

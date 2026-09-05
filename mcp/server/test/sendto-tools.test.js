// Selecting hits, selecting alignment columns, and forwarding either into a new job.
//
// These use the *real* ResultTable, Selection and Store from the core package over a stubbed network,
// rather than a hand-written stand-in. A fake selection object would agree with whatever the tool did
// to it; what needs checking is that a selection made in one call is still there in the next, which
// only the real store can answer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ResultTable, Store, MsaColumnSelection, SubmittableQuery } from 'foldseek-server-lib';
import { createTools, runTool } from '../src/tools.js';

const CA = '1.000,2.000,3.000,4.000,5.000,6.000,7.000,8.000,9.000';

function parsed() {
    const hit = (target, score) => [{
        query: 'q', target, score, seqId: 0.5, eval: 1e-9, prob: 1,
        qStartPos: 1, qEndPos: 3, qLen: 3, dbStartPos: 1, dbEndPos: 3, dbLen: 3,
    }];
    return {
        type: 'structuresearch',
        mode: '3diaa',
        queries: [{ header: 'query', sequence: 'MAC' }],
        results: [{
            db: 'afdb50',
            hasDescription: false,
            hasTaxonomy: false,
            alignments: [hit('AF-P00001-F1-model_v4', 300), hit('AF-P00002-F1-model_v4', 200),
                hit('AF-P00003-F1-model_v4', 100)],
        }],
    };
}

const ALIGNMENT = {
    entries: [
        { name: '1abc_AB-_-_-_A_3_0-B_6_3', aa: 'MAC-MAC', ca: [
            '1.000,1.000,1.000', '2.000,2.000,2.000', '3.000,3.000,3.000',
            '4.000,4.000,4.000', '5.000,5.000,5.000', '6.000,6.000,6.000'].join(',') },
        { name: 'AF-P00001-F1-model_v4', aa: 'MACWMAC', ca: `${CA},7.000,7.000,7.000` },
    ],
    scores: [0.9, 0.9, 0.8, -1, 0.7, 0.6, 0.5],
};

function tmpDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-mcp-sendto-'));
}

/**
 * A client with a real Store and real result objects, but no network: every submit is recorded
 * instead of sent, and every structure a row would fetch is answered inline.
 */
async function stubClient(overrides = {}) {
    const calls = [];
    const record = (name, ...args) => { calls.push({ name, args }); };
    const store = new Store(await tmpDir());

    const client = {
        calls,
        store,
        submitted: () => calls.filter(c => c.name.startsWith('submit')),
        cg2allUrl: 'https://cg2all.test/predict',
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C' }),

        // The one construction path for a forwardable query, as the real client defines it.
        query(spec, opts) { return new SubmittableQuery(client, spec, opts); },

        async getTicketType(t) { return { type: t.startsWith('FM') ? 'foldmasoneasymsa' : 'structuresearch' }; },
        async getResultTable(ticket, { entry = 0 } = {}) {
            record('getResultTable', ticket, entry);
            return new ResultTable(parsed(), { ticket, entry, app: 'foldseek', client });
        },
        async getFoldMasonResult(t) { record('getFoldMasonResult', t); return ALIGNMENT; },
        async selectMsaColumns(ticket, opts) {
            return new MsaColumnSelection(client, ALIGNMENT, { ...opts, ticket });
        },
        async loadMsaSelection(ticket, name = 'default') {
            const rec = await store.readSelection(ticket, name);
            if (!rec) return null;
            return new MsaColumnSelection(client, ALIGNMENT, {
                ticket, name, entry: rec.entry ?? 0, columns: rec.columns ?? [],
                residueAa: rec.residueAa ?? [], savedAt: rec.updatedAt,
            });
        },
        listSelections(t) { return store.listSelections(t); },
        deleteSelection(t, n) { return store.deleteSelection(t, n); },
        copySelection(t, from, to) { return store.copySelection(t, from, to); },

        async getHitChains(ticket, { db, idx }) {
            record('getHitChains', ticket, db, idx);
            return [{ ca: CA, seq: 'MAC', chain: 'A', target: `${db}-hit${idx}_A` }];
        },
        async getQueryStructure() { return { name: 'query.pdb', content: 'ATOM      1  CA  MET A   1       0.000   0.000   0.000  1.00  0.00           C' }; },
        async submitFoldseekSearch(a) { record('submitFoldseekSearch', a); return { id: 'FSTICKET1', status: 'PENDING' }; },
        async submitFoldDisco(a) { record('submitFoldDisco', a); return { id: 'FDTICKET1', status: 'PENDING' }; },
        async submitFoldMason(a) { record('submitFoldMason', a); return { id: 'FMTICKET2', status: 'PENDING' }; },
        async pollTicket(t) { return { id: t, status: 'COMPLETE' }; },
        async resultUrl(t) { return `https://example.test/result/${t}/0`; },
        ...overrides,
    };
    return client;
}

async function toolsFor(overrides) {
    const client = await stubClient(overrides);
    return { client, tools: createTools(client) };
}

// -------------------------------------------------------------------------------------------------
// select_hits
// -------------------------------------------------------------------------------------------------

test('select_hits saves what a filter selected, and reads it back on the next call', async () => {
    const { tools } = await toolsFor();

    const made = await runTool(tools, 'select_hits', { ticketId: 'TICKET1', ids: ['0#0', '0#1'] });
    assert.equal(made.size, 2);
    assert.equal(made.name, 'default');
    assert.equal(made.size, 2, 'the confirmation says how many members it now has');

    // Nothing is passed between calls but the ticket and the name.
    const again = await runTool(tools, 'select_hits', { ticketId: 'TICKET1', action: 'describe' });
    assert.deepEqual(again.entries.map(e => e.id), ['0#0', '0#1']);
});

// -------------------------------------------------------------------------------------------------
// select_msa_columns
// -------------------------------------------------------------------------------------------------

test('select_msa_columns designates substitutions per column, and they persist', async () => {
    const { tools } = await toolsFor();
    await runTool(tools, 'select_msa_columns', { ticketId: 'FMTICKET1', entry: 0, columns: [0, 1, 4] });

    const set = await runTool(tools, 'select_msa_columns', {
        ticketId: 'FMTICKET1', action: 'add', residues: [{ column: 4, aa: 'b' }],
    });
    assert.equal(set.motif, 'A1, A2, B1:b');
    assert.equal(set.residueMapping, '0->A1, 1->A2, 4->B1(M):b');
    assert.equal(set.substitutions, undefined, 'the per-column array is gone; the line replaces it');

    const reread = await runTool(tools, 'select_msa_columns', { ticketId: 'FMTICKET1', action: 'describe' });
    assert.equal(reread.motif, 'A1, A2, B1:b');

    const bad = await runTool(tools, 'select_msa_columns', {
        ticketId: 'FMTICKET1', action: 'add', residues: [{ column: 4, aa: 'z' }],
    });
    assert.equal(bad.code, 'INVALID_INPUT');

    // Removing the column takes the substitution with it, and says which.
    const removed = await runTool(tools, 'select_msa_columns', {
        ticketId: 'FMTICKET1', action: 'remove', columns: [4],
    });
    assert.deepEqual(removed.droppedSubstitutions, [4]);
    assert.equal(removed.motif, 'A1, A2');
});

// -------------------------------------------------------------------------------------------------
// send_to
// -------------------------------------------------------------------------------------------------

test('send_to forwards one row to Foldseek', async () => {
    const { client, tools } = await toolsFor();
    const out = await runTool(tools, 'send_to', {
        from: { type: 'row', ticketId: 'TICKET1', rowId: '0#1' },
        tool: 'foldseek', databases: ['afdb50'],
    });

    assert.equal(out.ticketId, 'FSTICKET1');
    assert.deepEqual(client.calls.find(c => c.name === 'getHitChains').args, ['TICKET1', 'afdb50', 1]);
    const [submitted] = client.submitted();
    assert.equal(submitted.name, 'submitFoldseekSearch');
    assert.match(submitted.args[0].query, /^REMARK {2}99 Accession: afdb50-hit1/);
});

test('send_to forwards a saved selection to FoldMason', async () => {
    const { client, tools } = await toolsFor();
    await runTool(tools, 'select_hits', { ticketId: 'TICKET1', ids: ['0#0', '0#1'], name: 'shortlist' });

    const out = await runTool(tools, 'send_to', {
        from: { type: 'selection', ticketId: 'TICKET1', name: 'shortlist' },
        tool: 'foldmason',
    });

    assert.equal(out.ticketId, 'FMTICKET2');
    const [submitted] = client.submitted();
    assert.equal(submitted.name, 'submitFoldMason');
    assert.deepEqual(submitted.args[0].files.map(f => f.name),
        ['afdb50-hit0.pdb', 'afdb50-hit1.pdb', 'query.pdb']);
});

test('send_to forwards a column selection to FoldDisco with the motif it derived', async () => {
    const { client, tools } = await toolsFor();
    await runTool(tools, 'select_msa_columns', { ticketId: 'FMTICKET1', entry: 0, columns: [0, 1, 4] });

    const out = await runTool(tools, 'send_to', {
        from: { type: 'msaColumns', ticketId: 'FMTICKET1' },
        tool: 'folddisco', databases: ['pdb_folddisco'],
    });

    assert.equal(out.ticketId, 'FDTICKET1');
    const [submitted] = client.submitted();
    assert.equal(submitted.name, 'submitFoldDisco');
    assert.equal(submitted.args[0].motif, 'A1, A2, B1');
    assert.equal(out.derivedFrom.motifSource, 'columns');
});

test('send_to takes a motif only from a source that has none', async () => {
    const { client, tools } = await toolsFor();
    await runTool(tools, 'select_msa_columns', { ticketId: 'FMTICKET1', entry: 0, columns: [0, 1, 4] });

    const refused = await runTool(tools, 'send_to', {
        from: { type: 'msaColumns', ticketId: 'FMTICKET1' },
        tool: 'folddisco', databases: ['pdb_folddisco'], motif: 'A9, A10',
    });
    assert.equal(refused.code, 'INVALID_INPUT');
    assert.match(refused.error, /already carries a motif/);

    // A Foldseek hit has no matched residues, so forwarding one to FoldDisco needs a motif given.
    const accepted = await runTool(tools, 'send_to', {
        from: { type: 'row', ticketId: 'TICKET1', rowId: '0#1' },
        tool: 'folddisco', databases: ['pdb_folddisco'], motif: 'A1',
    });
    assert.equal(accepted.ticketId, 'FDTICKET1');
    assert.equal(accepted.derivedFrom.motifSource, 'caller');
    assert.equal(client.submitted().at(-1).args[0].motif, 'A1');
});

test('send_to explains a source that has not been made yet', async () => {
    const { tools } = await toolsFor();

    const missing = await runTool(tools, 'send_to', {
        from: { type: 'selection', ticketId: 'TICKET1', name: 'nope' },
        tool: 'foldmason',
    });
    assert.equal(missing.isError, true);
    assert.match(missing.error, /no selection "nope".*select_hits/s);

    const wrong = await runTool(tools, 'send_to', { from: { type: 'wat' }, tool: 'foldseek' });
    assert.equal(wrong.isError, true);
    assert.match(wrong.error, /unknown source type/);
});

test('send_to refuses to send several rows to a single-query destination', async () => {
    const { tools } = await toolsFor();
    await runTool(tools, 'select_hits', { ticketId: 'TICKET1', ids: ['0#0', '0#1', '0#2'] });

    const out = await runTool(tools, 'send_to', {
        from: { type: 'selection', ticketId: 'TICKET1' },
        tool: 'foldseek', databases: ['afdb50'],
    });
    assert.equal(out.isError, true);
    assert.match(out.error, /takes one query; this selection has 3/);
});

// -------------------------------------------------------------------------------------------------
// load_accession
// -------------------------------------------------------------------------------------------------

test('a forwarded job reports which ticket it came out of, and can be found from that ticket', async () => {
    const { client, tools } = await toolsFor();
    await runTool(tools, 'select_hits', { ticketId: 'TICKET1', ids: ['0#0', '0#1'], name: 'shortlist' });
    await runTool(tools, 'send_to', {
        from: { type: 'selection', ticketId: 'TICKET1', name: 'shortlist' }, tool: 'foldmason',
    });

    const status = await runTool(tools, 'get_ticket_status', { ticketId: 'FMTICKET2' });
    assert.equal(status.derivedFrom.ticket, 'TICKET1');
    assert.equal(status.derivedFrom.selection, 'shortlist');
    assert.deepEqual(status.derivedFrom.entries, ['afdb50-hit0.pdb', 'afdb50-hit1.pdb', 'query.pdb']);

    assert.equal(client.calls.some(c => c.name === 'submitFoldMason'), true);
});

// --- copy-on-write and incompatible input at the tool layer --------------------------------------

test('select_hits copies a selection, and never overwrites one', async () => {
    const { tools } = await toolsFor();
    await runTool(tools, 'select_hits', { ticketId: 'TICKET1', ids: ['0#0'], name: 'draft' });

    const copied = await runTool(tools, 'select_hits',
        { ticketId: 'TICKET1', action: 'copy', fromName: 'draft', name: 'to-foldmason__001' });
    assert.equal(copied.size, 1);

    const collision = await runTool(tools, 'select_hits',
        { ticketId: 'TICKET1', action: 'copy', fromName: 'draft', name: 'to-foldmason__001' });
    assert.equal(collision.isError, true);
    assert.equal(collision.code, 'SELECTION_COLLISION');

    const noSource = await runTool(tools, 'select_hits',
        { ticketId: 'TICKET1', action: 'copy', name: 'x' });
    assert.equal(noSource.code, 'INVALID_INPUT');
    assert.match(noSource.error, /fromName/);
});

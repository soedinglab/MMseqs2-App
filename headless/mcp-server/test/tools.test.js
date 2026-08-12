// The tool layer, exercised without the MCP SDK or a stdio pipe — see src/tools.js for why those
// are separable. The client is stubbed, so these assert which client call each tool makes and how a
// failure is turned into a result an agent can act on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UnsupportedOnDeploymentError } from 'mmseqs2-agent-core';
import { createTools, runTool } from '../src/tools.js';

const DATABASES = [
    { path: 'pdb100', name: 'PDB', status: 'COMPLETE', complex: true, motif: false, interface: false, taxonomy: true },
    { path: 'afdb50', name: 'AFDB', status: 'COMPLETE', complex: false, motif: false, interface: false },
    { path: 'pdb_folddisco', name: 'PDB motif', status: 'COMPLETE', complex: false, motif: true, interface: false },
    { path: 'ifacedb', name: 'Interfaces', status: 'COMPLETE', complex: true, motif: false, interface: true },
];

/** Minimal stand-in for the core client; records what was called. */
function stubClient(overrides = {}) {
    const calls = [];
    const record = (name, ...args) => { calls.push({ name, args }); };
    const client = {
        calls,
        async getDatabases() { record('getDatabases'); return DATABASES; },
        async submitFoldseekSearch(a) { record('submitFoldseekSearch', a); return { id: 'FS1', status: 'PENDING' }; },
        async submitMultimerSearch(a) { record('submitMultimerSearch', a); return { id: 'MM1', status: 'PENDING' }; },
        async submitFoldMason(a) { record('submitFoldMason', a); return { id: 'FM1', status: 'PENDING' }; },
        async submitFoldDisco(a) { record('submitFoldDisco', a); return { id: 'FD1', status: 'PENDING' }; },
        async pollTicket(t) { record('pollTicket', t); return { id: t, status: 'COMPLETE' }; },
        async getTicketType(t) { record('getTicketType', t); return { type: 'structuresearch' }; },
        async waitForCompletion(t) { record('waitForCompletion', t); return { id: t, status: 'COMPLETE' }; },
        async getResult(t, e) { record('getResult', t, e); return { getTable: opts => ({ ok: true, from: 'foldseek', opts }) }; },
        async getFoldDiscoResult(t) { record('getFoldDiscoResult', t); return { getTable: opts => ({ ok: true, from: 'folddisco', opts }) }; },
        // Dispatches the way the real client does, so the tools' behaviour is still observable
        // through which fetch it ends up making.
        async getResultTable(t, { entry = 0 } = {}) {
            record('getResultTable', t, entry);
            const { type } = await client.getTicketType(t);
            return type === 'folddisco' ? client.getFoldDiscoResult(t) : client.getResult(t, entry);
        },
        async resultUrl(t) { record('resultUrl', t); return `https://example.test/result/${t}/0`; },
        async getFoldMasonResult(t) {
            record('getFoldMasonResult', t);
            return { entries: [{ name: 'a', aa: '--AB' }, { name: 'b', aa: 'CD--' }], statistics: { msaLDDT: 0.5 }, tree: '(a,b);' };
        },
        async getQueries(t, o) { record('getQueries', t, o); return { lookup: [] }; },
        async listCachedTickets(o) { record('listCachedTickets', o); return [{ id: 'T1', kind: 'search', lastStatus: 'COMPLETE' }]; },
        ...overrides,
    };
    return client;
}

test('every tool is fully declared', () => {
    const tools = createTools(stubClient());
    assert.ok(tools.length >= 10, `expected the Phase 1 tool set, got ${tools.length}`);
    for (const tool of tools) {
        assert.match(tool.name, /^[a-z][a-z0-9_]*$/, `${tool.name} should be snake_case`);
        assert.ok(tool.description?.length > 20, `${tool.name} needs a usable description`);
        assert.equal(tool.inputSchema.type, 'object', `${tool.name} schema`);
        assert.equal(typeof tool.handler, 'function');
        for (const required of tool.inputSchema.required ?? []) {
            assert.ok(required in tool.inputSchema.properties, `${tool.name}.${required} must be described`);
        }
    }
    assert.equal(new Set(tools.map(t => t.name)).size, tools.length, 'tool names must be unique');
});

test('list_databases reports which tool each database can be used with', async () => {
    const tools = createTools(stubClient());
    const { databases } = await runTool(tools, 'list_databases', {});
    const byPath = Object.fromEntries(databases.map(d => [d.path, d.usableFor]));

    assert.deepEqual(byPath.pdb100, ['foldseek_search', 'foldseek_search (multimer)']);
    assert.deepEqual(byPath.afdb50, ['foldseek_search']);
    assert.deepEqual(byPath.pdb_folddisco, ['folddisco_search']);
    assert.deepEqual(byPath.ifacedb, [], 'an interface-only database suits none of the exposed tools');
});

test('a search returns the ticket immediately when no wait is asked for', async () => {
    const client = stubClient();
    const tools = createTools(client);
    const out = await runTool(tools, 'foldseek_search', { query: 'x', databases: ['pdb100'] });

    assert.deepEqual(out, { ticketId: 'FS1', status: 'PENDING' });
    assert.ok(!client.calls.some(c => c.name === 'waitForCompletion'), 'should not wait unasked');
});

test('waitTimeoutMs waits, and a timeout is reported rather than thrown', async () => {
    const waited = stubClient();
    const tools = createTools(waited);
    assert.deepEqual(
        await runTool(tools, 'foldseek_search', { query: 'x', databases: ['pdb100'], waitTimeoutMs: 5000 }),
        { ticketId: 'FS1', status: 'COMPLETE' },
    );
    assert.ok(waited.calls.some(c => c.name === 'waitForCompletion'));

    const slow = stubClient({
        async waitForCompletion() {
            const err = new Error('timed out');
            err.timedOut = true;
            err.status = 'RUNNING';
            throw err;
        },
    });
    assert.deepEqual(
        await runTool(createTools(slow), 'foldseek_search', { query: 'x', databases: ['pdb100'], waitTimeoutMs: 1 }),
        { ticketId: 'FS1', status: 'RUNNING', timedOut: true },
    );
});

test('a job that ends in ERROR is a failure, not a status', async () => {
    const client = stubClient({
        async waitForCompletion() {
            const err = new Error('ticket FS1 finished with status ERROR');
            err.status = 'ERROR';
            throw err;
        },
    });
    const out = await runTool(createTools(client), 'foldseek_search',
        { query: 'x', databases: ['pdb100'], waitTimeoutMs: 5000 });
    assert.equal(out.isError, true);
    assert.match(out.error, /ERROR/);
});

test('get_result_table dispatches on the ticket job type', async () => {
    const foldseek = stubClient();
    const fsTable = await runTool(createTools(foldseek), 'get_result_table', { ticketId: 'T', db: 'pdb100', limit: 3 });
    assert.equal(fsTable.from, 'foldseek');
    assert.deepEqual(fsTable.opts, { db: 'pdb100', limit: 3 });
    assert.ok(foldseek.calls.some(c => c.name === 'getResult'));

    const folddisco = stubClient({ async getTicketType() { return { type: 'folddisco' }; } });
    const fdTable = await runTool(createTools(folddisco), 'get_result_table', { ticketId: 'T', db: 'pdb_folddisco' });
    assert.equal(fdTable.from, 'folddisco');
    assert.ok(folddisco.calls.some(c => c.name === 'getFoldDiscoResult'));
    assert.ok(!folddisco.calls.some(c => c.name === 'getResult'), 'a FoldDisco ticket must not use the Foldseek route');
});

test('get_result_table passes the entry index through for multi-query tickets', async () => {
    const client = stubClient();
    await runTool(createTools(client), 'get_result_table', { ticketId: 'T', entry: 3, db: 'pdb100' });
    const call = client.calls.find(c => c.name === 'getResult');
    assert.deepEqual(call.args, ['T', 3]);
    const passed = await runTool(createTools(client), 'get_result_table', { ticketId: 'T', db: 'pdb100' });
    assert.equal(passed.opts.entry, undefined, 'entry is a fetch argument, not a table option');
});

test('submit_ticket routes to each tool and rejects an unknown one', async () => {
    for (const [tool, expected] of [
        ['foldseek', 'submitFoldseekSearch'], ['multimer', 'submitMultimerSearch'],
        ['foldmason', 'submitFoldMason'], ['folddisco', 'submitFoldDisco'],
    ]) {
        const client = stubClient();
        const out = await runTool(createTools(client), 'submit_ticket', { tool, query: 'x', databases: ['pdb100'] });
        assert.ok(client.calls.some(c => c.name === expected), `${tool} -> ${expected}`);
        assert.ok(out.ticketId, `${tool} should return a ticket id`);
        assert.equal(out.status, 'PENDING');
    }
    const bad = await runTool(createTools(stubClient()), 'submit_ticket', { tool: 'blast' });
    assert.equal(bad.isError, true);
    assert.match(bad.error, /unknown tool: blast/);
});

test('get_ticket_status reports status, job type and the page URL together', async () => {
    const out = await runTool(createTools(stubClient()), 'get_ticket_status', { ticketId: 'T' });
    assert.deepEqual(out, {
        ticketId: 'T', status: 'COMPLETE', jobType: 'structuresearch',
        resultUrl: 'https://example.test/result/T/0',
    });
});

test('get_ticket_status still reports status when the job type or URL cannot be read', async () => {
    const client = stubClient({
        async getTicketType() { throw new Error('no job.json'); },
        async resultUrl() { throw new Error('unknown type'); },
    });
    const out = await runTool(createTools(client), 'get_ticket_status', { ticketId: 'T' });
    assert.deepEqual(out, { ticketId: 'T', status: 'COMPLETE', jobType: null, resultUrl: null });
});

test('get_foldmason_result reports the shape of the alignment by default', async () => {
    const tools = createTools(stubClient());
    const lean = await runTool(tools, 'get_foldmason_result', { ticketId: 'T' });
    assert.equal(lean.entryCount, 2);
    assert.equal(lean.columns, 4);
    assert.equal(lean.entries.length, 2);
    assert.ok(lean.statistics, 'statistics come by default');
    assert.equal(lean.tree, undefined, 'the tree is opt-in');
    assert.equal(lean.fasta, undefined);

    const statsOnly = await runTool(tools, 'get_foldmason_result', { ticketId: 'T', include: ['statistics'] });
    assert.ok(statsOnly.statistics);
    assert.equal(statsOnly.entries, undefined);
});

test('list_cached_tickets is a local read', async () => {
    const client = stubClient();
    const out = await runTool(createTools(client), 'list_cached_tickets', { limit: 5 });
    assert.deepEqual(out.tickets, [{
        ticketId: 'T1', kind: 'search', jobType: undefined, submittedAt: undefined,
        lastStatus: 'COMPLETE', lastPolledAt: undefined, request: undefined,
    }]);
    assert.deepEqual(client.calls, [{ name: 'listCachedTickets', args: [{ limit: 5 }] }]);
});

test('an unsupported job type says so, distinctly from any other failure', async () => {
    const client = stubClient({
        async submitFoldDisco() { throw new UnsupportedOnDeploymentError('folddisco'); },
    });
    const out = await runTool(createTools(client), 'folddisco_search',
        { query: 'x', databases: ['pdb_folddisco'], motif: 'A1' });

    assert.equal(out.isError, true);
    assert.equal(out.unsupportedTool, 'folddisco');
    assert.match(out.error, /does not serve folddisco/);
});

test('a validation failure reaches the caller with its reason intact', async () => {
    const client = stubClient({
        async submitFoldDisco() { throw new Error('invalid FoldDisco motif: 1 residue(s) are not in the query structure: A999'); },
    });
    const out = await runTool(createTools(client), 'folddisco_search',
        { query: 'x', databases: ['pdb_folddisco'], motif: 'A999' });

    assert.equal(out.isError, true);
    assert.match(out.error, /A999/, 'the agent needs to know which residue was wrong');
    assert.equal(out.unsupportedTool, undefined);
});

test('an unknown tool name is a result, not a crash', async () => {
    const out = await runTool(createTools(stubClient()), 'no_such_tool', {});
    assert.equal(out.isError, true);
    assert.match(out.error, /unknown tool: no_such_tool/);
});

test('the FoldMason column tools are advertised and route to the client', async () => {
    const client = stubClient({
        async getFoldMasonColumns(t, opts) { return { called: 'columns', ticket: t, opts }; },
        async getFoldMasonColumnSummary(t, opts) { return { called: 'summary', ticket: t, opts }; },
    });
    const tools = createTools(client);

    const summary = await runTool(tools, 'get_foldmason_column_summary',
        { ticketId: 'FM1', metrics: ['lddt', 'conservation'], primary: 'lddt' });
    assert.equal(summary.called, 'summary');
    assert.deepEqual(summary.opts.metrics, ['lddt', 'conservation']);
    assert.equal(summary.opts.ticketId, undefined, 'the ticket is an argument, not an option');

    const columns = await runTool(tools, 'get_foldmason_columns',
        { ticketId: 'FM1', columns: [1, 2], metrics: ['quality'] });
    assert.equal(columns.called, 'columns');
    assert.deepEqual(columns.opts.columns, [1, 2]);
    // A default cap matters here: a long alignment would otherwise return every column.
    assert.equal(columns.opts.limit, 50);
    assert.equal((await runTool(tools, 'get_foldmason_columns', { ticketId: 'FM1', limit: 0 })).opts.limit, 0,
        'limit:0 must stay 0 — that is how a caller asks for everything');
});

test('the column tools describe the metrics they accept', () => {
    const tools = createTools(stubClient());
    for (const name of ['get_foldmason_columns', 'get_foldmason_column_summary']) {
        const tool = tools.find(t => t.name === name);
        const metrics = tool.inputSchema.properties.metrics;
        assert.ok(metrics.items.enum.includes('lddt'), `${name} should offer lddt`);
        assert.ok(metrics.items.enum.includes('conservation'), `${name} should offer conservation`);
        assert.match(tool.description, /lddt|LDDT/, `${name} should say what it ranks on`);
    }
});

test('get_result_table switches shape on view, and get_taxonomy is its own tool', async () => {
    const client = stubClient({
        async getResultTable(t, o) {
            return {
                getTable: opts => ({ shape: 'rows', opts }),
                getTableSummary: opts => ({ shape: 'summary', opts }),
                getTaxonomy: (db, opts) => ({ shape: 'taxonomy', db, opts }),
            };
        },
        async getTaxonomy(t, o) { return { shape: 'taxonomy', ticket: t, opts: o }; },
    });
    const tools = createTools(client);

    assert.equal((await runTool(tools, 'get_result_table', { ticketId: 'T' })).shape, 'rows');
    const summary = await runTool(tools, 'get_result_table', { ticketId: 'T', view: 'summary', topN: 2, merged: true });
    assert.equal(summary.shape, 'summary');
    assert.deepEqual(summary.opts, { topN: 2, merged: true }, 'view must not leak into the options');

    const tax = await runTool(tools, 'get_taxonomy', { ticketId: 'T', db: 'pdb100', maxRows: 5 });
    assert.equal(tax.shape, 'taxonomy');
    assert.deepEqual(tax.opts, { db: 'pdb100', maxRows: 5 });
});

test('filters reach the table untouched', async () => {
    const client = stubClient({
        async getResultTable() { return { getTable: opts => opts, getTableSummary: opts => opts }; },
    });
    const out = await runTool(createTools(client), 'get_result_table', {
        ticketId: 'T', taxonFilter: { taxon: 'Bacteria' }, motifFilter: '1010',
    });
    assert.deepEqual(out.taxonFilter, { taxon: 'Bacteria' });
    assert.equal(out.motifFilter, '1010');
});

test('submit_ticket validateOnly never submits', async () => {
    const client = stubClient({
        async validateSubmission(args) { return { ok: true, tool: args.tool, would: {} }; },
    });
    const tools = createTools(client);

    const validated = await runTool(tools, 'submit_ticket',
        { tool: 'foldseek', query: 'x', databases: ['pdb100'], validateOnly: true });
    assert.equal(validated.ok, true);
    assert.ok(client.calls.every(c => !c.name.startsWith('submit')), 'no submit call may be made');

    await runTool(tools, 'submit_ticket', { tool: 'foldseek', query: 'x', databases: ['pdb100'] });
    assert.ok(client.calls.some(c => c.name === 'submitFoldseekSearch'), 'without the flag it submits');
});

test('get_ticket_status carries the page URL', async () => {
    const client = stubClient({ async resultUrl(t) { return `https://example.test/result/${t}/0`; } });
    const out = await runTool(createTools(client), 'get_ticket_status', { ticketId: 'T' });
    assert.equal(out.resultUrl, 'https://example.test/result/T/0');
});

test('get_foldmason_result includes only what was asked for', async () => {
    const client = stubClient({
        async getFoldMasonResult() {
            return {
                entries: [{ name: 'a', aa: 'AB', ss: 'AB', ca: '1,2,3' }, { name: 'b', aa: 'CD', ss: 'CD', ca: '4,5,6' }],
                statistics: { msaLDDT: 0.5 }, tree: '(a,b);',
            };
        },
    });
    const tools = createTools(client);

    const lean = await runTool(tools, 'get_foldmason_result', { ticketId: 'T' });
    assert.ok(lean.statistics && lean.entries, 'statistics and the roster are the default');
    assert.equal(lean.fasta, undefined);
    assert.equal(lean.coordinates, undefined, 'coordinates are never default — they dominate the payload');
    assert.equal(lean.tree, undefined);

    const full = await runTool(tools, 'get_foldmason_result',
        { ticketId: 'T', include: ['fasta', 'coordinates', 'tree'] });
    assert.match(full.fasta.fasta, /^>a\nAB/);
    assert.equal(full.coordinates.returned, 1, 'one entry unless others are named');
    assert.equal(full.tree, '(a,b);');
    assert.equal(full.statistics, undefined, 'include is exhaustive, not additive');
});

test('the column tool forwards the masking and letter options', async () => {
    const client = stubClient({ async getFoldMasonColumns(t, opts) { return { opts }; } });
    const { opts } = await runTool(createTools(client), 'get_foldmason_columns',
        { ticketId: 'T', minOccupancy: 0.8, includeLetters: true, maxLetters: 3 });
    assert.equal(opts.minOccupancy, 0.8);
    assert.equal(opts.includeLetters, true);
    assert.equal(opts.maxLetters, 3);
});

// The advertised surface: exactly eleven tools, each declared, none of them able to block.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UnsupportedOnDeploymentError } from 'foldseek-server-lib';
import { createTools, runTool } from '../src/tools.js';

const EXPECTED = [
    'export_result',
    'folddisco_search',
    'foldmason_msa',
    'foldseek_search',
    'get_result_summary',
    'get_ticket_status',
    'list_databases',
    'multimer_search',
    'select_hits',
    'select_msa_columns',
    'send_to',
];

const WITHDRAWN = [
    'submit_ticket', 'get_result_table', 'get_taxonomy', 'get_queries', 'get_foldmason_result',
    'get_foldmason_column_summary', 'get_foldmason_columns', 'load_accession', 'list_cached_tickets',
];

const DATABASES = [
    { path: 'pdb100', name: 'PDB', version: '2024', status: 'COMPLETE', complex: true, motif: false, interface: false, taxonomy: true },
    { path: 'afdb50', name: 'AFDB', version: '4', status: 'COMPLETE', complex: false, motif: false, interface: false },
    { path: 'pdb_folddisco', name: 'PDB motif', status: 'COMPLETE', complex: false, motif: true, interface: false },
    { path: 'ifacedb', name: 'Interfaces', status: 'COMPLETE', complex: true, motif: false, interface: true },
];

function stubClient(overrides = {}) {
    const calls = [];
    const record = (name, ...args) => calls.push({ name, args });
    const client = {
        calls,
        submitted: () => calls.filter(c => c.name.startsWith('submit')),
        async getDatabases() { return DATABASES; },
        async submitFoldseekSearch(a) { record('submitFoldseekSearch', a); return { id: 'FS1', status: 'PENDING' }; },
        async submitMultimerSearch(a) { record('submitMultimerSearch', a); return { id: 'MM1', status: 'PENDING' }; },
        async submitFoldMason(a) { record('submitFoldMason', a); return { id: 'FM1', status: 'PENDING' }; },
        async submitFoldDisco(a) { record('submitFoldDisco', a); return { id: 'FD1', status: 'PENDING' }; },
        async validateSubmission(a) { record('validateSubmission', a); return { ok: true, tool: a.tool, problems: [] }; },
        async waitForCompletion(t) { record('waitForCompletion', t); return { id: t, status: 'COMPLETE' }; },
        async pollTicket(t) { record('pollTicket', t); return { id: t, status: 'COMPLETE' }; },
        async getTicketType(t) { record('getTicketType', t); return { type: 'structuresearch' }; },
        async resultUrl(t) { return `https://example.test/result/${t}/0`; },
        store: { async readTicket() { return null; } },
        async getResultSummary(t, e) { record('getResultSummary', t, e); return { schema: 'foldseek-server/result-summary@1', ticket: t, queryIdx: e }; },
        async exportResult(t, e) { record('exportResult', t, e); return { artifactId: 'a'.repeat(64), ticket: t, queryIdx: e }; },
        ...overrides,
    };
    return client;
}

test('exactly eleven tools are advertised, and the withdrawn ones are gone', () => {
    const tools = createTools(stubClient());
    assert.deepEqual(tools.map(t => t.name).sort(), EXPECTED);
    assert.equal(tools.length, 11);
    for (const name of WITHDRAWN) {
        assert.equal(tools.some(t => t.name === name), false, `${name} must not be advertised`);
    }
});

test('every tool is fully declared, and declared briefly', () => {
    for (const tool of createTools(stubClient())) {
        assert.match(tool.name, /^[a-z][a-z0-9_]*$/);
        assert.equal(tool.inputSchema.type, 'object');
        assert.equal(typeof tool.handler, 'function');

        // A tool an agent must read a paragraph about is a tool with the wrong shape.
        assert.ok(tool.description.length > 40, `${tool.name} needs a description`);
        assert.ok(tool.description.length <= 220,
            `${tool.name} description is ${tool.description.length} chars — keep it to two lines`);
        // Nested too: a description moved into `items` still costs the same tokens to read.
        const walk = (properties, prefix) => {
            for (const [field, spec] of Object.entries(properties ?? {})) {
                if (spec.description) {
                    assert.ok(spec.description.length <= 130,
                        `${prefix}${field} description is ${spec.description.length} chars`);
                }
                walk(spec.properties, `${prefix}${field}.`);
                walk(spec.items?.properties, `${prefix}${field}[].`);
            }
        };
        walk(tool.inputSchema.properties, `${tool.name}.`);
    }
});

test('no tool can be asked to block, and only get_ticket_status polls', () => {
    const tools = createTools(stubClient());
    for (const tool of tools) {
        const schema = JSON.stringify(tool.inputSchema);
        assert.equal(schema.includes('waitTimeoutMs'), false, `${tool.name} must not take a wait`);
        assert.equal(schema.includes('timeout'), false, `${tool.name} must not take a timeout`);
    }
    assert.equal(JSON.stringify(tools.map(t => t.handler.toString())).includes('waitForCompletion'), false);
});

test('each submit tool returns a ticket immediately', async () => {
    const client = stubClient();
    const tools = createTools(client);
    const cases = [
        ['foldseek_search', { query: 'ATOM', databases: ['afdb50'] }, 'FS1'],
        ['multimer_search', { query: 'ATOM', databases: ['pdb100'] }, 'MM1'],
        ['foldmason_msa', { files: [{ name: 'a.pdb', content: 'ATOM' }, { name: 'b.pdb', content: 'ATOM' }] }, 'FM1'],
        ['folddisco_search', { query: 'ATOM', databases: ['pdb_folddisco'], motif: 'A1' }, 'FD1'],
    ];
    for (const [name, args, id] of cases) {
        const out = await runTool(tools, name, args);
        assert.equal(out.ticketId, id, name);
        assert.equal(out.status, 'PENDING');
    }
    assert.equal(client.calls.some(c => c.name === 'waitForCompletion'), false, 'nothing waited');
});

test('validateOnly checks without queueing, on all four submit tools', async () => {
    const client = stubClient();
    const tools = createTools(client);
    for (const [name, args] of [
        ['foldseek_search', { query: 'ATOM', databases: ['afdb50'], validateOnly: true }],
        ['multimer_search', { query: 'ATOM', databases: ['pdb100'], validateOnly: true }],
        ['foldmason_msa', { files: [{ name: 'a', content: 'x' }, { name: 'b', content: 'y' }], validateOnly: true }],
        ['folddisco_search', { query: 'ATOM', databases: ['pdb_folddisco'], motif: 'A1', validateOnly: true }],
    ]) {
        const out = await runTool(tools, name, args);
        assert.equal(out.ok, true, name);
        assert.equal(out.ticketId, undefined, `${name} must not queue anything`);
    }
    assert.equal(client.submitted().length, 0);
    assert.equal(client.calls.filter(c => c.name === 'validateSubmission').length, 4);
});

test('foldseek_search is monomer only; multimer_search ignores what does not apply', async () => {
    const client = stubClient();
    const tools = createTools(client);

    assert.equal(JSON.stringify(tools.find(t => t.name === 'foldseek_search').inputSchema)
        .includes('multimer'), false, 'no multimer switch');
    const complexMode = await runTool(tools, 'foldseek_search',
        { query: 'ATOM', databases: ['pdb100'], mode: 'complex-3diaa' });
    assert.equal(complexMode.code, 'INVALID_INPUT');
    assert.match(complexMode.error, /multimer_search/);

    const schema = tools.find(t => t.name === 'multimer_search').inputSchema.properties;
    assert.equal(schema.iterativeSearch, undefined, 'complex search has no iterative mode');
    // taxFilter does apply: ComplexSearchJob carries TaxFilter, it is part of the job hash, and the
    // worker passes it through. Only the *result* lacks taxonomy reports.
    assert.ok(schema.taxFilter, 'a complex search can be restricted by taxon');

    // Refused, not ignored: an argument the backend drops in silence would leave a caller believing
    // they had filtered.
    const iterative = await runTool(tools, 'multimer_search',
        { query: 'ATOM', databases: ['pdb100'], iterativeSearch: true });
    assert.equal(iterative.code, 'INVALID_INPUT');
    assert.match(iterative.error, /iterativeSearch is not a multimer_search argument/);

    const taxed = await runTool(tools, 'multimer_search',
        { query: 'ATOM', databases: ['pdb100'], taxFilter: '9606' });
    assert.equal(taxed.isError, undefined, 'a taxon filter is accepted');

    // FoldDiscoJob has neither field, so both are refused rather than dropped.
    for (const field of ['taxFilter', 'mode']) {
        const out = await runTool(tools, 'folddisco_search',
            { query: 'ATOM', databases: ['pdb_folddisco'], motif: 'A1', [field]: 'x' });
        assert.equal(out.code, 'INVALID_INPUT', field);
        assert.match(out.error, new RegExp(`${field} is not a folddisco_search argument`));
    }
    // The filter reaches the client rather than being blanked on the way through.
    const sent = client.submitted().at(-1).args[0];
    assert.equal(sent.taxFilter, '9606');
    assert.equal(sent.iterativeSearch, undefined, 'not sent, because it was never accepted');
});

test('list_databases filters to what a given tool accepts', async () => {
    const tools = createTools(stubClient());

    const all = await runTool(tools, 'list_databases', {});
    assert.deepEqual(all.databases.map(d => d.path),
        ['pdb100', 'afdb50', 'pdb_folddisco', 'ifacedb']);
    assert.deepEqual(all.databases.find(d => d.path === 'pdb100').usableFor,
        ['foldseek', 'multimer']);
    assert.equal(all.databases.find(d => d.path === 'pdb100').version, '2024');

    for (const [tool, expected] of [
        ['foldseek', ['pdb100', 'afdb50']],
        ['multimer', ['pdb100']],
        ['folddisco', ['pdb_folddisco']],
    ]) {
        const out = await runTool(tools, 'list_databases', { tool });
        assert.deepEqual(out.databases.map(d => d.path), expected, tool);
        assert.equal(out.databases[0].usableFor, undefined, 'the filter already answered that');
    }
});

test('the summary and export tools pass through the ticket and queryIdx, and nothing else', async () => {
    const client = stubClient();
    const tools = createTools(client);

    // The intent is that neither tool grows a query language: no fields, sorting, filtering or limits.
    // `mountRoot` is not a query — it says where the caller sees the files, which only it can know.
    const allowed = {
        get_result_summary: ['ticketId', 'queryIdx'],
        export_result: ['ticketId', 'queryIdx', 'mountRoot'],
    };
    for (const [name, keys] of Object.entries(allowed)) {
        const tool = tools.find(t => t.name === name);
        assert.deepEqual(Object.keys(tool.inputSchema.properties), keys,
            `${name} takes ${keys.join(', ')} and nothing else`);
    }

    assert.equal((await runTool(tools, 'get_result_summary', { ticketId: 'T1', queryIdx: 2 })).queryIdx, 2);
    assert.equal((await runTool(tools, 'export_result', { ticketId: 'T1' })).queryIdx, 0);
});

test('get_ticket_status reports the kind and the lineage, and survives a missing type', async () => {
    const tools = createTools(stubClient({
        store: { async readTicket() { return { derivedFrom: { ticket: 'SRC', origin: 'chains' } }; } },
    }));
    const out = await runTool(tools, 'get_ticket_status', { ticketId: 'T1' });
    assert.equal(out.status, 'COMPLETE');
    assert.equal(out.tool, 'foldseek');
    assert.equal(out.derivedFrom.ticket, 'SRC');

    const degraded = createTools(stubClient({
        async getTicketType() { throw new Error('no type'); },
        async resultUrl() { throw new Error('no url'); },
    }));
    const still = await runTool(degraded, 'get_ticket_status', { ticketId: 'T1' });
    assert.equal(still.status, 'COMPLETE');
    assert.equal(still.tool, null);
    assert.equal(still.resultUrl, null);
});

test('failures come back as results with a stable code', async () => {
    const tools = createTools(stubClient({
        async getResultSummary() { throw Object.assign(new Error('nope'), { code: 'RESULT_NOT_READY' }); },
        async exportResult() { throw Object.assign(new Error('404 from /api'), { status: 404 }); },
        async submitFoldDisco() { throw new UnsupportedOnDeploymentError('folddisco'); },
    }));

    assert.equal((await runTool(tools, 'get_result_summary', { ticketId: 'T1' })).code, 'RESULT_NOT_READY');
    assert.equal((await runTool(tools, 'export_result', { ticketId: 'T1' })).code, 'UNKNOWN_TICKET');

    const unsupported = await runTool(tools, 'folddisco_search',
        { query: 'ATOM', databases: ['pdb_folddisco'], motif: 'A1' });
    assert.equal(unsupported.code, 'UNSUPPORTED_ON_DEPLOYMENT');
    assert.equal(unsupported.unsupportedTool, 'folddisco');

    const unknown = await runTool(tools, 'no_such_tool', {});
    assert.equal(unknown.code, 'UNKNOWN_TOOL');
});

test('send_to refuses an unknown destination before touching a ticket', async () => {
    const client = stubClient();
    const out = await runTool(createTools(client), 'send_to',
        { from: { type: 'row', ticketId: 'T1', rowId: '0#0' }, tool: 'blastp' });
    assert.equal(out.code, 'INVALID_INPUT');
    assert.equal(client.calls.length, 0, 'nothing was fetched to find that out');
});

test('send_to refuses the options its destination does not have', async () => {
    const client = stubClient();
    const tools = createTools(client);
    const from = { type: 'row', ticketId: 'T1abcd', rowId: '0#0' };

    // The same fields the typed tools refuse, refused per destination: a forwarded job must not lose
    // a filter in transit.
    for (const [tool, field] of [['folddisco', 'taxFilter'], ['folddisco', 'mode'],
        ['foldmason', 'taxFilter'], ['multimer', 'iterativeSearch']]) {
        const out = await runTool(tools, 'send_to', { from, tool, databases: ['pdb100'], [field]: 'x' });
        assert.equal(out.code, 'INVALID_INPUT', `${tool}.${field}`);
        assert.match(out.error, new RegExp(`${field} is not a send_to ${tool} argument`));
    }

    // The refusal happens before the source is resolved, which is why this stub needs no result
    // table; the accepted path is covered against a full client in sendto-tools.test.js.
    const accepted = await runTool(tools, 'send_to',
        { from, tool: 'foldseek', databases: ['pdb100'], taxFilter: '9606' });
    assert.notEqual(accepted.code, 'INVALID_INPUT', 'a taxon filter is not foreign to foldseek');
});

test('every tool failure carries a code, and validateOnly is the other channel', async () => {
    const client = stubClient();
    const tools = createTools(client);

    // `code` was conditional on the thrown error having one, so a plain Error — the FoldMason arity
    // check — produced { isError, error } and refuted the documented shape.
    const failures = [
        ['send_to', { from: { type: 'row', ticketId: 'T1abcd', rowId: '0#0' }, tool: 'foldmason' }],
        ['send_to', { from: { type: 'row', ticketId: 'T1abcd', rowId: '0#0' }, tool: 'nope' }],
        ['foldseek_search', { databases: ['pdb100'] }],
        ['foldmason_msa', { files: [{ name: 'a.pdb', content: 'ATOM' }] }],
        ['folddisco_search', { query: 'ATOM', databases: ['pdb_folddisco'], taxFilter: '9606' }],
        ['select_hits', { ticketId: 'T1abcd', action: 'describe', name: 'missing' }],
    ];
    for (const [name, args] of failures) {
        const out = await runTool(tools, name, args);
        assert.equal(out.isError, true, `${name} ${JSON.stringify(args)}`);
        assert.ok(out.code, `${name} must carry a code, got ${JSON.stringify(out)}`);
        assert.ok(out.error, `${name} must carry a message`);
    }
    assert.ok((await runTool(tools, 'no_such_tool', {})).code);

    // The second channel: a dry run is a *successful* call whose verdict lives in `ok`, so it carries
    // no isError even when it found problems. A caller branching only on isError reads an unusable
    // database as a passing validation. (The stub always passes; the shape is the point here, and
    // live.test.js exercises a real refusal.)
    const dry = await runTool(tools, 'foldseek_search',
        { query: 'ATOM', databases: ['pdb100'], validateOnly: true });
    assert.equal(dry.isError, undefined, 'a dry run is not an error channel');
    assert.equal(typeof dry.ok, 'boolean', 'its verdict is `ok`');
    assert.ok(Array.isArray(dry.problems), 'with problems[] beside it');
});

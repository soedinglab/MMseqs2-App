// The tools themselves: name, schema, and handler, with no MCP SDK involved.
//
// Split out from server.js on purpose. The SDK is a transport — it reads stdio, matches a tool name
// and serializes a result — and none of that is what can be wrong here. What can be wrong is which
// endpoint a tool calls, what it validates before submitting, and what shape it returns. Keeping
// those in a plain module means they can be exercised against a real backend without a client
// process, an SDK install, or a stdio pipe.
//
// Handlers return plain objects; server.js does the JSON-and-content-block wrapping.

import { UnsupportedOnDeploymentError } from 'mmseqs2-agent-core';

/**
 * Submit, then optionally wait. A wait that runs out is not a failure: the ticket exists and the
 * caller can poll it, so the timeout is reported as a status rather than thrown. Anything else —
 * a rejected motif, an unusable database, a job that finished in ERROR — is a real failure and
 * surfaces as one.
 */
async function submitAndMaybeWait(client, submit, { waitTimeoutMs = 0 } = {}) {
    const ticket = await submit();
    const out = { ticketId: ticket.id, status: ticket.status ?? 'PENDING' };
    if (!waitTimeoutMs) return out;

    try {
        const done = await client.waitForCompletion(ticket.id, { timeoutMs: waitTimeoutMs });
        out.status = done.status;
    } catch (err) {
        if (err.timedOut) return { ...out, status: err.status ?? 'RUNNING', timedOut: true };
        throw err;
    }
    return out;
}

const QUERY = { type: 'string', description: 'Query structure as PDB or mmCIF text.' };
const DATABASES = {
    type: 'array', items: { type: 'string' },
    description: 'Database paths, as returned by list_databases (e.g. "pdb100", "afdb50").',
};
const WAIT = {
    type: 'number',
    description: 'Milliseconds to wait for completion. Omit or 0 to return as soon as it is queued.',
};

export function createTools(client) {
    const tools = [
        {
            name: 'list_databases',
            description:
                'Databases this server offers, with the capability flags that decide which job ' +
                'types can use each one. Call this before searching: a database name that is valid ' +
                'for one tool is often not valid for another.',
            inputSchema: { type: 'object', properties: {} },
            async handler() {
                const dbs = await client.getDatabases();
                return {
                    databases: dbs.map(d => ({
                        path: d.path, name: d.name, version: d.version, status: d.status,
                        default: !!d.default, taxonomy: !!d.taxonomy,
                        usableFor: [
                            !d.interface && !d.motif ? 'foldseek_search' : null,
                            d.complex && !d.interface && !d.motif ? 'foldseek_search (multimer)' : null,
                            d.motif && !d.interface ? 'folddisco_search' : null,
                        ].filter(Boolean),
                    })),
                };
            },
        },

        {
            name: 'foldseek_search',
            description:
                'Search a query structure against structure databases. Set multimer:true for a ' +
                'complex (FS-MM) search, which uses a different set of databases and does not ' +
                'support iterativeSearch.',
            inputSchema: {
                type: 'object',
                required: ['query', 'databases'],
                properties: {
                    query: QUERY,
                    databases: DATABASES,
                    mode: { type: 'string', description: 'Alignment mode, default "3diaa".' },
                    multimer: { type: 'boolean', description: 'Complex (FS-MM) search.' },
                    iterativeSearch: { type: 'boolean' },
                    taxFilter: {
                        type: 'string',
                        description: 'Numeric taxon ids, comma separated; entries after the first ' +
                                     'may be negated with "!" (e.g. "9606,!10090").',
                    },
                    email: { type: 'string' },
                    waitTimeoutMs: WAIT,
                },
            },
            handler(args) {
                return submitAndMaybeWait(client, () => client.submitFoldseekSearch(args), args);
            },
        },

        {
            name: 'foldmason_msa',
            description:
                'Build a multiple structure alignment from at least two structures. Each file needs ' +
                'a name — it becomes the entry name in the alignment.',
            inputSchema: {
                type: 'object',
                required: ['files'],
                properties: {
                    files: {
                        type: 'array',
                        minItems: 2,
                        items: {
                            type: 'object',
                            required: ['name', 'content'],
                            properties: {
                                name: { type: 'string' },
                                content: { type: 'string', description: 'PDB or mmCIF text.' },
                            },
                        },
                    },
                    email: { type: 'string' },
                    waitTimeoutMs: WAIT,
                },
            },
            handler(args) {
                return submitAndMaybeWait(client, () => client.submitFoldMason(args), args);
            },
        },

        {
            name: 'folddisco_search',
            description:
                'Search for a structural motif. The motif is a comma-separated residue list — ' +
                '"A123", bare "123", or "A123:W" for a substitution — and every residue must exist ' +
                'in the query structure.',
            inputSchema: {
                type: 'object',
                required: ['query', 'databases', 'motif'],
                properties: {
                    query: QUERY,
                    databases: { ...DATABASES, description: 'Motif-capable databases (see list_databases).' },
                    motif: { type: 'string' },
                    email: { type: 'string' },
                    waitTimeoutMs: WAIT,
                },
            },
            handler(args) {
                return submitAndMaybeWait(client, () => client.submitFoldDisco(args), args);
            },
        },

        {
            name: 'submit_ticket',
            description: 'Submit any of the above without waiting. Returns as soon as the job is queued.',
            inputSchema: {
                type: 'object',
                required: ['tool'],
                properties: {
                    tool: { type: 'string', enum: ['foldseek', 'multimer', 'foldmason', 'folddisco'] },
                    query: QUERY,
                    databases: DATABASES,
                    files: { type: 'array', items: { type: 'object' } },
                    motif: { type: 'string' },
                    mode: { type: 'string' },
                    iterativeSearch: { type: 'boolean' },
                    taxFilter: { type: 'string' },
                    email: { type: 'string' },
                },
            },
            async handler({ tool, ...rest }) {
                const submit = {
                    foldseek: () => client.submitFoldseekSearch(rest),
                    multimer: () => client.submitMultimerSearch(rest),
                    foldmason: () => client.submitFoldMason(rest),
                    folddisco: () => client.submitFoldDisco(rest),
                }[tool];
                if (!submit) throw new Error(`unknown tool: ${tool}`);
                const ticket = await submit();
                return { ticketId: ticket.id, status: ticket.status ?? 'PENDING' };
            },
        },

        {
            name: 'get_ticket_status',
            description: 'Current status of a ticket, and what kind of job it is.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: { ticketId: { type: 'string' } },
            },
            async handler({ ticketId }) {
                const [{ status }, type] = await Promise.all([
                    client.pollTicket(ticketId),
                    client.getTicketType(ticketId).catch(() => null),
                ]);
                return { ticketId, status, jobType: type?.type ?? null };
            },
        },

        {
            name: 'get_result_table',
            description:
                'Sorted, paginated hits for a completed ticket. Works for Foldseek and FoldDisco ' +
                'tickets alike — the job type decides which is fetched. `db` takes a database name, ' +
                'an index, an array of either, or "*" for all of them; with several databases the ' +
                'per-database default limit drops to 5.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    entry: { type: 'number', description: 'Query index for a multi-query ticket. Foldseek only.' },
                    db: { description: 'Database name, index, array of either, or "*".' },
                    sortKey: { type: 'string' },
                    sortOrder: { type: 'number' },
                    offset: { type: 'number' },
                    limit: { type: 'number' },
                    includeChains: { type: 'boolean' },
                    fields: { type: 'array', items: { type: 'string' } },
                    taxonFilter: {
                        type: 'object',
                        properties: {
                            taxId: { type: ['string', 'number'] },
                            includeDescendants: { type: 'boolean' },
                        },
                        description: 'Keep only hits under this taxon. Applied before sorting and ' +
                                     'paging, so total/returned describe the filtered set.',
                    },
                },
            },
            async handler({ ticketId, entry = 0, ...opts }) {
                const { type } = await client.getTicketType(ticketId);
                const table = type === 'folddisco'
                    ? await client.getFoldDiscoResult(ticketId)
                    : await client.getResult(ticketId, entry);
                return table.getTable(opts);
            },
        },

        {
            name: 'get_foldmason_result',
            description:
                'The alignment for a completed FoldMason ticket: entries, per-entry sequences and ' +
                'the guide tree. Pass includeEntries:false for just the statistics.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    includeEntries: { type: 'boolean' },
                },
            },
            async handler({ ticketId, includeEntries = true }) {
                const res = await client.getFoldMasonResult(ticketId);
                const summary = {
                    ticketId,
                    entryCount: res.entries?.length ?? 0,
                    columns: res.entries?.[0]?.aa?.length ?? 0,
                    statistics: res.statistics,
                };
                if (!includeEntries) return summary;
                return {
                    ...summary,
                    entries: (res.entries ?? []).map(e => ({ name: e.name, aa: e.aa })),
                    tree: res.tree,
                };
            },
        },

        {
            name: 'get_queries',
            description: 'The queries inside a ticket, and the entry index each one is reached by.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    limit: { type: 'number' },
                    page: { type: 'number' },
                },
            },
            handler({ ticketId, ...opts }) {
                return client.getQueries(ticketId, opts);
            },
        },

        {
            name: 'list_cached_tickets',
            description:
                'Tickets this agent has already seen, newest first, read from the local cache — no ' +
                'network, and it survives restarts.',
            inputSchema: {
                type: 'object',
                properties: { limit: { type: 'number' } },
            },
            async handler({ limit = 100 } = {}) {
                const tickets = await client.listCachedTickets({ limit });
                return {
                    tickets: tickets.map(t => ({
                        ticketId: t.id, kind: t.kind, jobType: t.jobType,
                        submittedAt: t.submittedAt, lastStatus: t.lastStatus,
                        lastPolledAt: t.lastPolledAt, request: t.request,
                    })),
                };
            },
        },
    ];

    return tools;
}

/**
 * Run a tool by name and normalise failure.
 *
 * A tool that throws should say what went wrong, not just that something did — the reason is
 * usually actionable (a database this deployment cannot use, a motif residue absent from the
 * query). UnsupportedOnDeploymentError is called out separately because it means "this server is
 * not built for that job type", which no amount of fixing the arguments will change.
 */
export async function runTool(tools, name, args = {}) {
    const tool = tools.find(t => t.name === name);
    if (!tool) return { isError: true, error: `unknown tool: ${name}` };
    try {
        return await tool.handler(args ?? {});
    } catch (err) {
        if (err instanceof UnsupportedOnDeploymentError) {
            return { isError: true, error: err.message, unsupportedTool: err.tool };
        }
        return { isError: true, error: err.message };
    }
}

// The tools themselves: name, schema, and handler, with no MCP SDK involved.
//
// Split out from server.js on purpose. The SDK is a transport — it reads stdio, matches a tool name
// and serializes a result — and none of that is what can be wrong here. What can be wrong is which
// endpoint a tool calls, what it validates before submitting, and what shape it returns. Keeping
// those in a plain module means they can be exercised against a real backend without a client
// process, an SDK install, or a stdio pipe.
//
// Handlers return plain objects; server.js does the JSON-and-content-block wrapping.

import {
    UnsupportedOnDeploymentError, COLUMN_METRICS,
    foldMasonEntries, foldMasonFasta, foldMasonCoordinates,
} from 'mmseqs2-agent-core';

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
    /** The four submit paths, shared by the search tools and submit_ticket. */
    const submitByTool = async (tool, args) => {
        const submit = {
            foldseek: () => client.submitFoldseekSearch(args),
            multimer: () => client.submitMultimerSearch(args),
            foldmason: () => client.submitFoldMason(args),
            folddisco: () => client.submitFoldDisco(args),
        }[tool];
        if (!submit) throw new Error(`unknown tool: ${tool}`);
        const ticket = await submit();
        return { ticketId: ticket.id, status: ticket.status ?? 'PENDING' };
    };

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
            description:
                'Submit any of the above without waiting. Returns as soon as the job is queued. Pass ' +
                'validateOnly:true to run every check — databases, motif against the query, taxon ' +
                'filter — and see what would be sent, without queueing anything.',
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
                    validateOnly: { type: 'boolean', description: 'Check without submitting.' },
                },
            },
            async handler({ tool, validateOnly = false, ...rest }) {
                if (validateOnly) return client.validateSubmission({ tool, ...rest });
                return submitByTool(tool, rest);
            },
        },

        {
            name: 'get_ticket_status',
            description:
                'Current status of a ticket, what kind of job it is, and the page URL where a human ' +
                'would read it.',
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
                const resultUrl = await client.resultUrl(ticketId).catch(() => null);
                return { ticketId, status, jobType: type?.type ?? null, resultUrl };
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
                    view: {
                        type: 'string', enum: ['rows', 'summary'],
                        description: '"rows" (default) returns hits. "summary" surveys every database ' +
                                     'without transporting rows — totals, the sort key\'s ' +
                                     'best/median/worst, and a small top sample. Start there.',
                    },
                    db: { description: 'Database name, index, array of either, or "*".' },
                    sortKey: { type: 'string' },
                    sortOrder: { type: 'number' },
                    offset: { type: 'number' },
                    limit: { type: 'number' },
                    includeChains: { type: 'boolean' },
                    fields: { type: 'array', items: { type: 'string' } },
                    topN: { type: 'number', description: 'summary view: sample per database, default 3; 0 for stats only.' },
                    merged: {
                        type: 'boolean',
                        description: 'summary view: add one ranking across every database. Up to 100 ' +
                                     'hits per database enter the pool regardless of topN.',
                    },
                    mergedLimit: { type: 'number', description: 'summary view: merged rows to return; defaults to topN.' },
                    taxonFilter: {
                        type: 'object',
                        properties: {
                            taxon: {
                                type: ['string', 'number', 'array'],
                                description: 'A taxId, a taxon name, or an array of either. Names are ' +
                                             'resolved within this database\'s own tree.',
                            },
                            taxId: { type: ['string', 'number'], description: 'Alias for taxon.' },
                            includeDescendants: {
                                type: 'boolean',
                                description: 'Default true. Hits carry leaf taxIds, so an internal ' +
                                             'node without its subtree matches nothing.',
                            },
                        },
                        description: 'Keep only hits under this taxon. Applied before sorting and ' +
                                     'paging, so total/returned describe the filtered set.',
                    },
                    motifFilter: {
                        type: ['string', 'array'],
                        description: 'FoldDisco only: keep hits whose matched-query-residue pattern ' +
                                     'equals this ("1" matched, "0" missing). See the summary view ' +
                                     'for which patterns exist.',
                    },
                },
            },
            async handler({ ticketId, entry = 0, view = 'rows', ...opts }) {
                const table = await client.getResultTable(ticketId, { entry });
                return view === 'summary' ? table.getTableSummary(opts) : table.getTable(opts);
            },
        },

        {
            name: 'get_taxonomy',
            description:
                'The taxa present in one database\'s hits, depth-ordered with clade read counts — ' +
                'what to filter on. Names from here can be passed straight to get_result_table\'s ' +
                'taxonFilter. A database without taxonomy says so rather than erroring.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    entry: { type: 'number' },
                    db: { description: 'Database name or index. Required unless the ticket has one.' },
                    minCladeReads: { type: 'number', description: 'Drop taxa below this count.' },
                    maxRows: { type: 'number', description: 'Default 200.' },
                },
            },
            handler({ ticketId, ...opts }) {
                return client.getTaxonomy(ticketId, opts);
            },
        },

        {
            name: 'get_foldmason_result',
            description:
                'The alignment for a completed FoldMason ticket. `include` picks what comes back: ' +
                'statistics (always), entries (the roster), fasta (aligned sequences), coordinates ' +
                '(CA traces), tree (the guide tree). Coordinates are never included unless asked for ' +
                '— they dominate the response — and default to one entry unless you name others.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    include: {
                        type: 'array',
                        items: { type: 'string', enum: ['statistics', 'entries', 'fasta', 'coordinates', 'tree'] },
                        description: 'Default ["statistics","entries"].',
                    },
                    representation: {
                        type: 'string', enum: ['aa', '3di'],
                        description: 'Which alignment fasta returns. Default aa.',
                    },
                    entries: {
                        type: 'array', items: { type: 'number' },
                        description: 'Entry indices for fasta/coordinates. Omit for a range (fasta) ' +
                                     'or the first entry (coordinates).',
                    },
                    offset: { type: 'number' },
                    limit: { type: 'number', description: 'fasta only; default 500.' },
                },
            },
            async handler({ ticketId, include = ['statistics', 'entries'], representation = 'aa', entries = null, offset = 0, limit = 500 }) {
                const res = await client.getFoldMasonResult(ticketId);
                const out = {
                    ticketId,
                    entryCount: res.entries?.length ?? 0,
                    columns: res.entries?.[0]?.aa?.length ?? 0,
                };
                const want = new Set(include);
                if (want.has('statistics')) out.statistics = res.statistics;
                if (want.has('entries')) out.entries = foldMasonEntries(res).entries;
                if (want.has('fasta')) out.fasta = foldMasonFasta(res, { representation, entries, offset, limit });
                if (want.has('coordinates')) out.coordinates = foldMasonCoordinates(res, { entries });
                if (want.has('tree')) out.tree = res.tree;
                return out;
            },
        },

        {
            name: 'get_foldmason_column_summary',
            description:
                'Where to look in a FoldMason alignment. Gives each metric\'s spread, the notable ' +
                'columns (identity, fully conserved, unconserved) as compressed ranges, the ' +
                'best-scoring columns, and the contiguous ranges where the ranking metric runs high, ' +
                'best region first. Ranked on LDDT by default, since that measures how well the ' +
                'structures superpose; the cut-off defaults to this alignment\'s own median rather ' +
                'than a fixed bar, which would return nothing on many real alignments. Cheap at any ' +
                'length — call this before get_foldmason_columns.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    representation: {
                        type: 'string', enum: ['aa', '3di'],
                        description: 'Amino acid (default) or 3Di. 3Di has no conservation.',
                    },
                    metrics: {
                        type: 'array', items: { type: 'string', enum: COLUMN_METRICS },
                        description: `Any of ${COLUMN_METRICS.join(', ')}. Default: all available.`,
                    },
                    primary: {
                        type: 'string', enum: COLUMN_METRICS.filter(m => m !== 'consensus'),
                        description: 'Metric the regions and top columns are ranked on. Default lddt.',
                    },
                    threshold: { description: 'A number, or "auto" (default) for a quantile.' },
                    quantile: { type: 'number', description: 'Used when threshold is "auto"; default 0.5.' },
                    minLength: { type: 'number', description: 'Shortest run to report; default 3.' },
                    maxRegions: { type: 'number', description: 'Regions returned, best first; default 10.' },
                    topColumns: { type: 'number', description: 'Columns returned, best first; default 10.' },
                },
            },
            handler({ ticketId, ...opts }) {
                return client.getFoldMasonColumnSummary(ticketId, opts);
            },
        },

        {
            name: 'get_foldmason_columns',
            description:
                'Per-column metrics for a completed FoldMason alignment: LDDT, quality ' +
                '(substitution-matrix agreement), conservation (which physicochemical properties ' +
                'every residue in the column shares), consensus, occupancy, entropy. Pass `metrics` ' +
                'for just the ones you need and `columns`/`offset`/`limit` to scope the range. ' +
                'Conservation is amino-acid only.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    representation: { type: 'string', enum: ['aa', '3di'] },
                    metrics: {
                        type: 'array', items: { type: 'string', enum: COLUMN_METRICS },
                        description: `Any of ${COLUMN_METRICS.join(', ')}. Default: all available.`,
                    },
                    columns: {
                        type: 'array', items: { type: 'number' },
                        description: 'Specific column indices. Omit for a contiguous range.',
                    },
                    offset: { type: 'number' },
                    limit: { type: 'number', description: 'Default 50; 0 means every column.' },
                    precision: { type: 'number', description: 'Decimal places for floats, default 4.' },
                    minOccupancy: {
                        type: 'number',
                        description: 'Drop columns whose occupancy is below this (0-1) — the gap ' +
                                     'masking the page applies with a threshold slider.',
                    },
                    includeLetters: {
                        type: 'boolean',
                        description: 'Add each column\'s residue composition with logo fractions.',
                    },
                    maxLetters: { type: 'number', description: 'Letters per column, default 5.' },
                },
            },
            handler({ ticketId, limit = 50, ...opts }) {
                return client.getFoldMasonColumns(ticketId, { limit, ...opts });
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

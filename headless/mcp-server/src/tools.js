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
    UnsupportedOnDeploymentError, COLUMN_METRICS, DESTINATIONS,
    foldMasonEntries, foldMasonFasta, foldMasonCoordinates, expandRanges,
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
const ACCESSION = {
    type: ['string', 'object'],
    description: 'Load the query from a public database instead of passing its text: an id, or ' +
                 '{id, source: "PDB"|"AlphaFoldDB"|"BFVD", autoMotif}. For a PDB id, a Q-BioLiP ' +
                 'binding site is looked up and used as the motif unless one is given.',
    properties: {
        id: { type: 'string' },
        source: { type: 'string', enum: ['PDB', 'AlphaFoldDB', 'BFVD'] },
        autoMotif: { type: 'boolean' },
    },
};
const DATABASES = {
    type: 'array', items: { type: 'string' },
    description: 'Database paths, as returned by list_databases (e.g. "pdb100", "afdb50").',
};
const WAIT = {
    type: 'number',
    description: 'Milliseconds to wait for completion. Omit or 0 to return as soon as it is queued.',
};

/**
 * A selection, short enough to read. `size` is always exact; the entry list is capped, because the
 * point of a selection is that it can hold a thousand rows without transporting them.
 */
function brief(selection, maxEntries) {
    const full = selection.describe();
    const entries = full.entries.slice(0, Math.max(0, maxEntries));
    return {
        ...full,
        entries,
        ...(full.entries.length > entries.length ? { entriesTruncated: full.entries.length } : {}),
    };
}

export function createTools(client) {
    /**
     * Turn send_to's `from` into something with a sendTo() — a row, a saved selection, a saved column
     * selection, or a freshly loaded accession.
     *
     * These are references rather than opaque handles on purpose. A row is already addressed by the
     * `id` get_result_table prints, and a selection by the ticket and name it was saved under; both
     * survive a restart and can be read back with the tool that made them. An encoded blob would be a
     * second addressing scheme that says nothing about what it points at.
     */
    const resolveSource = async (from) => {
        const type = from?.type;
        if (type === 'row') {
            const table = await client.getResultTable(from.ticketId, { entry: from.entry ?? 0 });
            return table.row(from.rowId);
        }
        if (type === 'selection') {
            const table = await client.getResultTable(from.ticketId, { entry: from.entry ?? 0 });
            const selection = await table.loadSelection(from.name ?? 'default');
            if (!selection) {
                throw new Error(`no saved selection named "${from.name ?? 'default'}" on ${from.ticketId}` +
                                ' — make one with select_hits first');
            }
            if (selection.size === 0) throw new Error('that selection is empty');
            return selection;
        }
        if (type === 'msaColumns') {
            const selection = await client.loadMsaSelection(from.ticketId, from.name ?? 'default');
            if (!selection) {
                throw new Error(`no saved column selection named "${from.name ?? 'default'}" on ` +
                                `${from.ticketId} — make one with select_msa_columns first`);
            }
            return selection;
        }
        throw new Error(`unknown source type: ${JSON.stringify(type)} ` +
                        '(expected row, selection or msaColumns). To search with a structure loaded ' +
                        'by accession, pass `accession` to the search tool itself — an accession is ' +
                        'not something a previous job produced.');
    };

    /**
     * Resolve an `accession` argument into the query a search tool submits.
     *
     * This belongs on the *submit* side rather than in send_to, which the first draft had wrong.
     * send_to forwards something a previous job produced and is addressed by that job's ticket; an
     * accession is a public identifier that depends on no ticket at all, so putting it there made two
     * unrelated things look like one. The page draws the same line — Load Accession is a control on
     * the search pages, not on a result page.
     *
     * For a PDB id with a Q-BioLiP binding site this also fills in the motif, so a FoldDisco search on
     * a known binding site is one call with no motif argument.
     */
    const queryFromAccession = async (spec) => {
        const id = typeof spec === 'string' ? spec : spec?.id ?? spec?.accession;
        if (!id) throw new Error('accession must be an id, or {id, source?, autoMotif?}');
        const loaded = await client.loadAccession(id, {
            source: (typeof spec === 'object' && spec.source) || 'PDB',
            autoMotif: typeof spec === 'object' && spec.autoMotif !== undefined ? spec.autoMotif : true,
        });
        return loaded;
    };

    /**
     * A search tool's query, from either `query` text or an `accession`. Returns the arguments to
     * submit with, plus what was loaded, so a caller can see which entry an accession resolved to —
     * AlphaFoldDB is a fuzzy search and can answer with a different one.
     */
    const resolveQuery = async ({ query, accession, motif }) => {
        if (query && accession) {
            throw new Error('pass either query or accession, not both');
        }
        if (!accession) return { query, motif };
        const loaded = await queryFromAccession(accession);
        return {
            query: loaded.text,
            // An explicit motif wins; the loaded one is a default, not an override.
            motif: motif ?? loaded.motif,
            loaded: loaded.describe(),
        };
    };

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
                required: ['databases'],
                properties: {
                    query: QUERY,
                    accession: ACCESSION,
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
            async handler({ accession, ...args }) {
                const resolved = await resolveQuery({ ...args, accession });
                const out = await submitAndMaybeWait(
                    client, () => client.submitFoldseekSearch({ ...args, query: resolved.query }), args);
                return resolved.loaded ? { ...out, loaded: resolved.loaded } : out;
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
                required: ['databases'],
                properties: {
                    query: QUERY,
                    accession: ACCESSION,
                    databases: { ...DATABASES, description: 'Motif-capable databases (see list_databases).' },
                    motif: {
                        type: 'string',
                        description: 'Required, unless an `accession` supplies one from Q-BioLiP.',
                    },
                    email: { type: 'string' },
                    waitTimeoutMs: WAIT,
                },
            },
            async handler({ accession, ...args }) {
                const resolved = await resolveQuery({ ...args, accession });
                const out = await submitAndMaybeWait(client, () => client.submitFoldDisco({
                    ...args, query: resolved.query, motif: resolved.motif,
                }), args);
                return resolved.loaded
                    ? { ...out, motif: resolved.motif, loaded: resolved.loaded }
                    : out;
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
                    accession: ACCESSION,
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
            async handler({ tool, validateOnly = false, accession, ...rest }) {
                const resolved = await resolveQuery({ ...rest, accession });
                const args = { ...rest, query: resolved.query, ...(resolved.motif ? { motif: resolved.motif } : {}) };
                const out = validateOnly
                    ? await client.validateSubmission({ tool, ...args })
                    : await submitByTool(tool, args);
                return resolved.loaded ? { ...out, loaded: resolved.loaded } : out;
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
                // Where this job came from, when it came from another one — the ticket, the row or
                // columns, and how the structure was assembled. Absent for a job submitted directly.
                // Wrapped rather than awaited directly: readTicket throws synchronously on an id the
                // cache will not build a path from, and a ticket whose record cannot be read still has
                // a status worth reporting.
                const record = await Promise.resolve()
                    .then(() => client.store.readTicket(ticketId))
                    .catch(() => null);
                return {
                    ticketId, status, jobType: type?.type ?? null, resultUrl,
                    ...(record?.derivedFrom ? { derivedFrom: record.derivedFrom } : {}),
                };
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
            name: 'select_hits',
            description:
                'Mark hits as selected, so send_to can forward them. Takes the row ids ' +
                'get_result_table prints ("dbIndex#entryIndex") — the id carries the database, so ' +
                'nothing else needs naming. The selection is saved against the ticket under a name ' +
                'and survives between calls, so "add" and "remove" adjust the one already there. ' +
                'Ids that do not resolve are rejected individually and reported, never silently ' +
                'dropped and never fatal. Nothing is fetched by selecting.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    entry: { type: 'number', description: 'Query index for a multi-query ticket.' },
                    name: { type: 'string', description: 'Selection name; default "default".' },
                    action: {
                        type: 'string',
                        enum: ['set', 'add', 'remove', 'clear', 'describe', 'list', 'delete'],
                        description: '"set" replaces the selection (the default), "describe" reads it ' +
                                     'back, "list" names every saved selection for this ticket.',
                    },
                    ids: {
                        type: 'array', items: { type: 'string' },
                        description: 'Row ids from get_result_table, e.g. ["8#0","8#5"]. Read them ' +
                                     'from a table — on a multimer result the entry index is a sparse, ' +
                                     'opaque group id, so a synthesised one is unlikely to exist.',
                    },
                    maxEntries: { type: 'number', description: 'Entries listed back, default 25.' },
                },
            },
            async handler({ ticketId, entry = 0, name = 'default', action = 'set', ids = [], maxEntries = 25 }) {
                const table = await client.getResultTable(ticketId, { entry });
                if (action === 'list') return { ticketId, selections: await table.listSelections() };
                if (action === 'delete') {
                    return { ticketId, name, deleted: await table.deleteSelection(name) };
                }

                const existing = await table.loadSelection(name);
                if (action === 'describe') {
                    if (!existing) return { ticketId, name, error: `no saved selection named "${name}"` };
                    return brief(existing, maxEntries);
                }

                // One bad id in a list of fifty should not lose the other forty-nine, and a caller
                // deserves to know which one it was.
                const accepted = [];
                const rejected = [];
                for (const id of ids) {
                    try { accepted.push(table.row(id).id); }
                    catch (err) { rejected.push({ id, reason: err.message }); }
                }

                const selection = existing ?? table.select([], { name });
                if (action === 'set') selection.clear().add(accepted);
                else if (action === 'add') selection.add(accepted);
                else if (action === 'remove') selection.remove(accepted);
                else if (action === 'clear') selection.clear();

                await selection.save(name);
                return { ...brief(selection, maxEntries), ...(rejected.length ? { rejected } : {}) };
            },
        },

        {
            name: 'select_msa_columns',
            description:
                'Pick columns of one FoldMason entry and see the motif they map to — the residues those ' +
                'columns cover, as chain+number. Saved against the ticket like select_hits, so the ' +
                'region can be widened, narrowed, read off a different entry, or given an explicit ' +
                'motif before being sent to FoldDisco with send_to. Take the ranges straight from ' +
                'get_foldmason_column_summary.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: { type: 'string' },
                    name: { type: 'string', description: 'Selection name; default "default".' },
                    action: {
                        type: 'string',
                        enum: ['set', 'add', 'remove', 'describe', 'list', 'delete'],
                    },
                    entry: { type: 'number', description: 'Which entry the residues are read off. Default 0.' },
                    columns: { type: 'array', items: { type: 'number' }, description: 'Column indices.' },
                    ranges: {
                        type: 'array', items: { type: 'string' },
                        description: 'Columns as ranges ("12-28"), the form the summary reports them in.',
                    },
                    motif: {
                        type: 'string',
                        description: 'Use this motif instead of the one the columns produce. Empty string ' +
                                     'goes back to deriving it.',
                    },
                },
            },
            async handler({ ticketId, name = 'default', action = 'set', entry, columns, ranges, motif }) {
                if (action === 'list') return { ticketId, selections: await client.listSelections(ticketId) };
                if (action === 'delete') {
                    return { ticketId, name, deleted: await client.deleteSelection(ticketId, name) };
                }

                const existing = await client.loadMsaSelection(ticketId, name);
                if (action === 'describe') {
                    if (!existing) return { ticketId, name, error: `no saved selection named "${name}"` };
                    return existing.describe();
                }

                const selection = existing
                    ?? await client.selectMsaColumns(ticketId, { entry: entry ?? 0, columns: [], name });
                if (entry !== undefined) selection.setEntry(entry);

                const picked = [...(columns ?? []), ...expandRanges(ranges ?? [])];
                if (action === 'set') selection.setColumns(picked);
                else if (action === 'add') selection.addColumns(picked);
                else if (action === 'remove') selection.removeColumns(picked);

                if (motif !== undefined) selection.setMotif(motif);
                await selection.save(name);
                return selection.describe();
            },
        },

        {
            name: 'load_accession',
            description:
                'Look up a structure by accession from PDB, AlphaFoldDB or BFVD without submitting ' +
                'anything: what it resolved to, how large it is, and — for a PDB id — the Q-BioLiP ' +
                'binding sites, with the first already expressed as a motif. Use it to check an ' +
                'accession before searching; to actually search with it, pass `accession` to ' +
                'foldseek_search / folddisco_search / submit_ticket, which loads it the same way.',
            inputSchema: {
                type: 'object',
                required: ['accession'],
                properties: {
                    accession: { type: ['string', 'array'], description: 'One id, or several.' },
                    source: {
                        type: 'string', enum: ['PDB', 'AlphaFoldDB', 'BFVD'],
                        description: 'Default PDB. AlphaFoldDB is a fuzzy search, so the entry returned ' +
                                     'can differ from the one asked for — check the name.',
                    },
                    autoMotif: {
                        type: 'boolean',
                        description: 'Q-BioLiP lookup for PDB ids. Default true; the other sources skip it.',
                    },
                },
            },
            async handler({ accession, source = 'PDB', autoMotif = true }) {
                if (Array.isArray(accession)) {
                    const list = await client.loadAccessions(accession, { source, autoMotif });
                    return list.describe();
                }
                const loaded = await client.loadAccession(accession, { source, autoMotif });
                return loaded.describe();
            },
        },

        {
            name: 'send_to',
            description:
                'Forward something a previous job produced into a new one: a hit row, a saved ' +
                'selection, or a saved MSA column selection. The structure is assembled for the ' +
                'destination — chains merged for Foldseek, encoded for FoldMason, reconstructed to ' +
                'full atoms for FoldDisco when the original file is not available — so the caller does ' +
                'not decide any of that, and the new ticket records which ticket it came out of. ' +
                'FoldMason needs two or more structures, so only a selection can reach it. To search ' +
                'with a structure from PDB/AlphaFoldDB/BFVD, pass `accession` to the search tool ' +
                'instead — that depends on no ticket.',
            inputSchema: {
                type: 'object',
                required: ['from', 'tool'],
                properties: {
                    from: {
                        type: 'object',
                        required: ['type'],
                        description: 'What to send.',
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['row', 'selection', 'msaColumns'],
                            },
                            ticketId: { type: 'string' },
                            entry: { type: 'number' },
                            rowId: { type: 'string', description: 'row: "dbIndex#entryIndex".' },
                            name: { type: 'string', description: 'selection/msaColumns: default "default".' },
                        },
                    },
                    tool: { type: 'string', enum: DESTINATIONS },
                    databases: DATABASES,
                    mode: { type: 'string' },
                    motif: {
                        type: 'string',
                        description: 'FoldDisco. Defaults to whatever motif the source carries — a ' +
                                     'FoldDisco hit\'s matched residues, an MSA column selection\'s ' +
                                     'residues, a Q-BioLiP binding site.',
                    },
                    taxFilter: { type: 'string' },
                    iterativeSearch: { type: 'boolean' },
                    includeQuery: {
                        type: 'boolean',
                        description: 'FoldMason from a selection: also forward the original query ' +
                                     'structure as an entry. Default true.',
                    },
                    email: { type: 'string' },
                    waitTimeoutMs: WAIT,
                },
            },
            async handler({ from, tool, waitTimeoutMs = 0, ...opts }) {
                const sender = await resolveSource(from);
                return submitAndMaybeWait(client, () => sender.sendTo({ tool, ...opts }), { waitTimeoutMs });
            },
        },

        {
            name: 'list_cached_tickets',
            description:
                'Tickets this agent has already seen, newest first, read from the local cache — no ' +
                'network, and it survives restarts. Each carries `derivedFrom` when it was forwarded ' +
                'out of another ticket, so a chain of searches can be walked back; `derivedFromTicket` ' +
                'filters to the jobs one ticket produced.',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: { type: 'number' },
                    derivedFromTicket: {
                        type: 'string',
                        description: 'Only jobs forwarded out of this ticket.',
                    },
                },
            },
            async handler({ limit = 100, derivedFromTicket = null } = {}) {
                const tickets = await client.listCachedTickets({ limit: derivedFromTicket ? 10000 : limit });
                const matching = derivedFromTicket
                    ? tickets.filter(t => t.derivedFrom?.ticket === derivedFromTicket).slice(0, limit)
                    : tickets;
                return {
                    tickets: matching.map(t => ({
                        ticketId: t.id, kind: t.kind, jobType: t.jobType,
                        submittedAt: t.submittedAt, lastStatus: t.lastStatus,
                        lastPolledAt: t.lastPolledAt, request: t.request,
                        ...(t.derivedFrom ? { derivedFrom: t.derivedFrom } : {}),
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

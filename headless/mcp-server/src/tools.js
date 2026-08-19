// The eleven tools: name, schema, handler. No MCP SDK here — server.js does the wrapping.

import {
    UnsupportedOnDeploymentError, DESTINATIONS, expandRanges, kindForJobType,
} from 'mmseqs2-agent-core';

const TICKET = { type: 'string', description: 'Ticket id.' };
const ENTRY = { type: 'number', description: 'Query index. Foldseek and multimer only; default 0.' };
const QUERY = { type: 'string', description: 'Structure as PDB or mmCIF text.' };
const DATABASES = { type: 'array', items: { type: 'string' }, description: 'Paths from list_databases.' };
const EMAIL = { type: 'string', description: 'Optional notification address.' };
const VALIDATE_ONLY = { type: 'boolean', description: 'Run every check and report; submit nothing.' };
const NAME = { type: 'string', description: 'Selection name; default "default".' };
const ACCESSION = {
    type: ['string', 'object'],
    description: 'An id, or {id, source, autoMotif}, fetched instead of passing text. ' +
                 'A PDB id brings its Q-BioLiP motif.',
    properties: {
        id: { type: 'string' },
        source: { type: 'string', enum: ['PDB', 'AlphaFoldDB', 'BFVD'] },
        autoMotif: { type: 'boolean' },
    },
};

const SUBMIT_TOOLS = ['foldseek_search', 'multimer_search', 'foldmason_msa', 'folddisco_search'];

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/** Arguments meant for the other selection tool are refused, not dropped. */
function refuseForeign(args, foreign, tool) {
    const present = foreign.filter(field => args[field] !== undefined);
    if (present.length) {
        throw coded('INVALID_INPUT', `${present.join(', ')} is not a ${tool} argument`);
    }
}

function confirm(selection, rejected = []) {
    const { entries, ...rest } = selection.describe();
    return { ...rest, ...(rejected.length ? { rejected } : {}) };
}

/** A selection read back: `size` is exact, the entry list is capped. */
function describe(selection, maxEntries) {
    const full = selection.describe();
    const entries = full.entries.slice(0, Math.max(0, maxEntries));
    return {
        ...full,
        entries,
        ...(full.entries.length > entries.length ? { entriesTruncated: full.entries.length } : {}),
    };
}

export function createTools(client) {
    const resolveQuery = async ({ query, accession, motif }) => {
        if (query && accession) throw coded('INVALID_INPUT', 'pass either query or accession, not both');
        if (!accession) return { query, motif };
        const spec = typeof accession === 'string' ? { id: accession } : accession;
        const id = spec?.id ?? spec?.accession;
        if (!id) throw coded('INVALID_INPUT', 'accession must be an id, or {id, source?, autoMotif?}');
        const loaded = await client.loadAccession(id, {
            source: spec.source || 'PDB',
            autoMotif: spec.autoMotif !== undefined ? spec.autoMotif : true,
        });
        // An explicit motif wins; a loaded one is a default.
        return { query: loaded.text, motif: motif ?? loaded.motif, loaded: loaded.describe() };
    };

    const submit = async (tool, args, run) => {
        const resolved = await resolveQuery(args);
        const full = { ...args, query: resolved.query, ...(resolved.motif ? { motif: resolved.motif } : {}) };
        if (args.validateOnly) {
            const report = await client.validateSubmission({ tool, ...full });
            return resolved.loaded ? { ...report, loaded: resolved.loaded } : report;
        }
        const ticket = await run(full);
        const out = {
            ticketId: ticket.id,
            status: ticket.status ?? 'PENDING',
            // Which motif was searched, when the caller did not supply it themselves.
            ...(full.motif ? { motif: full.motif } : {}),
        };
        return resolved.loaded ? { ...out, loaded: resolved.loaded } : out;
    };

    const resolveSource = async (from) => {
        const { type, ticketId, entry = 0, rowId, name = 'default' } = from ?? {};
        if (type === 'row') {
            return (await client.getResultTable(ticketId, { entry })).row(rowId);
        }
        if (type === 'selection') {
            const table = await client.getResultTable(ticketId, { entry });
            const selection = await table.loadSelection(name);
            if (!selection) {
                throw coded('SELECTION_NOT_FOUND',
                    `no selection "${name}" on ${ticketId} — make one with select_hits`);
            }
            if (selection.size === 0) throw coded('INVALID_INPUT', `selection "${name}" is empty`);
            return selection;
        }
        if (type === 'msaColumns') {
            const selection = await client.loadMsaSelection(ticketId, name);
            if (!selection) {
                throw coded('SELECTION_NOT_FOUND',
                    `no column selection "${name}" on ${ticketId} — make one with select_msa_columns`);
            }
            return selection;
        }
        throw coded('INVALID_INPUT', `unknown source type ${JSON.stringify(type)} ` +
                    '(row, selection, msaColumns). To search with a public structure, pass ' +
                    '`accession` to a search tool instead.');
    };

    return [
        {
            name: 'list_databases',
            description: 'Databases this server offers. Pass jobType for only the ones that tool accepts.',
            inputSchema: {
                type: 'object',
                properties: {
                    jobType: { type: 'string', enum: SUBMIT_TOOLS.filter(t => t !== 'foldmason_msa') },
                },
            },
            async handler({ jobType = null }) {
                const usable = {
                    foldseek_search: d => !d.interface && !d.motif,
                    multimer_search: d => d.complex && !d.interface && !d.motif,
                    folddisco_search: d => d.motif && !d.interface,
                };
                const all = await client.getDatabases();
                const listed = jobType ? all.filter(usable[jobType]) : all;
                return {
                    ...(jobType ? { jobType } : {}),
                    databases: listed.map(d => ({
                        path: d.path,
                        name: d.name,
                        version: d.version,
                        status: d.status,
                        taxonomy: !!d.taxonomy,
                        ...(jobType ? {} : {
                            usableFor: Object.keys(usable).filter(tool => usable[tool](d)),
                        }),
                    })),
                };
            },
        },

        {
            name: 'foldseek_search',
            description: 'Search one monomer structure against structure databases. ' +
                         'For a complex, use multimer_search.',
            inputSchema: {
                type: 'object',
                required: ['databases'],
                properties: {
                    query: QUERY,
                    accession: ACCESSION,
                    databases: DATABASES,
                    mode: { type: 'string', enum: ['3diaa', '3di', 'tmalign', 'lolalign'], description: 'Default 3diaa.' },
                    iterativeSearch: { type: 'boolean' },
                    taxFilter: { type: 'string', description: 'Taxon ids, comma separated; "!" negates after the first.' },
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            handler(args) {
                if (String(args.mode ?? '').includes('complex')) {
                    throw coded('INVALID_INPUT', 'foldseek_search is monomer only — use multimer_search');
                }
                return submit('foldseek', args, a => client.submitFoldseekSearch(a));
            },
        },

        {
            name: 'multimer_search',
            description: 'Search a complex against complex-capable databases. ' +
                         'Iterative search and taxon filtering do not apply.',
            inputSchema: {
                type: 'object',
                required: ['databases'],
                properties: {
                    query: QUERY,
                    accession: ACCESSION,
                    databases: DATABASES,
                    mode: { type: 'string', enum: ['3diaa', '3di', 'tmalign', 'lolalign'], description: 'Default 3diaa.' },
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            async handler(args) {
                const ignored = ['iterativeSearch', 'taxFilter'].filter(k => args[k] !== undefined);
                const out = await submit('multimer', { ...args, iterativeSearch: false, taxFilter: '' },
                    a => client.submitMultimerSearch(a));
                return ignored.length ? { ...out, ignored } : out;
            },
        },

        {
            name: 'foldmason_msa',
            description: 'Align two or more structures. Each file name becomes an entry name.',
            inputSchema: {
                type: 'object',
                required: ['files'],
                properties: {
                    files: {
                        type: 'array',
                        minItems: 2,
                        description: 'Structures to align.',
                        items: {
                            type: 'object',
                            required: ['name', 'content'],
                            properties: { name: { type: 'string' }, content: QUERY },
                        },
                    },
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            handler(args) {
                return submit('foldmason', args, a => client.submitFoldMason(a));
            },
        },

        {
            name: 'folddisco_search',
            description: 'Search for a structural motif — a residue list like "A123, A156, W201". ' +
                         'Every residue must exist in the query.',
            inputSchema: {
                type: 'object',
                required: ['databases'],
                properties: {
                    query: QUERY,
                    accession: ACCESSION,
                    databases: { ...DATABASES, description: 'Motif-capable paths from list_databases.' },
                    motif: { type: 'string', description: 'Required unless an accession supplies one.' },
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            async handler(args) {
                const out = await submit('folddisco', args, a => client.submitFoldDisco(a));
                return out;
            },
        },

        {
            name: 'get_ticket_status',
            description: 'Status of a ticket, what kind of job it is, and what it was derived from.',
            inputSchema: { type: 'object', required: ['ticketId'], properties: { ticketId: TICKET } },
            async handler({ ticketId }) {
                const [{ status }, type] = await Promise.all([
                    client.pollTicket(ticketId),
                    client.getTicketType(ticketId).catch(() => null),
                ]);
                const record = await client.store.readTicket(ticketId).catch(() => null);
                return {
                    ticketId,
                    status,
                    jobType: type?.type ?? null,
                    resultKind: type?.type ? kindForJobType(type.type) : null,
                    resultUrl: await client.resultUrl(ticketId).catch(() => null),
                    ...(record?.derivedFrom ? { derivedFrom: record.derivedFrom } : {}),
                };
            },
        },

        {
            name: 'get_result_summary',
            description: 'What a finished result holds: databases, row counts, the ranking metric and ' +
                         'one top hit each. Start here, then export_result for the whole thing.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: { ticketId: TICKET, entry: ENTRY },
            },
            handler({ ticketId, entry = 0 }) {
                return client.getResultSummary(ticketId, entry);
            },
        },

        {
            name: 'export_result',
            description: 'Write the complete result — every row, taxonomy node, column — to files and ' +
                         'return their URIs. Read them as resources; nothing is inlined.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: { ticketId: TICKET, entry: ENTRY },
            },
            handler({ ticketId, entry = 0 }) {
                return client.exportResult(ticketId, entry);
            },
        },

        {
            name: 'select_hits',
            description: 'Name a set of hits so send_to can forward them. Saved against the ticket. ' +
                         'Ids are the "dbIndex#rowIndex" form the exported rows carry.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: TICKET,
                    entry: ENTRY,
                    name: NAME,
                    action: {
                        type: 'string',
                        enum: ['set', 'add', 'remove', 'clear', 'copy', 'describe', 'list', 'delete'],
                        description: 'Default "set". "copy" duplicates fromName, leaving it untouched.',
                    },
                    ids: { type: 'array', items: { type: 'string' }, description: 'e.g. ["8#0","8#5"].' },
                    fromName: { type: 'string', description: 'copy: the selection to copy.' },
                    maxEntries: { type: 'number', description: 'describe: entries listed back; default 25.' },
                },
            },
            async handler(args) {
                const { ticketId, entry = 0, name = 'default', action = 'set', ids = [], fromName,
                    maxEntries = 25 } = args;
                refuseForeign(args, ['columns', 'ranges', 'motif'], 'select_hits');

                const table = await client.getResultTable(ticketId, { entry });
                if (action === 'list') return { ticketId, selections: await table.listSelections() };
                if (action === 'delete') return { ticketId, name, deleted: await table.deleteSelection(name) };
                if (action === 'copy') {
                    if (!fromName) throw coded('INVALID_INPUT', 'copy needs fromName and name');
                    const record = await client.copySelection(ticketId, fromName, name);
                    return { ticketId, name, copiedFrom: fromName, size: record.ids?.length ?? 0 };
                }

                const existing = await table.loadSelection(name);
                if (action === 'describe') {
                    if (!existing) throw coded('SELECTION_NOT_FOUND', `no selection "${name}" on ${ticketId}`);
                    return describe(existing, maxEntries);
                }
                if (['set', 'add', 'remove'].includes(action) && ids.length === 0) {
                    throw coded('INVALID_INPUT', `${action} needs ids; use "clear" to empty a selection`);
                }

                // One bad id must not lose the others, and the caller deserves to know which.
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
                return confirm(selection, rejected);
            },
        },

        {
            name: 'select_msa_columns',
            description: 'Name a set of alignment columns and see the motif they map to. ' +
                         'Saved against the ticket, ready for send_to.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: TICKET,
                    name: NAME,
                    action: {
                        type: 'string',
                        enum: ['set', 'add', 'remove', 'clear', 'copy', 'describe', 'list', 'delete'],
                        description: 'Default "set". "copy" duplicates fromName, leaving it untouched.',
                    },
                    entry: { type: 'number', description: 'Which entry the residues are read off; default 0.' },
                    columns: { type: 'array', items: { type: 'number' }, description: 'Column indices.' },
                    ranges: { type: 'array', items: { type: 'string' }, description: 'Columns as ranges, e.g. ["12-28"].' },
                    motif: { type: 'string', description: 'Use this motif instead of the derived one; "" to derive again.' },
                    fromName: { type: 'string', description: 'copy: the selection to copy.' },
                },
            },
            async handler(args) {
                const { ticketId, name = 'default', action = 'set', entry, columns, ranges, motif,
                    fromName } = args;
                refuseForeign(args, ['ids'], 'select_msa_columns');

                if (action === 'list') return { ticketId, selections: await client.listSelections(ticketId) };
                if (action === 'delete') {
                    return { ticketId, name, deleted: await client.deleteSelection(ticketId, name) };
                }
                if (action === 'copy') {
                    if (!fromName) throw coded('INVALID_INPUT', 'copy needs fromName and name');
                    const record = await client.copySelection(ticketId, fromName, name);
                    return { ticketId, name, copiedFrom: fromName, size: record.columns?.length ?? 0 };
                }

                const existing = await client.loadMsaSelection(ticketId, name);
                if (action === 'describe') {
                    if (!existing) throw coded('SELECTION_NOT_FOUND', `no selection "${name}" on ${ticketId}`);
                    return existing.describe();
                }

                const selection = existing
                    ?? await client.selectMsaColumns(ticketId, { entry: entry ?? 0, columns: [], name });
                if (entry !== undefined) selection.setEntry(entry);

                const picked = [...(columns ?? []), ...expandRanges(ranges ?? [])];
                // An empty list is fine when the entry or motif is what changes; only a call that would
                // do nothing at all is a mistake.
                if (['set', 'add', 'remove'].includes(action) && picked.length === 0
                    && entry === undefined && motif === undefined) {
                    throw coded('INVALID_INPUT',
                        `${action} needs columns or ranges; use "clear" to empty a selection`);
                }
                if (action === 'set') selection.setColumns(picked);
                else if (action === 'add') selection.addColumns(picked);
                else if (action === 'remove') selection.removeColumns(picked);
                else if (action === 'clear') selection.setColumns([]);

                if (motif !== undefined) selection.setMotif(motif);
                await selection.save(name);
                return selection.describe();
            },
        },

        {
            name: 'send_to',
            description: 'Forward a hit, a saved selection, or saved MSA columns into a new job. ' +
                         'The structure is assembled for the destination and the new ticket records its source.',
            inputSchema: {
                type: 'object',
                required: ['from', 'tool'],
                properties: {
                    from: {
                        type: 'object',
                        required: ['type'],
                        description: 'What to send.',
                        properties: {
                            type: { type: 'string', enum: ['row', 'selection', 'msaColumns'] },
                            ticketId: TICKET,
                            entry: ENTRY,
                            rowId: { type: 'string', description: 'row: "dbIndex#rowIndex".' },
                            name: NAME,
                        },
                    },
                    tool: { type: 'string', enum: DESTINATIONS, description: 'Destination.' },
                    databases: DATABASES,
                    mode: { type: 'string' },
                    motif: { type: 'string', description: 'FoldDisco; defaults to the motif the source carries.' },
                    taxFilter: { type: 'string' },
                    iterativeSearch: { type: 'boolean' },
                    includeQuery: {
                        type: 'boolean',
                        description: 'FoldMason from a selection: also send the original query. Default true.',
                    },
                    email: EMAIL,
                },
            },
            async handler({ from, tool, ...opts }) {
                if (!DESTINATIONS.includes(tool)) {
                    throw coded('INVALID_INPUT', `unknown destination ${JSON.stringify(tool)}`);
                }
                const sender = await resolveSource(from);
                const ticket = await sender.sendTo({ tool, ...opts });
                return {
                    ticketId: ticket.id,
                    status: ticket.status ?? 'PENDING',
                    ...(ticket.derivedFrom ? { derivedFrom: ticket.derivedFrom } : {}),
                    ...(ticket.skipped?.length ? { skipped: ticket.skipped } : {}),
                };
            },
        },
    ];
}

/**
 * Run a tool by name and normalise failure. A tool that ran and failed is a result the caller can act
 * on; the code says which kind so it can act without parsing prose.
 */
export async function runTool(tools, name, args = {}) {
    const tool = tools.find(t => t.name === name);
    if (!tool) return { isError: true, code: 'UNKNOWN_TOOL', error: `unknown tool: ${name}` };
    try {
        return await tool.handler(args ?? {});
    } catch (err) {
        if (err instanceof UnsupportedOnDeploymentError) {
            return {
                isError: true, code: 'UNSUPPORTED_ON_DEPLOYMENT',
                error: err.message, unsupportedTool: err.tool,
            };
        }
        const code = err.code ?? (err.status === 404 ? 'UNKNOWN_TICKET' : undefined);
        return { isError: true, ...(code ? { code } : {}), error: err.message };
    }
}

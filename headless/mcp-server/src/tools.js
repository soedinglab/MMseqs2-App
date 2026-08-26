// The eleven tools: name, schema, handler. No MCP SDK here — server.js does the wrapping.

import {
    UnsupportedOnDeploymentError, DESTINATIONS, expandRanges, toolForJobType,
    resolveInputPath,
} from 'foldseek-server-lib';

const TICKET = { type: 'string', description: 'Ticket id.' };
const QUERY_IDX = {
    type: 'number',
    description: 'Which query of a multi-query ticket; default 0. Foldseek and multimer only',
};
const QUERY = { type: 'string', description: 'Structure as PDB or mmCIF text.' };
function pathArg(dirs, { many = false } = {}) {
    const kind = many ? 'Names' : 'Name';
    const full = `${kind} read server-side, relative to or inside: ${dirs.join(', ')}`;
    const description = full.length <= 128
        ? full
        : `${kind} read server-side, relative to ${dirs.length === 1 ? 'a readable directory'
            : `one of ${dirs.length} readable directories`}; a refusal lists them.`;
    return many
        ? { type: 'array', minItems: 2, items: { type: 'string' }, description }
        : { type: 'string', description };
}

const DATABASES = { type: 'array', items: { type: 'string' }, description: 'Paths from list_databases.' };
const TAX_FILTER = {
    type: 'string',
    description: 'Taxon ids or scientific names; "!" negates after the first. '
               + 'e.g. "Bacteria,!Escherichia coli".',
};
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
    const { name, size } = selection.describe();
    return { name, size, ...(rejected.length ? { rejected } : {}) };
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

export function createTools(client, { inputDirs = [], touchDirs = [] } = {}) {
    const readPath = p => resolveInputPath(p, { inputDirs, touchDirs });
    // Advertised only when it can work. A schema offering a capability that always refuses is worse
    // than one that never mentions it.
    const byPath = inputDirs.length ? { queryRef: pathArg(inputDirs) } : {};
    const byPaths = inputDirs.length ? { fileRefs: pathArg(inputDirs, { many: true }) } : {};

    /** Accessions for an alignment: no motif lookup, and each name keeps a real extension. */
    const fetched = async (specs) => {
        const ids = specs.map((spec) => {
            const s = typeof spec === 'string' ? { id: spec } : spec;
            const id = s?.id ?? s?.accession;
            if (!id) throw coded('INVALID_INPUT', 'each accession must be an id or {id, source}');
            return { id, source: s.source || 'PDB' };
        });
        const bySource = new Map();
        for (const { id, source } of ids) {
            if (!bySource.has(source)) bySource.set(source, []);
            bySource.get(source).push(id);
        }
        const out = [];
        for (const [source, list] of bySource) {
            const loaded = await client.loadAccessions(list, { source });
            if (loaded.failed.length) {
                throw coded('INVALID_INPUT',
                    `could not load ${loaded.failed.map(f => f.id).join(', ')} from ${source}`);
            }
            out.push(...loaded.structures.map(st => ({ name: st.name, content: st.text })));
        }
        return out;
    };

    // FoldMason brings `files` instead of a single query, so it opts out of the arity rule.
    const resolveQuery = async ({ query, queryRef, accession, motif }, { required = true } = {}) => {
        const all = { query, queryRef, accession };
        const given = Object.keys(all).filter(k => all[k]);
        if (given.length > 1 || (required && given.length === 0)) {
            throw coded('INVALID_INPUT',
                `pass exactly one of ${Object.keys(all).join(', ')} — got ${given.join(', ') || 'none'}`);
        }
        for (const [key, read] of [['queryRef', readPath]]) {
            if (!all[key]) continue;
            const file = await read(all[key]);
            return { query: file.text, motif, loaded: { name: file.name, bytes: file.bytes } };
        }
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
        const resolved = await resolveQuery(args, { required: tool !== 'foldmason' });
        // Neither a local path nor a URL reaches the client: only the text it held. A URL can carry a
        // presigned signature, so it is no more recordable than a path.
        const { queryRef, ...rest } = args;
        const full = { ...rest, query: resolved.query, ...(resolved.motif ? { motif: resolved.motif } : {}) };
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
            // Which taxa a name turned into. Only when one did: the ids are the material fact and the
            // caller never passed them.
            ...(ticket.taxonomy ? { taxFilter: ticket.taxonomy.filter,
                taxonomy: ticket.taxonomy.resolved.map(({ name, taxId, sciName, negated }) => (
                    { name, taxId, ...(sciName !== name ? { sciName } : {}),
                      ...(negated ? { negated } : {}) })) } : {}),
        };
        return resolved.loaded ? { ...out, loaded: resolved.loaded } : out;
    };

    const resolveSource = async (from) => {
        const { type, ticketId, queryIdx = 0, rowId, name = 'default' } = from ?? {};
        if (type === 'row') {
            return (await client.getResultTable(ticketId, { queryIdx })).row(rowId);
        }
        if (type === 'selection') {
            const table = await client.getResultTable(ticketId, { queryIdx });
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
            description: 'Databases this server offers. Pass tool for only the ones it accepts.',
            inputSchema: {
                type: 'object',
                properties: {
                    tool: { type: 'string', enum: ['foldseek', 'multimer', 'folddisco'] },
                },
            },
            async handler({ tool = null }) {
                const usable = {
                    foldseek: d => !d.interface && !d.motif,
                    multimer: d => d.complex && !d.interface && !d.motif,
                    folddisco: d => d.motif && !d.interface,
                };
                const all = await client.getDatabases();
                const listed = tool ? all.filter(usable[tool]) : all;
                return {
                    databases: listed.map(d => ({
                        path: d.path,
                        name: d.name,
                        version: d.version,
                        status: d.status,
                        taxonomy: !!d.taxonomy,
                        ...(tool ? {} : {
                            usableFor: Object.keys(usable).filter(t => usable[t](d)),
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
                    ...byPath,
                    accession: ACCESSION,
                    databases: DATABASES,
                    mode: { type: 'string', enum: ['3diaa', 'tmalign', 'lolalign'], description: 'Default 3diaa.' },
                    iterativeSearch: { type: 'boolean' },
                    taxFilter: TAX_FILTER,
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
                         'Iterative search does not apply.',
            inputSchema: {
                type: 'object',
                required: ['databases'],
                properties: {
                    query: QUERY,
                    ...byPath,
                    accession: ACCESSION,
                    databases: DATABASES,
                    mode: { type: 'string', enum: ['3diaa', 'tmalign', 'lolalign'], description: 'Default 3diaa.' },
                    taxFilter: TAX_FILTER,
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            async handler(args) {
                refuseForeign(args, ['iterativeSearch'], 'multimer_search');
                return submit('multimer', args, a => client.submitMultimerSearch(a));
            },
        },

        {
            name: 'foldmason_msa',
            description: 'Align two or more structures. Each file name becomes an entry name.',
            inputSchema: {
                type: 'object',
                properties: {
                    files: {
                        type: 'array',
                        minItems: 1,
                        description: 'Structures as text. Combines with fileRefs and accessions.',
                        items: {
                            type: 'object',
                            required: ['name', 'content'],
                            properties: { name: { type: 'string' }, content: QUERY },
                        },
                    },
                    ...byPaths,
                    accessions: {
                        type: 'array',
                        minItems: 1,
                        description: 'Ids the server fetches, e.g. ["1abc", {"id": "P0DTC2", '
                                   + '"source": "AlphaFoldDB"}]. Combines with the other two.',
                        items: { type: ['string', 'object'] },
                    },
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            async handler(args) {
                const { files, fileRefs, accessions, ...rest } = args;
                const read = async (list) => Promise.all(list.map(async (item) => {
                    const file = await readPath(item);
                    return { name: file.name, content: file.text };
                }));
                // Order is declared, because an entry's index is what a column selection refers to.
                const assembled = [
                    ...(files ?? []),
                    ...(fileRefs ? await read(fileRefs) : []),
                    ...(accessions ? await fetched(accessions) : []),
                ];
                if (assembled.length < 2) {
                    throw coded('INVALID_INPUT',
                        'foldmason needs at least two structures across files, fileRefs and '
                        + `accessions — got ${assembled.length}`);
                }
                return submit('foldmason', { ...rest, files: assembled },
                    a => client.submitFoldMason(a));
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
                    ...byPath,
                    accession: ACCESSION,
                    databases: { ...DATABASES, description: 'Motif-capable paths from list_databases.' },
                    motif: { type: 'string', description: 'Required unless an accession supplies one.' },
                    email: EMAIL,
                    validateOnly: VALIDATE_ONLY,
                },
            },
            async handler(args) {
                // FoldDiscoJob has no TaxFilter or Mode field, so these would be dropped in silence —
                // and a caller who thought they had filtered would read an unfiltered result.
                refuseForeign(args, ['taxFilter', 'mode', 'iterativeSearch'], 'folddisco_search');
                return submit('folddisco', args, a => client.submitFoldDisco(a));
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
                    tool: type?.type ? toolForJobType(type.type) : null,
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
                properties: { ticketId: TICKET, queryIdx: QUERY_IDX },
            },
            handler({ ticketId, queryIdx = 0 }) {
                return client.getResultSummary(ticketId, queryIdx);
            },
        },

        {
            name: 'export_result',
            description: 'Write the complete result — every row, taxonomy node, column — to files and ' +
                         'return their URIs. Read them as resources; nothing is inlined.',
            inputSchema: {
                type: 'object',
                required: ['ticketId'],
                properties: {
                    ticketId: TICKET,
                    queryIdx: QUERY_IDX,
                    mountRoot: {
                        type: 'string',
                        description: 'Where you see the export directory, if not at the server\'s path. ' +
                                     'Paths come back in that space.',
                    },
                },
            },
            handler({ ticketId, queryIdx = 0, mountRoot = null }) {
                return client.exportResult(ticketId, queryIdx, { mountRoot });
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
                    queryIdx: QUERY_IDX,
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
                const { ticketId, queryIdx = 0, name = 'default', action = 'set', ids = [], fromName,
                    maxEntries = 25 } = args;
                refuseForeign(args, ['columns', 'ranges', 'motif'], 'select_hits');

                const table = await client.getResultTable(ticketId, { queryIdx });
                if (action === 'list') return { ticketId, selections: await table.listSelections() };
                if (action === 'delete') return { name, deleted: await table.deleteSelection(name) };
                if (action === 'copy') {
                    if (!fromName) throw coded('INVALID_INPUT', 'copy needs fromName and name');
                    const record = await client.copySelection(ticketId, fromName, name);
                    return { name, size: record.ids?.length ?? 0 };
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
            description: 'Name a set of alignment columns and see the motif they derive. ' +
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
                    residues: {
                        type: 'array',
                        description: 'Substitutions on selected columns: [{column, aa}]; aa null clears one.',
                        items: {
                            type: 'object',
                            required: ['column'],
                            properties: {
                                column: { type: 'number' },
                                aa: {
                                    type: ['string', 'null'],
                                    description: 'One of ACDEFGHIKLMNPQRSTVWYXpnhba',
                                },
                            },
                        },
                    },
                    fromName: { type: 'string', description: 'copy: the selection to copy.' },
                },
            },
            async handler(args) {
                const { ticketId, name = 'default', action = 'set', entry, columns, ranges, residues,
                    fromName } = args;
                refuseForeign(args, ['ids', 'motif'], 'select_msa_columns');

                if (action === 'list') return { ticketId, selections: await client.listSelections(ticketId) };
                if (action === 'delete') {
                    return { ticketId, name, deleted: await client.deleteSelection(ticketId, name) };
                }
                if (action === 'copy') {
                    if (!fromName) throw coded('INVALID_INPUT', 'copy needs fromName and name');
                    const record = await client.copySelection(ticketId, fromName, name);
                    return { name, size: record.columns?.length ?? 0 };
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
                // An empty list is fine when the entry or a substitution is what changes; only a call
                // that would do nothing at all is a mistake.
                if (['set', 'add', 'remove'].includes(action) && picked.length === 0
                    && entry === undefined && residues === undefined) {
                    throw coded('INVALID_INPUT',
                        `${action} needs columns or ranges; use "clear" to empty a selection`);
                }
                const annotated = selection.residueAa.map(r => r.column);
                if (action === 'set') selection.setColumns(picked);
                else if (action === 'add') selection.addColumns(picked);
                else if (action === 'remove') selection.removeColumns(picked);
                else if (action === 'clear') selection.setColumns([]);

                const kept = new Set(selection.residueAa.map(r => r.column));
                const orphaned = annotated.filter(c => !kept.has(c));

                if (residues !== undefined) selection.setResidueAa(residues);
                await selection.save(name);
                const full = selection.describe();
                return {
                    name: full.name,
                    entryName: full.entryName,
                    selectedColumns: full.selectedColumns,
                    residueCount: full.residueCount,
                    gapColumns: full.gapColumns,
                    residueMapping: full.residueMapping,
                    motif: full.motif,
                    ...(orphaned.length ? { droppedSubstitutions: orphaned } : {}),
                };
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
                            queryIdx: QUERY_IDX,
                            rowId: { type: 'string', description: 'row: "dbIndex#rowIndex".' },
                            name: NAME,
                        },
                    },
                    tool: { type: 'string', enum: DESTINATIONS, description: 'Destination.' },
                    databases: DATABASES,
                    mode: { type: 'string' },
                    motif: { type: 'string', description: 'FoldDisco, only when the source carries none.' },
                    taxFilter: TAX_FILTER,
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
                // The destination decides which options exist, and the same fields the typed tools
                // refuse are refused here — a forwarded job must not lose a filter in transit.
                const foreign = {
                    multimer: ['iterativeSearch'],
                    folddisco: ['taxFilter', 'mode', 'iterativeSearch'],
                    foldmason: ['taxFilter', 'mode', 'iterativeSearch', 'motif'],
                }[tool] ?? [];
                refuseForeign(opts, foreign, `send_to ${tool}`);
                const sender = await resolveSource(from);
                const ticket = await sender.sendTo({ tool, ...opts });
                return {
                    ticketId: ticket.id,
                    status: ticket.status ?? 'PENDING',
                    ...(ticket.derivedFrom ? { derivedFrom: ticket.derivedFrom } : {}),
                    ...(ticket.skipped?.length ? { skipped: ticket.skipped } : {}),
                    ...(ticket.taxonomy ? { taxFilter: ticket.taxonomy.filter,
                        taxonomy: ticket.taxonomy.resolved.map(({ name, taxId, negated }) => (
                            { name, taxId, ...(negated ? { negated } : {}) })) } : {}),
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
        // Always a code. It used to be conditional, so a plain `new Error` — the FoldMason arity
        // check, among others — produced { isError, error } and refuted the documented shape.
        const code = err.code ?? (err.status === 404 ? 'UNKNOWN_TICKET' : 'INTERNAL_ERROR');
        return { isError: true, code, error: err.message };
    }
}

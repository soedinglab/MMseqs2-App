// Validate, build and submit destination-specific queries.

import {
    mockPDB, mergePdbs, encodeMultimer, decodeMultimer,
} from '../../../frontend/lib/pdbAssembly.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import { structureRemarkLine, structureRemarkPrefix } from '../../../frontend/lib/structureRemark.js';
import {
    reconstructFullAtom, resolveStructureFromDb, ensureStructureExtension,
    DatabaseNotResolvableError, loadAccession, loadAccessions,
} from './structures.js';
import { assertMotif } from './motif.js';
import { summarizeRequest } from './store.js';
import { resolveTaxFilter, taxFilterHasNames } from './taxonomy.js';

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

export const ORIGINS = ['chains', 'fm-entry', 'structure'];
export const DESTINATIONS = ['foldseek', 'multimer', 'foldmason', 'folddisco'];
export const FOLDMASON_MIN_FILES = 2;

const VALID_TAX_FILTER = /^[0-9]+(,!?[0-9]+)*$|^$/;

export function assertTaxFilter(taxFilter) {
    const value = taxFilter ?? '';
    if (typeof value !== 'string' || !VALID_TAX_FILTER.test(value)) {
        throw new Error(
            `invalid taxon filter: ${JSON.stringify(taxFilter)} — expected numeric taxon ids `
            + 'separated by commas, optionally negated after the first (e.g. "9606", "9606,!10090")',
        );
    }
    return value;
}

/** Destinations that require a query set. */
const MULTI_INPUT_DESTINATIONS = new Set(['foldmason']);

/** Add source accession and ticket provenance to a structure. */
export function provenanceRemark(text, { accession, db = null, ticket = null }) {
    const firstline = structureRemarkLine(
        text, `Accession: ${accession}${db ? `, DB: ${db}` : ''}`, 99);
    let second = '';
    if (ticket) {
        const t = ticket.length > 55 ? `${ticket.slice(0, 52)}...` : ticket;
        second = `${structureRemarkPrefix(text, 99)}${`Imported from ${t}`.padEnd(69, ' ')}\n`;
    }
    return `${firstline}\n${second}${text}`;
}

function assertOrigin(spec) {
    if (!ORIGINS.includes(spec?.kind)) {
        throw coded('INVALID_INPUT', `unknown query origin: ${JSON.stringify(spec?.kind)} ` +
                        `(expected one of ${ORIGINS.join(', ')})`);
    }
}

/** Build a plain query-source record. */
export function createQuery(spec, { label = null } = {}) {
    assertOrigin(spec);
    return { label, spec };
}

export async function resolveQuery(query) {
    return query.spec;
}

async function reconstructQuery(text, signal, name, { cg2allUrl, fetchImpl }) {
    try {
        return await reconstructFullAtom(text, { cg2allUrl, signal, fetchImpl });
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw coded('UPSTREAM_FAILED', `could not reconstruct ${name}: ${err.message}`);
    }
}

/** Build the structure representation required by a destination. */
export async function buildQuery(query, tool, {
    signal, fetchImpl = globalThis.fetch, cg2allUrl, onWarning = null,
} = {}) {
    if (!DESTINATIONS.includes(tool)) {
        throw coded('INVALID_INPUT', `unknown destination: ${JSON.stringify(tool)} ` +
                        `(expected one of ${DESTINATIONS.join(', ')})`);
    }
    const spec = await resolveQuery(query);
    const motif = spec.motif ? { motif: spec.motif } : {};

    if (spec.kind === 'structure') {
        return { pdb: spec.text, name: spec.name ?? 'query', isMultimer: false, ...motif,
            ...(spec.resolvedFrom ? { resolvedFrom: spec.resolvedFrom } : {}) };
    }

    if (spec.kind === 'fm-entry') {
        const { pdb, suffix } = spec;
        const name = spec.name ?? 'query';
        if (tool === 'foldmason') return { pdb, suffix, name, isMultimer: !!suffix };
        const real = suffix ? decodeMultimer(pdb, suffix) : pdb;
        if (tool !== 'folddisco') return { pdb: real, name, isMultimer: !!suffix, ...motif };
        return { pdb: await reconstructQuery(real, signal, name, { cg2allUrl, fetchImpl }), name,
            isMultimer: !!suffix, reconstructed: true, ...motif };
    }

    const chains = spec.chains ?? [];
    if (chains.length === 0) throw coded('INVALID_INPUT', 'this query has no chains to build from');
    const parts = chains.map(c => ({ pdb: mockPDB(c.ca, c.seq ?? '', c.chain), chain: c.chain }));
    const multi = parts.length > 1;
    const base = spec.name ?? getAccession(chains[0]?.target ?? 'query');
    const chainset = `_${chains.map(c => c.chain).join('')}`;

    if (tool === 'foldmason') {
        if (!multi) return { pdb: parts[0].pdb, name: base, isMultimer: false };
        const { pdb, suffix } = encodeMultimer(parts);
        return { pdb, suffix, name: `${base}${chainset}${suffix}`, isMultimer: true };
    }

    if (tool === 'folddisco') {
        if (!multi) {
            const accession = spec.accession ?? base;
            try {
                const found = await resolveStructureFromDb(spec.db, accession,
                    { signal, fetchImpl });
                return { pdb: found.text, name: base, isMultimer: false, resolvedFrom: found.url, ...motif };
            } catch (err) {
                if (!(err instanceof DatabaseNotResolvableError)) {
                    onWarning?.(`${base}: falling back to reconstruction (${err.message})`);
                }
            }
        }
        return {
            pdb: await reconstructQuery(multi ? mergePdbs(parts) : parts[0].pdb, signal, base,
                { cg2allUrl, fetchImpl }),
            name: multi ? `${base}${chainset}` : base,
            isMultimer: multi, reconstructed: true, ...motif,
        };
    }

    return { pdb: multi ? mergePdbs(parts) : parts[0].pdb,
        name: multi ? `${base}${chainset}` : base, isMultimer: multi, ...motif };
}

export async function buildQueryFile(query, opts = {}) {
    const built = await buildQuery(query, 'foldmason', opts);
    return { name: ensureStructureExtension(built.name, built.pdb), content: built.pdb };
}

async function recordLineage({ store, onWarning }, query, ticket, tool, built,
    { motifSource = null } = {}) {
    const source = query.spec?.ticket;
    if (!source) return ticket;
    const derivedFrom = {
        ticket: source, origin: query.spec.kind, tool,
        ...(query.spec.lineage ?? {}),
        ...(motifSource ? { motifSource } : {}),
        ...(query.label ? { from: query.label } : {}),
        ...(built?.name ? { name: built.name } : {}),
        ...(built?.resolvedFrom ? { resolvedFrom: built.resolvedFrom } : {}),
        ...(built?.reconstructed ? { reconstructed: true } : {}),
    };
    try { await store.writeTicket(ticket.id, { derivedFrom }); }
    catch (err) { onWarning?.(`could not record lineage for ${ticket.id}: ${err.message}`); }
    ticket.derivedFrom = derivedFrom;
    return ticket;
}

/** Build and submit one query to a single-query destination. */
export async function sendQuery(dependencies, query, {
    tool, databases = null, mode = '3diaa', motif = null, taxFilter = '', email = '',
    iterativeSearch = false, remark = true, signal = undefined,
} = {}) {
    if (MULTI_INPUT_DESTINATIONS.has(tool)) {
        throw coded('INVALID_INPUT', 'FoldMason requires two or more structures');
    }
    const {
        fetchImpl, cg2allUrl, onWarning, submitFoldDisco, submitFoldseekSearch, store,
    } = dependencies;
    const built = await buildQuery(query, tool, {
        signal,
        fetchImpl,
        cg2allUrl,
        onWarning,
    });
    if (tool === 'folddisco' && motif && built.motif) {
        throw coded('INVALID_INPUT',
            'this source already carries a motif, so supplying one would let the two disagree - ' +
            'change the source selection instead');
    }
    const text = remark ? provenanceRemark(built.pdb, {
        accession: built.name, db: query.spec.db ?? null, ticket: query.spec.ticket ?? null,
    }) : built.pdb;
    const ticket = tool === 'folddisco'
        ? await submitFoldDisco({ query: text, databases, motif: motif ?? built.motif, email })
        : await submitFoldseekSearch({ query: text, databases, mode,
            multimer: tool === 'multimer', email, iterativeSearch, taxFilter });
    const motifSource = tool !== 'folddisco' ? null
        : motif ? 'caller' : built.motif ? (query.spec.motifSource ?? 'hit') : null;
    return recordLineage({ store, onWarning }, query, ticket, tool, built, { motifSource });
}

export function createQuerySet(queries, { ticket = null, queryIdx = 0, description = null } = {}) {
    return { queries, ticket, queryIdx, description };
}

/** Submit one query elsewhere or build a bounded-concurrency FoldMason file set. */
export async function sendQuerySet(dependencies, set, {
    tool, includeQuery = true, concurrency = 8, email = '', signal, ...rest
} = {}) {
    if (tool !== 'foldmason') {
        if (set.queries.length !== 1) {
            throw coded('INVALID_INPUT', `${tool} takes one query; this selection has ${set.queries.length}. ` +
                            'Narrow it to one row, or send to foldmason.');
        }
        return sendQuery(dependencies, set.queries[0], { tool, email, signal, ...rest });
    }

    const files = [];
    const skipped = [];
    const seen = new Set();
    const add = (file, index) => {
        if (seen.has(file.name)) {
            skipped.push({ index, name: file.name, reason: 'duplicate entry name' });
            return;
        }
        seen.add(file.name);
        files.push(file);
    };

    for (let i = 0; i < set.queries.length; i += concurrency) {
        const batch = set.queries.slice(i, i + concurrency);
        const settled = await Promise.allSettled(batch.map(q => buildQueryFile(q, {
            signal,
            fetchImpl: dependencies.fetchImpl,
            cg2allUrl: dependencies.cg2allUrl,
            onWarning: dependencies.onWarning,
        })));
        settled.forEach((r, j) => {
            if (r.status === 'fulfilled' && r.value?.content) add(r.value, i + j);
            else skipped.push({ index: i + j,
                name: set.queries[i + j]?.label ?? set.queries[i + j]?.spec?.name ?? null,
                reason: r.reason?.message ?? 'produced no structure' });
        });
    }

    if (includeQuery && set.ticket) {
        const original = await dependencies.getQueryStructure(set.ticket, {
            queryIdx: set.queryIdx,
        }).catch(err => {
            skipped.push({ index: -1, name: 'query', reason: err.message });
            return null;
        });
        if (original) add(original, -1);
    }

    const ticket = await dependencies.submitFoldMason({ files, email });
    ticket.skipped = skipped;
    ticket.submittedFiles = files.length;
    if (set.ticket) {
        const derivedFrom = {
            ticket: set.ticket, queryIdx: set.queryIdx, origin: 'selection', tool: 'foldmason',
            ...(set.description?.name ? { selection: set.description.name } : {}),
            entries: files.map(f => f.name),
            ...(skipped.length ? { skipped: skipped.length } : {}),
        };
        try { await dependencies.store.writeTicket(ticket.id, { derivedFrom }); }
        catch (err) { dependencies.onWarning?.(`could not record lineage for ${ticket.id}: ${err.message}`); }
        ticket.derivedFrom = derivedFrom;
    }
    return ticket;
}

/** Compose validation, submission and forwarding over narrow backend and state dependencies. */
export function createSubmitService({
    backend,
    store,
    results,
    fetchImpl = backend?.fetchImpl ?? globalThis.fetch,
    cg2allUrl,
    onWarning = null,
} = {}) {
    if (!backend) throw new Error('createSubmitService({ backend }) is required');
    if (!store) throw new Error('createSubmitService({ store }) is required');
    if (!results) throw new Error('createSubmitService({ results }) is required');

    let databasesPromise = null;
    const usableFor = {
        search: d => !d.interface && !d.motif && !d.rna,
        complexsearch: d => d.complex && !d.interface && !d.motif && !d.rna,
        folddisco: d => d.motif && !d.interface && !d.rna,
    };

    const getDatabases = ({ refresh = false } = {}) => {
        if (refresh || !databasesPromise) {
            databasesPromise = backend.getDatabases()
                .then(res => (Array.isArray(res) ? res : res.databases ?? []))
                .catch(err => { databasesPromise = null; throw err; });
        }
        return databasesPromise;
    };

    const assertDatabases = async (requested, kind) => {
        if (!Array.isArray(requested) || requested.length === 0) {
            throw new Error(`${kind}: at least one database must be selected`);
        }
        const all = await getDatabases();
        const predicate = usableFor[kind] ?? usableFor.search;
        const usable = all.filter(d => d.status === undefined || d.status === 'COMPLETE')
            .filter(predicate);
        const paths = new Set(usable.map(d => d.path));
        const unknown = requested.filter(d => !paths.has(d));
        if (!unknown.length) return;

        const known = new Set(all.map(d => d.path));
        const wrongKind = unknown.filter(d => known.has(d));
        const absent = unknown.filter(d => !known.has(d));
        const parts = [];
        if (absent.length) parts.push(`${absent.join(', ')} not available on this server`);
        if (wrongKind.length) parts.push(`${wrongKind.join(', ')} cannot be used for ${kind}`);
        throw new Error(
            `${kind}: ${parts.join('; ')}. Available: ${usable.map(d => d.path).join(', ') || '(none)'}`,
        );
    };

    const recordSubmission = async (result, kind, submitted) => {
        const now = new Date().toISOString();
        try {
            await store.writeTicket(result.id, {
                kind,
                submittedAt: now,
                lastStatus: result.status ?? 'PENDING',
                lastPolledAt: now,
                request: summarizeRequest(submitted),
            });
        } catch (err) {
            onWarning?.(`submitted ${result.id}, but could not write its cache record: ${err.message}`);
        }
        return { id: result.id, status: result.status ?? 'PENDING', kind };
    };

    const submits = {
        getDatabases,
        loadAccession,
        loadAccessions,

        async submitFoldseekSearch({
            query, databases, mode = '3diaa', multimer = false,
            email = '', iterativeSearch = false, taxFilter = '',
        }) {
            if (!query) throw coded('INVALID_INPUT', 'submitFoldseekSearch({ query }) is required');
            const isComplex = multimer || mode.split('-').includes('complex');
            if (isComplex && iterativeSearch) {
                throw new Error('multimer (complex) search does not support iterative search');
            }
            const { filter, resolved } = await resolveTaxFilter(taxFilter, { fetchImpl });
            const tax = assertTaxFilter(filter);
            const effectiveMode = multimer && !mode.split('-').includes('complex')
                ? `complex-${mode}` : mode;
            const kind = isComplex ? 'complexsearch' : 'search';
            await assertDatabases(databases, kind);

            const result = await backend.submitSearch({
                query, databases, mode: effectiveMode, email, iterativeSearch, taxFilter: tax,
            });
            const ticket = await recordSubmission(result, kind,
                { query, databases, mode: effectiveMode, taxFilter: tax });
            if (resolved.length) ticket.taxonomy = { filter: tax, resolved };
            return ticket;
        },

        submitMultimerSearch(options) {
            return submits.submitFoldseekSearch({ ...options, multimer: true });
        },

        async submitFoldMason({ files, email = '' }) {
            if (!Array.isArray(files) || files.length < FOLDMASON_MIN_FILES) {
                throw new Error(`FoldMason needs at least ${FOLDMASON_MIN_FILES} structures; `
                                + `${Array.isArray(files) ? files.length : 0} provided`);
            }
            return recordSubmission(
                await backend.submitFoldMason({ files, email }), 'foldmason', { files, email });
        },

        async submitFoldDisco({ query, databases, motif, email = '' }) {
            if (!query) throw new Error('submitFoldDisco({ query }) is required');
            await assertMotif(motif, query);
            await assertDatabases(databases, 'folddisco');
            return recordSubmission(
                await backend.submitFoldDisco({ query, databases, motif, email }),
                'folddisco', { query, databases, motif });
        },

        buildQuery(query, tool, options = {}) {
            return buildQuery(query, tool, { fetchImpl, cg2allUrl, onWarning, ...options });
        },

        sendQuery(query, options = {}) {
            return sendQuery({
                fetchImpl, cg2allUrl, onWarning, store,
                submitFoldDisco: submits.submitFoldDisco,
                submitFoldseekSearch: submits.submitFoldseekSearch,
            }, query, options);
        },

        sendQuerySet(set, options = {}) {
            return sendQuerySet({
                fetchImpl, cg2allUrl, onWarning, store,
                getQueryStructure: results.getQueryStructure,
                submitFoldMason: submits.submitFoldMason,
                submitFoldDisco: submits.submitFoldDisco,
                submitFoldseekSearch: submits.submitFoldseekSearch,
            }, set, options);
        },

        async validateSubmission({
            tool, query, databases, motif, mode = '3diaa', files,
            iterativeSearch = false, taxFilter = '',
        }) {
            const problems = [];
            let taxonomy = null;
            const record = async (check) => { try { await check(); } catch (err) { problems.push(err.message); } };

            if (tool === 'foldmason') {
                await record(() => {
                    if (!Array.isArray(files) || files.length < FOLDMASON_MIN_FILES) {
                        throw new Error(`FoldMason needs at least ${FOLDMASON_MIN_FILES} structures; `
                            + `${Array.isArray(files) ? files.length : 0} provided`);
                    }
                });
                return {
                    ok: problems.length === 0, tool, problems,
                    would: { endpoint: '/ticket/foldmason', files: (files ?? []).map(f => f.name) },
                };
            }

            if (!query) problems.push(`${tool}: a query structure is required`);
            const isComplex = tool === 'multimer' || String(mode).split('-').includes('complex');
            const kind = tool === 'folddisco' ? 'folddisco' : (isComplex ? 'complexsearch' : 'search');

            if (tool === 'folddisco') {
                await record(() => assertMotif(motif, query));
            } else if (taxFilterHasNames(taxFilter)) {
                try {
                    const { filter, resolved } = await resolveTaxFilter(taxFilter, { fetchImpl });
                    assertTaxFilter(filter);
                    taxonomy = { filter, resolved };
                } catch (err) { problems.push(`taxonomy: ${err.message}`); }
            } else {
                await record(() => assertTaxFilter(taxFilter));
            }
            if (tool !== 'folddisco' && isComplex && iterativeSearch) {
                problems.push('multimer (complex) search does not support iterative search');
            }
            try { await assertDatabases(databases, kind); }
            catch (err) { problems.push(err.message); }

            const effectiveMode = tool === 'multimer' && !String(mode).split('-').includes('complex')
                ? `complex-${mode}` : mode;
            return {
                ok: problems.length === 0,
                tool,
                problems,
                would: {
                    endpoint: tool === 'folddisco' ? '/ticket/folddisco' : '/ticket',
                    databases: databases ?? [],
                    ...(tool === 'folddisco' ? { motif }
                        : { mode: effectiveMode, taxFilter: taxonomy?.filter ?? taxFilter, iterativeSearch }),
                    queryBytes: query ? Buffer.byteLength(query) : 0,
                },
                ...(taxonomy?.resolved.length ? { taxonomy: taxonomy.resolved } : {}),
            };
        },
    };

    return submits;
}

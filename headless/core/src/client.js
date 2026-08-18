// Talks to the Go backend's HTTP API directly — no browser, no mounted page.
//
// Every request shape here was read off backend/server.go rather than inferred from the frontend's
// calls, since the frontend is free to send more than a handler reads:
//   POST /api/ticket            q, database[], mode, email, iterativesearch, taxfilter
//   POST /api/ticket/foldmason  multipart, one `queries[]` part per file (the part's filename
//                               carries the entry name; `fileNames[]` exists only for back-compat)
//   POST /api/ticket/folddisco  q, database[], motif, email  (no mode, no taxfilter — both are
//                                                             commented out in the handler)
//   GET  /api/ticket/{id}       -> { id, status }
//   GET  /api/ticket/type/{id}  -> { type }
//   GET  /api/result/{id}/{entry}
//   GET  /api/result/{id}/{entry}?format=brief&index=&database=   one hit's chains, with the CA
//                                                   coordinates the full table omits — see getHitChains
//   GET  /api/result/{id}/query                the original query file, whole (no per-entry form)
//   GET  /api/result/foldmason/{id}
//   GET  /api/result/folddisco/{id}            the result table
//   GET  /api/result/folddisco/{id}?id=&database=   the same route with `id` set returns that hit's
//                                                   PDB text instead — see getFoldDiscoTargetStructure
//   GET  /api/result/queries/{id}/{limit}/{page}
//
// `baseUrl` is the site origin (https://search.foldseek.com), matching what the frontend puts in
// axios' baseURL; the /api prefix belongs to the routes and is added here. A deployment that sets
// config.Server.PathPrefix to something else can override it with `apiPath`.
//
// Uses the platform fetch rather than axios: Node 18+ ships fetch, FormData and Blob, so multipart
// submission needs no dependency at all. The frontend's axios usage does not carry over — this is a
// separate program that happens to share parsing logic, not a port of the page's networking.

import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';
import { Store, defaultStateDir, summarizeRequest } from './store.js';
import { ResultTable } from './results.js';
import { assertMotif, computeDefaultMotif, validateMotif, normalizeChainNames } from './motif.js';
import {
    foldMasonColumns, foldMasonFasta, foldMasonCoordinates, foldMasonEntries, MsaColumnSelection,
} from './msa.js';
import {
    fetchFoldDiscoStructure, reconstructFullAtom, resolveStructureFromDb,
    loadAccession, loadAccessions, ensureStructureExtension,
} from './structures.js';
import { SubmittableQuery } from './submit.js';
import { TERMINAL_STATUSES, kindForJobType, normalizeEntry } from './facts.js';
import { resultSummary, notReadySummary } from './summary.js';
import { createArtifactStore, artifactCacheKey, artifactWriter, serverNamespaceFor } from './artifacts.js';
import { collectArtifacts as sweepArtifacts, fileAudit } from './artifact-gc.js';
import { getChainName } from '../../../frontend/lib/targetName.js';
import { listChains } from '../../../frontend/lib/structureText.js';
import { mockPDB, encodeMultimer } from '../../../frontend/lib/pdbAssembly.js';
import { pathForTicket } from '../../../frontend/lib/ticketRoute.js';
import path from 'node:path';
import fsp from 'node:fs/promises';

/** FoldMason aligns structures against each other; one input has nothing to align to. */
export const FOLDMASON_MIN_FILES = 2;

/** How many parsed results to keep in memory at once. Each can be several MB. */
const PARSED_CACHE_SIZE = 16;
const DEFAULT_GC_MIN_INTERVAL_SECONDS = 600;

const VALID_TAX_FILTER = /^[0-9]+(,!?[0-9]+)*$|^$/;

export { TERMINAL_STATUSES, kindForJobType };

/** A 404 on a job type this deployment does not serve, told apart from a genuinely missing ticket. */
export class UnsupportedOnDeploymentError extends Error {
    constructor(tool) {
        super(`this deployment does not serve ${tool} jobs — /ticket/${tool} returned 404 ` +
              `(the backend only registers that route when config.App is "foldseek")`);
        this.name = 'UnsupportedOnDeploymentError';
        this.tool = tool;
    }
}

export class HttpError extends Error {
    constructor(status, url, body) {
        super(`${status} from ${url}${body ? `: ${String(body).slice(0, 300)}` : ''}`);
        this.name = 'HttpError';
        this.status = status;
        this.url = url;
        this.body = body;
    }
}

export class Ticket {
    constructor(client, id, status = null, kind = null) {
        this.client = client;
        this.id = id;
        this.status = status;
        this.kind = kind;
    }

    wait(opts) { return this.client.waitForCompletion(this.id, opts); }
    getResult(entry = 0) { return this.client.getResult(this.id, entry); }
}

export function assertTaxFilter(taxFilter) {
    const value = taxFilter ?? '';
    if (typeof value !== 'string' || !VALID_TAX_FILTER.test(value)) {
        throw new Error(
            `invalid taxon filter: ${JSON.stringify(taxFilter)} — expected numeric taxon ids ` +
            'separated by commas, optionally negated after the first (e.g. "9606", "9606,!10090")',
        );
    }
    return value;
}

export function createClient({
    baseUrl,
    app = 'foldseek',
    apiPath = '/api',
    cg2allUrl = 'https://3di.foldseek.com/cg2all/predict',
    stateDir = defaultStateDir(),
    basicAuth = null,
    fetchImpl = globalThis.fetch,
    onWarning = null,
    resultRowCap = null,
    artifacts = {},
} = {}) {
    // Never default this. A wrong-but-plausible default would send someone's structures to a public
    // production server without them choosing it.
    if (!baseUrl || typeof baseUrl !== 'string') {
        throw new Error('createClient({ baseUrl }) is required — pass the site origin, e.g. ' +
                        '"http://localhost:3000" or "https://search.foldseek.com"');
    }
    if (typeof fetchImpl !== 'function') {
        throw new Error('no fetch available — Node 18+ is required, or pass fetchImpl');
    }

    const root = baseUrl.replace(/\/+$/, '') + apiPath.replace(/\/+$/, '');
    const store = new Store(stateDir);

    const parsedResults = new Map();
    const memo = async (key, load) => {
        if (parsedResults.has(key)) return parsedResults.get(key);
        const value = await load();
        if (parsedResults.size >= PARSED_CACHE_SIZE) {
            parsedResults.delete(parsedResults.keys().next().value);
        }
        parsedResults.set(key, value);
        return value;
    };
    const serverNamespace = serverNamespaceFor({ baseUrl, apiPath });
    const artifactStore = createArtifactStore({
        root: path.join(stateDir, 'artifacts'),
        ...artifacts,
    });
    // Outside the artifact root on purpose: the GC never has to decide whether its own log is an
    // artifact.
    const gcOptions = {
        staleBuildSeconds: artifacts.staleBuildSeconds,
        maxDeletions: artifacts.maxDeletions,
        audit: artifacts.audit ?? fileAudit(path.join(stateDir, 'artifact-gc-audit.jsonl')),
    };
    const gcMinIntervalSeconds = artifacts.gcMinIntervalSeconds ?? DEFAULT_GC_MIN_INTERVAL_SECONDS;
    const gcStateFile = path.join(stateDir, 'artifact-gc-state.json');
    let databasesPromise = null;

    function headers(extra = {}) {
        const h = { ...extra };
        if (basicAuth) {
            const { user, pass } = basicAuth;
            h.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
        }
        return h;
    }

    async function request(pathname, { method = 'GET', form, tool = null, signal, as = 'json' } = {}) {
        const url = `${root}${pathname}`;
        const init = {
            method,
            headers: headers({ Accept: as === 'json' ? 'application/json' : 'text/plain, */*' }),
            signal,
        };
        if (form instanceof FormData) {
            init.body = form;                       // fetch sets the multipart boundary itself
        } else if (form) {
            init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            init.body = form.toString();
        }

        const res = await fetchImpl(url, init);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            if (res.status === 404 && tool) throw new UnsupportedOnDeploymentError(tool);
            throw new HttpError(res.status, url, text);
        }
        return as === 'json' ? res.json() : res.text();
    }

    /** database[] repeats — the handler reads req.Form["database[]"], not a joined string. */
    function withDatabases(params, databases) {
        for (const db of databases ?? []) params.append('database[]', db);
        return params;
    }

    const USABLE_FOR = {
        search: d => !d.interface && !d.motif,
        complexsearch: d => d.complex && !d.interface && !d.motif,
        interfacesearch: d => d.interface && !d.motif,
        folddisco: d => d.motif && !d.interface,
    };

    async function assertDatabases(requested, kind) {
        if (!Array.isArray(requested) || requested.length === 0) {
            throw new Error(`${kind}: at least one database must be selected`);
        }
        const all = await client.getDatabases();
        const predicate = USABLE_FOR[kind] ?? USABLE_FOR.search;
        const usable = all.filter(d => d.status === undefined || d.status === 'COMPLETE').filter(predicate);
        const paths = new Set(usable.map(d => d.path));

        const unknown = requested.filter(d => !paths.has(d));
        if (unknown.length) {
            const known = new Set(all.map(d => d.path));
            const wrongKind = unknown.filter(d => known.has(d));
            const absent = unknown.filter(d => !known.has(d));
            const parts = [];
            if (absent.length) parts.push(`${absent.join(', ')} not available on this server`);
            if (wrongKind.length) parts.push(`${wrongKind.join(', ')} cannot be used for ${kind}`);
            throw new Error(
                `${kind}: ${parts.join('; ')}. ` +
                `Available: ${usable.map(d => d.path).join(', ') || '(none)'}`,
            );
        }
    }

    async function recordSubmission(result, kind, submitted) {
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
        return new Ticket(client, result.id, result.status ?? 'PENDING', kind);
    }

    const client = {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiRoot: root,
        app,
        cg2allUrl,
        store,
        fetchImpl,
        onWarning,

        getDatabases({ refresh = false } = {}) {
            if (refresh || !databasesPromise) {
                databasesPromise = request('/databases')
                    .then(res => (Array.isArray(res) ? res : res.databases ?? []))
                    .catch(err => { databasesPromise = null; throw err; });
            }
            return databasesPromise;
        },

        async submitFoldseekSearch({
            query, databases, mode = '3diaa', multimer = false,
            email = '', iterativeSearch = false, taxFilter = '',
        }) {
            if (!query) throw new Error('submitFoldseekSearch({ query }) is required');
            const isComplex = multimer || mode.split('-').includes('complex');
            if (isComplex && iterativeSearch) {
                throw new Error('multimer (complex) search does not support iterative search');
            }
            const tax = assertTaxFilter(taxFilter);
            const effectiveMode = multimer && !mode.split('-').includes('complex')
                ? `complex-${mode}` : mode;
            const kind = isComplex ? 'complexsearch' : 'search';
            await assertDatabases(databases, kind);

            const form = withDatabases(new URLSearchParams(), databases);
            form.set('q', query);
            form.set('mode', effectiveMode);
            form.set('email', email);
            form.set('iterativesearch', iterativeSearch ? 'true' : 'false');
            form.set('taxfilter', tax);
            const result = await request('/ticket', { method: 'POST', form });
            return recordSubmission(result, kind, { query, databases, mode: effectiveMode, taxFilter: tax });
        },

        /** Convenience wrapper for FS-MM; identical to submitFoldseekSearch({ multimer: true }). */
        submitMultimerSearch(opts) {
            return client.submitFoldseekSearch({ ...opts, multimer: true });
        },

        async submitFoldMason({ files, email = '' }) {
            if (!Array.isArray(files) || files.length < FOLDMASON_MIN_FILES) {
                throw new Error(`FoldMason needs at least ${FOLDMASON_MIN_FILES} structures; ` +
                                `${Array.isArray(files) ? files.length : 0} provided`);
            }
            const form = new FormData();
            for (const f of files) form.append('queries[]', new Blob([f.content]), f.name);
            if (email) form.append('email', email);
            const result = await request('/ticket/foldmason', { method: 'POST', form, tool: 'foldmason' });
            return recordSubmission(result, 'foldmason', { files, email });
        },

        async submitFoldDisco({ query, databases, motif, email = '' }) {
            if (!query) throw new Error('submitFoldDisco({ query }) is required');
            assertMotif(motif, query);
            await assertDatabases(databases, 'folddisco');

            const form = withDatabases(new URLSearchParams(), databases);
            form.set('q', query);
            form.set('motif', motif);
            form.set('email', email);
            const result = await request('/ticket/folddisco', { method: 'POST', form, tool: 'folddisco' });
            return recordSubmission(result, 'folddisco', { query, databases, motif });
        },

        async pollTicket(ticket) {
            const res = await request(`/ticket/${encodeURIComponent(ticket)}`);
            await store.writeTicket(ticket, {
                lastStatus: res.status,
                lastPolledAt: new Date().toISOString(),
            });
            return res;
        },

        async resultUrl(ticket, { entry = 0 } = {}) {
            const { type } = await client.getTicketType(ticket).catch(() => ({ type: null }));
            return `${client.baseUrl}${pathForTicket(ticket, type, { entry })}`;
        },

        async getTicketType(ticket) {
            const cached = await store.readTicket(ticket);
            if (cached?.jobType) return { type: cached.jobType };
            const res = await request(`/ticket/type/${encodeURIComponent(ticket)}`);
            await store.writeTicket(ticket, { jobType: res.type, kind: kindForJobType(res.type) });
            return res;
        },

        async waitForCompletion(ticket, { intervalMs = 2000, timeoutMs = 0, onStatus = null } = {}) {
            const cached = await store.readTicket(ticket);
            if (cached?.lastStatus === 'COMPLETE') {
                onStatus?.('COMPLETE', { fromCache: true });
                return new Ticket(client, ticket, 'COMPLETE', cached.kind);
            }

            const startedAt = Date.now();
            for (;;) {
                const { status } = await client.pollTicket(ticket);
                onStatus?.(status, { fromCache: false });
                if (TERMINAL_STATUSES.has(status)) {
                    if (status !== 'COMPLETE') {
                        const err = new Error(`ticket ${ticket} finished with status ${status}`);
                        err.status = status;
                        throw err;
                    }
                    const t = await store.readTicket(ticket);
                    return new Ticket(client, ticket, status, t?.kind);
                }
                if (timeoutMs && Date.now() - startedAt >= timeoutMs) {
                    const err = new Error(`timed out after ${timeoutMs}ms waiting for ${ticket} ` +
                                          `(last status ${status})`);
                    err.status = status;
                    err.timedOut = true;
                    throw err;
                }
                await new Promise(r => setTimeout(r, intervalMs));
            }
        },

        async getResult(ticket, entry = 0) {
            const data = await memo(`search:${ticket}:${entry}`, async () => {
                const cached = await store.readResult(ticket, 'search', entry);
                if (cached) return cached;
                const value = parseResults(
                    await request(`/result/${encodeURIComponent(ticket)}/${encodeURIComponent(entry)}`));
                await store.writeResult(ticket, 'search', entry, value);
                return value;
            });
            return new ResultTable(data, { ticket, entry, app, client });
        },

        getFoldMasonResult(ticket) {
            return memo(`foldmason:${ticket}`, async () => {
                const cached = await store.readResult(ticket, 'foldmason');
                if (cached) return cached;
                const res = await request(`/result/foldmason/${encodeURIComponent(ticket)}`);
                await store.writeResult(ticket, 'foldmason', 0, res);
                return res;
            });
        },

        async getFoldMasonColumns(ticket, opts = {}) {
            return foldMasonColumns(await client.getFoldMasonResult(ticket), opts);
        },

        async getFoldMasonFasta(ticket, opts = {}) {
            return foldMasonFasta(await client.getFoldMasonResult(ticket), opts);
        },

        async getFoldMasonCoordinates(ticket, opts = {}) {
            return foldMasonCoordinates(await client.getFoldMasonResult(ticket), opts);
        },

        async getFoldMasonEntries(ticket) {
            return foldMasonEntries(await client.getFoldMasonResult(ticket));
        },

        async selectMsaColumns(ticket, { entry = 0, columns = [], name = 'default' } = {}) {
            return new MsaColumnSelection(
                client, await client.getFoldMasonResult(ticket), { entry, columns, ticket, name });
        },

        async loadMsaSelection(ticket, name = 'default') {
            const record = await store.readSelection(ticket, name);
            if (!record) return null;
            if (record.page && record.page !== 'foldmason') {
                throw new Error(`selection "${name}" on ${ticket} is a ${record.page} row selection, ` +
                                'not a column selection');
            }
            return new MsaColumnSelection(client, await client.getFoldMasonResult(ticket), {
                ticket, name,
                entry: record.entry ?? 0,
                columns: record.columns ?? [],
                motif: record.motif ?? null,
                savedAt: record.updatedAt,
            });
        },

        listSelections(ticket) { return store.listSelections(ticket); },
        deleteSelection(ticket, name = 'default') { return store.deleteSelection(ticket, name); },
        copySelection(ticket, fromName, toName) { return store.copySelection(ticket, fromName, toName); },

        async getResultTable(ticket, { entry = 0 } = {}) {
            const { type } = await client.getTicketType(ticket);
            return type === 'folddisco'
                ? client.getFoldDiscoResult(ticket)
                : client.getResult(ticket, entry);
        },

        async getTaxonomy(ticket, { entry = 0, db = null, ...opts } = {}) {
            const table = await client.getResultTable(ticket, { entry });
            return table.getTaxonomy(db, opts);
        },

        async getFoldDiscoResult(ticket) {
            const data = await memo(`folddisco:${ticket}`, async () => {
                const cached = await store.readResult(ticket, 'folddisco');
                if (cached) return cached;
                const value = parseResultsFoldDisco(
                    await request(`/result/folddisco/${encodeURIComponent(ticket)}`));
                await store.writeResult(ticket, 'folddisco', 0, value);
                return value;
            });
            return new ResultTable(data, { ticket, entry: 0, app, tool: 'folddisco', client });
        },

        getFoldDiscoTargetStructure(ticket, opts) {
            return fetchFoldDiscoStructure(request, ticket, opts);
        },

        getQueries(ticket, { limit = 200, page = 0 } = {}) {
            return request(`/result/queries/${encodeURIComponent(ticket)}/${limit}/${page}`);
        },

        /**
         * One hit's chains, with the CA coordinates the full result omits.
         *
         * @returns {Promise<{ca: string, seq: string, chain: string, target: string}[]>}
         */
        async getHitChains(ticket, { entry = 0, db, idx, signal } = {}) {
            if (db === undefined || idx === undefined) {
                throw new Error('getHitChains({ db, idx }) is required');
            }
            const qs = new URLSearchParams({ format: 'brief', index: String(idx), database: String(db) });
            const rows = await request(
                `/result/${encodeURIComponent(ticket)}/${encodeURIComponent(entry)}?${qs}`, { signal });
            if (!Array.isArray(rows) || rows.length === 0) {
                throw new Error(`no hit at index ${idx} in ${db} for ticket ${ticket}`);
            }
            return rows.map(r => ({
                ca: r.tCa, seq: r.tSeq, chain: getChainName(r.target), target: r.target,
            }));
        },

        /**
         * The ticket's own query structure, as a submittable file.
         */
        async getQueryStructure(ticket, { signal, encodeComplex = true } = {}) {
            const text = await request(`/result/${encodeURIComponent(ticket)}/query`,
                { as: 'text', signal });

            if (encodeComplex) {
                const chains = listChains(text);
                if (chains.length > 1) {
                    const parts = chains.map(c => ({ pdb: mockPDB(c.ca, c.seq, c.chain), chain: c.chain }));
                    const { pdb, suffix } = encodeMultimer(parts);
                    return { name: `query${suffix}`, content: pdb, chains: chains.length };
                }
            }
            return { name: ensureStructureExtension('query', text), content: text };
        },

        query(spec, opts) { return new SubmittableQuery(client, spec, opts); },

        reconstructFullAtom(pdbText, opts = {}) {
            return reconstructFullAtom(pdbText, { cg2allUrl, fetchImpl, ...opts });
        },

        resolveStructureFromDb(db, accession, opts = {}) {
            return resolveStructureFromDb(db, accession, { fetchImpl, ...opts });
        },

        loadAccession(id, opts) { return loadAccession(client, id, opts); },
        loadAccessions(ids, opts) { return loadAccessions(client, ids, opts); },

        computeDefaultMotif(structureText, opts) { return computeDefaultMotif(structureText, opts); },
        validateMotif(motif, structureText) { return validateMotif(motif, structureText); },

        /**
         * Give a structure single-character chain names and rewrite a motif to match — the repair for
         * a chain a motif token cannot address, e.g., A1…A4.
         */
        normalizeChainNames(structureText, opts) { return normalizeChainNames(structureText, opts); },

        /**
         * Run every pre-submission check and report what *would* be sent, without queueing anything.
         */
        async validateSubmission({ tool, query, databases, motif, mode = '3diaa', files, iterativeSearch = false, taxFilter = '' }) {
            const problems = [];
            const record = (fn) => { try { fn(); } catch (err) { problems.push(err.message); } };

            if (tool === 'foldmason') {
                record(() => {
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
                record(() => assertMotif(motif, query));
            } else {
                record(() => assertTaxFilter(taxFilter));
                if (isComplex && iterativeSearch) {
                    problems.push('multimer (complex) search does not support iterative search');
                }
            }
            try {
                await assertDatabases(databases, kind);
            } catch (err) {
                problems.push(err.message);
            }

            const effectiveMode = tool === 'multimer' && !String(mode).split('-').includes('complex')
                ? `complex-${mode}` : mode;
            return {
                ok: problems.length === 0,
                tool,
                problems,
                would: {
                    endpoint: tool === 'folddisco' ? '/ticket/folddisco' : '/ticket',
                    databases: databases ?? [],
                    ...(tool === 'folddisco' ? { motif } : { mode: effectiveMode, taxFilter, iterativeSearch }),
                    queryBytes: query ? Buffer.byteLength(query) : 0,
                },
            };
        },

        /**
         * Resolve a ticket to one result unit, without waiting for it.
         *
         * Status comes from the cache when it is already terminal, and otherwise from exactly one
         * poll: a caller asking what a result holds has not asked to wait for it.
         */
        async resolveUnit(ticket, entry = 0) {
            const { type: jobType } = await client.getTicketType(ticket);
            const normalized = normalizeEntry(jobType, entry);
            const kind = kindForJobType(jobType);

            const cached = await store.readTicket(ticket).catch(() => null);
            const status = TERMINAL_STATUSES.has(cached?.lastStatus)
                ? cached.lastStatus
                : (await client.pollTicket(ticket)).status;

            const unit = {
                ticket, jobType, kind, status,
                entry: normalized.entry,
                entryNormalized: normalized.normalized,
                record: cached,
            };
            if (status !== 'COMPLETE') return unit;

            if (kind === 'foldmason') {
                unit.foldMasonResult = await client.getFoldMasonResult(ticket);
            } else if (kind === 'folddisco') {
                unit.table = await client.getFoldDiscoResult(ticket);
            } else {
                unit.table = await client.getResult(ticket, normalized.entry);
            }
            unit.record = await store.readTicket(ticket).catch(() => cached);
            return unit;
        },

        /** Bounded orientation for one result unit. Takes a ticket and an entry, and nothing else. */
        async getResultSummary(ticket, entry = 0) {
            const unit = await client.resolveUnit(ticket, entry);
            if (unit.status !== 'COMPLETE') return notReadySummary(unit);

            const [catalog, selections] = await Promise.all([
                client.getDatabases().catch(() => null),
                store.listSelections(ticket).catch(() => []),
            ]);
            return resultSummary({ ...unit, catalog, selections, configuredCap: resultRowCap });
        },

        artifacts: artifactStore,
        serverNamespace,

        /**
         * The complete factual export for one result unit, as files. Returns a descriptor — the
         * resource URI and what is in the bundle — never the data.
         */
        async exportResult(ticket, entry = 0) {
            const unit = await client.resolveUnit(ticket, entry);
            if (unit.status !== 'COMPLETE') {
                const err = new Error(`ticket ${ticket} is ${unit.status}; nothing to export yet`);
                err.code = unit.status === 'COMPLETE' ? 'EXPORT_FAILED' : 'RESULT_NOT_READY';
                err.status = unit.status;
                throw err;
            }

            const artifactId = artifactCacheKey({
                serverNamespace, ticketId: ticket, normalizedEntry: unit.entry,
            });

            const hit = await artifactStore.read(artifactId);
            if (hit.ok) {
                await artifactStore.touch(artifactId);
                return artifactStore.descriptor(hit.manifest, { cacheHit: true });
            }
            if (hit.reason !== 'ABSENT') {
                // Anything present that did not read back is a failed build or a damaged artifact:
                // it has to go before the rename, or the rename is what fails.
                onWarning?.(`rebuilding artifact ${artifactId.slice(0, 12)}: ${hit.reason}`);
                await fsp.rm(artifactStore.dirFor(artifactId), { recursive: true, force: true });
            }

            const catalog = await client.getDatabases().catch(() => null);
            const { manifest, cacheHit } = await artifactStore.build(artifactId, artifactWriter({
                artifactId,
                serverNamespace,
                ticket,
                entry: unit.entry,
                jobType: unit.jobType,
                table: unit.table ?? null,
                foldMasonResult: unit.foldMasonResult ?? null,
                record: unit.record,
                catalog,
                configuredCap: resultRowCap,
                clock: artifactStore.now,
            }));
            await client.collectArtifacts({ minIntervalSeconds: gcMinIntervalSeconds })
                .catch(err => onWarning?.(`artifact GC failed: ${err.message}`));
            return artifactStore.descriptor(manifest, { cacheHit });
        },

        /**
         * Delete expired public artifacts. Touches nothing under tickets/.
         *
         * `minIntervalSeconds` skips the walk entirely when the last sweep is recent; the marker lives
         * outside the artifact root and survives a restart. An explicit call (operator, startup, tests)
         * passes 0 and always sweeps.
         */
        async collectArtifacts({ minIntervalSeconds = 0, ...opts } = {}) {
            const now = artifactStore.now();
            if (minIntervalSeconds > 0) {
                const last = await fsp.readFile(gcStateFile, 'utf8')
                    .then(text => Date.parse(JSON.parse(text).lastSweepAt))
                    .catch(() => NaN);
                if (Number.isFinite(last) && (now.getTime() - last) / 1000 < minIntervalSeconds) {
                    // Not "skipped": the report already uses that for how many entries were skipped.
                    return {
                        throttled: true,
                        lastSweepAt: new Date(last).toISOString(),
                        nextDueAt: new Date(last + minIntervalSeconds * 1000).toISOString(),
                    };
                }
            }
            const report = await sweepArtifacts(artifactStore, { ...gcOptions, ...opts, now });
            await fsp.writeFile(gcStateFile, JSON.stringify({ lastSweepAt: now.toISOString() }))
                .catch(err => onWarning?.(`could not record the GC sweep time: ${err.message}`));
            return report;
        },

        listCachedTickets(opts) { return store.listTickets(opts); },
    };

    return client;
}

export { idForHit } from './results.js';

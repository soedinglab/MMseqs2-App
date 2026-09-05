// HTTP client for the Go backend; submissions validate locally and completed results are cached.

import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';
import { Store, defaultStateDir, summarizeRequest } from './store.js';
import { ResultTable } from './results.js';
import { assertMotif } from './motif.js';
import { MsaColumnSelection } from './msa.js';
import {
    fetchFoldDiscoStructure, loadAccession, loadAccessions, ensureStructureExtension,
} from './structures.js';
import { SubmittableQuery } from './submit.js';
import { TERMINAL_STATUSES, kindForJobType, toolForJobType, normalizeQueryIdx } from './facts.js';
import { resultSummary, notReadySummary } from './summary.js';
import { createArtifactStore, artifactCacheKey, artifactWriter, serverNamespaceFor } from './artifacts.js';
import {
    collectArtifacts as sweepArtifacts, collectResultCache as sweepResultCache,
    collectDroppedInputs as sweepImports, fileAudit,
    DEFAULT_RESULT_TTL_SECONDS,
} from './gc.js';
import { DEFAULT_INPUT_TTL_SECONDS, sharedPaths } from './inputs.js';
import { resolveTaxFilter, taxFilterHasNames } from './taxonomy.js';
import { getChainName } from '../../../frontend/lib/targetName.js';
import { listChains } from '../../../frontend/lib/structureText.js';
import { mockPDB, encodeMultimer } from '../../../frontend/lib/pdbAssembly.js';
import { pathForTicket } from '../../../frontend/lib/ticketRoute.js';
import path from 'node:path';
import fsp from 'node:fs/promises';

/** Minimum structures in a FoldMason alignment. */
export const FOLDMASON_MIN_FILES = 2;

/** Parsed-result cache bound. */
const PARSED_CACHE_SIZE = 16;
const GC_MIN_INTERVAL_SECONDS = 600;

const VALID_TAX_FILTER = /^[0-9]+(,!?[0-9]+)*$|^$/;

export { TERMINAL_STATUSES, kindForJobType, toolForJobType };

/** A deployment does not expose this job route. */
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

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
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
    apiPath = '/api',
    cg2allUrl = 'https://3di.foldseek.com/cg2all/predict',
    stateDir = defaultStateDir(),
    basicAuth = null,
    fetchImpl = globalThis.fetch,
    onWarning = null,
    resultRowCap = null,
    sharedDir = null,
    resultTtlSeconds = DEFAULT_RESULT_TTL_SECONDS,
    inputTtlSeconds = DEFAULT_INPUT_TTL_SECONDS,
    artifacts = {},
} = {}) {
    // Require an explicit destination for submitted structures.
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

    // Keep user-visible shared files outside private server state.
    const shared = sharedDir ? path.resolve(sharedDir) : null;
    if (shared) {
        const toState = path.relative(shared, stateDir);
        if (toState === '' || (!toState.startsWith('..') && !path.isAbsolute(toState))) {
            throw new Error(`sharedDir ${shared} contains the state directory ${stateDir} — ` +
                            'pick a directory outside it');
        }
    }
    const { exportsDir, importsDir } = shared ? sharedPaths(shared) : {};
    const artifactRoot = exportsDir || path.join(stateDir, 'artifacts');
    const artifactStore = createArtifactStore({
        root: artifactRoot,
        insideStateDir: !shared,
        mountName: shared ? path.basename(shared) : null,
        pathPrefix: shared ? 'exports' : null,
        ...artifacts,
    });
    // Keep the GC log outside the artifact root it sweeps.
    const gcOptions = {
        audit: artifacts.audit ?? fileAudit(path.join(stateDir, 'artifact-gc-audit.jsonl')),
    };
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

    /** Encode each selected database as a repeated form field. */
    function withDatabases(params, databases) {
        for (const db of databases ?? []) params.append('database[]', db);
        return params;
    }

    const USABLE_FOR = {
        search: d => !d.interface && !d.motif && !d.rna,
        complexsearch: d => d.complex && !d.interface && !d.motif && !d.rna,
        folddisco: d => d.motif && !d.interface && !d.rna,
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
        return { id: result.id, status: result.status ?? 'PENDING', kind };
    }

    const client = {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiRoot: root,
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

            const form = withDatabases(new URLSearchParams(), databases);
            form.set('q', query);
            form.set('mode', effectiveMode);
            form.set('email', email);
            form.set('iterativesearch', iterativeSearch ? 'true' : 'false');
            form.set('taxfilter', tax);
            const result = await request('/ticket', { method: 'POST', form });
            const ticket = await recordSubmission(result, kind,
                { query, databases, mode: effectiveMode, taxFilter: tax });
            // Only when a name was resolved: the ids are the one thing the caller did not pass in.
            if (resolved.length) ticket.taxonomy = { filter: tax, resolved };
            return ticket;
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
            let kind = null;
            try { kind = kindForJobType(res.type); } catch { /* unsupported: kind stays null */ }
            await store.writeTicket(ticket, { jobType: res.type, kind });
            return res;
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
            return new ResultTable(data, { ticket, queryIdx: entry, client });
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
                residueAa: record.residueAa ?? [],
                savedAt: record.updatedAt,
            });
        },

        listSelections(ticket) { return store.listSelections(ticket); },
        deleteSelection(ticket, name = 'default') { return store.deleteSelection(ticket, name); },
        copySelection(ticket, fromName, toName) { return store.copySelection(ticket, fromName, toName); },

        async getResultTable(ticket, { queryIdx = 0 } = {}) {
            const { type } = await client.getTicketType(ticket);
            return type === 'folddisco'
                ? client.getFoldDiscoResult(ticket)
                : client.getResult(ticket, queryIdx);
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
            return new ResultTable(data, { ticket, queryIdx: 0, tool: 'folddisco', client });
        },

        getFoldDiscoTargetStructure(ticket, opts) {
            return fetchFoldDiscoStructure(request, ticket, opts);
        },

        getQueries(ticket, { limit = 200, page = 0 } = {}) {
            return request(`/result/queries/${encodeURIComponent(ticket)}/${limit}/${page}`);
        },

        /** Fetch one hit's chains and CA coordinates. */
        async getHitChains(ticket, { queryIdx = 0, db, idx, signal } = {}) {
            if (db === undefined || idx === undefined) {
                throw new Error('getHitChains({ db, idx }) is required');
            }
            const qs = new URLSearchParams({ format: 'brief', index: String(idx), database: String(db) });
            const rows = await request(
                `/result/${encodeURIComponent(ticket)}/${encodeURIComponent(queryIdx)}?${qs}`, { signal });
            if (!Array.isArray(rows) || rows.length === 0) {
                throw new Error(`no hit at index ${idx} in ${db} for ticket ${ticket}`);
            }
            return rows.map(r => ({
                ca: r.tCa, seq: r.tSeq, chain: getChainName(r.target), target: r.target,
            }));
        },

        /** Fetch the ticket's query as a submittable file. */
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

        loadAccession(id, opts) { return loadAccession(client, id, opts); },
        loadAccessions(ids, opts) { return loadAccessions(client, ids, opts); },

        /** Validate a submission without queueing it. */
        async validateSubmission({ tool, query, databases, motif, mode = '3diaa', files, iterativeSearch = false, taxFilter = '' }) {
            const problems = [];
            let taxonomy = null;
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
                if (taxFilterHasNames(taxFilter)) {
                    try {
                        const { filter, resolved } = await resolveTaxFilter(taxFilter, { fetchImpl });
                        assertTaxFilter(filter);
                        taxonomy = { filter, resolved };
                    } catch (err) { problems.push(`taxonomy: ${err.message}`); }
                } else {
                    record(() => assertTaxFilter(taxFilter));
                }
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
                    ...(tool === 'folddisco' ? { motif }
                        : { mode: effectiveMode, taxFilter: taxonomy?.filter ?? taxFilter, iterativeSearch }),
                    queryBytes: query ? Buffer.byteLength(query) : 0,
                },
                ...(taxonomy?.resolved.length ? { taxonomy: taxonomy.resolved } : {}),
            };
        },

        /** Resolve one result unit with at most one status poll. */
        async resolveUnit(ticket, queryIdx = 0) {
            const { type: jobType } = await client.getTicketType(ticket);
            const { queryIdx: index } = normalizeQueryIdx(jobType, queryIdx);
            const kind = kindForJobType(jobType);

            // Refuse indices the backend would otherwise return as empty complete results.
            if (index > 0) {
                const list = await client.getQueries(ticket, { limit: 1000 }).catch(() => null);
                const count = list?.lookup?.length ?? null;
                if (count !== null && index >= count) {
                    throw coded('QUERY_IDX_OUT_OF_RANGE',
                        `queryIdx ${index} is past the end of ${ticket}: it holds ${count} `
                        + `quer${count === 1 ? 'y' : 'ies'}, so valid values are 0..${count - 1}`);
                }
            }

            const cached = await store.readTicket(ticket).catch(() => null);
            const status = TERMINAL_STATUSES.has(cached?.lastStatus)
                ? cached.lastStatus
                : (await client.pollTicket(ticket)).status;

            const unit = {
                ticket, jobType, kind, status,
                queryIdx: index,
                record: cached,
            };
            if (status !== 'COMPLETE') return unit;

            if (kind === 'foldmason') {
                unit.foldMasonResult = await client.getFoldMasonResult(ticket);
            } else if (kind === 'folddisco') {
                unit.table = await client.getFoldDiscoResult(ticket);
            } else {
                unit.table = await client.getResult(ticket, index);
            }
            unit.record = await store.readTicket(ticket).catch(() => cached);
            return unit;
        },

        /** Return a bounded summary for one result unit. */
        async getResultSummary(ticket, queryIdx = 0) {
            const unit = await client.resolveUnit(ticket, queryIdx);
            if (unit.status !== 'COMPLETE') return notReadySummary(unit);

            const [catalog, selections] = await Promise.all([
                client.getDatabases().catch(() => null),
                store.listSelections(ticket).catch(() => []),
            ]);
            return resultSummary({ ...unit, catalog, selections, configuredCap: resultRowCap });
        },

        artifacts: artifactStore,
        serverNamespace,

        /** Export one complete result unit and return only its descriptor. */
        async exportResult(ticket, queryIdx = 0) {
            const unit = await client.resolveUnit(ticket, queryIdx);
            if (unit.status !== 'COMPLETE') {
                const err = new Error(`ticket ${ticket} is ${unit.status}; nothing to export yet`);
                err.code = unit.status === 'COMPLETE' ? 'EXPORT_FAILED' : 'RESULT_NOT_READY';
                err.status = unit.status;
                throw err;
            }

            const artifactId = artifactCacheKey({
                serverNamespace, ticketId: ticket, queryIdx: unit.queryIdx,
            });

            const hit = await artifactStore.read(artifactId);
            if (hit.ok) {
                await artifactStore.touch(artifactId);
                return artifactStore.descriptor(hit.manifest, { cacheHit: true });
            }
            if (hit.reason !== 'ABSENT') {
                // Remove an unreadable artifact before rebuilding it atomically.
                onWarning?.(`rebuilding artifact ${artifactId.slice(0, 12)}: ${hit.reason}`);
                await fsp.rm(artifactStore.dirFor(artifactId), { recursive: true, force: true });
            }

            const catalog = await client.getDatabases().catch(() => null);
            const { manifest, cacheHit } = await artifactStore.build(artifactId, artifactWriter({
                artifactId,
                serverNamespace,
                ticket,
                queryIdx: unit.queryIdx,
                jobType: unit.jobType,
                table: unit.table ?? null,
                foldMasonResult: unit.foldMasonResult ?? null,
                record: unit.record,
                catalog,
                configuredCap: resultRowCap,
                clock: artifactStore.now,
            }));
            await client.collectGarbage({ minIntervalSeconds: GC_MIN_INTERVAL_SECONDS })
                .catch(err => onWarning?.(`GC failed: ${err.message}`));
            return artifactStore.descriptor(manifest, { cacheHit });
        },

        /** Expire artifacts, cached results and dropped inputs on one clock. */
        async collectGarbage({ minIntervalSeconds = 0, dryRun = false, auditKeeps = false,
            audit = undefined } = {}) {
            const now = artifactStore.now();
            if (minIntervalSeconds > 0) {
                const last = await fsp.readFile(gcStateFile, 'utf8')
                    .then(text => Date.parse(JSON.parse(text).lastSweepAt))
                    .catch(() => NaN);
                if (Number.isFinite(last) && (now.getTime() - last) / 1000 < minIntervalSeconds) {
                    // Keep throttling distinct from per-entry skips.
                    return {
                        throttled: true,
                        lastSweepAt: new Date(last).toISOString(),
                        nextDueAt: new Date(last + minIntervalSeconds * 1000).toISOString(),
                    };
                }
            }
            const opts = { ...gcOptions, ...(audit ? { audit } : {}), dryRun, auditKeeps, now };
            const report = {
                artifacts: await sweepArtifacts(artifactStore, opts),
                results: await sweepResultCache(store, { ...opts, ttlSeconds: resultTtlSeconds }),
                inputs: importsDir
                    ? await sweepImports(importsDir, { ...opts, ttlSeconds: inputTtlSeconds })
                    : { skipped: 'NO_SHARED_DIR' },
            };
            await fsp.writeFile(gcStateFile, JSON.stringify({ lastSweepAt: now.toISOString() }))
                .catch(err => onWarning?.(`could not record the GC sweep time: ${err.message}`));
            return report;
        },

        // Expose the shared layout to MCP transport setup.
        sharedDirs: shared ? { shared, exportsDir, importsDir } : null,
    };

    return client;
}

export { idForHit } from './results.js';

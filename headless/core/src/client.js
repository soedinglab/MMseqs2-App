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
import { assertMotif } from './motif.js';
import { foldMasonColumns, foldMasonColumnSummary } from './msa.js';

export const TERMINAL_STATUSES = new Set(['COMPLETE', 'ERROR', 'UNKNOWN']);

/** FoldMason aligns structures against each other; one input has nothing to align to. */
export const FOLDMASON_MIN_FILES = 2;

/**
 * Taxon filter grammar, copied from backend/searchjob.go:69 — numeric taxon ids, comma separated,
 * every entry after the first optionally negated with "!", empty meaning no filter. A malformed one
 * is rejected by the job constructor as a bare "invalid taxon filter" after submission, so the same
 * rule is applied here to fail with something readable instead.
 */
const VALID_TAX_FILTER = /^[0-9]+(,!?[0-9]+)*$|^$/;

/**
 * Which cache file a ticket's results belong in, from the backend's JobType (see the JobType
 * constants in backend/jobsystem.go). Needed for tickets this client did not submit itself — a
 * ticket id pasted in from a browser session has no local record until it is asked about.
 */
export function kindForJobType(jobType) {
    switch (jobType) {
        case 'foldmasoneasymsa': return 'foldmason';
        case 'folddisco': return 'folddisco';
        case 'complexsearch': return 'complexsearch';
        default: return 'search';       // search, structuresearch, interfacesearch, msa, pair, …
    }
}

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

    /**
     * Which databases each job type may use, mirroring Databases.vue's own filters rather than the
     * backend's looser check.
     *
     * The backend only rejects what its job constructor rejects: NewComplexSearchJobRequest requires
     * Params.Complex and NewFoldDiscoJobRequest requires Params.Motif, but NewStructureSearchJobRequest
     * accepts any complete database at all — including the `*_folddisco` motif indexes, which are not
     * a meaningful target for a structure search and which the search page never offers. Matching the
     * page keeps "what the client accepts" the same as "what a user could have picked", at the cost
     * of being deliberately stricter than the server for plain search.
     */
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
        // /databases already returns only complete ones; re-checking costs nothing and keeps this
        // correct if a caller points it at /databases/all.
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
        await store.writeTicket(result.id, {
            kind,
            submittedAt: now,
            lastStatus: result.status ?? 'PENDING',
            lastPolledAt: now,
            request: summarizeRequest(submitted),
        });
        return new Ticket(client, result.id, result.status ?? 'PENDING', kind);
    }

    const client = {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiRoot: root,
        app,
        cg2allUrl,
        store,

        /** Complete databases and their capability flags. Fetched once per client. */
        getDatabases({ refresh = false } = {}) {
            if (refresh || !databasesPromise) {
                databasesPromise = request('/databases')
                    .then(res => (Array.isArray(res) ? res : res.databases ?? []))
                    .catch(err => { databasesPromise = null; throw err; });
            }
            return databasesPromise;
        },

        /**
         * Monomer and multimer search are the same endpoint. The handler splits `mode` on "-" and
         * looks for a "complex" (multimer) or "interface" segment, so multimer search is
         * mode "complex-3diaa" rather than a separate route — which is exactly how
         * MultimerSearch.vue builds it ('complex-' + MODE_KEY).
         */
        async submitFoldseekSearch({
            query, databases, mode = '3diaa', multimer = false,
            email = '', iterativeSearch = false, taxFilter = '',
        }) {
            if (!query) throw new Error('submitFoldseekSearch({ query }) is required');
            const isComplex = multimer || mode.split('-').includes('complex');
            // NewComplexSearchJobRequest takes no iterative-search flag: the handler reads the field
            // but the complex job never receives it. Sending it would be silently ignored, which
            // reads as support that isn't there.
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

        /**
         * FoldMason takes one multipart part per structure, and needs at least two: it builds a
         * multiple structure alignment, so a single input has nothing to align against. The backend
         * does not reject a one-file job — it would queue and fail later — so the check is here,
         * matching FoldMasonSearch.vue's own guard.
         *
         * The entry name rides on the part's filename, not a sibling field.
         */
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

        /**
         * A FoldDisco search is defined by its motif, so the motif is validated against the query
         * structure before submitting — every token has to name a residue the query actually
         * contains, the same rule FoldDiscoSearch.vue enforces before enabling its search button.
         * The backend checks neither (NewFoldDiscoJobRequest validates the database list and
         * nothing else), so an empty or unresolvable motif would otherwise queue a job that cannot
         * mean anything.
         *
         * No taxon filter: the handler and the job constructor both have it commented out.
         */
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

        async getTicketType(ticket) {
            const cached = await store.readTicket(ticket);
            if (cached?.jobType) return { type: cached.jobType };
            const res = await request(`/ticket/type/${encodeURIComponent(ticket)}`);
            // Record `kind` alongside it: a ticket that arrived from elsewhere (pasted from a
            // browser session, say) has no submission record, and every later cache read needs to
            // know which result file it is looking for.
            await store.writeTicket(ticket, { jobType: res.type, kind: kindForJobType(res.type) });
            return res;
        },

        /**
         * Poll until terminal. A cached COMPLETE skips the network entirely — the backend has no
         * result expiry, so a completed ticket cannot revert to running.
         */
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

        /** Foldseek/plain search results, parsed with the frontend's own parseResults. */
        async getResult(ticket, entry = 0) {
            const cached = await store.readResult(ticket, 'search', entry);
            if (cached) return new ResultTable(cached, { ticket, entry, app });

            const raw = await request(`/result/${encodeURIComponent(ticket)}/${encodeURIComponent(entry)}`);
            const parsed = parseResults(raw);
            await store.writeResult(ticket, 'search', entry, parsed);
            return new ResultTable(parsed, { ticket, entry, app });
        },

        /** The backend parses FoldMason results itself; there is nothing to run parseResults on. */
        async getFoldMasonResult(ticket) {
            const cached = await store.readResult(ticket, 'foldmason');
            if (cached) return cached;
            const res = await request(`/result/foldmason/${encodeURIComponent(ticket)}`);
            await store.writeResult(ticket, 'foldmason', 0, res);
            return res;
        },

        /**
         * Per-column metrics for an alignment — occupancy, entropy, quality, conservation. The page
         * computes these on the GPU; these come from the CPU port in msaTracks.js, which reproduces
         * that output column for column.
         */
        async getFoldMasonColumns(ticket, opts = {}) {
            return foldMasonColumns(await client.getFoldMasonResult(ticket), opts);
        },

        async getFoldMasonColumnSummary(ticket, opts = {}) {
            return foldMasonColumnSummary(await client.getFoldMasonResult(ticket), opts);
        },

        /**
         * The whole FoldDisco result table. No entry index exists on this route, unlike Foldseek's
         * /result/{ticket}/{entry}, and no query string is sent: `database` there narrows the table
         * per-database, which this client has no use for, and `id` changes what the route returns
         * entirely.
         */
        async getFoldDiscoResult(ticket) {
            const cached = await store.readResult(ticket, 'folddisco');
            if (cached) return new ResultTable(cached, { ticket, entry: 0, app, tool: 'folddisco' });

            const raw = await request(`/result/folddisco/${encodeURIComponent(ticket)}`);
            const parsed = parseResultsFoldDisco(raw);
            await store.writeResult(ticket, 'folddisco', 0, parsed);
            return new ResultTable(parsed, { ticket, entry: 0, app, tool: 'folddisco' });
        },

        /**
         * A hit's own PDB text — the same route with `id` set. This is the structure source for
         * forwarding a FoldDisco hit onwards, and is why that path needs no reconstruction step.
         *
         * The id is not one field: ResultFoldDisco.vue's getTargetPdb sends `item.target` for pdb*
         * databases and `item.dbkey` for every other one, and both come from the *parsed* result
         * (raw `target` for pdb100 is an absolute server path, which the handler would join again
         * into a nonexistent one). idForHit() below applies that rule so callers do not have to.
         *
         * Retried because the server may have to decompress the structure with foldcomp on first
         * request; the page retries this same call for the same reason.
         */
        async getFoldDiscoTargetStructure(ticket, { id, database, retries = 4, retryDelayMs = 500 }) {
            if (!id) throw new Error('getFoldDiscoTargetStructure({ id }) is required');
            const qs = new URLSearchParams({ id });
            if (database !== undefined) qs.set('database', database);
            const path = `/result/folddisco/${encodeURIComponent(ticket)}?${qs}`;

            let lastErr;
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    return await request(path, { as: 'text' });
                } catch (err) {
                    lastErr = err;
                    if (attempt < retries - 1) {
                        await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)));
                    }
                }
            }
            throw lastErr;
        },

        getQueries(ticket, { limit = 200, page = 0 } = {}) {
            return request(`/result/queries/${encodeURIComponent(ticket)}/${limit}/${page}`);
        },

        listCachedTickets(opts) { return store.listTickets(opts); },
    };

    return client;
}

/**
 * The identifier getFoldDiscoTargetStructure wants for a hit, per ResultFoldDisco.vue's getTargetPdb:
 * pdb* databases address structures by filename (`6iuf.ent`), everything else by numeric dbkey.
 */
export function idForHit(hit, database) {
    return String(database).startsWith('pdb') ? hit.target : hit.dbkey;
}

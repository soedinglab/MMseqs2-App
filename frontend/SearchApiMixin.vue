<script>
// Shared programmatic surface for the query-string search pages (Search, Multimer, FoldDisco).
//
// Those pages hold near-identical state — query, database, databases, mode, taxFilter, email —
// and their search() methods differ only in endpoint, mode prefix and result route. Writing three
// copies of getState/validate/submit would recreate exactly the drift that left the result pages
// with three subtly different selection handlers, so it lives here once, parameterised by
// searchApiConfig().
//
// FoldMason deliberately does NOT use this: its input is a list of files and its validation is a
// count bound, so it would need a mixin full of conditionals.

import { registerPageApi } from './lib/resultsApi.js';
import { sourcesFor, fetchAccession } from './lib/accession.js';
import { create } from 'axios';

export default {
    name: 'SearchApiMixin',
    methods: {
        // Pages override this. Defaults describe the plain Foldseek/MMseqs search.
        searchApiConfig() {
            return {
                tool: 'search',
                modeInfix: '',            // '' | 'FOLDDISCO_'  — the $STRINGS key infix
                modeValuePrefix: '',      // '' | 'complex-'     — prefixes the submitted value
                accessionExtras: [],      // [] | ['QBioLip']
                sendsMode: true,          // FoldDisco does not submit a mode at all
                needsQueryStructure: false,
                supportsTaxonomy: true,
                supportsIterative: false,
            };
        },

        // ---------- modes ----------
        // Enumerated from $STRINGS at call time. Never a literal list: the keys are
        // build-target-specific ($STRINGS is selected by FRONTEND_APP) and FoldDisco uses a
        // different key infix entirely.
        getModes() {
            const { modeInfix, modeValuePrefix } = this.searchApiConfig();
            const count = Number(this.$STRINGS[`MODE_COUNT${modeInfix ? '_' + modeInfix.replace(/_$/, '') : ''}`]
                ?? this.$STRINGS.MODE_COUNT ?? 0);
            const out = [];
            for (let i = 1; i <= count; i++) {
                const key = this.$STRINGS[`MODE_KEY_${modeInfix}${i}`];
                if (key === undefined) continue;
                out.push({
                    key: modeValuePrefix + key,
                    title: this.$STRINGS[`MODE_TITLE_${modeInfix}${i}`] ?? key,
                });
            }
            return out;
        },
        setMode(key) {
            const cfg = this.searchApiConfig();
            if (!cfg.sendsMode) {
                return { ok: false, reason: `${cfg.tool} does not submit a mode` };
            }
            const valid = this.getModes();
            if (!valid.some(m => m.key === key)) {
                return { ok: false, reason: `unknown mode: ${key}`,
                    valid: valid.map(m => m.key) };
            }
            this.mode = key;
            return { ok: true, mode: this.mode };
        },
        // Defensive only. An earlier draft claimed the `mode` localStorage key leaked between
        // Search and Multimer; it does not — each page binds its own namespace
        // (Search: raw storage, Multimer: StorageWrapper("complex"), FoldDisco:
        // StorageWrapper("folddisco")), so the keys are `mode`, `complex.mode`, `folddisco.mode`.
        // Kept because validating the live mode against this page's own list costs nothing and
        // would catch a stale or hand-edited stored value.
        _modeInvalid() {
            const cfg = this.searchApiConfig();
            if (!cfg.sendsMode) return false;
            return !this.getModes().some(m => m.key === this.mode);
        },

        // ---------- databases ----------
        // Read the page's own filtered array. Databases.vue narrows api/databases/all by the
        // interface/complex/motif flags into disjoint per-page subsets, so hitting the endpoint
        // directly would offer databases this page rejects.
        getDatabases() {
            const all = Array.isArray(this.databases) ? this.databases : [];
            return {
                loading: all.length === 0,
                available: all.map(db => ({
                    path: db.path, name: db.name, status: db.status, default: !!db.default,
                })),
                selected: Array.isArray(this.database) ? [...this.database] : [],
            };
        },
        setDatabases(list) {
            const all = Array.isArray(this.databases) ? this.databases : [];
            if (all.length === 0) {
                return { ok: false, reason: 'databases not loaded yet — retry shortly' };
            }
            const wanted = Array.isArray(list) ? list : [list];
            const complete = all.filter(db => db.status === 'COMPLETE');
            const selected = [], rejected = [];
            const norm = x => String(x).trim().toLowerCase();
            for (const w of wanted) {
                // Path and display name, both case-insensitively. A caller that echoes a path
                // straight back from getDatabases() must always work, and matching loosely on
                // the name costs nothing.
                const hit = complete.find(db => db.path === w)
                    || complete.find(db => norm(db.path) === norm(w))
                    || complete.find(db => norm(db.name) === norm(w));
                if (hit) { selected.push(hit.path); continue; }
                const exists = all.find(db => norm(db.path) === norm(w) || norm(db.name) === norm(w));
                rejected.push({ requested: w,
                    reason: exists ? `status is ${exists.status}, not COMPLETE` : 'unknown database',
                    ...(exists ? {} : { hint: 'match against a `path` or `name` from getDatabases()' }) });
            }
            this.database = selected;
            return { ok: rejected.length === 0, selected, rejected,
                available: complete.map(db => db.path) };
        },

        // ---------- query ----------
        // Does NOT return `text` by default. A loaded mmCIF is ~776 KB, which serializes to ~194k
        // tokens at the agent's transport boundary — one innocent-looking getter that can consume a
        // whole context window. `length` and `looksLike` answer every question a caller actually has
        // ("did the query land?", "what kind is it?"); pass includeText for the rare case that needs
        // the bytes.
        getQuery({ includeText = false } = {}) {
            const text = this.query ?? '';
            let looksLike = 'unknown';
            const t = text.trimStart();
            if (t.startsWith('>')) looksLike = 'fasta';
            else if (t.startsWith('data_') || t.startsWith('#')) looksLike = 'cif';
            else if (/^(ATOM|HETATM|HEADER|REMARK|MODEL)/m.test(t)) looksLike = 'pdb';
            else if (/^[A-Za-z\s]+$/.test(t) && t.length) looksLike = 'sequence';
            return { length: text.length, looksLike, ...(includeText ? { text } : {}) };
        },
        // Async on purpose. FoldDisco's query watcher awaits getStructure() and isMotifValid
        // stays false until it resolves, so a synchronous validate() straight after setQuery()
        // would report a phantom failure.
        async setQuery(text) {
            this.query = String(text ?? '');
            await this.$nextTick();
            const ready = await this._waitForQueryReady();
            // Never echo `text` back: the caller just passed it in, so returning it doubles the
            // cost of the call for no information.
            const q = this.getQuery();
            return {
                ok: q.length > 0, ...q,
                structureParsed: ready,
                isMultimer: this.isMultimer ?? undefined,
                predictable: this.predictable ?? undefined,
            };
        },
        async _waitForQueryReady(timeoutMs = 20000) {
            if (!this.searchApiConfig().needsQueryStructure) return true;
            if (!this.query) return true;
            const t0 = Date.now();
            while (Date.now() - t0 < timeoutMs) {
                if (this.queryStructure) return true;
                await new Promise(r => setTimeout(r, 50));
            }
            return false;
        },

        // ---------- accession loading ----------
        getAccessionSources() {
            return sourcesFor(this.searchApiConfig().accessionExtras)
                .filter(s => s.value !== 'QBioLip')   // two-step; exposed separately
                .map(s => ({ value: s.value, text: s.text }));
        },
        async loadAccession(accession, source = 'PDB') {
            const valid = this.getAccessionSources().map(s => s.value);
            if (!valid.includes(source)) {
                return { ok: false, reason: `unknown source: ${source}`, valid };
            }
            if (!accession) return { ok: false, reason: 'accession is empty' };
            let got;
            try {
                got = await fetchAccession(String(accession).trim(), source);
            } catch {
                return { ok: false, reason: `accession not found: ${accession}`, source };
            }
            const set = await this.setQuery(got.text);
            return {
                ok: true, source,
                requested: String(accession).trim(),
                // AlphaFoldDB is a fuzzy search that takes the first hit, so what loaded may
                // differ from what was asked for. Surface it rather than hiding it.
                resolved: got.name,
                length: set.length,
                structureParsed: set.structureParsed,
            };
        },

        // ---------- taxonomy ----------
        async searchTaxonomy(term) {
            if (!this.searchApiConfig().supportsTaxonomy) {
                return { ok: false, reason: `${this.searchApiConfig().tool} has no taxonomy filter` };
            }
            if (!term || String(term).length < 3) {
                return { ok: false, reason: 'term must be at least 3 characters' };
            }
            try {
                // Same endpoint TaxonomyAutocomplete uses; fresh axios so no token leaks.
                const axios = create();
                const r = await axios.get(
                    'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest/'
                    + encodeURIComponent(term) + '?tax_rank_filter=higher_taxon');
                const list = r.data?.sci_name_and_ids ?? [];
                return { ok: true, matches: list.map(el => ({
                    value: el.tax_id,
                    text: el.common_name ? `${el.sci_name} (${el.common_name})` : el.sci_name,
                })) };
            } catch {
                return { ok: false, reason: 'taxonomy lookup failed' };
            }
        },
        async setTaxonomyFilter(x) {
            const cfg = this.searchApiConfig();
            if (!cfg.supportsTaxonomy) {
                return { ok: false, reason: `${cfg.tool} has no taxonomy filter` };
            }
            if (x === null || x === undefined || x === '') {
                this.taxFilter = null;
                return { ok: true, taxFilter: null };
            }
            if (typeof x === 'object' && x.value !== undefined) {
                this.taxFilter = { value: x.value, text: x.text ?? String(x.value) };
                return { ok: true, taxFilter: this.taxFilter };
            }
            if (/^\d+$/.test(String(x))) {
                this.taxFilter = { value: Number(x), text: String(x) };
                return { ok: true, taxFilter: this.taxFilter };
            }
            const found = await this.searchTaxonomy(x);
            if (!found.ok || found.matches.length === 0) {
                return { ok: false, reason: `no taxon matching "${x}"` };
            }
            this.taxFilter = found.matches[0];
            return { ok: true, taxFilter: this.taxFilter, matchedFrom: found.matches.length };
        },
        setIterativeSearch(value) {
            if (!this.searchApiConfig().supportsIterative) {
                return { ok: false, reason: 'iterative search is Foldseek-only' };
            }
            this.iterativeSearch = !!value;
            return { ok: true, iterativeSearch: this.iterativeSearch };
        },

        // ---------- validation & state ----------
        // One reason per failed condition rather than a bare boolean, mirroring the page's own
        // searchDisabled computed.
        validate() {
            const reasons = [];
            if (this.inSearch) reasons.push('a search is already running');
            if (!this.query || this.query.length === 0) reasons.push('query is empty');
            if (!Array.isArray(this.databases) || this.databases.length === 0) {
                reasons.push('databases have not loaded yet');
            }
            if (!Array.isArray(this.database) || this.database.length === 0) {
                reasons.push('no database selected');
            }
            if (this.predictable) {
                reasons.push('query is a sequence awaiting structure prediction');
            }
            if (this._modeInvalid()) {
                reasons.push(`mode "${this.mode}" is not one of this page's valid modes`);
            }
            for (const extra of (this.searchApiExtraValidation?.() ?? [])) reasons.push(extra);
            return { ok: reasons.length === 0, reasons };
        },
        // includeText is forwarded to getQuery() and is off by default — see getQuery().
        getState({ includeText = false } = {}) {
            const cfg = this.searchApiConfig();
            const state = {
                tool: cfg.tool,
                query: this.getQuery({ includeText }),
                databases: this.getDatabases(),
                inSearch: !!this.inSearch,
                // Presence only. The address is the user's notification PII and never leaves
                // the page — there is no setter either.
                email: { present: !!(this.email && this.email.length) },
                valid: this.validate(),
            };
            if (cfg.sendsMode) {
                state.mode = { current: this.mode, valid: this.getModes(),
                    invalid: this._modeInvalid() };
            }
            if (cfg.supportsTaxonomy) state.taxFilter = this.taxFilter ?? null;
            if (cfg.supportsIterative) state.iterativeSearch = !!this.iterativeSearch;
            if (this.searchApiExtraState) Object.assign(state, this.searchApiExtraState());
            return state;
        },

        // ---------- submit ----------
        // Delegates to the page's own search(). Reimplementing request construction here would
        // duplicate three slightly different bodies (endpoint, mode prefix, motif, FASTA
        // normalisation) and drift from them — the exact failure this mixin exists to avoid.
        // RATELIMIT and MAINTENANCE are ordinary response statuses in that code, so they come
        // back as data rather than exceptions.
        async submit() {
            const v = this.validate();
            if (!v.ok) return { ok: false, reason: 'validation failed', reasons: v.reasons };

            const isObjMsg = this.errorMessage !== null && typeof this.errorMessage === 'object';
            if (isObjMsg) this.errorMessage = { type: null, message: '' };
            else this.errorMessage = '';
            // Capture the router itself: search() navigates, which destroys this component, so
            // `this.$route` is not something to rely on afterwards.
            const router = this.$router;
            const before = router?.currentRoute?.fullPath ?? null;

            try {
                await this.search();
            } catch (e) {
                return { ok: false, status: 'ERROR',
                    reason: `request failed: ${e?.message ?? e}` };
            }

            const msg = isObjMsg ? (this.errorMessage?.message ?? '') : (this.errorMessage ?? '');
            if (msg) {
                const status = /rate limit/i.test(msg) ? 'RATELIMIT'
                    : /maintenance/i.test(msg) ? 'MAINTENANCE' : 'ERROR';
                return { ok: false, status, reason: msg };
            }
            // search() resolves before the router settles, so reading $route here used to report
            // `ticket: null, route: 'search', navigated: false` while the tab was already on the
            // result page. Wait for the navigation the request just triggered.
            const settled = await this._awaitRouteChange(router, before);
            return {
                ok: true,
                ticket: settled?.params?.ticket ?? null,
                route: settled?.name ?? null,
                navigated: !!settled,
            };
        },

        /**
         * Resolve with the new Route once it differs from `beforeFullPath`, or null on timeout.
         *
         * search() calls $router.push straight after the response, so a real navigation lands within
         * a tick or two — the timeout only pays out when the submit legitimately did not navigate,
         * which is why it is seconds rather than the 15s used elsewhere.
         */
        async _awaitRouteChange(router, beforeFullPath, timeoutMs = 5000) {
            const deadline = Date.now() + timeoutMs;
            for (;;) {
                const cur = router?.currentRoute ?? null;
                if (cur && (cur.fullPath ?? null) !== beforeFullPath) return cur;
                if (Date.now() >= deadline) return null;
                await new Promise(r => setTimeout(r, 50));
            }
        },

        goTo(tool) {
            const map = {
                multimer: 'goToMultimer',
                monomer: 'goToMonomer',
                foldseek: 'goToFoldseek',
            };
            const fn = map[String(tool).toLowerCase()];
            if (!fn || typeof this[fn] !== 'function') {
                return { ok: false, reason: `no cross-link to ${tool} from this page`,
                    available: Object.keys(map).filter(k => typeof this[map[k]] === 'function') };
            }
            this[fn]();
            return { ok: true, target: tool };
        },

        describePage() {
            const cfg = this.searchApiConfig();
            const dbs = this.getDatabases();
            return {
                kind: 'search',
                tool: cfg.tool,
                query: { length: this.query?.length ?? 0 },
                modes: cfg.sendsMode ? this.getModes().map(m => m.key) : null,
                accessionSources: this.getAccessionSources().map(s => s.value),
                databases: { loading: dbs.loading, count: dbs.available.length,
                    selected: dbs.selected.length },
                supports: { taxonomy: cfg.supportsTaxonomy, iterative: cfg.supportsIterative,
                    mode: cfg.sendsMode },
                notes: [
                    'submit() is the only network call here besides loadAccession() and '
                        + 'searchTaxonomy(); it consumes rate limit and navigates away.',
                    'setQuery() and loadAccession() are async — await before validate().',
                    'setDatabases() takes paths or display names.',
                    'No email setter; getState() reports presence only.',
                    ...(this.searchApiExtraNotes?.() ?? []),
                ],
            };
        },

        _registerSearchApi() {
            const cfg = this.searchApiConfig();
            const api = {
                getState: this.getState,
                validate: this.validate,
                getQuery: this.getQuery,
                setQuery: this.setQuery,
                getDatabases: this.getDatabases,
                setDatabases: this.setDatabases,
                getAccessionSources: this.getAccessionSources,
                loadAccession: this.loadAccession,
                submit: this.submit,
                goTo: this.goTo,
                describePage: this.describePage,
                _vm: this,   // unstable escape hatch; see describe()
            };
            if (cfg.sendsMode) { api.getModes = this.getModes; api.setMode = this.setMode; }
            if (cfg.supportsTaxonomy) {
                api.searchTaxonomy = this.searchTaxonomy;
                api.setTaxonomyFilter = this.setTaxonomyFilter;
            }
            if (cfg.supportsIterative) api.setIterativeSearch = this.setIterativeSearch;
            if (this.searchApiExtraMethods) Object.assign(api, this.searchApiExtraMethods());
            this._disposeSearchApi = registerPageApi('search', cfg.tool, api);
        },
    },
    mounted() {
        this._registerSearchApi();
    },
    beforeDestroy() {
        this._disposeSearchApi?.();
    },
};
</script>

<script>
// Forwarding a hit-table selection into another tool's search form.
//
// ResultView (Foldseek) and ResultFoldDisco drive the same SelectToSendPanel with the same three
// targets and the same handoff semantics, so they carried near-identical copies of this method.
// The copies drifted — one reported `queryLength` from getQuery() alone, the other fell through to
// getQueries() — which meant the same field meant different things depending on which result page
// you called from. One implementation, parameterised by nothing.
//
// Requirements on the consuming component: `$refs.sendPanel`, `selectedCounts`, and
// `getSingleSelectionInfo()`. `banList` is optional.

import { awaitPageApi } from './lib/resultsApi.js';

export default {
    name: 'SendToMixin',
    methods: {
        /**
         * Push the current selection into a fresh search form.
         *
         * Unlike everything else on these pages this is genuinely side-effectful: it fetches
         * structures, writes them to IndexedDB and navigates away. Resolves once the panel has
         * finished and the destination is drivable.
         *
         * waitForQuery defaults ON: the handoff travels through IndexedDB and lands *after* the
         * page mounts, so without it every caller has to poll the destination itself — and one that
         * forgets sees an empty form and a validate() failure it cannot explain.
         *
         * includeQuery prepends the query structure to a FoldMason handoff. Omitted, it follows the
         * panel's toggle; passed, it overrides for this call without moving the toggle. The
         * effective value is echoed back, because otherwise two identical calls can send different
         * payloads with nothing to distinguish them.
         */
        async sendTo(target, { waitForQuery = true, timeoutMs = 10000, includeQuery } = {}) {
            const panel = this.$refs.sendPanel;
            if (!panel) return { ok: false, reason: 'send panel not mounted' };
            const n = this.selectedCounts;
            if (n === 0) return { ok: false, reason: 'nothing selected' };

            const plans = {
                foldseek:  { fn: 'sendToFoldseek',  ok: n === 1, want: 'exactly one entry' },
                folddisco: { fn: 'sendToFoldDisco', ok: n === 1, want: 'exactly one entry' },
                foldmason: { fn: 'sendToFoldMason', ok: n >= 1,  want: 'at least one entry' },
            };
            const plan = plans[String(target).toLowerCase()];
            if (!plan) {
                return { ok: false, reason: `unknown target: ${target}`, valid: Object.keys(plans) };
            }
            if (!plan.ok) {
                return { ok: false, reason: `${target} needs ${plan.want}; ${n} selected` };
            }
            // Pages that do not define banList get [] and skip this, which is also what an empty
            // list does — no need for the two to be spelled differently.
            const banned = this.banList ?? [];
            if (target === 'folddisco' && banned.includes(this.getSingleSelectionInfo()?.db)) {
                return { ok: false, reason: 'this database is not supported by FoldDisco' };
            }
            const wantsQueryFlag = includeQuery !== undefined;
            if (wantsQueryFlag && target !== 'foldmason') {
                return { ok: false, reason: `includeQuery applies to foldmason only, not ${target}` };
            }
            // Read off the panel before the call: it navigates away and unmounts.
            const sentQuery = target === 'foldmason'
                ? (wantsQueryFlag ? !!includeQuery : !!panel.includeQuery)
                : undefined;

            // A complex selection routes to the Multimer page, a monomer one to Search
            // (SelectToSendPanel.vue:219-225), so the requested target is not always the
            // destination. Do NOT predict it: the panel decides from `result.isMultimer` on the
            // *fetched* structure, while the only flag visible from here — isSelectionComplex —
            // derives from the stored alignment group and is a prop that lags a tick behind a
            // same-tick setSelection(). Predicting from it reported 'foldseek' for a 2-chain hit
            // that landed on /multimer. Read where we actually arrived instead.
            const router = this.$router;
            await panel[plan.fn](...(wantsQueryFlag ? [{ includeQuery: !!includeQuery }] : []));
            // $router.push resolves before the destination mounts, so without this the caller's
            // next line would see window.searchApi undefined. awaitPageApi lives in the module,
            // not in this component, so it survives our own unmount.
            let ready = true;
            try { await awaitPageApi('search'); } catch { ready = false; }
            const arrived = router?.currentRoute?.name ?? null;

            const out = {
                ok: true, target, sent: n,
                destination: arrived === 'multimer' ? 'multimer' : target,
                route: arrived,
                searchApiReady: ready,
                ...(sentQuery === undefined ? {} : { includeQuery: sentQuery }),
            };
            // searchApiReady only means the page mounted; the structure lands afterwards.
            if (ready && waitForQuery) {
                const api = typeof window !== 'undefined' ? window.searchApi : null;
                out.queryReady = await this._awaitQueryLanded(api, timeoutMs);
                Object.assign(out, this._describeLandedQuery(api));
            }
            return out;
        },

        /**
         * Poll the destination page until its query is populated.
         *
         * FoldMason's surface is a list, so it has getQueries() and no getQuery() — pick the reader
         * once rather than assuming a shape that only three of the four search pages have.
         */
        async _awaitQueryLanded(api, timeoutMs = 10000) {
            const read = this._queryReader(api);
            if (!read) return false;
            const deadline = Date.now() + timeoutMs;
            for (;;) {
                if (read() > 0) return true;
                if (Date.now() >= deadline) return false;
                await new Promise(r => setTimeout(r, 100));
            }
        },

        _queryReader(api) {
            if (api?.getQuery) return () => api.getQuery()?.length ?? 0;
            if (api?.getQueries) return () => api.getQueries()?.length ?? 0;
            return null;
        },

        /**
         * Report what landed, under a key that says what the number counts.
         *
         * Single-query forms (Search, Multimer, FoldDisco) are measured in characters; FoldMason's
         * form holds a list and is measured in entries. Reporting both as `queryLength` made one
         * field mean two things, so each destination shape gets its own key and callers can branch
         * on which is present.
         */
        _describeLandedQuery(api) {
            if (api?.getQuery) return { queryLength: api.getQuery()?.length ?? 0 };
            if (api?.getQueries) return { queryCount: api.getQueries()?.length ?? 0 };
            return {};
        },
    },
};
</script>

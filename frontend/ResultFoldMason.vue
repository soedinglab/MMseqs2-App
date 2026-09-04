<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel class="msa-panel">
                <template slot="header">
                    <template v-if="!$LOCAL && msaData">
                        <!-- <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
                        <small class="ticket">{{ ticket }}</small> -->
                        <NameField :ticket="ticket"/>
                    </template>
                    <template v-else>
                        <span  class="hidden-sm-and-down">Results:&nbsp;</span>
                        <!-- <small class="ticket">{{ hits.query.header }}</small> -->
                    </template>
                </template>

                <div slot="desc" v-if="!$LOCAL && resultState == 'PENDING'">
                    <v-container fill-height grid-list-md>
                        <v-layout justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-search_2x.png" srcset="./assets/marv-search_2x.png 2x, ./assets/marv-search_3x.png 3x" />
                            </v-flex>
                            <v-flex xs8>
                                <h3>Still Pending</h3>
                                <p>Please wait a moment</p>
                            </v-flex>
                        </v-layout>
                    </v-container>
                </div>
                <div slot="desc" v-else-if="!$LOCAL && resultState == 'EMPTY'">
                    <v-container fill-height grid-list-md>
                        <v-layout justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-result_2x.png" srcset="./assets/marv-result_2x.png 2x, ./assets/marv-result_3x.png 3x" />
                            </v-flex>
                            <v-flex xs8>
                                <h3>No hits found!</h3>
                                <p>Start a <v-btn to="/search">New Alignment</v-btn>?</p>
                            </v-flex>
                        </v-layout>
                    </v-container>
                </div>
                <div slot="desc" v-else-if="!$LOCAL && resultState != 'RESULT'">
                    <v-container fill-height grid-list-md>
                        <v-layout justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
                            </v-flex>
                            <v-flex xs8>
                                <h3>Error! </h3>
                                <p>Start a <v-btn to="/foldmason">New Alignment</v-btn>?</p>
                            </v-flex>
                        </v-layout>
                    </v-container>
                </div>

                <template slot="content" v-if="resultState == 'RESULT' && msaData">
                    <MSA
                        v-if="msaData"
                        :entries="msaData.entries"
                        :scores="msaData.scores"
                        :statistics="msaData.statistics"
                        :tree="msaData.tree"
                        :ticket="ticket"
                        ref="msa"
                        @changedReference="selectedReference=$event"
                        @changedSelection="selectedColumns=$event"
                        @api-surface="augmentApi"
                    />
                </template>

                </panel>
            </v-flex>
            <NavigationButton :scrollOffsetArr="[]"/>
            <SelectToSendPanelFoldMason 
                ref="sendPanel"
                v-if="msaData"
                :entries="msaData.entries" :ticket="ticket"
                :targetIndex="selectedReference"
                :selectedColumns="selectedColumns"
                :selectedCounts="selectedColumns.length"
                @clearAll="clearSelection"
            />
        </v-layout>
    </v-container>
</template>


<script>
import { download, downloadBlob, dateTime } from './Utilities.js';
import { registerResultApi, awaitPageApi } from './lib/resultsApi.js';
import makeZip from './lib/zip.js'
import MSA from './MSA.vue';
import MSAView from './MSAView.vue';
import Panel from './Panel.vue';
import NavigationButton from './NavigationButton.vue';
import SelectToSendPanelFoldMason from './SelectToSendPanelFoldMason.vue';
import NameField from './NameField.vue';
import SendToMixin from './SendToMixin.vue';

export default {
    name: 'ResultFoldMason',
    tool: 'foldmason',
    components: { MSA, MSAView, Panel, NavigationButton, SelectToSendPanelFoldMason, NameField},
    mixins: [ SendToMixin ],
    data() {
        return {
            ticket: "",
            error: "",
            msaData: null,
            selectedReference: 0,
            selectedColumns: [],
        }
    },
    beforeDestroy() {
        this._disposeApi?.();
    },
    mounted() {
        this.$root.$on('downloadJSON', () => {
            if (!this.msaData) return;
            download(this.msaData, "foldmason.json");
        })
        this.$root.$on('downloadMSA', () => {
            let encoder = new TextEncoder();
            let zip_file = makeZip([
                { name: 'foldmason_aa.fa', data: encoder.encode(this.formatMSA('aa')) },
                { name: 'foldmason_ss.fa', data: encoder.encode(this.formatMSA('ss')) },
                { name: 'foldmason.nw',    data: encoder.encode(this.msaData.tree) },
            ]);
            downloadBlob(zip_file, "foldmason.zip");
        })
        if (this.msaData) {
            return;
        }
        this.fetchData();
    },
    destroyed () {
        this.$root.$off('downloadJSON');
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
        }
    },
    computed: {
        resultState() {
            if (this.error != "") {
                return "ERROR";
            }
            if (this.msaData == null) {
                return "PENDING";
            }
            if (!this.msaData) {
                return "ERROR";
            }
            if (this.msaData) {
                return "RESULT";
            }
            return "ERROR";
        }       
    },
    methods: {
        /**
         * Take over the page API from MSA, adding what only this component can do.
         *
         * MSA registers its own surface first (MSALocal.vue depends on that), then hands it here. The
         * send panel is a sibling of MSA, not a child, so MSA could never reach it via $refs — this is
         * the component that owns both, so this is where sendTo belongs.
         */
        augmentApi(surface) {
            this._msaSurface = surface;
            this._disposeApi?.();
            this._disposeApi = registerResultApi('foldmason', {
                ...surface,
                sendTo: this.sendTo,
                describePage: this.describePage,
                _vm: this,
            });
        },
        describePage() {
            const base = this._msaSurface?.describePage?.() ?? {};
            return {
                ...base,
                sendTargets: {
                    foldseek: 'the reference structure',
                    folddisco: 'the reference structure, with the selected columns as a motif',
                },
                notes: [
                    ...(base.notes ?? []),
                    'sendTo() forwards the REFERENCE row — setReference(row) chooses it.',
                ],
            };
        },
        /**
         * Forward the reference structure to a search page.
         *
         * There is no `foldmason` target: you are already on a FoldMason result. The panel's send
         * methods swallow their own failures and return, so success is inferred from the route
         * actually changing rather than from the call resolving.
         */
        async sendTo(target, { waitForQuery = true, timeoutMs = 10000, includeQuery } = {}) {
            const panel = this.$refs.sendPanel;
            if (!panel) return { ok: false, reason: 'send panel not mounted' };
            // Named rather than ignored: the hit tables take includeQuery for their foldmason
            // target, and neither target here is one.
            if (includeQuery !== undefined) {
                return { ok: false,
                    reason: 'includeQuery applies to a foldmason target; this page has none' };
            }
            const plans = { foldseek: 'sendToFoldseek', folddisco: 'sendToFoldDisco' };
            const fn = plans[String(target).toLowerCase()];
            if (!fn) {
                return { ok: false, reason: `unknown target: ${target}`, valid: Object.keys(plans) };
            }
            const ref = this.selectedReference;
            if (!(ref >= 0) || !this.msaData?.entries?.[ref]) {
                return { ok: false,
                    reason: 'no reference row is set; call setReference(row) first' };
            }
            // The panel forwards the row in its `targetIndex` prop, while the fields below are read
            // from `selectedReference` here. setReference() reaches the panel the long way round —
            // MSA method, `changedReference` event, parent assignment, prop, render — so a same-tick
            // setReference(2); sendTo() forwards the OLD row and reports the new one. Verified: it
            // sent 6IUF while returning referenceName 'MGYP003305394636'. Let the prop catch up.
            if (!await this._awaitPanelReference(panel, ref)) {
                return { ok: false, reference: ref,
                    reason: `send panel still targets row ${panel.targetIndex}, not ${ref}` };
            }
            const router = this.$router;
            const before = router?.currentRoute?.name ?? null;
            await panel[fn]();
            const arrived = router?.currentRoute?.name ?? null;
            if (arrived === before) {
                return { ok: false, reason: `${target} send did not navigate; the structure fetch `
                    + 'likely failed', reference: ref };
            }
            let ready = true;
            try { await awaitPageApi('search'); } catch { ready = false; }
            const out = {
                ok: true, target, sent: 1,
                reference: ref,
                referenceName: this.msaData.entries[ref]?.name ?? null,
                motifColumns: this.selectedColumns.length,
                route: arrived,
                searchApiReady: ready,
            };
            if (ready && waitForQuery) {
                // Helpers from SendToMixin; this page's own sendTo() overrides the mixin's, since
                // it forwards a reference row rather than a selection.
                const api = typeof window !== 'undefined' ? window.searchApi : null;
                out.queryReady = await this._awaitQueryLanded(api, timeoutMs);
                Object.assign(out, this._describeLandedQuery(api));
            }
            return out;
        },
        /** Resolve once the send panel's targetIndex prop matches `ref`, or false if it never does. */
        async _awaitPanelReference(panel, ref, timeoutMs = 2000) {
            const deadline = Date.now() + timeoutMs;
            for (;;) {
                if (panel.targetIndex === ref) return true;
                if (Date.now() >= deadline) return false;
                await new Promise(r => setTimeout(r, 20));
            }
        },
        resetProperties() {
            this.ticket = this.$route.params.ticket;
            this.error = "";
            this.msaData = null;
        },
        formatMSA(alphabet) {
            if (!this.msaData) return;
            return this.msaData.entries.map(entry => `>${entry.name}\n${entry[alphabet]}`).join('\n');
        },
        async fetchData() {
            this.resetProperties();
            try {
                let data;
                if (this.ticket.startsWith('user-')) {
                    data = this.$root.userData;
                } else {
                    const response = await this.$axios.get("api/result/foldmason/" + this.ticket); // '?format=brief'
                    data = response.data;
                    if (data == null) {
                        throw new Error("No MSA returned");
                    }
                }
                this.msaData = data;
            } catch {
                this.error = "Failed";
                this.msaData = null;
            }
        },
        clearSelection() {
            this.$refs.msa.clearSelection()
        }
    }
};
</script>
<style scoped>
.msa-panel >>> .panel,
.msa-panel >>> .panel-content,
.msa-panel >>> .v-card__text {
    contain: none;
    overflow: visible;
}

.msa-panel >>> .panel-content {
    padding: 0;
}
</style>

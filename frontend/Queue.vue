<template>
<v-container grid-list-md fluid v-if="status != 'COMPLETE'" pa-2>
    <v-layout>
        <v-flex xs12 sm10>
            <panel>
                <template slot="header">
                    Job Status:&nbsp;
                    <strong v-if="status == 'PENDING'">Waiting for Worker</strong>
                    <strong v-else-if="status == 'RUNNING'">In Progress</strong>
                    <strong v-else>ERROR</strong>
                </template>

                <v-container grid-list-xs fluid slot="content">
                    <v-layout wrap>
                        <v-flex xs12 sm6 md4 aria-hidden="true" class="status-img">
                            <img v-if="status == 'PENDING'" src="./assets/marv-search_2x.png" srcset="./assets/marv-search_2x.png 2x, ./assets/marv-search_3x.png 3x" />
                            <img v-else-if="status == 'RUNNING'" src="./assets/marv-result_2x.png" srcset="./assets/marv-result_2x.png 2x, ./assets/marv-result_3x.png 3x" />
                            <div v-else-if="status == 'COMPLETE'"></div>
                            <img v-else src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
                        </v-flex>
                        <v-flex xs12 sm6 md8>
                            {{ error }}
                        </v-flex>
                    </v-layout>
                </v-container>
            </panel>
        </v-flex>
    </v-layout>
</v-container>
</template>

<script>
import { registerPageApi } from './lib/resultsApi.js';
import { routeForTicket } from './lib/ticketRoute.js';
import { setJobType } from './lib/HistoryMixin';
import Panel from './Panel.vue';

export default {
    components: { Panel },
    data() {
        return {
            status: "PENDING",
            error: "",
        };
    },
    created() {
        this.fetchData();
    },
    mounted() {
        this._disposeApi = registerPageApi('queue', 'queue', {
            getStatus: this.getStatus,
            getResultRoute: this.getResultRoute,
            waitForResult: this.waitForResult,
            describePage: this.describePage,
            _vm: this,
        });
    },
    beforeDestroy() {
        this._disposeApi?.();
    },
    watch: {
        '$route': 'fetchData'
    },
    methods: {
        // ---- API (window.queueApi) ----
        getStatus() {
            return {
                ticket: this.$route?.params?.ticket ?? null,
                status: this.status,
                error: this.error || null,
                terminal: ['COMPLETE', 'FAILED', 'ERROR'].includes(this.status),
            };
        },
        async getResultRoute() {
            const ticket = this.$route?.params?.ticket;
            if (!ticket) return { ok: false, reason: 'no ticket in route' };
            try {
                const r = await this.$axios.get('api/ticket/type/' + ticket);
                const type = r.data?.type;
                // This page is the authority on a ticket's type; share it so History and
                // goToTicket() do not have to ask again.
                setJobType(ticket, type);
                const route = routeForTicket(ticket, type);
                return route.viaQueue
                    ? { ok: false, reason: `unmapped job type: ${type}`, type }
                    : { ok: true, type, route: route.name, params: route.params, ticket };
            } catch {
                return { ok: false, reason: 'could not query job type' };
            }
        },
        // Queue.vue polls every second and $router.replace()s to the result route on COMPLETE,
        // so the *arrival of a result page* is the completion signal. Race that against this
        // page's own terminal failure states rather than assuming success.
        async waitForResult({ timeoutMs = 600000, pollMs = 500 } = {}) {
            const ticket = this.$route?.params?.ticket ?? null;
            const t0 = Date.now();
            while (Date.now() - t0 < timeoutMs) {
                if (typeof window !== 'undefined' && window.resultsApi) {
                    return { ok: true, ticket, status: 'COMPLETE',
                        waitedMs: Date.now() - t0 };
                }
                if (['FAILED', 'ERROR'].includes(this.status)) {
                    return { ok: false, ticket, status: this.status,
                        reason: this.error || 'job failed' };
                }
                await new Promise(r => setTimeout(r, pollMs));
            }
            return { ok: false, ticket, status: this.status, reason: `timed out after ${timeoutMs}ms` };
        },
        describePage() {
            return {
                kind: 'queue',
                ticket: this.$route?.params?.ticket ?? null,
                status: this.status,
                notes: [
                    'waitForResult() resolves when a result page registers and fails on '
                        + 'FAILED/ERROR — no polling needed on your side.',
                ],
            };
        },
        fetchData() {
            const ticket = this.$route.params.ticket;
            if (typeof (ticket) === "undefined") {
                this.status = "ERROR";
                return;
            }

            this.$axios.get("api/ticket/" + ticket).then(
                (response) => {
                    const data = response.data;
                    this.status = data.status;
                    switch (this.status) {
                        case "UNKNOWN":
                            this.status = "FAILED";
                            this.error = "No record of this job submission exists.";
                            break;
                        case "ERROR":
                        case "FAILED":
                            this.status = "FAILED";
                            this.error = "Job failed. Please try again later.";
                            break;
                        case "COMPLETE":
                            this.$axios.get("api/ticket/type/" + ticket).then(
                            (response) => {
                                const type = response.data.type;
                                setJobType(ticket, type);
                                if (type === "index") {
                                    this.$router.replace({ name: 'preferences' });
                                    return;
                                }
                                // Route table lives in lib/ticketRoute.js, shared with
                                // History.vue and goToTicket(). viaQueue means unmapped —
                                // redirecting back here would loop, so fail instead.
                                const route = routeForTicket(ticket, type);
                                if (route.viaQueue) {
                                    this.status = "FAILED";
                                    this.error = "Job failed. Please try again later.";
                                    return;
                                }
                                this.$router.replace({ name: route.name, params: route.params });
                            })
                            break;
                        default:
                            this.error = "Please wait..."
                            setTimeout(this.fetchData.bind(this), 1000);
                            break;
                    }
                },
                () => {
                    this.status = "FAILED";
                    this.error = "Could not query job status. Please try again later.";
                }
            );
        }
    }
};
</script>

<style>
.status-img img {
    max-width: 100%;
}
</style>

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
    watch: {
        '$route': 'fetchData'
    },
    methods: {
        fetchData() {
            const ticket = this.$route.params.ticket;
            if (typeof (ticket) === "undefined") {
                this.status = "ERROR";
                return;
            }

            this.$http.get("api/ticket/" + ticket).then(
                (response) => {
                    response.json().then((data) => {
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
                                this.$http.get("api/ticket/type/" + ticket).then(
                                (response) => {
                                    response.json().then((data) => {
                                        switch (data.type) {
                                            case "search":
                                                this.$router.replace({ name: 'result', params: { ticket: ticket, entry: 0 } });
                                                break;
                                            case "structuresearch":
                                                this.$router.replace({ name: 'result', params: { ticket: ticket, entry: 0 } });
                                                break;
                                            case "index":
                                                this.$router.replace({ name: 'preferences' });
                                                break;
                                            default:
                                                this.status = "FAILED";
                                                this.error = "Job failed. Please try again later.";
                                        }
                                    })
                                });
                                break;
                            default:
                                this.error = "Please wait..."
                                setTimeout(this.fetchData.bind(this), 1000);
                                break;
                        }
                    });
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

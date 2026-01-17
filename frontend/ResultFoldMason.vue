<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel class="msa-panel">
                <template slot="header">
                    <template v-if="!$LOCAL && msaData">
                        <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
                        <small class="ticket">{{ ticket }}</small>
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
                    />
                </template>

                </panel>
            </v-flex>
            <NavigationButton :scrollOffsetArr="[]"/>
            <SelectToSendPanelFoldMason 
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
import makeZip from './lib/zip.js'
import MSA from './MSA.vue';
import MSAView from './MSAView.vue';
import Panel from './Panel.vue';
import NavigationButton from './NavigationButton.vue';
import SelectToSendPanelFoldMason from './SelectToSendPanelFoldMason.vue';

export default {
    name: 'ResultFoldMason',
    tool: 'foldmason',
    components: { MSA, MSAView, Panel, NavigationButton, SelectToSendPanelFoldMason},
    data() {
        return {
            ticket: "",
            error: "",
            msaData: null,
            selectedReference: 0,
            selectedColumns: [],
        }
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
.msa-panel {
    margin-bottom: 600px;
}
</style>
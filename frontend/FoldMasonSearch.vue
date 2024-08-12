<template>
    <v-container grid-list-md fluid px-2 py-1 class="search-component">
        <v-layout wrap>
        <v-flex xs12>
            <panel class="query-panel d-flex fill-height" fill-height>
            <template slot="header">
                Input protein structures (PDB only) for MSTA
            </template>
            <template slot="toolbar-extra">
                <v-icon v-if="queries.length > 0" title="Clear" @click="queries = []" style="margin-right: 16px">{{ $MDI.Delete }}</v-icon>
                <!-- <v-tooltip open-delay="300" top>
                    <template v-slot:activator="{ on }">
                        <v-icon v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                    </template>
                    <span>{{ $STRINGS.QUERIES_HELP }}</span>
                </v-tooltip> -->
            </template>
            <template slot="content">
                <div class="query-chip-group">
                    <v-chip
                        v-for="(q, index) in queries"
                        outlined
                        close
                        :key="q.name"
                        :value="q.name"
                        @click:close="removeQuery(index)"
                    >
                        {{ q.name }}
                    </v-chip>
                </div>
                <div class="actions input-buttons-panel">
                    <div class="input-buttons-left">
                        <file-button
                            id="file"
                            :label="$STRINGS.UPLOAD_LABEL"
                            v-on:upload="upload"
                            :multiple="true"
                        ></file-button>
                        <!-- <PredictStructureButton v-if="$APP == 'foldseek'" :query="query" v-model="predictable" v-on:predict="query = $event"></PredictStructureButton> -->
                        <!-- <file-button id="localMSAFile" label="Upload MSA file" @upload="uploadMSA"></file-button> -->
                        <file-button id="localFile" label="Upload previous result (JSON)" @upload="uploadJSON"></file-button>
                        <v-btn
                            type="button"
                            class="btn btn--raised btn--file"
                            style="position: relative;"
                            color="primary"
                            @click="handleLoadExample"
                        >
                            Load example MSTA
                        </v-btn>
                    </div>
                </div>
            </template>
            </panel>
        </v-flex>
        <v-flex xs12>
            <panel collapsible collapsed render-collapsed>
            <template slot="header">Alignment settings</template>
            <template slot="toolbar-extra">
                <v-icon
                    title="Reset to default parameters"
                    @click="resetParams"
                    style="margin-right: 16px"
                >
                    {{ $MDI.Restore }}</v-icon>
            </template>
            <div slot="content">
                <v-text-field
                    v-model="params.gapOpen"
                    min="0"
                    step="1"
                    type="number"
                    label="Gap open penalty"
                    dense
                />
                <v-text-field
                    v-model="params.gapExtend"
                    min="0"
                    step="1"
                    type="number"
                    label="Gap extension penalty"
                    dense
                />
            </div>
            </panel>
        </v-flex>
        <v-flex>
            <panel>
            <template slot="content">
                <div class="actions" :style="!$vuetify.breakpoint.xsOnly ?'display:flex; align-items: center;' : null">
                <v-item-group class="v-btn-toggle">
                    <v-btn color="primary" :block="false" x-large v-on:click="search" :disabled="alignDisabled">
                        <v-icon>{{ $MDI.Wall }}</v-icon>
                        &nbsp;Align</v-btn>
                </v-item-group>
                <div :style="!$vuetify.breakpoint.xsOnly ? 'margin-left: 1em;' : 'margin-top: 1em;'">
                    <span><strong>Summary</strong></span><br>
                    Align <strong>{{ queries.length }}</strong> structures with FoldMason
                    <!-- </template> with {{ $STRINGS.APP_NAME }} in <strong>{{ modes[mode.replace('complex-', '')] }}</strong> mode. -->
                    <div v-if="errorMessage != ''" class="v-alert v-alert--outlined warning--text mt-2">
                        <span>{{ errorMessage }}</span>
                    </div>
                </div>
                </div>
            </template>
            </panel>
        </v-flex>
        </v-layout>
        <reference :reference="$STRINGS.CITATION_FOLDMASON"></reference>
    </v-container>
</template>
    
<script>
import Panel from "./Panel.vue";
import FileButton from "./FileButton.vue";
import LoadAcessionButton from './LoadAcessionButton.vue';
import Reference from "./Reference.vue";
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import { djb2, parseResultsList } from './Utilities.js';
import { AxiosCompressRequest } from './lib/AxiosCompressRequest.js';
import ApiDialog from './ApiDialog.vue';
import { HistoryMixin } from './lib/HistoryMixin.js';
import Databases from './Databases.vue';
import QueryTextarea from "./QueryTextarea.vue";

const defaultParams = {
    wg: true,
    filterMsa: true,
    compBias: true,
    matchRatio: 0.51,
    gapOpen: 10,
    gapExtend: 1,
    refineIters: 0
};

export default {
    name: "foldmason",
    mixins: [ HistoryMixin ],
    components: { 
        Panel,
        FileButton,
        LoadAcessionButton,
        // TaxonomyAutocomplete,
        // PredictStructureButton: () => __APP__ == "foldseek" ? import('./PredictStructureButton.vue') : null,
        Reference,
        ApiDialog,
        Databases,
        QueryTextarea
    },
    data() {
        return {
            inSearch: false,
            errorMessage: "",
            queries: [],   // [ { name: "file", text: "ATOM..." }, { name: "file", text: "ATOM..." } ...]
            params: structuredClone(defaultParams)
        };
    },
    async mounted() {
    },
    computed: {
        alignDisabled() {
            return this.queries.length <= 1 || this.inSearch;
        },
    },
    watch: {
    },
    methods: {
        async handleLoadExample() {
            let response = null;
            try {
                const url = "https://search.foldseek.com/dl/foldmason_example.json";
                response = await this.$axios.get(url);
                if (!response) {
                    throw new Error(`Error fetching example: ${response.status}`);
                }
            } catch (error) {
                this.errorMessage = "Error loading example";
                throw error;
            }
            this.$root.userData = response.data;
            this.$router.push({ name: 'foldmasonresult', params: { ticket: `user-example` }}).catch(error => {});
        },
        async search() {
            var request = {
                queries: this.queries.map(q => q.text),
                fileNames: this.queries.map(q => q.name),
                gapOpen: this.params.gapOpen,
                gapExtend: this.params.gapExtend
            };
            // if (typeof(request.q) === 'string' && request.q != '') {
            //     if (request.q[request.q.length - 1] != '\n') {
            //         request.q += '\n';
            //     }
            // }
            try {
                this.inSearch = true;
                const response = await this.$axios.post("api/ticket/foldmason", convertToQueryUrl(request), {
                    transformRequest: AxiosCompressRequest(this.$axios)
                });
                this.errorMessage = "";
                switch (response.data.status) {
                    case "PENDING":
                    case "RUNNING":
                        this.addToHistory(response.data.id);
                        this.$router.push({
                            name: "queue", params: { ticket: response.data.id }
                        });
                        break;
                    case "COMPLETE":
                        this.addToHistory(response.data.id);
                        this.$router.push({
                            name: "foldmasonresult", params: { ticket: response.data.id }
                        });
                        break;
                    case "RATELIMIT":
                        this.errorMessage = "You have reached the rate limit. Please try again later.";
                        break;
                    case "MAINTENANCE":
                        this.errorMessage = "The server is currently under maintenance. Please try again later.";
                        break;
                    default:
                        this.errorMessage = "Error loading search result";
                        break;
                }
            } catch (error) {
                this.errorMessage = "Error loading search result";
                throw error;
            } finally {
                this.inSearch = false;
            }
        },
        async removeQuery(index) {
            this.queries.splice(index, 1);
        },
        /**
         * Load all files and add them to component state
         * TODOs:
         *   no need to store full text before submission
         *   need to limit number of files
         * @param {*} files - FileList from upload event
         */
        async upload(files) {
            const readFile = async (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve({ name: file.name, text: e.target.result });
                    reader.onerror = err => reject(err);
                    reader.readAsText(file);
                });
            }
            try {
                const fileReadPromises = Array.from(files).map(readFile);
                const fileContents = await Promise.all(fileReadPromises);
                this.queries = fileContents;
            } catch(error) {
                console.log("Error reading files", error);
            }
        },
        uploadJSON(files) {
            let file = files[0];
            let hash = djb2(file.name);
            let fr = new FileReader();
            fr.addEventListener(
                "load",
                (e) => {
                    this.$root.userData = JSON.parse(e.target.result);
                    this.$router.push({ name: 'foldmasonresult', params: { ticket: `user-${hash}` }}).catch(error => {});
                }
            );
            fr.readAsText(file)
        },
        resetParams() {
            this.params = structuredClone(defaultParams);
        },
    }
};
</script>

<style>
.input-buttons-panel {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
}
.input-buttons-left {
    display: flex;
    flex-wrap: wrap;
}
.query-panel .actions button {
    margin: 5px 5px 5px 0;
}
</style>

<style scoped>
.query-chip-group {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 7px;
}
.query-panel .actions {
    flex: 0;
    padding-top: 7px;
}

.search-component >>> .v-input--checkbox {
    margin-top: 0px;
}

.search-component >>> .input-group label {
    font-size: 16px;
}

.search-component >>> .v-text-field {
    margin-top: 0px;
    padding-top: 0px;
    margin-bottom: 8px;
}

.theme--dark .v-input label {
    color: #FFFFFFB3;
}

.theme--light .v-input label {
    color: #00000099;
}
</style>

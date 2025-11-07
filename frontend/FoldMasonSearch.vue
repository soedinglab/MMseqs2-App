<template>
    <v-container grid-list-md fluid px-2 py-1 class="search-component">
        <v-layout wrap>
        <v-flex xs12>
            <panel class="query-panel d-flex fill-height" fill-height>
            <template slot="header">
                <template v-if="$vuetify.breakpoint.smAndDown">
                    MSTA proteins
                </template>
                <template v-else>
                    Input protein structures (PDB/CIF) for MSTA
                </template>
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
                <div class="upload-outer-container w-44 gr-2 mb-2">
                    <DragUploadBox
                            class="drag-upload-box"
                            @uploadedFiles="upload"
                            multiple
                    ></DragUploadBox> 
                  
                    <div v-if="queries.length > 0" class="query-chip-group">
                        <v-chip
                            v-for="(q, index) in queries"
                            close
                            outlined
                            :key="q.name"
                            :value="q.name"
                            @click:close="removeQuery(index)"
                        >
                            {{ q.name }}
                        </v-chip>
                    </div>
                </div>

                <div class="actions input-buttons-panel">
                    <div class="input-buttons-left">
                        <!-- <PredictStructureButton v-if="$APP == 'foldseek'" :query="query" v-model="predictable" v-on:predict="query = $event"></PredictStructureButton> -->
                        <!-- <file-button id="localMSAFile" label="Upload MSA file" @upload="uploadMSA"></file-button> -->
                        <load-acession-button v-if="$APP == 'foldseek'" @select="queries.push(...$event)" @loading="accessionLoading = $event" :preload-source="preloadSources" :preload-accession="preloadAccessions" multiple></load-acession-button>
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
        <!-- <v-flex xs12>
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
        </v-flex> -->
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
                    <div v-if="errorMessage.type" :class="['v-alert', 'v-alert--outlined', errorMessage.type + '--text', 'mt-2' ]">
                        <span>{{ errorMessage.message }}</span>
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
import { djb2, parseResultsList } from './Utilities.js';
import { AxiosCompressRequest } from './lib/AxiosCompressRequest.js';
import ApiDialog from './ApiDialog.vue';
import { HistoryMixin } from './lib/HistoryMixin.js';
import Databases from './Databases.vue';
import QueryTextarea from "./QueryTextarea.vue";
import DragUploadBox from "./DragUploadBox.vue";
import { BlobDatabase } from "./lib/BlobDatabase.js";

const db = BlobDatabase();

export default {
    name: "FoldMasonSearch",
    tool: "foldmason",
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
        QueryTextarea,
        DragUploadBox
    },
    data() {
        return {
            inSearch: false,
            errorMessage: { type: null, message: "" },
            queries: [],   // [ { name: "file", text: "ATOM..." }, { name: "file", text: "ATOM..." } ...]
            inFileDrag: false,
            accessionLoading: false,
        };
    },
    async mounted() {
        if (this.preloadAccessions.length > 0) {
            this.queries = [];
        }
        this.retrieveAndClean()
        return;
    },
    computed: {
        alignDisabled() {
            return this.queries.length <= 1 || this.inSearch || this.queries.length >= 5000;
        },
        fileNameSet() {
            return new Set(this.queries.map(f => f.name)); 
        },
        preloadSources() {
            return this.$route.query.sources || "";
        },
        preloadAccessions() {
            return this.$route.query.accessions || "";
        },
    },
    watch: {
        'queries': function() {
            let count = this.queries.length;
            if (count >= 5000) {
                this.errorMessage = { type: "error", message: "Please use a local Foldmason installation to align more than 5000 structures." };
            } else if (count >= 1000) {
                this.errorMessage = { type: "warning", message: "Foldmason result visualization might not work as expected with more than 1000 structures." };
            } else {
                this.errorMessage = { type: null, message: "" };
            }
        }
    },
    methods: {
        async handleLoadExample() {
            let response = null;
            try {
                this.errorMessage = { type: null, message: "" };
                const url = "https://search.foldseek.com/dl/foldmason_example.json";
                response = await this.$axios.get(url);
                if (!response) {
                    throw new Error(`Error fetching example: ${response.status}`);
                }
            } catch (error) {
                this.errorMessage = { type: "error", message: "Error loading example" };
                throw error;
            }
            this.$root.userData = response.data;
            this.$router.push({ name: 'foldmasonresult', params: { ticket: `user-example` }}).catch(error => {});
        },
        async search() {
            const params = new FormData();
            this.queries.forEach((v) => {
                params.append('fileNames[]', v.name);
                params.append('queries[]', new Blob([v.text], { type: 'text/plain' }), v.name);
            });

            try {
                this.inSearch = true;
                const response = await this.$axios.post("api/ticket/foldmason", params, {
                    transformRequest: AxiosCompressRequest(this.$axios)
                });
                this.errorMessage = { type: null, message: "" };
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
                        this.errorMessage = { type: "error", message: "You have reached the rate limit. Please try again later." };
                        break;
                    case "MAINTENANCE":
                        this.errorMessage = { type: "error", message: "The server is currently under maintenance. Please try again later." };
                        break;
                    default:
                        this.errorMessage = { type: "error", message: "Error loading search result." };
                        break;
                }
            } catch (error) {
                this.errorMessage = { type: "error", message: "Error loading search result."};
                throw error;
            } finally {
                this.inSearch = false;
            }
        },
        async removeQuery(index) {
            this.queries.splice(index, 1);
        },
        addFiles(newFiles) {
            for (const newFile of newFiles) {
                if (!this.fileNameSet.has(newFile.name)) {
                    this.queries.push(newFile);
                }
            }
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
                this.addFiles(fileContents);
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
        async retrieveAndClean() {
            const clean = async (size) => {
                // return
                await db.removeItem('msa.query.size')
                await db.removeItem('msa.query.names')
                for (let i = 0; i < size; i++) {
                    await db.removeItem(`msa.query.chunk:${i}`)
                }
            }
            
            // await clean(2)
            // return

            const SEP = '\0'

            let size = await db.getItem('msa.query.size')
            if (!size || size.length == 0) { 
                await clean()
                return 
            }

            size = parseInt(size)
            
            const texts = []
            let names = await db.getItem('msa.query.names')
            if (!names || names.length == 0) {
                console.warn("MSA query name has not been passed")
                await clean(size)
                return
            }
            names = names.split(SEP)

            for (let i = 0; i < size; i++) {
                const entry = await db.getItem(`msa.query.chunk:${i}`)
                if (!entry || entry.length == 0) {
                    console.warn(`MSA query chunk ${i} is missing`)
                    await clean(size)
                    return
                }
                
                texts.push(...( ( await entry.text() ).split(SEP) ))
            }

            if (names.length != texts.length) {
                console.warn("MSA query entries and names size differs")
                console.log(`names length: ${names.length}`)
                console.log(`texts length: ${texts.length}`)
                await clean(size)
                return
            }

            const files = []

            for (let i = 0; i < texts.length; i++) {
                files.push({text: texts[i], name: names[i]})
            }

            this.addFiles(files)

            await clean(size)
        }
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
    margin-top: 10px;
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
                        
.uploaded-file {
    margin: 10px 0;
}

.upload-outer-container {
    min-height: 300px;
    display: flex;
    flex-direction: column;
}

.drag-upload-box >>> .upload-drag-area {
    height: 100%;
    background-image: url("./assets/marv-foldmason-gray.png");
    background-repeat: no-repeat;
    background-position: right 15px bottom -10px;
    background-size: 220px;
    line-height: 1.5;
}
</style>

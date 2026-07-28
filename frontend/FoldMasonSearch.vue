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
                    <v-alert
                        v-model="alert"
                        border="left"
                        close-text="Close Alert"
                        color="primary"
                        text
                        type="info"
                        dismissible
                    >
                    <strong>{{ skippedEntries }} duplicated entries</strong> have been skipped
                    </v-alert>
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
                            {{ q.name.split('-_-_-_')[0] }}
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
import DragUploadBox from "./DragUploadBox.vue";
import { BlobDatabase } from "./lib/BlobDatabase.js";
import { registerPageApi } from './lib/resultsApi.js';
import { sourcesFor, fetchAccession } from './lib/accession.js';

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
        DragUploadBox
    },
    data() {
        return {
            inSearch: false,
            errorMessage: { type: null, message: "" },
            queries: [],   // [ { name: "file", text: "ATOM..." }, { name: "file", text: "ATOM..." } ...]
            inFileDrag: false,
            accessionLoading: false,
            alert: false,
            skippedEntries: 0,
        };
    },
    async mounted() {
        this._disposeApi = registerPageApi('search', 'foldmason', {
            getState: this.getState,
            validate: this.validate,
            getQueries: this.getQueries,
            addQuery: this.addQuery,
            addQueries: this.addQueries,
            removeQuery: this.apiRemoveQuery,
            clearQueries: this.clearQueries,
            getAccessionSources: this.getAccessionSources,
            loadAccessions: this.loadAccessions,
            submit: this.submit,
            describePage: this.describePage,
            _vm: this,
        });
        if (this.preloadAccessions.length > 0) {
            this.queries = [];
        }
        this.retrieveAndClean()
        return;
    },
    beforeDestroy() {
        // FoldMasonSearch registers directly rather than through SearchApiMixin, so it needs its
        // own disposer — without it window.searchApi survives navigation to the result page.
        this._disposeApi?.();
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
        // ---------------------------------------------------------------------------------
        // API (window.searchApi). Deliberately NOT the SearchApiMixin: the input here is a
        // list of files and validation is a count bound, so sharing would mean a mixin full
        // of conditionals. See claude-plan/ai-friendly-search/context.md §3.
        // ---------------------------------------------------------------------------------
        getQueries() {
            return (this.queries ?? []).map((q, index) => ({
                index,
                name: q.name,
                length: q.text ? q.text.length : (q.file?.size ?? null),
                source: q.file ? 'file' : 'text',
            }));
        },
        addQuery(name, text) {
            if (!name || !text) return { ok: false, reason: 'name and text are both required' };
            this.queries.push({ name: String(name), text: String(text) });
            return { ok: true, count: this.queries.length };
        },
        addQueries(list) {
            const added = [], rejected = [];
            for (const item of (Array.isArray(list) ? list : [list])) {
                if (item?.name && item?.text) {
                    this.queries.push({ name: String(item.name), text: String(item.text) });
                    added.push(item.name);
                } else {
                    rejected.push({ item, reason: 'needs { name, text }' });
                }
            }
            return { ok: rejected.length === 0, added, rejected, count: this.queries.length };
        },
        // Wrapper, not an override: the page already has removeQuery() and the template binds
        // it (@click:close). A same-named method here would silently win the object literal and
        // change what the close button does.
        async apiRemoveQuery(index) {
            const i = Number(index);
            if (!Number.isInteger(i) || i < 0 || i >= this.queries.length) {
                return { ok: false, reason: `index ${index} out of range (0..${this.queries.length - 1})` };
            }
            await this.removeQuery(i);
            return { ok: true, count: this.queries.length };
        },
        clearQueries() {
            this.queries = [];
            return { ok: true, count: 0 };
        },
        getAccessionSources() {
            return sourcesFor([]).map(s => ({ value: s.value, text: s.text }));
        },
        // The `multiple` path: appends, mirroring @select="queries.push(...$event)".
        async loadAccessions(list, source = 'PDB') {
            const valid = this.getAccessionSources().map(s => s.value);
            if (!valid.includes(source)) {
                return { ok: false, reason: `unknown source: ${source}`, valid };
            }
            const wanted = (Array.isArray(list) ? list : String(list).split(/[,\s]+/))
                .map(x => String(x).trim()).filter(Boolean);
            if (wanted.length === 0) return { ok: false, reason: 'no accessions given' };
            const settled = await Promise.allSettled(
                wanted.map(a => fetchAccession(a, source)));
            const added = [], failed = [];
            settled.forEach((r, i) => {
                if (r.status === 'fulfilled') {
                    this.queries.push({ name: r.value.name, text: r.value.text });
                    added.push({ requested: wanted[i], resolved: r.value.name });
                } else {
                    failed.push(wanted[i]);
                }
            });
            return { ok: failed.length === 0, added, failed, count: this.queries.length };
        },
        validate() {
            const reasons = [];
            const n = this.queries?.length ?? 0;
            if (this.inSearch) reasons.push('a search is already running');
            if (n <= 1) reasons.push(`FoldMason needs at least 2 structures; ${n} provided`);
            if (n >= 5000) reasons.push(`too many structures: ${n} (limit is 4999)`);
            return { ok: reasons.length === 0, reasons, count: n, bounds: { min: 2, max: 4999 } };
        },
        getState() {
            return {
                tool: 'foldmason',
                queries: this.getQueries(),
                count: this.queries?.length ?? 0,
                inSearch: !!this.inSearch,
                skippedEntries: this.skippedEntries ?? 0,
                valid: this.validate(),
            };
        },
        // Delegates to the page's own search() so the multipart body is never duplicated.
        async submit() {
            const v = this.validate();
            if (!v.ok) return { ok: false, reason: 'validation failed', reasons: v.reasons };
            this.errorMessage = { type: null, message: '' };
            const before = this.$route?.fullPath ?? null;
            try {
                await this.search();
            } catch (e) {
                return { ok: false, status: 'ERROR', reason: `request failed: ${e?.message ?? e}` };
            }
            const msg = this.errorMessage?.message ?? '';
            if (msg) {
                const status = /rate limit/i.test(msg) ? 'RATELIMIT'
                    : /maintenance/i.test(msg) ? 'MAINTENANCE' : 'ERROR';
                return { ok: false, status, reason: msg };
            }
            return { ok: true, ticket: this.$route?.params?.ticket ?? null,
                route: this.$route?.name ?? null,
                navigated: (this.$route?.fullPath ?? null) !== before };
        },
        describePage() {
            return {
                kind: 'search',
                tool: 'foldmason',
                count: this.queries?.length ?? 0,
                bounds: { min: 2, max: 4999 },
                accessionSources: this.getAccessionSources().map(s => s.value),
                notes: [
                    'Input is a list of structures; validation is a count bound (2..4999).',
                    'submit() POSTs multipart, consumes rate limit and navigates away.',
                    'No mode, taxonomy or motif on this page.',
                ],
            };
        },
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
                params.append('queries[]', v.file || new Blob([v.text], { type: 'text/plain' }), v.name);
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
            this.addFiles(Array.from(files).map(file => ({ name: file.name, file })));
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
                await db.removeItem('msa.query.forwarded_query')
                await db.removeItem('msa.query.forwarded_query_name')
                for (let i = 0; i < size; i++) {
                    await db.removeItem(`msa.query.chunk:${i}`)
                }
            }


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

            const query = await db.getItem('msa.query.forwarded_query')
            let queryFile = undefined
            let queryName = undefined
            if (query && query.length != 0) {
                queryFile = await query.text()
                queryName = await db.getItem('msa.query.forwarded_query_name')
            }

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
                console.log(texts)
                await clean(size)
                return
            }
            
            

            const files = []

            
            for (let i = 0; i < texts.length; i++) {
                files.push({text: texts[i], name: names[i]})
            }

            // Calculate overlapping entries
            files.sort((a, b) => {return a.name.localeCompare(b.name)})
            let dupCount = 0
            let prev = ""
            
            for (let f of files) {
                if (f.name == prev) {
                    dupCount++
                } else {
                    prev = f.name
                }
            }

            if (dupCount > 0) {
                this.alert = true
                this.skippedEntries = dupCount
            }

            if (queryFile) {
                files.unshift({text: queryFile, name: queryName})
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

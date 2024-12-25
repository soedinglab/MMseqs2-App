<template>
<v-container grid-list-md fluid px-2 py-1 class="search-component">
    <v-layout wrap>
    <v-flex xs12>
        <panel class="query-panel d-flex fill-height" fill-height>
        <template slot="header">
            <template v-if="$APP == 'foldseek'">
                Input protein
                <template v-if="!$vuetify.breakpoint.smAndDown">
                    structure (PDB/CIF) or sequence (FASTA)
                </template>
            </template>
            <template v-else>
                Queries
            </template>
        </template>
        <template slot="toolbar-extra">
            <api-dialog
                :disabled="searchDisabled"
                :email="email"
                :mode="mode"
                :database="database"
                :taxfilter="taxFilter ? taxFilter.value : ''"></api-dialog>
            <v-icon v-if="query.length > 0" title="Clear" @click="query = ''" style="margin-right: 16px">{{ $MDI.Delete }}</v-icon>
            <v-tooltip open-delay="300" top>
                <template v-slot:activator="{ on }">
                    <v-icon v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                </template>
                <span>{{ $STRINGS.QUERIES_HELP }}</span>
            </v-tooltip>
        </template>
        <template slot="content">
            <query-textarea
                :loading="accessionLoading"
                v-model="query">
            </query-textarea>

                        <div class="actions input-buttons-panel">
                            <div class="input-buttons-left">
                                <load-acession-button v-if="$APP == 'foldseek'" @select="query = $event" @loading="accessionLoading = $event" :preload-source="preloadSource" :preload-accession="preloadAccession"></load-acession-button>
                                <file-button id="file" :label="$STRINGS.UPLOAD_LABEL" v-on:upload="upload"></file-button>
                                <PredictStructureButton v-if="$APP == 'foldseek'" :query="query" v-model="predictable" v-on:predict="query = $event"></PredictStructureButton>
                            </div>
                            <file-button id="localFile" label="Upload previous results" @upload="uploadJSON"></file-button>
                        </div>
                    </template>
                </panel>
            </v-flex>
            <v-flex xs12>
                <!-- Databases Section -->
                <panel collapsible collapsed>
                    <template slot="header">
                        <template v-if="!$vuetify.breakpoint.smAndDown">
                            Databases
                        </template>
                        <template v-else>
                            DBs
                        </template>
                    </template>
                    <div slot="content">
                        <!-- Existing Database Selection -->
                        <div class="input-group">
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <label v-on="on">Databases&nbsp;<v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon></label>
                                </template>
                                <span v-if="$ELECTRON || hideEmail">Choose the databases to search against and the result mode.</span>
                                <span v-else>Choose the databases to search against, the result mode, and optionally an email to notify you when the job is done.</span>
                            </v-tooltip>
                        </div>

                        <template v-if="databases.length > 0">
                            <v-checkbox v-for="(db, index) in databases" v-model="database" :key="index" :value="db.path" :label="db.name + ' ' + db.version" :append-icon="(db.status == 'ERROR' || db.status == 'UNKNOWN') ? $MDI.AlertCircleOutline : ((db.status == 'PENDING' || db.status == 'RUNNING') ? $MDI.ProgressWrench : undefined)" :disabled="db.status != 'COMPLETE'" hide-details></v-checkbox>
                        </template>

                        <div v-if="databasesNotReady" class="alert alert-info mt-1">
                            <span>Databases are loading...</span>
                        </div>
                    </div>
                </panel>

                <!-- Search Parameters Section -->
                <panel collapsible collapsed>
                    <template slot="header">
                        <template v-if="!$vuetify.breakpoint.smAndDown">
                            Search Parameters
                        </template>
                        <template v-else>
                            Params
                        </template>
                    </template>
                    <div slot="content">
                        <!-- Mode Section -->
                        <v-radio-group v-model="mode">
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <label v-on="on">Mode&nbsp;<v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon></label>
                                </template>
                                <span v-html="$STRINGS.MODE_HELP"></span>
                            </v-tooltip>
                            <v-radio hide-details
                                    v-for="i in ($STRINGS.MODE_COUNT - 0)"
                                    :key="i"
                                    :value="$STRINGS['MODE_KEY_' + i]"
                                    :label="$STRINGS['MODE_TITLE_' + i]">
                            </v-radio>
                        </v-radio-group>

                        <TaxonomyAutocomplete v-model="taxFilter"></TaxonomyAutocomplete>

                        <v-divider class="my-2"></v-divider>

                        <v-radio-group v-model="iterativeSearch">
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <label v-on="on">
                                        Iterative search
                                        <v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                                    </label>
                                </template>
                                <span>Improve sensitivity of search by performing an iterative search (--num-iterations 3).</span>
                            </v-tooltip>

                            <v-radio label="On" :value="true"></v-radio>
                            <v-radio label="Off" :value="false"></v-radio>
                        </v-radio-group>
                    </div>
                </panel>


            </v-flex>
            <v-flex>
                <panel>
                <template slot="content">
                    <div class="actions" :style="!$vuetify.breakpoint.xsOnly ?'display:flex; align-items: center;' : null">
                    <v-btn color="primary" :block="$vuetify.breakpoint.xsOnly" x-large v-on:click="search" :disabled="searchDisabled"><v-icon>{{ $MDI.Magnify }}</v-icon>&nbsp;Search</v-btn>
                    <div :style="!$vuetify.breakpoint.xsOnly ? 'margin-left: 1em;' : 'margin-top: 1em;'">
                        <span><strong>Summary</strong></span><br>
                        Search <template v-if="taxFilter">
                            <strong>{{ taxFilter.text }}</strong> in
                        </template>
                        <template v-if="database.length == databases.length">
                            <strong>all available</strong> databases
                        </template>
                        <template v-else>
                            <strong>{{ database.length }}</strong>
                            <template v-if="database.length == 1">
                                database
                            </template>
                            <template v-else>
                                databases
                            </template>
                            ({{
                                databases.filter(db => database.includes(db.path)).map(db => db.name).sort().join(", ")
                            }})
                        </template> with {{ $STRINGS.APP_NAME }} in <strong>{{ modes[mode] }}</strong> mode<span v-if="iterativeSearch"><strong> iterative</strong></span>.
                        <div v-if="errorMessage != ''" class="v-alert v-alert--outlined warning--text mt-2">
                            <span>{{ errorMessage }}</span>
                        </div>
                    </div>
                    </div>
                </template>
                </panel>
            </v-flex>
        </v-layout>
    <v-layout wrap>
    <v-flex xs12>
        <v-card rounded="0">
        <v-card-title primary-title class="pb-0 mb-0">
            <div class="text-h5 mb-0">Reference</div>
        </v-card-title>
        <v-card-title primary-title class="pt-0 mt-0">
            <p class="text-subtitle-2 mb-0" v-html="$STRINGS.CITATION"></p>
        </v-card-title>
        </v-card>
    </v-flex>
    </v-layout>
    </v-container>
</template>

<script>
import Panel from "./Panel.vue";
import FileButton from "./FileButton.vue";
import LoadAcessionButton from './LoadAcessionButton.vue';
import Reference from "./Reference.vue";
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';
import { djb2, parseResultsList, checkMultimer } from './Utilities.js';
import { AxiosCompressRequest } from './lib/AxiosCompressRequest.js';
import ApiDialog from './ApiDialog.vue';
import { storage, HistoryMixin } from './lib/HistoryMixin.js';
import { BlobDatabase } from './lib/BlobDatabase.js';
import Databases from './Databases.vue';
import QueryTextarea from "./QueryTextarea.vue";

const db = BlobDatabase();

export default {
    name: "search",
    mixins: [ HistoryMixin ],
    components: { 
        Panel,
        FileButton,
        LoadAcessionButton,
        TaxonomyAutocomplete,
        PredictStructureButton: () => __APP__ == "foldseek" ? import('./PredictStructureButton.vue') : null,
        Reference,
        ApiDialog,
        Databases,
        QueryTextarea
    },
    data() {
        return {
            inSearch: false,
            errorMessage: "",
            showCurl: false,
            mode: this.$STRINGS.MODE_DEFAULT_KEY,
            modes: Array.from({length: this.$STRINGS.MODE_COUNT - 0}, (_, i) => i + 1)
                    .reduce((dict, i, _)  => { dict[this.$STRINGS['MODE_KEY_' + i]] = this.$STRINGS['MODE_TITLE_' + i]; return dict; }, {}),
            email: storage.getItem('email') || "",
            hideEmail: true,
            query: "",
            database: JSON.parse(storage.getItem('database') || '[]'),
            databases: JSON.parse(storage.getItem('databases') || '[]'),
            iterativeSearch: JSON.parse(storage.getItem('iterativeSearch') || false),
            taxFilter: JSON.parse(storage.getItem('taxFilter') || 'null'),
            predictable: false,
            accessionLoading: false,
        };
    },
    async mounted() {
        if (this.preloadAccession.length > 0) {
            this.query = "";
            return;
        }

        let query = await db.getItem('query');
        if (query && query.length > 0) {
            this.query = query;
        } else {
            this.query = this.$STRINGS.QUERY_DEFAULT;
        }
        if (localStorageEnabled && localStorage.database) {
            this.database = JSON.parse(localStorage.database);
        }
        if (localStorageEnabled && localStorage.databases) {
            this.databases = JSON.parse(localStorage.databases);
        }
        if (localStorageEnabled && localStorage.iterativeSearch) {
            this.iterativeSearch = JSON.parse(localStorage.iterativeSearch);
        }
        if (localStorageEnabled && localStorage.taxFilter) {
            this.taxFilter = JSON.parse(localStorage.taxFilter);
        }
    },
    computed: {
        searchDisabled() {
            if (__APP__ == "foldseek" ) {
                return (
                    this.inSearch || this.database.length == 0 || this.databases.length == 0 || this.query.length == 0 || this.predictable
                );
            } else {
                return (
                    this.inSearch || this.database.length == 0 || this.databases.length == 0 || this.query.length == 0
                );
            }
        },
        preloadSource() {
            return this.$route.query.source || "";
        },
        preloadAccession() {
            return this.$route.query.accession || "";
        },
        isMultimer() {
            if (__APP__ != "foldseek") {
                return false;
            }
            return checkMultimer(this.query);
        }
    },
    watch: {
        mode(value) {
            storage.setItem('mode', value);
        },
        email(value) {
            storage.setItem('email', value);
        },
        query(value) {
            db.setItem('query', value);
        },
        database(value) {
            storage.setItem('database', JSON.stringify(value));
        },
        databases(value) {
            storage.setItem('databases', JSON.stringify(value));
        },
        iterativeSearch(value) {
            storage.setItem('iterativeSearch', JSON.stringify(value));
        },
        taxFilter(value) {
            storage.setItem('taxFilter', JSON.stringify(value));
        },
    },
    methods: {
        async search() {
            var request = {
                q: this.query,
                database: this.database,
                mode: this.mode,
                email: this.email,
                iterativesearch: this.iterativeSearch
            };
            if (__APP__ == "foldseek" && typeof(request.q) === 'string' && request.q != '') {
                if (request.q[request.q.length - 1] != '\n') {
                    request.q += '\n';
                }
            }
            if (__APP__ == "mmseqs" && typeof(value) === 'string' && request.q != '') {
                // Fix query to always be a valid FASTA sequence
                request.q = request.q.trim();
                if (request.q[0] != '>') {
                    request.q = '>unnamed\n' + request.q;
                }
            }
            if (__ELECTRON__) {
                request.email = "";
            }
            if (this.taxFilter) {
                request.taxfilter = this.taxFilter.value;
            }
            try {
                this.inSearch = true;
                const response = await this.$axios.post("api/ticket", convertToQueryUrl(request), {
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
                            name: "result", params: { ticket: response.data.id, entry: 0 }
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
        upload(files) {
            var reader = new FileReader();
            reader.onload = e => {
                this.query = e.target.result;
            };
            reader.readAsText(files[0]);
        },
        uploadJSON(files) {
            let file = files[0];
            let hash = djb2(file.name);
            let fr = new FileReader();
            fr.addEventListener(
                "load",
                (e) => {
                    let data = parseResultsList(JSON.parse(e.target.result));
                    this.$root.userData = data;
                    this.$router.push({ name: 'result', params: { ticket: `user-${hash}`, entry: 0 }}).catch(error => {});
                }
            );
            fr.readAsText(file)
        },
        async goToMultimer() {
            await db.setItem('multimer.query', this.query);
            this.$router.push({ name: 'multimer'});
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

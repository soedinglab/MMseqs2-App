<template>
    <v-container grid-list-md fluid px-2 py-1 class="search-component">
        <v-layout wrap>
            <v-flex xs12>
                <panel class="query-panel d-flex fill-height" fill-height>
                    <template slot="header">
                        <template v-if="$APP == 'foldseek'">
                            Input protein
                            <template v-if="!$vuetify.breakpoint.smAndDown">
                                structure (PDB) or sequence (FASTA)
                            </template>
                        </template>
                        <template v-else>
                            Queries
                        </template>
                    </template>
                    <template slot="toolbar-extra">
                        <v-dialog v-if="!$ELECTRON" v-model="showCurl" absolute :disabled="searchDisabled">
                            <template v-slot:activator="{ on }">
                                <v-btn v-on="on" plain :disabled="searchDisabled">
                                    <v-icon>M 22.23 1.96 c -0.98 0 -1.77 0.8 -1.77 1.77 c 0 0.21 0.05 0.4 0.12 0.6 l -8.31 14.23 c -0.8 0.17 -1.42 0.85 -1.42 1.7 a 1.77 1.77 0 0 0 3.54 0 c 0 -0.2 -0.05 -0.37 -0.1 -0.55 l 8.34 -14.29 a 1.75 1.75 0 0 0 1.37 -1.69 c 0 -0.97 -0.8 -1.77 -1.77 -1.77 M 14.98 1.96 c -0.98 0 -1.77 0.8 -1.77 1.77 c 0 0.21 0.05 0.4 0.12 0.6 l -8.3 14.24 c -0.81 0.16 -1.43 0.84 -1.43 1.7 a 1.77 1.77 0 0 0 3.55 0 c 0 -0.2 -0.06 -0.38 -0.12 -0.56 L 15.4 5.42 a 1.75 1.75 0 0 0 1.37 -1.69 c 0 -0.97 -0.8 -1.77 -1.78 -1.77 M 1.75 6 a 1.75 1.75 0 1 0 0 3.5 a 1.75 1.75 0 0 0 0 -3.5 z m 0 6 a 1.75 1.75 0 1 0 0 3.5 a 1.75 1.75 0 0 0 0 -3.5 z</v-icon>
                                    API
                                </v-btn>
                            </template>
                            <v-card>
                                <v-card-title>
                                    <div class="text-h5">cURL Command</div>
                                </v-card-title>
                                <v-card-text>
                                    {{ $STRINGS.CURL_INTRO }}
                                <br>
                                <code>curl -X POST -F q=@PATH_TO_FILE <span v-if="email">-F 'email={{email}}'</span> -F 'mode={{mode}}' <span v-for="(path, i) in database" :key="i">-F 'database[]={{ path }}' </span> {{ origin() + '/api/ticket' }}</code>
                                <br>
                                    Refer to the <a href="https://search.mmseqs.com/docs/" target="_blank" rel="noopener">API documentation</a>, on how to check the status and fetch the result.
                                </v-card-text>
                                <v-card-actions>
                                    <v-spacer></v-spacer>
                                    <v-btn color="primary" text @click.native="showCurl = false">Close</v-btn>
                                </v-card-actions>
                            </v-card>
                        </v-dialog>
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>{{ $STRINGS.QUERIES_HELP }}</span>
                        </v-tooltip>
                    </template>
                    <template slot="content">
                        <v-textarea
                            :aria-label="$STRINGS.QUERIES_HELP"
                            class="marv-bg mono"
                            hide-details
                            v-model="query"
                            @dragover.prevent
                            @drop="fileDrop($event)"
                            :placeholder="$STRINGS.QUERIES_HELP"
                            spellcheck="false"
                            data-gramm="false"
                            data-gramm_editor="false"
                            data-enable-grammarly="false"
                            >
                        </v-textarea>

                        <div class="actions">
                            <load-acession-button v-if="$APP == 'foldseek'" v-on:select="query = $event" :preload-source="preloadSource" :preload-accession="preloadAccession"></load-acession-button>
                            <file-button id="file" :label="$STRINGS.UPLOAD_LABEL" v-on:upload="upload"></file-button>
                            <PredictStructureButton v-if="$APP == 'foldseek'" :query="query" v-model="predictable" v-on:predict="query = $event"></PredictStructureButton>
                        </div>
                    </template>
                </panel>
            </v-flex>
            <v-flex xs12>
                <panel collapsible collapsed>
                    <template slot="header">
                        <template v-if="!$vuetify.breakpoint.smAndDown">
                            Databases
                        </template>
                        <template v-else>
                            DBs
                        </template>
                        &amp; search settings
                    </template>
                    <div slot="content">
                        <div class="input-group">
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <label v-on="on">Databases&nbsp;<v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon></label>
                                </template>
                                <span v-if="$ELECTRON || hideEmail">Choose the databases to search against and the result mode.</span>
                                <span v-else>Choose the databases to search against, the result mode, and optionally an email to notify you when the job is done.</span>
                            </v-tooltip>
                        </div>
                            
                        <div v-if="databases.length == 0">
                            <div :class="['alert', { 'alert-info': !dberror }, { 'alert-danger': dberror }]">
                                <span v-if="dberror">Could not query available databases!</span>
                                <span v-else-if="dbqueried == false">Loading databases...</span>
                                <span v-else>
                                    No databases found! <br />
                                    <span v-if="$ELECTRON">
                                        Go to <router-link to="preferences">Preferences</router-link> to add a database.
                                    </span>
                                </span>
                            </div>
                        </div>
                        <template v-else>
                            <v-checkbox v-for="(db, index) in databases" v-model="database" :key="index" :value="db.path" :label="db.name + ' ' + db.version" :append-icon="(db.status == 'ERROR' || db.status == 'UNKNOWN') ? $MDI.AlertCircleOutline : ((db.status == 'PENDING' || db.status == 'RUNNING') ? $MDI.ProgressWrench : undefined)" :disabled="db.status != 'COMPLETE'" hide-details></v-checkbox>
                        </template>
                        <div v-if="databasesNotReady" class="alert alert-info mt-1">
                            <span>Databases are loading...</span>
                        </div>

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
                                     :label="$STRINGS['MODE_TITLE_' + i]"
                                     ></v-radio>
                        </v-radio-group>

                        <TaxonomyAutocomplete v-model="taxFilter"></TaxonomyAutocomplete>

                        <v-tooltip v-if="!$ELECTRON && !hideEmail" open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-text-field v-on="on" label="Notification Email (Optional)" placeholder="you@example.org" v-model="email"></v-text-field>
                            </template>
                            <span>Send an email when the job is done.</span>
                        </v-tooltip>


                        <div v-if="errorMessage != ''" class="v-alert red mt-2">
                            <span>{{ errorMessage }}</span>
                        </div>
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
                        </template> with {{ $STRINGS.APP_NAME }} in <strong>{{ modes[mode] }}</strong> mode.
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
import { gzip } from 'pako';
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';

let localStorageEnabled = false;
try {
    if (typeof window.localStorage !== 'undefined') {
        localStorageEnabled = true
    }
} catch(e) {}

export default {
    name: "search",
    components: { 
        Panel,
        FileButton,
        LoadAcessionButton,
        TaxonomyAutocomplete,
        PredictStructureButton: () => __APP__ == "foldseek" ? import('./PredictStructureButton.vue') : null,
    },
    data() {
        return {
            dberror: false,
            dbqueried: false,
            databases: [],
            inSearch: false,
            errorMessage: "",
            showCurl: false,
            mode: this.$STRINGS.MODE_DEFAULT_KEY,
            modes: Array.from({length: this.$STRINGS.MODE_COUNT - 0}, (_, i) => i + 1)
                        .reduce((dict, i, _)  => { dict[this.$STRINGS['MODE_KEY_' + i]] = this.$STRINGS['MODE_TITLE_' + i]; return dict; }, {}),
            email: "",
            hideEmail: true,
            query: "",
            database: [],
            taxFilter: null,
            predictable: false
        };
    },
    mounted() {
        if (localStorageEnabled && localStorage.mode) {
            this.mode = localStorage.mode;
        }
        if (localStorageEnabled && localStorage.email) {
            this.email = localStorage.email;
        }
        if (this.preloadAccession.length > 0) {
            this.query = "";
        } else if (localStorageEnabled && localStorage.query && localStorage.query.length > 0) {
            this.query = localStorage.query;
        } else {
            this.query = this.$STRINGS.QUERY_DEFAULT;
        }
        if (localStorageEnabled && localStorage.database) {
            this.database = JSON.parse(localStorage.database);
        }
        if (localStorageEnabled && localStorage.databases) {
            this.databases = JSON.parse(localStorage.databases);
        }
        if (localStorageEnabled && localStorage.taxFilter) {
            this.taxFilter = JSON.parse(localStorage.taxFilter);
        }
    },
    computed: {
        databasesNotReady: function() {
            return this.databases.some((db) => db.status == "PENDING" || db.status == "RUNNING");
        },
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
        }
    },
    created() {
        this.fetchData();
    },
    watch: {
        $route: "fetchData",
        mode(value) {
            if (localStorageEnabled) {
                localStorage.mode = value;
            }
        },
        email(value) {
            if (localStorageEnabled) {
                localStorage.email = value;
            }
        },
        query(value) {
            if (localStorageEnabled) {
                localStorage.query = value;
            }
        },
        database(value) {
            if (localStorageEnabled) {
                localStorage.database = JSON.stringify(value);
            }
        },
        databases(value) {
            if (localStorageEnabled) {
                localStorage.databases = JSON.stringify(value);
            }
        },
        taxFilter(value) {
            if (localStorageEnabled) {
                localStorage.taxFilter = JSON.stringify(value);
            }
        },
    },
    methods: {
        origin() {
            return (
                window.location.protocol +
                "//" +
                window.location.hostname +
                (window.location.port ? ":" + window.location.port : "")
            );
        },
        fetchData() {
            this.$axios.get("api/databases/all").then(
                response => {
                    const data = response.data;
                    this.dbqueried = true;
                    this.dberror = false;
                    this.databases = data.databases;

                    const complete = this.databases.filter((db) => { return db.status == "COMPLETE"; });
                    if (this.database === null || this.database.length == 0) {
                        this.database = complete.filter((element) => { return element.default == true }).map((db) => { return db.path; });
                    } else {
                        const paths = complete.map((db) => { return db.path; });
                        this.database = this.database.filter((elem) => {
                            return paths.includes(elem);
                        });
                    }

                    if (this.databases.some((db) => { return db.status == "PENDING" || db.status == "RUNNING"; })) {
                        setTimeout(this.fetchData.bind(this), 1000);
                    }
                }).catch(() => { this.dberror = true; });
        },
        search(event) {
            var data = {
                q: this.query,
                database: this.database,
                mode: this.mode,
                email: this.email
            };
            if (__APP__ == "foldseek" && typeof(data.q) === 'string' && data.q != '') {
                if (data.q[data.q.length - 1] != '\n') {
                    data.q += '\n';
                }
            }
            if (__APP__ == "mmseqs" && typeof(value) === 'string' && data.q != '') {
                // Fix query to always be a valid FASTA sequence
                data.q = data.q.trim();
                if (data.q[0] != '>') {
                    data.q = '>unnamed\n' + data.q;
                }
            }
            if (__ELECTRON__) {
                data.email = "";
            }
            if (this.taxFilter) {
                data.taxfilter = this.taxFilter.value;
            }
            this.inSearch = true;
            this.$axios.post("api/ticket", convertToQueryUrl(data), {
                transformRequest: this.$axios.defaults.transformRequest.concat(
                    (data, headers) => {
                        if (typeof data === 'string' && data.length > 1024) {
                            headers['Content-Encoding'] = 'gzip';
                            return gzip(data);
                        } else {
                            headers['Content-Encoding'] = undefined;
                            return data;
                        }
                    }
                )
            }).then(response => {
                const data = response.data;
                this.errorMessage = "";
                this.inSearch = false;
                if (data.status == "PENDING" || data.status == "RUNNING") {
                    this.addToHistory(data.id);
                    this.$router.push({
                        name: "queue",
                        params: { ticket: data.id }
                    });
                } else if (data.status == "COMPLETE") {
                    this.addToHistory(data.id);
                    this.$router.push({
                        name: "result",
                        params: { ticket: data.id, entry: 0 }
                    });
                } else {
                    this.errorMessage = "Error loading search result";
                }
            }).catch(() => {
                this.errorMessage = "Error loading search result";
            }).finally(() => {
                this.inSearch = false;
            });
        },
        fileDrop(event) {
            event.preventDefault();
            event.stopPropagation();

            var dataTransfer = event.dataTransfer || event.target;
            if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
                this.upload(dataTransfer.files);
            }
        },
        upload(files) {
            var reader = new FileReader();
            reader.onload = e => {
                this.query = e.target.result;
            };
            reader.readAsText(files[0]);
        },
        addToHistory(uuid) {
            if (!uuid) {
                return;
            }

            let history;
            if (localStorageEnabled && localStorage.history) {
                history = JSON.parse(localStorage.history);
            } else {
                history = [];
            }

            let found = -1;
            for (let i in history) {
                if (history[i].id == uuid) {
                    found = i;
                    break;
                }
            }

            if (found == -1) {
                history.unshift({ time: +new Date(), id: uuid });
            } else {
                let tmp = history[found];
                tmp.time = +new Date();
                history.splice(found, 1);
                history.unshift(tmp);
            }

            if (localStorageEnabled) {
                localStorage.history = JSON.stringify(history);
            }
        }
    }
};
</script>

<style>

.query-panel .actions button {
    margin: 5px 5px 5px 0;
}

</style>

<style scoped>
.query-panel .actions {
    flex: 0;
    padding-top: 7px;
}

.marv-bg .input-group__input {
    max-height: inherit;
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

.marv-bg >>> textarea {
    height: 100%;
    min-height: 270px;
    background-image: url("./assets/marv-search-gray.png");
    background-repeat: no-repeat;
    background-position: right 15px bottom -10px;
    background-size: 200px;
    line-height: 1.5;
}

code {
    font-size: 0.8em;
}

.marv-bg >>> .v-input__control, .marv-bg >>> .v-input__slot, .marv-bg >>> .v-text-field__slot {
    flex: 1;
    align-self: stretch;
}

.theme--dark .v-input label {
    color: #FFFFFFB3;
}

.theme--light .v-input label {
    color: #00000099;
}

</style>

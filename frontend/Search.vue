<template>
    <v-container grid-list-md fluid px-2 py-1 class="search-component">
        <v-layout wrap>
            <v-flex xs12 md8>
                <panel class="query-panel d-flex fill-height" fill-height>
                    <template slot="header">
                        Queries
                    </template>
                    <template slot="toolbar-extra">
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Enter a list of either protein or nucleotide sequences in FASTA format or upload a FASTA file.</span>
                        </v-tooltip>
                    </template>
                    <template slot="content">
                        <v-textarea
                            aria-label="Enter a list of either protein or nucleotide sequences in FASTA format or upload a FASTA file." 
                            class="marv-bg mono"
                            hide-details 
                            v-model="query" 
                            @dragover.prevent 
                            @drop="fileDrop($event)" 
                            placeholder="Enter a list of either protein or nucleotide sequences in FASTA format or upload a FASTA file." 
                            spellcheck="false">
                        </v-textarea>

                        <div class="actions">
                        <v-dialog v-if="!$ELECTRON" v-model="showCurl" absolute :disabled="searchDisabled">
                            <template v-slot:activator="{ on }">
                                <v-btn v-on="on" :disabled="searchDisabled">
                                    Get cURL Command
                                </v-btn>
                            </template>
                            <v-card>
                                <v-card-title>
                                    <div class="text-h5">cURL Command</div>
                                </v-card-title>
                                <v-card-text>
                                    Use this command to get a submit a file in fasta format to the MMseqs2 search server. Replace the 'PATH_TO_FILE' string with the path to the file.
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

                        <file-button id="file" label="Upload FASTA File" v-on:upload="upload"></file-button>
                        </div>
                    </template>
                </panel>
            </v-flex>
            <v-flex xs12 md4>
                <panel header="Search Settings">
                    <div slot="content">
                        <div class="input-group">
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <label v-on="on">Databases</label>
                                </template>
                                <span v-if="$ELECTRON">Choose the databases to search against and the result mode.</span>
                                <span v-else>Choose the databases to search against, the result mode, and optionally an email to notify you when the job is done.</span>
                            </v-tooltip>
                        </div>
                            
                        <div v-if="databases.length == 0">
                            <div :class="['alert', { 'alert-info': !dberror }, { 'alert-danger': dberror }]">
                                <span v-if="dberror">Could not query available databases!</span>
                                <span v-else>
                                    No databases found! <br />
                                    <span v-if="$ELECTRON">
                                        Go to <router-link to="preferences">Preferences</router-link> to add a database.
                                    </span>
                                </span>
                            </div>
                        </div>
                        <v-checkbox v-else v-for="(db, index) in databases" v-model="database" :key="index" :value="db.path" :label="db.name + ' ' + db.version" :append-icon="(db.status == 'ERROR' || db.status == 'UNKNOWN') ? $MDI.AlertCircleOutline : ((db.status == 'PENDING' || db.status == 'RUNNING') ? $MDI.ProgressWrench : undefined)" :disabled="db.status != 'COMPLETE'" hide-details></v-checkbox>
                        <div v-if="databasesNotReady" class="alert alert-info mt-1">
                            <span>Databases are loading...</span>
                        </div>

                        <v-radio-group v-model="mode">
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <label v-on="on">Mode</label>
                                </template>
                                <span>'All' shows all hits under an e-value cutoff. 'Greedy Best Hits' tries to cover the search query.</span>
                            </v-tooltip>
                            <v-radio value="accept" label="All Hits" hide-details>All</v-radio>
                            <v-radio value="summary" label="Greedy Best Hits" hide-details></v-radio>
                        </v-radio-group>

                        <v-tooltip v-if="!$ELECTRON" open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-text-field v-on="on" id="email" label="Notification Email (Optional)" placeholder="you@example.org" v-model="email"></v-text-field>
                            </template>
                            <span>Send an email when the job is done.</span>
                        </v-tooltip>

                        <v-btn color="primary" block large v-on:click="search" :disabled="searchDisabled"><v-icon>{{ $MDI.Magnify }}</v-icon>Search</v-btn>
                    </div>
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
            <p class="text-subtitle-2 mb-0">Mirdita M., Steinegger M., and Söding J., <a href="https://doi.org/10.1093/bioinformatics/bty1057" target="_blank" rel="noopener">MMseqs2 desktop and local web server app for fast, interactive sequence searches</a>, <i>Bioinformatics</i>, 2019.</p>
        </v-card-title>
        </v-card>
    </v-flex>
    </v-layout>
    </v-container>
</template>

<script>
import Panel from "./Panel.vue";
import FileButton from "./FileButton.vue";

export default {
    name: "search",
    components: { Panel, FileButton },
    data() {
        return {
            dberror: false,
            databases: [],
            inSearch: false,
            status: {
                type: "",
                message: ""
            },
            showCurl: false,
            mode_: null,
            email_: null,
            query_: null,
            database_: null
        };
    },
    computed: {
        mode: {
            get: function() {
                this.mode_ = this.$localStorage.get("mode", "accept");
                return this.mode_;
            },
            set: function(value) {
                this.$localStorage.set("mode", value);
                this.mode_ = value;
            }
        },
        email: {
            get: function() {
                this.email_ = this.$localStorage.get("email", "");
                return this.email_;
            },
            set: function(value) {
                this.$localStorage.set("email", value);
                this.email_ = value;
            }
        },
        query: {
            get: function() {
                if (this.query_ == null) {
                this.query_ = this.$localStorage.get(
                    "query",
                    ">TEST\nMPKIIEAIYENGVFKPLQKVDLKEGEKAKIVLESISDKTFGILKASETEIKKVLEEIDDFWGVC"
                );
                }
                return this.query_;
            },
            set: function(value) {
                // Fix query to always be a valid FASTA sequence
                if (typeof(value) === 'string' && value != '') {
                    value = value.trim();
                    if (value[0] != '>') {
                        value = '>unnamed\n' + value;
                    }
                }
                this.query_ = value;
                this.$localStorage.set("query", this.query_);
            }
        },
        database: {
            get: function() {
                if (this.database_ == null) {
                    this.database_ = JSON.parse(this.$localStorage.get("database", "[]"));
                }
                return this.database_;
            },
            set: function(value) {
                this.$localStorage.set("database", JSON.stringify(value));
                this.database_ = value;
            }
        },
        databasesNotReady: function() {
            return this.databases.some((db) => db.status == "PENDING" || db.status == "RUNNING");
        },
        searchDisabled() {
            return (
                this.inSearch || this.database.length == 0 || this.query.length == 0
            );
        },
        error() {
            return this.status.type == "error";
        }
    },
    localStorage: {
        history: {
            type: Array,
            default: []
        }
    },
    created() {
        this.fetchData();
    },
    watch: {
        $route: "fetchData"
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
            this.$http.get("api/databases/all").then(
                response => {
                    response.json().then(data => {
                        this.dberror = false;
                        this.databases = data.databases;

                        if (this.database === null || this.database.length == 0) {
                            const dbs = this.databases.filter((element) => { return element.default == true });
                            this.database = dbs.map((db) => { return db.path; });
                        } else {
                            const paths = this.databases.map((db) => { return db.path; });
                            this.database = this.database.filter((elem) => {
                                return paths.includes(elem);
                            });
                        }
                        this.database = this.databases.filter((db) => { return db.status == "PENDING" || db.status == "RUNNING"; });
                        if (this.databases.some((db) => { return db.status == "PENDING" || db.status == "RUNNING"; })) {
                            setTimeout(this.fetchData.bind(this), 1000);
                        }
                    }).catch(() => { this.dberror = true; });
                }).catch(() => { this.dberror = true; });
        },
        search(event) {
            var data = {
                q: this.query,
                database: this.database,
                mode: this.mode
            };
            if (!__ELECTRON__ && this.email != "") {
                data.email = this.email;
            }
            this.inSearch = true;
            this.$http.post("api/ticket", data, { emulateJSON: true }).then(
                response => {
                    response.json().then(data => {
                        this.status.message = this.status.type = "";
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
                            this.resultError("Error loading search result")();
                        }
                }).catch(this.resultError("Error loading search result"));
            }).catch(this.resultError("Error loading search result"));
        },
        resultError(message) {
            return () => {
                this.status.type = "error";
                this.status.message = message;
                this.inSearch = false;
            }
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

            let history = this.$localStorage.get("history");

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

            this.$localStorage.set("history", history);
        }
    }
};
</script>

<style scoped>
.query-panel .actions {
    flex: 0;
    padding-top: 7px;
}

@media screen and (min-width: 961px) {
.query-panel .actions {
    max-height: 48px;
}
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

</style>

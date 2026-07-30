<template>
<v-container grid-list-md fluid px-2 py-1 class="search-component">
    <v-layout wrap>
    <v-flex xs12>
        <panel class="query-panel d-flex fill-height" fill-height>
        <template slot="header">
            Input RNA
            <template v-if="!$vuetify.breakpoint.smAndDown">
                sequence (FASTA)
            </template>
        </template>
        <template slot="toolbar-extra">
            <api-dialog
                :disabled="searchDisabled"
                :email="email"
                :database="database"
                :taxfilter="taxFilter ? taxFilter.value : ''"
                suffix="riboseek"></api-dialog>
            <v-icon v-if="query.length > 0" title="Clear" @click="query = ''" style="margin-right: 16px">{{ $MDI.Delete }}</v-icon>
            <v-tooltip open-delay="300" top>
                <template v-slot:activator="{ on }">
                    <v-icon v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                </template>
                <span v-html="$STRINGS.QUERIES_HELP_RIBOSEEK"></span>
            </v-tooltip>
        </template>
        <template slot="content">
            <query-textarea
                v-model="query"
                :placeholder="$STRINGS.QUERIES_HELP_RIBOSEEK"></query-textarea>

            <div class="actions input-buttons-panel">
                <div class="input-buttons-left">
                    <file-button id="file" :label="$STRINGS.UPLOAD_LABEL_RIBOSEEK" v-on:upload="upload"></file-button>
                    <file-button id="localFile" label="Upload previous results" @upload="uploadJSON"></file-button>
                </div>
            </div>
        </template>
        </panel>
    </v-flex>
    <v-flex xs12>
        <panel collapsible collapsed render-collapsed>
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
            <databases
                :selected="database"
                :all-databases="databases"
                @update:selected="database = $event"
                @update:all-databases="databases = $event"
                :hideEmail="hideEmail"
                :rna-only="true"
                ></databases>

            <div style="margin-top:2em;">
                <TaxonomyAutocomplete v-model="taxFilter"></TaxonomyAutocomplete>
            </div>

            <v-tooltip open-delay="300" top>
                <template v-slot:activator="{ on }">
                    <v-checkbox v-model="iterativeSearch">
                        <template slot="label">
                            <label v-on="on">
                            Iterative search
                            <v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                        </label>
                        </template>
                    </v-checkbox>
                </template>
                <span>Improve sensitivity of search by performing an iterative search (--num-iterations 0).</span>
            </v-tooltip>

            <v-tooltip v-if="!$ELECTRON && !hideEmail" open-delay="300" top>
                <template v-slot:activator="{ on }">
                    <v-text-field v-on="on" label="Notification Email (Optional)" placeholder="you@example.org" v-model="email"></v-text-field>
                </template>
                <span>Send an email when the job is done.</span>
            </v-tooltip>
        </div>
        </panel>
    </v-flex>
    <v-flex>
        <panel>
        <template slot="content">
            <div class="actions" :style="!$vuetify.breakpoint.xsOnly ?'display:flex; align-items: center;' : null">
            <v-item-group class="v-btn-toggle">
                <v-btn color="primary" :block="false" x-large v-on:click="search" :disabled="searchDisabled" :loading="inSearch"><v-icon>{{ $MDI.Magnify }}</v-icon>&nbsp;Search</v-btn>
            </v-item-group>
            <div :style="!$vuetify.breakpoint.xsOnly ? 'margin-left: 1em;' : 'margin-top: 1em;'">
                <span><strong>Summary</strong></span><br>
                Search <template v-if="taxFilter">
                    <strong>{{ taxFilter.text }}</strong> in
                </template>
                <template v-if="databases.length > 0 && database.length == databases.length">
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
                    <template v-if="database.length > 0">
                    ({{
                        databases.filter(db => database.includes(db.path)).map(db => db.name).sort().join(", ")
                    }})
                    </template>
                </template> with Riboseek <template v-if="iterativeSearch">in iterative  mode</template>.
                <div v-if="errorMessage != ''" class="v-alert v-alert--outlined warning--text mt-2">
                    <span>{{ errorMessage }}</span>
                </div>
            </div>
            </div>
        </template>
        </panel>
    </v-flex>
    </v-layout>
    <reference :reference="$STRINGS.CITATION_RIBOSEEK"></reference>
</v-container>
</template>

<script>
import Panel from "./Panel.vue";
import FileButton from "./FileButton.vue";
import Reference from "./Reference.vue";
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';
import { djb2, parseResultsListRiboseek, readUploadedText } from './Utilities.js';
import { AxiosCompressRequest } from './lib/AxiosCompressRequest.js';
import ApiDialog from './ApiDialog.vue';
import { StorageWrapper, HistoryMixin } from './lib/HistoryMixin.js';
import { BlobDatabase } from './lib/BlobDatabase.js';
import Databases from './Databases.vue';
import QueryTextarea from "./QueryTextarea.vue";

const db = BlobDatabase();
const storage = new StorageWrapper("riboseek");

export default {
    name: "RiboseekSearch",
    tool: "riboseek",
    mixins: [ HistoryMixin ],
    components: {
        Panel,
        FileButton,
        TaxonomyAutocomplete,
        Reference,
        ApiDialog,
        Databases,
        QueryTextarea
    },
    data() {
        return {
            inSearch: false,
            errorMessage: "",
            email: storage.getItem('email') || "",
            hideEmail: true,
            query: "",
            database: JSON.parse(storage.getItem('database') || '[]'),
            databases: JSON.parse(storage.getItem('databases') || '[]'),
            iterativeSearch: JSON.parse(storage.getItem('iterativeSearch') || 'false'),
            taxFilter: JSON.parse(storage.getItem('taxFilter') || 'null'),
        };
    },
    async mounted() {
        let query = await db.getItem('riboseek.query');
        if (query && query.length > 0) {
            this.query = query;
        } else {
            this.query = this.$STRINGS.QUERY_DEFAULT_RIBOSEEK;
        }
    },
    computed: {
        searchDisabled() {
            return (
                this.inSearch || this.database.length == 0 || this.databases.length == 0 || this.query.length == 0
            );
        },
    },
    watch: {
        email(value) {
            storage.setItem('email', value);
        },
        query(value) {
            db.setItem('riboseek.query', value);
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
                email: this.email
            };
            if (typeof(request.q) === 'string' && request.q != '') {
                request.q = request.q.trim();
                if (request.q[0] != '>') {
                    request.q = '>unnamed\n' + request.q;
                }
                request.q += '\n';
            }
            if (__ELECTRON__) {
                request.email = "";
            }
            if (this.taxFilter) {
                request.taxfilter = this.taxFilter.value;
            }
            if (this.iterativeSearch) {
                request.iterativesearch = this.iterativeSearch;
            }
            try {
                this.inSearch = true;
                const response = await this.$axios.post("api/ticket/riboseek", convertToQueryUrl(request), {
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
                            name: "riboseekresult", params: { ticket: response.data.id, entry: 0 }
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
        async upload(files) {
            try {
                this.query = await readUploadedText(files[0]);
            } catch (error) {
                this.errorMessage = "Error reading uploaded file";
                throw error;
            }
        },
        uploadJSON(files) {
            let file = files[0];
            let hash = djb2(file.name);
            let fr = new FileReader();
            fr.addEventListener("load", (e) => {
                let data = parseResultsListRiboseek(JSON.parse(e.target.result));
                this.$root.userData = data;
                this.$router.push({
                    name: 'riboseekresult', params: { ticket: `user-${hash}`, entry: 0 }
                }).catch(error => {});
            });
            fr.readAsText(file);
        },
    }
};
</script>

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

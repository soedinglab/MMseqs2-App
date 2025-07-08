<template>
    <v-container grid-list-md fluid px-2 py-1 class="search-component">
        <v-layout wrap>
        <v-flex xs12>
            <panel class="query-panel d-flex fill-height" fill-height>
            <template slot="header">
                Input protein motif structure (PDB/CIF)
            </template>
            <template slot="toolbar-extra">
                <api-dialog
                    :disabled="searchDisabled"
                    :email="email"
                    :database="database"
                    >
                    <!-- :mode="mode" -->
                </api-dialog>
                <v-icon v-if="query.length > 0" title="Clear" @click="query = ''" style="margin-right: 16px">{{ $MDI.Delete }}</v-icon>
                <v-tooltip open-delay="300" top>
                    <template v-slot:activator="{ on }">
                        <v-icon v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon>
                    </template>
                    <span v-html="$STRINGS.MOTIF_HELP"></span>
                </v-tooltip>
            </template>

            <template slot="content">
                <div class="query-textarea-wrapper">
                    <query-textarea
                        :loading="accessionLoading"
                        v-model="query">
                    </query-textarea>
                </div>

                <div class="motif-select-wrapper">
                    <v-text-field 
                        v-model="motif"
                        :color="isMotifValid && motifLen <= 32 ? 'primary' : 'error'"
                        :error-messages="motifError"
                        clearable
                    >
                        <template v-slot:append-outer>
                            <motif-selection
                                :disabled="!query"
                                :chain-map="chainMap"
                                :error="motifError"
                                v-model="motif"
                            >
                            </motif-selection>
                            <ligand-motif-selection
                                :disabled="!query"
                                :query-structure="queryStructure"
                                v-model="motif"
                            ></ligand-motif-selection>
                        </template>
                        <template v-slot:label>
                            <span style="font-size: 1.3em;">Selected Motif</span>
                        </template>
                    </v-text-field>
                </div>

                <div class="actions input-buttons-panel">
                    <div class="input-buttons-left">
                        <load-acession-button @select="query = $event" @loading="accessionLoading = $event" :preload-source="preloadSource" :preload-accession="preloadAccession"></load-acession-button>
                        <file-button id="file" :label="$STRINGS.UPLOAD_LABEL" v-on:upload="upload"></file-button>
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
                    :motif-only="true"
                    ></databases>
    
                <!-- <v-radio-group v-model="mode"> // TODO: add mode
                    <v-tooltip open-delay="300" top>
                        <template v-slot:activator="{ on }">
                            <label v-on="on">Mode&nbsp;<v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{ $MDI.HelpCircleOutline }}</v-icon></label>
                        </template>
                        <span v-html="$STRINGS.MODE_HELP_FOLDDISCO"></span>
                    </v-tooltip>
                    <v-radio hide-details
                                    v-for="i in ($STRINGS.MODE_COUNT_FOLDDISCO - 0)"
                                    :key="i"
                                    :value="$STRINGS['MODE_KEY_FOLDDISCO_' + i]"
                                    :label="$STRINGS['MODE_TITLE_FOLDDISCO_' + i]"
                                    ></v-radio>
                </v-radio-group> -->
    
                <!-- <TaxonomyAutocomplete v-model="taxFilter"></TaxonomyAutocomplete> -->
    
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
                    <v-btn color="warning" v-if="motifLen > 32" :block="false" x-large v-on:click="goToFoldseek"><v-icon>{{ $MDI.Monomer }}</v-icon>&nbsp;Go to Foldseek</v-btn>
                </v-item-group>
                <div :style="!$vuetify.breakpoint.xsOnly ? 'margin-left: 1em;' : 'margin-top: 1em;'">
                    <span><strong>Summary</strong></span><br>
                    Search 
                    <!-- <template v-if="taxFilter">
                        <strong>{{ taxFilter.text }}</strong> in
                    </template> -->
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
                    </template> with FoldDisco.
                    <div v-if="errorMessage != ''" class="v-alert v-alert--outlined warning--text mt-2">
                        <span>{{ errorMessage }}</span>
                    </div>
                </div>
                </div>
            </template>
            </panel>
        </v-flex>
        </v-layout>
        <reference :reference="$STRINGS.CITATION_FOLDDISCO"></reference>
    </v-container>
</template>
    
<script>
import Panel from "./Panel.vue";
import FileButton from "./FileButton.vue";
import LoadAcessionButton from './LoadAcessionButton.vue';
import Reference from "./Reference.vue";
import { AxiosCompressRequest } from './lib/AxiosCompressRequest.js';
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';
import { threeToOne } from './Utilities.js';
import ApiDialog from './ApiDialog.vue';
import { StorageWrapper, HistoryMixin } from './lib/HistoryMixin.js';
import { BlobDatabase } from './lib/BlobDatabase.js';
import Databases from './Databases.vue';
import QueryTextarea from "./QueryTextarea.vue";
import {autoLoad} from 'ngl';
import MotifSelection from "./MotifSelection.vue";
import LigandMotifSelection from "./LigandMotifSelection.vue";

const db = BlobDatabase();
const storage = new StorageWrapper("folddisco");

async function getStructure(data) {
    var ext = 'pdb';
    if (data[0] == "#" || data.startsWith("data_")) {
        ext = 'cif';
        data = data.replaceAll("_chem_comp.", "_chem_comp_SKIP_HACK.");
    }
    var blob = new Blob([data], { type: 'text/plain' });
    var promise = autoLoad(blob, {ext : ext, name: 'query', firstModelOnly: true});
    return promise.then(structure => structure.getStructure());
}

function setDefaultMotif(structure) {
    if (!structure) {
        return;
    }

    var motifList = new Set(); 
    structure.eachResidue(r => {
        motifList.add(`${r.chainname}${r.resno}`);
    });
    return Array.from(motifList).join(',');
}

export default {
    name: "folddisco",
    mixins: [ HistoryMixin ],
    components: { 
        Panel,
        FileButton,
        LoadAcessionButton,
        TaxonomyAutocomplete,
        Reference,
        ApiDialog,
        Databases,
        QueryTextarea,
        MotifSelection,
        LigandMotifSelection,
    },
    data() {
        return {
            inSearch: false,
            errorMessage: "",
            mode: storage.getItem('mode') || (this.$STRINGS.MODE_DEFAULT_KEY_FOLDDISCO),
            modes: Array.from({length: this.$STRINGS.MODE_COUNT_FOLDDISCO - 0}, (_, i) => i + 1)
                    .reduce((dict, i, _)  => { dict[this.$STRINGS['MODE_KEY_FOLDDISCO_' + i]] = this.$STRINGS['MODE_TITLE_FOLDDISCO' + i]; return dict; }, {}),
            email: storage.getItem('email') || "",
            hideEmail: true,
            query: "",
            queryStructure: null,
            database: JSON.parse(storage.getItem('database') || '[]'),
            databases: JSON.parse(storage.getItem('databases') || '[]'),
            // taxFilter: JSON.parse(storage.getItem('taxFilter') || 'null'),
            predictable: false,
            accessionLoading: false,
            motif: storage.getItem('motif') || "",
        };
    },
    async mounted() {
        if (this.preloadAccession.length > 0) {
            this.query = "";
            return;
        }
        let query = await db.getItem('folddisco.query');
        if (query && query.length > 0) {
            this.query = query;
        } else {
            this.query = this.$STRINGS.MOTIF_DEFAULT; // 1G2F: zinc finger
        }
    },
    computed: {
        searchDisabled() {
            return (
                this.inSearch || this.database.length == 0 || this.databases.length == 0 || this.query.length == 0 || this.predictable || !this.isMotifValid || this.motifLen > 32
            );
        },
        preloadSource() {
            return this.$route.query.source || "";
        },
        preloadAccession() {
            return this.$route.query.accession || "";
        },
        motifLen() {
            if (!this.motif) {
                return 0;
            }
            return new Set(this.motif.split(',').filter(m => m.trim() != '')).size;
        },
        isMotifValid() {
            if (!this.queryStructure || !this.motif) {
                return false;
            }
            var motifSet = new Set(this.motif.split(',').map(m => m.trim()));
            this.queryStructure.eachResidue(r => {
                const onlyResno = `${r.resno}`;
                const chainResno = `${r.chainname}${r.resno}`;
                if (motifSet.has(chainResno)) {
                    motifSet.delete(chainResno);
                } else if (motifSet.has(onlyResno)) {
                    motifSet.delete(onlyResno);
                }
            });
            return motifSet.size == 0;
        },
        motifError() {
            if (this.motif == null || this.motif == '') {
                return;
            }
            if (!this.isMotifValid) {
                return 'Invalid motif';
            }
            if (this.motifLen > 32) {
                return `Motif too long (${this.motifLen} / 32 residues)`;
            }
        },
        chainMap() {
            if (!this.queryStructure) {
                return {};
            }

            let chains = {}
            this.queryStructure.eachResidue(r => {
                if (r.hetero != 1 && r.isProtein()) {
                    let res = [r.chainname, r.resno, threeToOne[r.resname], r.sstruc];
                    if (!(r.chainname in chains)) {
                        chains[r.chainname] = [res];
                    } else {
                        chains[r.chainname].push(res);
                    }
                }
            });

            const sortedKeys = Object.keys(chains).sort();
            const sortedChains = {};
            for (const key of sortedKeys) {
                sortedChains[key] = chains[key];
            }
            return sortedChains;
        },
    },
    watch: {
        // mode(value) {
        //     storage.setItem('mode', value);
        // },
        email(value) {
            storage.setItem('email', value);
        },
        motif(value) {
            storage.setItem('motif', value);
        },
        async query(value) {
            let prev = await db.getItem('folddisco.query')
            db.setItem('folddisco.query', value);
            this.queryStructure = await getStructure(this.query);
            if (prev && prev == value) {
                return;
            }
            this.motif = setDefaultMotif(this.queryStructure);
        },
        database(value) {
            storage.setItem('database', JSON.stringify(value));
        },
        databases(value) {
            storage.setItem('databases', JSON.stringify(value));
        },
        // taxFilter(value) {
        //     storage.setItem('taxFilter', JSON.stringify(value));
        // },
    },
    methods: {
        async search() {
            var request = {
                q: this.query,
                database: this.database,
                // mode: this.mode,
                email: this.email,
                motif: this.motif
            };
            if (typeof(request.q) === 'string' && request.q != '') {
                if (request.q[request.q.length - 1] != '\n') {
                    request.q += '\n';
                }
            }

            if (__ELECTRON__) {
                request.email = "";
            }
            // if (this.taxFilter) {
            //     request.taxfilter = this.taxFilter.value;
            // }
            try {
                this.inSearch = true;
                const response = await this.$axios.post("api/ticket/folddisco", convertToQueryUrl(request), {
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
                            name: "folddiscoresult", params: { ticket: response.data.id}
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
            reader.onload = async e => {
                this.query = e.target.result;
            };
            reader.readAsText(files[0]);
        },
        async goToFoldseek() {
            await db.setItem('query', this.query);
            this.$router.replace('/search');
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

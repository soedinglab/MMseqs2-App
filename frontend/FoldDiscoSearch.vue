<template>
    <v-container grid-list-md fluid px-2 py-1 class="search-component">
        <v-layout wrap>
        <v-flex xs12>
            <panel class="query-panel d-flex fill-height" fill-height>
            <template slot="header">
                <template v-if="$vuetify.breakpoint.smAndDown">
                    Protein & motif
                </template>
                <template v-else>
                    Input protein motif structure (PDB/CIF)
                </template>
            </template>
            <template slot="toolbar-extra">
                <api-dialog
                    :disabled="searchDisabled"
                    :email="email"
                    :database="database"
                    :motif="motif"
                    suffix="folddisco"
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
                                :query-structure="queryStructure"
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
                        <load-acession-button
                            @select="query = $event"
                            @motif="onMotifSelect"
                            @loading="accessionLoading = $event"
                            :preload-source="preloadSource"
                            :preload-accession="preloadAccession"
                            :extra-enabled="['QBioLip']"
                        ></load-acession-button>
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
                    </template> with Folddisco.
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
import { readUploadedText } from './Utilities.js';
import { AxiosCompressRequest } from './lib/AxiosCompressRequest.js';
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';
import ApiDialog from './ApiDialog.vue';
import { StorageWrapper, HistoryMixin } from './lib/HistoryMixin.js';
import { BlobDatabase } from './lib/BlobDatabase.js';
import Databases from './Databases.vue';
import QueryTextarea from "./QueryTextarea.vue";
import MotifSelection from "./MotifSelection.vue";
import LigandMotifSelection from "./LigandMotifSelection.vue";

const db = BlobDatabase();
const storage = new StorageWrapper("folddisco");

function makeStructureFromAtoms(atoms) {
    const residues = new Map();
    for (const atom of atoms) {
        const key = `${atom.chainname}:${atom.resno}:${atom.resname}:${atom.record}`;
        if (!residues.has(key)) {
            residues.set(key, {
                chainname: atom.chainname,
                resno: atom.resno,
                resname: atom.resname,
                record: atom.record,
                atoms: [],
                isPolymer: () => atom.record === 'ATOM',
                isWater: () => ['HOH', 'WAT', 'H2O'].includes(atom.resname),
            });
        }
        residues.get(key).atoms.push(atom);
    }
    return {
        residues: Array.from(residues.values()),
        atoms,
        eachResidue(callback) {
            this.residues.forEach(callback);
        },
    };
}

function parsePdbStructure(data) {
    const atoms = [];
    for (const line of String(data || '').split('\n')) {
        const record = line.slice(0, 6).trim();
        if (record !== 'ATOM' && record !== 'HETATM') continue;
        const atom = {
            index: atoms.length,
            record,
            atomname: line.slice(12, 16).trim(),
            resname: line.slice(17, 20).trim(),
            chainname: line.slice(21, 22).trim() || '_',
            resno: Number.parseInt(line.slice(22, 26).trim(), 10),
            x: Number.parseFloat(line.slice(30, 38).trim()),
            y: Number.parseFloat(line.slice(38, 46).trim()),
            z: Number.parseFloat(line.slice(46, 54).trim()),
        };
        if (!Number.isFinite(atom.resno)) continue;
        atoms.push(atom);
    }
    return makeStructureFromAtoms(atoms);
}

function tokenizeCif(text) {
    const tokens = [];
    const re = /'(?:[^']|'')*'|"(?:[^"]|"")*"|\S+/g;
    for (const line of String(text || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        let match;
        while ((match = re.exec(line))) {
            let token = match[0];
            if ((token[0] === "'" && token[token.length - 1] === "'")
                || (token[0] === '"' && token[token.length - 1] === '"')) {
                token = token.slice(1, -1);
            }
            tokens.push(token);
        }
    }
    return tokens;
}

function parseCifStructure(data) {
    const tokens = tokenizeCif(data);
    const atoms = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] !== 'loop_') continue;
        const headers = [];
        i++;
        while (i < tokens.length && tokens[i].startsWith('_')) {
            headers.push(tokens[i]);
            i++;
        }
        if (!headers.some(header => header.startsWith('_atom_site.'))) {
            while (i < tokens.length && tokens[i] !== 'loop_') i++;
            i--;
            continue;
        }
        const h = Object.fromEntries(headers.map((header, index) => [header, index]));
        const width = headers.length;
        while (i + width <= tokens.length && tokens[i] !== 'loop_') {
            if (tokens[i]?.startsWith('_')) break;
            const row = tokens.slice(i, i + width);
            const record = row[h['_atom_site.group_PDB']] || 'ATOM';
            const resno = Number.parseInt(row[h['_atom_site.auth_seq_id']] || row[h['_atom_site.label_seq_id']], 10);
            const atom = {
                index: atoms.length,
                record,
                atomname: row[h['_atom_site.auth_atom_id']] || row[h['_atom_site.label_atom_id']] || '',
                resname: row[h['_atom_site.auth_comp_id']] || row[h['_atom_site.label_comp_id']] || '',
                chainname: row[h['_atom_site.auth_asym_id']] || row[h['_atom_site.label_asym_id']] || '_',
                resno,
                x: Number.parseFloat(row[h['_atom_site.Cartn_x']]),
                y: Number.parseFloat(row[h['_atom_site.Cartn_y']]),
                z: Number.parseFloat(row[h['_atom_site.Cartn_z']]),
            };
            if (Number.isFinite(atom.resno) && Number.isFinite(atom.x) && Number.isFinite(atom.y) && Number.isFinite(atom.z)) {
                atoms.push(atom);
            }
            i += width;
        }
        i--;
    }
    return makeStructureFromAtoms(atoms);
}

function parseStructure(data) {
    const text = String(data || '').trimStart();
    return text[0] === '#' || text.startsWith('data_')
        ? parseCifStructure(text)
        : parsePdbStructure(text);
}

function setDefaultMotif(structure) {
    if (!structure) {
        return;
    }

    var motifList = new Set(); 
    structure.eachResidue(r => {
        if (r.isPolymer()) motifList.add(`${r.chainname}${r.resno}`);
    });
    return Array.from(motifList).join(',');
}

export default {
    name: "FolddiscoSearch",
    tool: "folddisco",
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
            pendingMotif: null,
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
            let valid = true;
            let validSubstitution = /[A-Za-z]/;
            let motifs = this.motif.split(',')
                .map(m => {
                    let chunks = m.trim().split(':');
                    if (chunks.length > 2) {
                        valid = false;
                        return false;
                    }
                    if (chunks.length > 1 && !validSubstitution.test(chunks[1])) {
                        valid = false;
                        return false; 
                    }
                    return chunks[0];
                });
            if (!valid) {
                return false;
            }

            let motifSet = new Set(motifs);
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
            this.queryStructure = parseStructure(this.query);
            if (prev && prev == value) {
                return;
            }
            if (this.pendingMotif !== null && this.pendingMotif.query === value) {
                this.motif = this.pendingMotif.motif;
            } else {
                this.motif = setDefaultMotif(this.queryStructure);
            }
            this.pendingMotif = null;
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
        // In a structure that arrives with its own motif, the structure is emitted first
        // Tag the motif to that structure and apply it right away
        onMotifSelect(motif) {
            this.pendingMotif = { query: this.query, motif };
            this.motif = motif;
        },
        async upload(files) {
            try {
                this.query = await readUploadedText(files[0]);
            } catch (error) {
                this.errorMessage = "Error reading uploaded file";
                throw error;
            }
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

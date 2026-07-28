<template>
    <v-dialog v-model="show" absolute width="unset">
        <template v-slot:activator="{ on }">
            <v-btn v-on="on" :disabled="loading" :block="$vuetify.breakpoint.xsOnly" :color="error ? 'error' : null">
                <template v-if="loading">
                    <v-icon>{{ $MDI.ProgressWrench }}</v-icon>&nbsp;
                </template>
                Load accession
            </v-btn>
        </template>
        <v-card>
            <form @submit.prevent="loadSelected">
            <v-card-title>
                <div class="text-h5">Load accession</div>
            </v-card-title>
            <v-card-text>
                <v-select :items="sources" v-model="source" label="Source"></v-select>
                <template v-if="source == 'QBioLip'">
                    <v-text-field ref="accession" label="PDB ID" v-model="accession" @keydown="error = false"></v-text-field>
                    <div v-if="results !== null && results.length === 0" class="text-center my-4 grey--text">
                        No binding sites found for this PDB ID.
                    </div>
                    <v-list v-else-if="results && results.length > 0" dense class="qbiolip-result-list">
                        <v-subheader>Select a binding site to load its structure and motif</v-subheader>
                        <v-list-item
                            v-for="(item, i) in results"
                            :key="i"
                            @click="selectResult(item)"
                            :disabled="loading"
                            class="qbiolip-motif-item"
                        >
                            <v-list-item-content>
                                <v-list-item-title>
                                    <strong>Ligand:</strong> {{ item.Ligand.ligname }}
                                    <span class="grey--text">({{ item.Receptor.assembly }})</span>
                                    <v-chip x-small class="ml-1" v-if="item.Complex.relvant === '1'" color="success" text-color="white">biologically relevant</v-chip>
                                </v-list-item-title>
                                <v-list-item-subtitle>
                                    <strong>Binding site ({{ bindingResidues(item).length }}):</strong> {{ bindingResidues(item).join(', ') }}
                                </v-list-item-subtitle>
                            </v-list-item-content>
                        </v-list-item>
                    </v-list>
                </template>
                <v-text-field v-else ref="accession" label="Accession" v-model="accession" @keydown="error = false"></v-text-field>
                <v-sheet v-if="error" style="display: flex; align-items: center; justify-content: center;" color="error" rounded width="100%" height="48">{{error}}</v-sheet>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click.native="show = false">Cancel</v-btn>
                <v-btn type="submit" color="primary" text @click.native="loadSelected" :disabled="this.accession.length == 0 || loading">{{ source == 'QBioLip' ? 'Search' : 'Load' }}</v-btn>
            </v-card-actions>
            </form>
        </v-card>
    </v-dialog>
</template>

<script>
import { BASE_SOURCES, EXTRA_SOURCES, fetchAccession, qbiolipBsToMotif,
    searchBindingSites, fetchBindingSite } from './lib/accession.js';

export default {
    name: 'load-accession-button',
    props: {
        preloadAccession: { default: '', type: String },
        preloadSource: { default: '', type: String },
        multiple: { default: false, type: Boolean },
        extraEnabled: { default: () => [], type: Array },
    },
    data() {
        return {
            loading: false,
            error: "",
            show: false,
            source: 'PDB',
            accession: '',
            results: null,
            // Shared with the search-page API via lib/accession.js.
            sources: [...BASE_SOURCES],
            extraSources: EXTRA_SOURCES
        };
    },
    mounted() {
        for (let i in this.extraEnabled) {
            let s = this.extraEnabled[i];
            console.log(s, this.extraSources)
            if (s in this.extraSources) {
                this.sources.push(this.extraSources[s])
            }
        }
        if (this.preloadAccession && this.preloadAccession.length > 0 && this.preloadSource && this.preloadSource.length > 0) {
            if (this.multiple) {
                const accessions = this.preloadAccession.split(/[,\s]+/)
                    .filter(x => x.length)
                    .map(x => x.replaceAll(/[^A-Za-z0-9_]/g, ''));
                if (accessions.length === 0) {
                    return;
                }

                let sources = this.preloadSource.split(/[,\s]+/).filter(x => x.length);
                if (sources.length == 1) {
                    sources = Array(accessions.length).fill(sources[0]);
                }
                if (sources.length != accessions.length) {
                    return;
                }
                const valid = this.sources.map(e => e.value);
                if (!sources.every(s => valid.includes(s))) {
                    return;
                }
                let combined = sources.map(function(e, i) {
                    return [accessions[i], e];
                });
                this.loadMany(combined);
            } else if (this.sources.map((e) => e.value).includes(this.preloadSource)) {
                this.accession = this.preloadAccession.replaceAll(/[^A-Za-z0-9_]/g, '');
                this.source = this.preloadSource;
                this.load(this.accession, this.preloadSource);
            }
        }
    },
    watch: {
        loading: function (val, old) {
            if (val != old) {
                this.$emit('loading', val);
            }
        },
        source: function (val, old) {
            if (val != old) {
                this.results = null;
                this.error = "";
            }
        },
    },
    methods: {
        loadSelected() {
            if (this.source == 'QBioLip') {
                this.search();
                return;
            }
            if (this.multiple) {
                const list = this.accession.split(/[,\s]+/).filter(x => x.length);
                if (list.length === 0) {
                    return;
                }
                let combined = list.map((e, _) => {
                    return [e, this.source];
                });
                this.loadMany(combined);
            } else {
                this.load(this.accession, this.source);
            }
        },
        fetchData(accession, source) {
            return fetchAccession(accession, source);
        },
        loadMany(list) {
            this.loading = true;
            this.error   = "";
            const jobs = list.map(a => this.fetchData(a[0].trim(), a[1].trim()));
            Promise.allSettled(jobs).then(results => {
                const ok  = results.filter(r => r.status === 'fulfilled').map(r => r.value);
                const bad = results.filter(r => r.status === 'rejected').map(r => r.reason);
                // console.log(ok);
                if (ok.length) {
                    this.$emit('select', ok);
                    this.show = false;
                }
                if (bad.length) {
                    this.error = `${bad.join(', ')} not found`;
                }
                this.loading = false;
            });
        },
        load(accession, source) {
            if (!accession) {
                return;
            }

            this.loading = true;
            this.error   = "";

            this.fetchData(accession, source)
                .then(r => {
                    this.$emit('select', r.text);
                    this.show    = false;
                    this.loading = false;
                })
                .catch(() => {
                    this.error   = "Accession not found";
                    this.loading = false;
                });
        },
        // Q-BioLiP: binding-site residues for display (label-chain letters, as
        // reported by Q-BioLiP). The final motif is auth-chain mapped on select.
        bindingResidues(item) {
        console.log(item.Complex)
            const motif = qbiolipBsToMotif(item.Complex && item.Complex.bs, null);
            return motif ? motif.split(',') : [];
        },
        // Q-BioLiP: look up binding sites for a PDB ID.
        search() {
            const id = this.accession.trim().toUpperCase();
            if (!id) {
                return;
            }

            this.loading = true;
            this.error   = "";
            this.results = null;

            searchBindingSites(id)
                .then(results => { this.results = results; })
                .catch(() => {
                    this.error = "Search failed. Please check the PDB ID and try again.";
                })
                .finally(() => {
                    this.loading = false;
                });
        },
        // Q-BioLiP: load the chosen binding site's structure and emit its motif.
        selectResult(item) {
            const assembly = item.Receptor.assembly;

            this.loading = true;
            this.error   = "";

            fetchBindingSite(item)
                .then(({ text, motif }) => {
                    this.$emit('select', text);
                    this.$emit('motif', motif);
                    this.show = false;
                })
                .catch(() => {
                    this.error = `Failed to load structure for ${assembly}.`;
                })
                .finally(() => {
                    this.loading = false;
                });
        }
    }
}
</script>

<style scoped>
.qbiolip-result-list {
    max-height: 400px;
    overflow-y: auto;
}

.qbiolip-motif-item {
    cursor: pointer;
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}

.qbiolip-motif-item:hover {
    background-color: rgba(128, 128, 128, 0.1);
}

.qbiolip-motif-item .v-list-item__subtitle {
    white-space: normal;
    overflow: hidden;
}
</style>


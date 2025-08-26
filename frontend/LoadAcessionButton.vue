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
                <v-text-field ref="accession" label="Accession" v-model="accession" @keydown="error = false"></v-text-field>
                <v-sheet v-if="error" style="display: flex; align-items: center; justify-content: center;" color="error" rounded width="100%" height="48">{{error}}</v-sheet>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click.native="show = false">Cancel</v-btn>
                <v-btn type="submit" color="primary" text @click.native="loadSelected" :disabled="this.accession.length == 0 || loading">Load</v-btn>
            </v-card-actions>
            </form>
        </v-card>
    </v-dialog>
</template>

<script>
import { create } from 'axios';

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
            sources: [
                { text: 'PDB (rcsb.org)', value: 'PDB' },
                { text: 'AlphaFoldDB (ebi.ac.uk)', value: 'AlphaFoldDB' },
                { text: 'BFVD (bfvd.foldseek.com)', value: 'BFVD' },
            ],
            extraSources: {
                'AlphaFill' : { text: 'AlphaFill (alphafill.eu)', value: 'AlphaFill' },
            }
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
    },
    methods: {
        loadSelected() {
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
            return new Promise((resolve, reject) => {
                const axios = create();
                const upper = accession.toUpperCase();

                const fail = () => reject(accession);
                if (source == "PDB") {
                    axios.get("https://files.rcsb.org/download/" + upper + ".cif")
                        .then(r => resolve({ name: upper + ".cif", text: r.data }))
                        .catch(fail);
                } else if (source == "BFVD") {
                    axios.get("https://bfvd.steineggerlab.workers.dev/pdb/" + upper + ".pdb")
                        .then(r => resolve({ name: upper + ".pdb", text: r.data }))
                        .catch(fail);
                } else if (source == "AlphaFill") {
                    axios.get("https://alphafill.eu/v1/aff/" + upper)
                        .then(r => resolve({ name: upper + ".cif", text: r.data }))
                        .catch(fail);
                } else if (source == "AlphaFoldDB") {
                    axios.get("https://alphafold.ebi.ac.uk/api/search?q=(text:*" + accession + " OR text:" + accession + "*)&type=main&start=0&rows=1")
                        .then(resp => {
                            const docs = resp.data.docs;
                            if (docs.length == 0) { 
                                fail(); 
                                return;
                            }
                            const cif = docs[0].entryId + "-model_v" + docs[0].latestVersion + ".pdb";
                            axios.get("https://alphafold.ebi.ac.uk/files/" + cif)
                                .then(r => resolve({ name: cif, text: r.data }))
                                .catch(fail);
                        })
                        .catch(fail);
                } else {
                    fail();
                }
            });
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
        }
    }
}
</script>


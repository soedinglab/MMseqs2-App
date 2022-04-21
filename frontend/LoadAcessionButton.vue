<template>
    <v-dialog v-model="show" absolute width="unset">
        <template v-slot:activator="{ on }">
            <v-btn v-on="on">
                Load accession
            </v-btn>
        </template>
        <v-card>
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
                <v-btn color="primary" text @click.native="load" :disabled="this.accession.length == 0 || loading">Load</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { create } from 'axios';

export default {
    name: 'load-accession-button',
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
            ]
        };
    },
    methods: {
        load() {
            let url;
            let fun;
            // make a new axios instance to not leak the electron access token
            const axios = create();
            const simpleFetch = response => {
                    this.$emit('select', response.data);
                    this.show = false;
                    this.loading = false;
                };
            if (this.source == "PDB") {
                url = "https://files.rcsb.org/download/" + this.accession.toUpperCase() + ".pdb";
                fun = simpleFetch;
            } else if (this.source == "AlphaFoldDB") {
                url = "https://alphafold.ebi.ac.uk/api/search?q=(text:*" + this.accession + " OR text:" + this.accession + "*)&type=main&start=0&rows=1"
                fun = response => {
                    const data = response.data;
                    const docs = data.docs;
                    if (docs.length == 0) {
                        this.error = "Accession not found";
                        this.loading = false;
                        return;
                    }
                    const cif = "https://alphafold.ebi.ac.uk/files/" + docs[0].entryId + "-model_v" + docs[0].latestVersion + ".pdb"
                    axios.get(cif)
                        .then(simpleFetch)
                        .catch(() => {
                            this.error = "Accession not found";
                            this.loading = false;
                        })
                };
            } else {
                return;
            }
            this.loading = true;
            axios.get(url)
                .then(fun)
                .catch(() => {
                    this.error = "Accession not found";
                    this.loading = false;
                })
        }
    }
}
</script>


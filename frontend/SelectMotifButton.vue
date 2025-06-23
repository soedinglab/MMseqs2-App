<template>
    <v-dialog v-model="show" absolute width="unset">
        <template v-slot:activator="{ on }">
            <v-btn v-on="on" :disabled="selecting" :block="$vuetify.breakpoint.xsOnly" :color="error ? 'error' : null">
                <template v-if="selecting">
                    <v-icon>{{ $MDI.ProgressWrench }}</v-icon>&nbsp;
                </template>
                (Optional) Select Motif
            </v-btn>
        </template>
        <v-card>
            <form @submit.prevent="select">
            <v-card-title>
                <div class="text-h6">Select Motif Residues</div>
            </v-card-title>
            <v-card-text>
                <v-btn text color="primary" style="pointer-events:none" :disabled="selecting">Specify motif chain and residues</v-btn>
                <v-text-field label="A12,A20,A43" v-model="motif" @keydown="error = false" :disabled="selecting"></v-text-field>
                <!-- <v-btn @click="select" :disabled="this.motif.length > 0 || selecting" color="primary" text>Select with structure</v-btn> -->
                <v-btn @click="select" disabled color="primary" text>Select with structure</v-btn>
                <v-sheet v-if="error" style="display: flex; align-items: center; justify-content: center;" color="error" rounded width="100%" height="48">{{error}}</v-sheet>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click.native="show = false; motif = ''">Cancel</v-btn>
                <v-btn type="submit" color="primary" text @click.native="select" :disabled="this.motif.length == 0 || selecting">Select</v-btn>
            </v-card-actions>
            </form>
        </v-card>
    </v-dialog>
</template>

<script>

export default {
    name: 'select-motif-button',
    props: {
        query: { default: '', type: String },
    },
    data() {
        return {
            selecting: false,
            error: "",
            show: false,
            motif: ''
            // source: 'PDB',
            // accession: ''
        };
    },
    mounted() {
        // RACHEL: do we need it? what's the preloadAccession and preloadSource?
    },
    watch: {
        selecting: function (val, old) {
            if (val != old) {
                this.$emit('selecting', val);
            }
        },
    },
    methods: {
        isValid(motif) {
            // TODO: check motif in the structure file
            return true;
        },
        select() {
            if (!this.motif) {
                return;
            }

            this.selecting = true;
            this.error   = "";

            if (this.isValid(this.motif)) {
                this.$emit('select', this.motif);
                this.show    = false;
                this.selecting = false;
            } else {
                this.error   = "Invalid motif";
                this.motif = '';
                this.selecting = false;
            }
        }
    }
}
</script>


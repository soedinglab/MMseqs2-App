<template>
    <v-dialog v-model="show" absolute width="unset">
        <template v-slot:activator="{ on }">
            <v-btn v-on="on" :disabled="selecting" :block="$vuetify.breakpoint.xsOnly" :color="selected ? 'primary' : (error ? 'error' : null)">
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
                <v-btn text @click.native="reset">Cancel</v-btn>
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
        structure: { default: null, type: Object },
    },
    data() {
        return {
            selecting: false,
            selected: false,
            error: "",
            show: false,
            motif: ''
        };
    },
    mounted() {
    },
    watch: {
        selecting: function (val, old) {
            if (val != old) {
                this.$emit('selecting', val);
            }
        },
    },
    methods: {
        isValid() {
            if (!this.structure) {
                return false;
            }

            var motifSet = new Set(this.motif.split(','));
            this.structure.eachResidue(r => {
                if (motifSet.has(`${r.chainname}${r.resno}`)) {
                    motifSet.delete(`${r.chainname}${r.resno}`);
                }
            });
            return motifSet.size == 0;
        },
        select() {
            if (!this.motif) {
                return;
            }
            this.selecting = true;
            this.error   = "";
            this.motif = this.motif.trim();

            if (this.isValid()) {
                this.$emit('select', this.motif);
                this.show    = false;
                this.selecting = false;
                this.selected = true;
            } else {
                this.error   = "Invalid motif";
                this.selecting = false;
                this.selected = false;
            }
        },
        reset() {
            this.motif = '';
            this.selecting = false;
            this.selected = false;
            this.error = '';
            this.show = false;
        }
    }
}
</script>


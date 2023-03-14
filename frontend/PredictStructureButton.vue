<template>
    <v-tooltip open-delay="300" top v-model="show">
        <template v-slot:activator="{ attrs }">
            <v-btn :color="color" v-on:click="predict" :disabled="disabled" v-bind="attrs" :block="$vuetify.breakpoint.xsOnly">
                <template v-if="loading">
                    <v-icon>{{ $MDI.ProgressWrench }}</v-icon>&nbsp;
                </template>
                Predict structure
            </v-btn>
        </template>
        <span>{{error}}</span>
    </v-tooltip>

</template>

<script>
import { create } from 'axios';

export default {
    name: 'predict-structure-button',
    props: ['query', 'value'],
    data() {
        return {
            color: "primary",
            loading: false,
            show: false,
            disabled: false,
        };
    },
    computed: {
        sequence() {
            if (this.query.length == 0) {
                return "";
            }
            let seq = this.query;
            if (this.query[0] == ">") {
                let start = this.query.indexOf("\n");
                if (start == -1) {
                    return "";
                }
                start = start + 1;
                seq = this.query.substring(start);
            }
            if (seq.length < 1000 && /^[A-Za-z\n]+$/.test(seq)) {
                seq = seq.replace(/\n/g, "");
                seq = seq.toUpperCase();
                return seq;
            }
            return "";
        }
    },
    watch: {
        query: {
            immediate: true,
            handler() {
                if (this.sequence.length == 0 && this.query[0] == '>') {
                    this.disabled = true;
                    this.color = "primary";
                    this.show = true;
                    this.error = "Enter a valid FASTA sequence";
                    this.$emit('input', true);
                } else if (this.sequence.length == 0) {
                    this.disabled = true;
                    this.color = "primary";
                    this.show = false;
                    this.error = "";
                    this.$emit('input', false);
                } else if (this.sequence.length > 400) {
                    this.disabled = true;
                    this.color = "error";
                    this.show = true;
                    this.error = "Sequence can be at most 400 residues long";
                    this.$emit('input', true);
                } else {
                    this.disabled = false;
                    this.color = "primary";
                    this.show = false;
                    this.error = "";
                    this.$emit('input', true);
                }
            }
        }
    },
    methods: {
        predict() {
            this.loading = true;
            const axios = create();
            axios.post("https://api.esmatlas.com/foldSequence/v1/pdb/", this.sequence, { headers: { "Accept": "*/*", "Content-Type": "application/x-www-form-urlencoded" } })
                .then((response) => {
                    this.$emit('predict', response.data);
                }).catch((error) => {
                    if (typeof error.response.data !== 'undefined') {
                        this.error = "Error: " + error.response.data;
                    } else {
                        this.error = error;
                    }
                    this.show = true;
                    this.color = "error";
                }).finally(() => {
                    this.loading = false;
                });
        }
    }
}
</script>


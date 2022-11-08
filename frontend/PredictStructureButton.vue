<template>
    <v-tooltip open-delay="300" top v-model="show">
        <template v-slot:activator="{ attrs }">
            <v-btn :color="color" v-on:click="predict" :disabled="disabled" v-bind="attrs">
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
    props: ['query', 'disabled'],
    data() {
        return {
            color: "primary",
            loading: false,
            show: false,
            error: "",
        };
    },
    watch: {
        query: function() {
            this.color = "primary";
            this.show = false;
            this.error = "";
        }
    },
    methods: {
        predict() {
            let seq;
            if (this.query[0] == ">") {
                let start = this.query.indexOf("\n");
                seq = this.query.substring(start + 1).trim();
            } else {
                seq = this.query.trim();
            }
            seq = seq.toUpperCase();
            seq = seq.replaceAll("\n", "");
            this.loading = true;
            const axios = create();
            axios.post("https://api.esmatlas.com/foldSequence/v1/pdb/", seq, { headers: { "Accept": "*/*", "Content-Type": "application/x-www-form-urlencoded" } })
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


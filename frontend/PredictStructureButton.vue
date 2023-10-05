<template>
    <v-menu offset-y>
      <template v-slot:activator="{ on: menu, attrs }">
        <v-tooltip open-delay="300" top v-model="show">
          <template v-slot:activator="{ on: tooltip }">
            <v-btn
              :color="color"
              :disabled="disabled"
              v-bind="attrs"
              v-on="{ ...tooltip, ...menu }"
              :block="$vuetify.breakpoint.xsOnly"
            >
              <template v-if="loading">
                <v-icon>{{ $MDI.ProgressWrench }}</v-icon>&nbsp;
              </template>
              Predict
            </v-btn>
          </template>
          <span>{{ error }}</span>
        </v-tooltip>
      </template>
      <v-list>
        <v-list-item v-on:click="predictESM">
          <v-list-item-title>Structure with ESMFold</v-list-item-title>
        </v-list-item>
        <v-list-item v-on:click="predictT5">
          <v-list-item-title>3Di with ProstT5</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
</template>

<script>
import { create } from 'axios';

function cleanFasta(fasta) {
    const i = fasta.indexOf('\n');
    const header = fasta.substring(0, i + 1);
    const seq = fasta.substring(i + 1).replace(/\s+/g, '');
    return header + seq;
}

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
                if (/>3DI/.test(this.query)) {
                    this.disabled = true;
                    this.color = "primary";
                    this.show = false;
                    this.error = "";
                    this.$emit('input', false);
                    return;
                } else if (this.sequence.length == 0 && this.query[0] == '>') {
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
        predictESM() {
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
        },
        predictT5() {
            this.loading = true;
            const axios = create();
            axios.get("https://3di.foldseek.com/predict/" + this.sequence)
                .then((response) => {
                    this.$emit('predict', cleanFasta(this.query) + '\n>3DI\n' + response.data);
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


<template>
    <v-tooltip open-delay="300" top>
        <template v-slot:activator="{ on }">
            <v-autocomplete
                :value="value"
                label="Taxonomic filter"
                placeholder="Start typing scientific name to search"
                hide-no-data
                :items="items"
                :loading="isLoading"
                :search-input.sync="search"
                @input="change"
                return-object
                auto-select-first
                :allow-overflow="false"
                dense
                chips
                deletable-chips
            ></v-autocomplete>
        </template>
        <span>Restrict results to taxonomic clade</span>
    </v-tooltip>
</template>

<script>
import { create } from 'axios';
import { debounce } from './lib/debounce';

export default {
    props: ['value'],
    data() {
        return {
            items: [],
            isLoading: false,
            search: null,
        }
    },
    mounted() {
        this.items = [ this.value ];
    },
    watch: {
        value(val) {
            this.items = [ this.value ];
        },
        search (val) {
            val && val.length > 2 && val !== this.value && this.querySelections(val)
        },
    },
    methods: {
        change(taxId) {
          this.$emit('input', taxId);
        },
        querySelections: debounce(function (name) {
            this.loading = true;
            // make a new axios instance to not leak the electron access token
            const axios = create();
            axios.get("https://api.ncbi.nlm.nih.gov/datasets/v1/genome/taxon_suggest/" + encodeURIComponent(name) + "?tax_rank_filter=higher_taxon")
                .then(response => {
                    if (response.status == 200 && response.data.hasOwnProperty("sci_name_and_ids")) {
                        this.items = response.data.sci_name_and_ids.map((el) => {
                            return { text: el.sci_name, value: el.tax_id }
                        });
                    }
                }).finally(() => { this.loading = false; });
        }, 1000, true)
    },
}
</script>

<style>
</style>

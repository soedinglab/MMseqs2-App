<template>
    <v-tooltip open-delay="300" top :disabled="isLocal">
        <template v-slot:activator="{ on }">
            <v-autocomplete
                :value="value"
                :label="isLocal ? undefined : 'Taxonomic filter'"
                :placeholder="isLocal ? 'Search scientific name' : 'Start typing scientific name to search'"
                :hide-no-data="!isLocal"
                no-data-text="No matching taxon in the hits"
                :items="isLocal ? localItems : items"
                :loading="isLoading"
                :search-input.sync="search"
                @input="change"
                return-object
                auto-select-first
                :allow-overflow="false"
                dense
                :chips="!isLocal"
                :deletable-chips="!isLocal"
                :outlined="isLocal"
                :hide-details="isLocal"
                :clearable="isLocal"
                :prepend-inner-icon="isLocal ? $MDI.Magnify : undefined"
                :menu-props="isLocal ? { maxHeight: 280 } : undefined"
            >
                <template v-if="isLocal" v-slot:item="{ item }">
                    <v-list-item-content>
                        <v-list-item-title>{{ item.text }}</v-list-item-title>
                        <v-list-item-subtitle>{{ [item.rank, item.count + (item.count == 1 ? ' hit' : ' hits')].filter(Boolean).join(' · ') }}</v-list-item-subtitle>
                    </v-list-item-content>
                </template>
            </v-autocomplete>
        </template>
        <span>Restrict results to taxonomic clade</span>
    </v-tooltip>
</template>

<script>
import { create } from 'axios';
import { debounce } from './lib/debounce';

export default {
    props: {
        value: null,
        // Local mode: suggest only these options instead of querying NCBI.
        localItems: {
            type: Array,
            default: null,
        },
    },
    data() {
        return {
            items: [],
            isLoading: false,
            search: null,
        }
    },
    computed: {
        isLocal() {
            return this.localItems != null;
        },
    },
    mounted() {
        this.items = [ this.value ];
    },
    watch: {
        value(val) {
            this.items = [ this.value ];
        },
        search (val) {
            !this.isLocal && val && val.length > 2 && val !== this.value && this.querySelections(val)
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
            axios.get("https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest/" + encodeURIComponent(name) + "?tax_rank_filter=higher_taxon")
                .then(response => {
                    if (response.status == 200 && response.data.hasOwnProperty("sci_name_and_ids")) {
                        this.items = response.data.sci_name_and_ids.map((el) => {
                            if (el.common_name) {
                                el.sci_name += " (" + el.common_name + ")";
                            }
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

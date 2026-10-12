<template>
    <v-menu ref="menu" v-model="open" offset-y :nudge-bottom="16" :left="openLeft" :close-on-content-click="false" :z-index="99999"
        transition="fade-transition"
        min-width="300" max-width="340">
        <template v-slot:activator="{ on, attrs }">
            <button type="button" class="column-menu-btn" :class="{ 'is-active': value != null, 'is-open': open }"
                v-bind="attrs" v-on="on" @click.stop="pickSide" :title="(sortable ? 'Sort and filter by ' : 'Filter by ') + label">
                <v-icon small :color="value != null ? color : undefined">
                    {{ value != null ? $MDI.Filter : $MDI.FilterOutline }}
                </v-icon>
            </button>
        </template>
        <v-card>
            <v-list v-if="sortable" dense class="py-0">
                <v-list-item style="padding: 0 12px;" @click="$emit('sort')">
                    <div style="display: flex; align-items: center; margin-right: 12px;">
                        <v-icon small>{{ $MDI.Sort }}</v-icon>
                    </div>
                    <v-list-item-content>
                        <v-list-item-title>Sort by {{ label }}</v-list-item-title>
                    </v-list-item-content>
                    <v-list-item-action class="my-0">
                        <v-icon :color="sortSelected ? color : undefined" :style="{ opacity: sortSelected ? 1 : 0.4 }">
                            {{ sortIcon }}
                        </v-icon>
                    </v-list-item-action>
                </v-list-item>
            </v-list>
            <v-divider v-if="sortable"></v-divider>
            <ResultFilterField ref="field" class="pa-3"
                :label="label" :kind="kind" :value="value" :color="color"
                :bounds="bounds" :logScale="logScale" :integer="integer" :taxOptions="taxOptions" :choices="choices"
                @filter="v => $emit('filter', v)"
            ></ResultFilterField>
        </v-card>
    </v-menu>
</template>

<script>
import ResultFilterField from './ResultFilterField.vue';
import menuFollow from './lib/menuFollow.js';

export default {
    name: 'ResultColumnMenu',
    mixins: [ menuFollow ],
    components: { ResultFilterField },
    props: {
        label: { type: String, required: true },
        kind: { type: String, default: null },
        value: { default: null },
        sortable: { type: Boolean, default: true },
        sortSelected: { type: Boolean, default: false },
        sortOrder: { type: Number, default: -1 },
        defaultSortOrder: { type: Number, default: -1 },
        color: { type: String, default: undefined },
        bounds: { type: Object, default: null },
        logScale: { type: Boolean, default: false },
        integer: { type: Boolean, default: false },
        taxOptions: { type: Array, default: null },
        choices: { type: Array, default: null },
    },
    data() {
        return {
            open: false,
            openLeft: true,
        }
    },
    computed: {
        sortIcon() {
            const order = this.sortSelected ? this.sortOrder : this.defaultSortOrder;
            return order < 0 ? this.$MDI.ChevronDown : this.$MDI.ChevronUp;
        },
    },
    watch: {
        open(isOpen) {
            if (isOpen) {
                this.$nextTick(() => this.$refs.field?.focus(() => this.open));
            }
        },
    },
    methods: {
        pickSide(event) {
            const button = event.currentTarget.getBoundingClientRect();
            const table = event.currentTarget.closest('table');
            const left = table ? table.getBoundingClientRect().left : 0;
            this.openLeft = button.right - left >= 300;
        },
    },
}
</script>

<style scoped>
.column-menu-btn {
    position: absolute;
    top: 50%;
    right: 2px;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
}
th:hover .column-menu-btn,
.column-menu-btn.is-active,
.column-menu-btn.is-open,
.column-menu-btn:focus-visible {
    opacity: 1;
}
/* Opaque, so it covers the end of a header label it overlaps. */
.column-menu-btn {
    background-color: #fff;
}
.theme--dark .column-menu-btn {
    background-color: #1e1e1e;
}
.column-menu-btn:hover {
    box-shadow: inset 0 0 0 11px rgba(128, 128, 128, 0.2);
}
</style>

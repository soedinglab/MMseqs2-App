<template>
    <v-menu v-model="open" offset-y :left="openLeft" :close-on-content-click="false" :z-index="99999"
        transition="fade-transition"
        min-width="300" max-width="340">
        <template v-slot:activator="{ on, attrs }">
            <button type="button" class="column-menu-btn" :class="{ 'is-active': value != null, 'is-open': open }"
                v-bind="attrs" v-on="on" @click.stop="pickSide" :title="'Sort and filter by ' + label">
                <v-icon small :color="value != null ? color : undefined">
                    {{ value != null ? $MDI.Filter : $MDI.FilterOutline }}
                </v-icon>
            </button>
        </template>
        <v-card>
            <v-list dense class="py-0">
                <v-list-item @click="$emit('sort')">
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
            <v-divider></v-divider>
            <div class="pa-3" ref="body">
                <v-text-field v-if="kind == 'text'"
                    :value="value" @input="onText"
                    :placeholder="'Search ' + label.toLowerCase()"
                    :prepend-inner-icon="$MDI.Magnify"
                    dense outlined hide-details clearable
                ></v-text-field>
                <TaxonomyAutocomplete v-else-if="kind == 'tax'"
                    :value="taxSelection" :localItems="taxOptions"
                    @input="onTaxon"
                ></TaxonomyAutocomplete>
                <div v-else-if="kind == 'range' && bounds">
                    <div class="range-hint text-caption text--secondary">
                        {{ singleValue ? 'All hits have the same value' : 'Drag the handles to filter by range' }}
                    </div>
                    <v-range-slider
                        :value="singleValue ? [0, 1] : sliderValue" @change="onSlider" @end="releaseThumb"
                        :min="singleValue ? 0 : scale.min" :max="singleValue ? 1 : scale.max" step="0"
                        :disabled="singleValue"
                        :color="color" :track-color="color"
                        thumb-label :thumb-size="44"
                        hide-details class="mx-1"
                    >
                        <template v-slot:thumb-label="{ value: position }">
                            {{ formatPosition(position) }}
                        </template>
                    </v-range-slider>
                    <div class="d-flex mt-2" style="gap: 8px;">
                        <v-text-field :value="displayRange[0]" @change="v => onInput(0, v)"
                            label="Min" dense outlined hide-details :disabled="singleValue"></v-text-field>
                        <v-text-field :value="displayRange[1]" @change="v => onInput(1, v)"
                            label="Max" dense outlined hide-details :disabled="singleValue"></v-text-field>
                    </div>
                </div>
                <div v-if="value != null" class="d-flex justify-end mt-2">
                    <v-btn text small @click="$emit('filter', null)">Clear filter</v-btn>
                </div>
            </div>
        </v-card>
    </v-menu>
</template>

<script>
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';
import { debounce } from './lib/debounce';
import { sliderScale, normalizeRange, formatFilterNumber } from './lib/resultFilter.js';

export default {
    name: 'ResultColumnMenu',
    components: { TaxonomyAutocomplete },
    props: {
        label: { type: String, required: true },
        kind: { type: String, default: null },
        value: { default: null },
        sortSelected: { type: Boolean, default: false },
        sortOrder: { type: Number, default: -1 },
        defaultSortOrder: { type: Number, default: -1 },
        color: { type: String, default: undefined },
        bounds: { type: Object, default: null },
        logScale: { type: Boolean, default: false },
        taxOptions: { type: Array, default: null },
    },
    data() {
        return {
            open: false,
            openLeft: true,
        }
    },
    created() {
        this.emitText = debounce(text => this.$emit('filter', text), 500);
    },
    computed: {
        sortIcon() {
            const order = this.sortSelected ? this.sortOrder : this.defaultSortOrder;
            return order < 0 ? this.$MDI.ChevronDown : this.$MDI.ChevronUp;
        },
        singleValue() {
            return this.bounds != null && this.bounds.min == this.bounds.max;
        },
        scale() {
            return sliderScale(this.bounds, this.logScale);
        },
        range() {
            return this.value || [this.bounds.min, this.bounds.max];
        },
        sliderValue() {
            return this.range.map(this.scale.toSlider);
        },
        displayRange() {
            return this.range.map(v => formatFilterNumber(v, this.logScale));
        },
        taxSelection() {
            return this.value ? { text: this.value.name, value: this.value.taxId } : null;
        },
    },
    watch: {
        open(isOpen) {
            if (isOpen && (this.kind == 'text' || this.kind == 'tax')) {
                this.focusField(10);
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
        // The menu content becomes visible a few frames after `open`.
        focusField(frames) {
            const input = this.$refs.body?.querySelector('input');
            if (input && input.offsetParent) {
                input.focus();
            } else if (frames > 0 && this.open) {
                requestAnimationFrame(() => this.focusField(frames - 1));
            }
        },
        releaseThumb() {
            document.activeElement?.blur();
        },
        formatPosition(position) {
            return formatFilterNumber(this.scale.fromSlider(position), this.logScale);
        },
        onText(text) {
            if (!text || !text.trim()) {
                this.emitText(null);
            } else {
                this.emitText(text);
            }
        },
        onTaxon(option) {
            this.$emit('filter', option ? option : null);
        },
        onSlider([lo, hi]) {
            this.emitRange(this.scale.fromSlider(lo), this.scale.fromSlider(hi));
        },
        onInput(index, text) {
            const next = [...this.range];
            next[index] = parseFloat(text);
            if (Number.isNaN(next[index])) {
                next[index] = index == 0 ? this.bounds.min : this.bounds.max;
            }
            this.emitRange(next[0], next[1]);
        },
        emitRange(lo, hi) {
            this.$emit('filter', normalizeRange(lo, hi, this.bounds));
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
.range-hint {
    height: 36px;
}
.column-menu-btn:hover {
    background-color: rgba(128, 128, 128, 0.2);
}
</style>

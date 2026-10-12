<template>
    <div>
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
</template>

<script>
import TaxonomyAutocomplete from './TaxonomyAutocomplete.vue';
import { debounce } from './lib/debounce';
import { sliderScale, normalizeRange, formatFilterNumber } from './lib/resultFilter.js';

export default {
    name: 'ResultFilterField',
    components: { TaxonomyAutocomplete },
    props: {
        label: { type: String, required: true },
        kind: { type: String, default: null },
        value: { default: null },
        color: { type: String, default: undefined },
        bounds: { type: Object, default: null },
        logScale: { type: Boolean, default: false },
        taxOptions: { type: Array, default: null },
    },
    created() {
        this.emitText = debounce(text => this.$emit('filter', text), 500);
    },
    computed: {
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
    methods: {
        // Retries until the surrounding menu has made the input visible.
        focus(isWanted, frames = 10) {
            if (this.kind != 'text' && this.kind != 'tax') return;
            const input = this.$el.querySelector('input');
            if (input && input.offsetParent) {
                input.focus();
            } else if (frames > 0 && isWanted()) {
                requestAnimationFrame(() => this.focus(isWanted, frames - 1));
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
.range-hint {
    height: 36px;
}
</style>

<template>
    <v-select
        clearable
        label="Query residues"
        persistent-hint
        v-bind="$attrs"
    >
        <template v-slot:selection="{ item }">
            <multi-slider
                style="flex: 1 1 100%; width: 100%;"
                :values="queryresidues"
                :value="item"
                disabled
                :background-color="color">
            </multi-slider>
        </template>
        <template v-slot:item="{ item }">
            <multi-slider
                style="flex: 1 1 100%; width: 100%;"
                :values="queryresidues"
                :value="item"
                disabled
                :background-color="color">
            </multi-slider>
        </template>
</v-select>
</template>

<script>
import MultiSlider from './MultiSlider.vue';
export default {
    name: 'MotifFilter',
    components: { MultiSlider },
    props: {
        queryresidues: {
            type: Object,
            required: false,
        },
        color: {
            type: String,
            required: false
        }
    },
}
</script>
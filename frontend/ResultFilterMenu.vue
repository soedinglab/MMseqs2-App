<template>
    <v-menu ref="menu" v-model="open" bottom left offset-y :close-on-content-click="false" :z-index="99999"
        transition="fade-transition" min-width="300" max-width="340">
        <template v-slot:activator="{ on, attrs }">
            <v-btn icon v-bind="attrs" v-on="on" title="Filter options">
                <v-badge :value="activeCount > 0" :content="activeCount" :color="color" overlap>
                    <v-icon :color="activeCount > 0 ? color : undefined">
                        {{ activeCount > 0 ? $MDI.Filter : $MDI.FilterOutline }}
                    </v-icon>
                </v-badge>
            </v-btn>
        </template>
        <v-card class="filter-menu-card">
            <v-expansion-panels accordion flat>
                <v-expansion-panel v-for="column in columns" :key="column.key">
                    <v-expansion-panel-header class="py-2">
                        <div class="d-flex align-center" style="min-width: 0;">
                            <span class="text-body-2 flex-shrink-0">{{ column.label }}</span>
                            <span v-if="column.summary" class="text-caption ml-2 text-truncate" :style="{ color }">
                                {{ column.summary }}
                            </span>
                        </div>
                    </v-expansion-panel-header>
                    <v-expansion-panel-content>
                        <ResultFilterField v-bind="column.field" @filter="v => $emit('filter', column.key, v)"></ResultFilterField>
                    </v-expansion-panel-content>
                </v-expansion-panel>
            </v-expansion-panels>
            <template v-if="activeCount > 0">
                <v-divider></v-divider>
                <div class="d-flex justify-end pa-2">
                    <v-btn text small @click="$emit('clear')">Clear all</v-btn>
                </div>
            </template>
        </v-card>
    </v-menu>
</template>

<script>
import ResultFilterField from './ResultFilterField.vue';
import menuFollow from './lib/menuFollow.js';

export default {
    name: 'ResultFilterMenu',
    mixins: [ menuFollow ],
    components: { ResultFilterField },
    props: {
        // [{ key, label, summary, field: ResultFilterField props }]
        columns: { type: Array, required: true },
        color: { type: String, default: undefined },
    },
    data() {
        return {
            open: false,
        }
    },
    computed: {
        activeCount() {
            return this.columns.filter(column => column.field.value != null).length;
        },
    },
}
</script>

<style scoped>
.filter-menu-card {
    max-height: 70vh;
    overflow-y: auto;
}
</style>

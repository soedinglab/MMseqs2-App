<script>
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import ResultColumnMenu from './ResultColumnMenu.vue';
import ResultFilterMenu from './ResultFilterMenu.vue';
import { defaultSortOrder } from './lib/resultSort.js';
import {
    filterKind, rangeBounds, choiceValues, isLogScale, isIntegerScale, taxonOptions, taxFilterFor, formatFilterValue,
} from './lib/resultFilter.js';

// Column sort/filter state shared by the per-database result tables.
// The table provides `entry`, `filterKeys`, `columnLabels`, `sortKey`, `sortOrder`,
// `entryLength` and `filteredTotal`; it may override `sortKeys`, `filterGroups`, `taxOptions`,
// `resolveTaxFilter` and `defaultOrderFor`.
export default {
    name: 'ResultTableFilterMixin',
    mixins: [ ResultSankeyMixin ],
    components: { ResultColumnMenu, ResultFilterMenu },
    props: {
        tableState: {
            type: Object,
            default: null,
        },
    },
    created() {
        if (this.tableState) {
            this.sortKey = this.tableState.sortKey
            this.sortOrder = this.tableState.sortOrder
            this.filters = this.tableState.filters
        }
    },
    beforeDestroy() {
        this.$emit('update:tableState', this.persistedState)
    },
    computed: {
        hasTaxonomyReport() {
            return this.entry?.hasTaxonomy && this.entry.taxonomyreports?.length > 0
        },
        taxonomyReport() {
            return this.hasTaxonomyReport ? this.entry.taxonomyreports[0] : null
        },
        sortKeys() {
            return this.filterKeys
        },
        // Hits as groups of chains; a table with ungrouped hits wraps each one.
        filterGroups() {
            return this.entry.alignments
        },
        // Filters on hidden columns are not kept with the table state.
        activeFilters() {
            return Object.fromEntries(Object.entries(this.filters).filter(([key]) => this.filterKeys.includes(key)))
        },
        persistedState() {
            return { sortKey: this.sortKey, sortOrder: this.sortOrder, filters: this.activeFilters }
        },
        rangeBoundsByKey() {
            const bounds = {}
            for (const key of this.filterKeys) {
                if (filterKind(key) == 'range') {
                    bounds[key] = rangeBounds(this.filterGroups, key)
                }
            }
            return bounds
        },
        taxOptions() {
            return this.entry.hasTaxonomy ? taxonOptions(this.taxonomyReport, this.filterGroups) : null
        },
        mobileFilterColumns() {
            return this.filterKeys.map(key => ({
                key,
                label: this.columnLabels[key],
                summary: this.filters[key] != null ? this.formatFilter(key) : '',
                field: this.filterFieldProps(key),
            }))
        },
        filterChips() {
            return this.filterKeys
                .filter(key => this.filters[key] != null)
                .map(key => ({ key, text: this.columnLabels[key] + ': ' + this.formatFilter(key) }))
        },
        // Header labels shorten below this width; the full name stays in the title and the menu.
        compactHeader() {
            return this.$vuetify.breakpoint.width < 1440
        },
        compactScoreName() {
            return this.mode == 'tmalign' ? 'TM' : this.mode == 'lolalign' ? 'Score' : 'E-val.'
        },
        hitCountLabel() {
            const unit = this.entryLength == 1 ? 'hit' : 'hits'
            if (this.filteredTotal < this.entryLength) {
                return `${this.filteredTotal} of ${this.entryLength} ${unit}`
            }
            return this.entryLength > 0 ? `${this.entryLength} ${unit}` : 'no hit'
        },
    },
    watch: {
        persistedState(state) {
            this.$emit('update:tableState', state)
        },
    },
    methods: {
        resolveTaxFilter(option) {
            return taxFilterFor(this.taxonomyReport, option)
        },
        defaultOrderFor(key) {
            return defaultSortOrder(key, { mode: this.mode })
        },
        formatFilter(key) {
            return formatFilterValue(key, this.filters[key], isLogScale(key, this.mode))
        },
        filterFieldProps(key) {
            return {
                label: this.columnLabels[key],
                kind: filterKind(key),
                value: this.filters[key] ?? null,
                color: this.entry.color,
                bounds: this.rangeBoundsByKey[key] ?? null,
                logScale: isLogScale(key, this.mode),
                integer: isIntegerScale(key),
                taxOptions: key == 'tax' ? this.taxOptions : null,
                choices: filterKind(key) == 'choice' ? choiceValues(this.filterGroups, key) : null,
            }
        },
        columnMenuProps(key) {
            return {
                ...this.filterFieldProps(key),
                sortable: this.sortKeys.includes(key),
                sortSelected: this.sortKey == key,
                sortOrder: this.sortOrder,
                defaultSortOrder: this.defaultOrderFor(key),
            }
        },
        onColumnFilter(key, value) {
            if (key == 'tax' && value != null) {
                value = this.resolveTaxFilter(value)
            }
            this.setFilter(key, value)
        },
        clearFilters() {
            this.filters = {}
        },
    },
}
</script>

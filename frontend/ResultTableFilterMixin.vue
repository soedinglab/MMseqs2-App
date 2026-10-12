<script>
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import ResultColumnMenu from './ResultColumnMenu.vue';
import ResultFilterMenu from './ResultFilterMenu.vue';
import { defaultSortOrder } from './lib/resultSort.js';
import {
    filterKind, rangeBounds, isLogScale, taxonOptions, taxFilterFor, formatFilterValue,
} from './lib/resultFilter.js';

// Column sort/filter state shared by the per-database result tables.
// The table provides `entry`, `filterKeys`, `columnLabels`, `sortKey`, `sortOrder`,
// `entryLength` and `filteredTotal`.
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
    computed: {
        hasTaxonomyReport() {
            return this.entry?.hasTaxonomy && this.entry.taxonomyreports?.length > 0
        },
        taxonomyReport() {
            return this.hasTaxonomyReport ? this.entry.taxonomyreports[0] : null
        },
        persistedState() {
            return { sortKey: this.sortKey, sortOrder: this.sortOrder, filters: this.filters }
        },
        rangeBoundsByKey() {
            const bounds = {}
            for (const key of this.filterKeys) {
                if (filterKind(key) == 'range') {
                    bounds[key] = rangeBounds(this.entry.alignments, key)
                }
            }
            return bounds
        },
        taxOptions() {
            return this.entry.hasTaxonomy ? taxonOptions(this.taxonomyReport, this.entry.alignments) : null
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
                taxOptions: key == 'tax' ? this.taxOptions : null,
            }
        },
        columnMenuProps(key) {
            return {
                ...this.filterFieldProps(key),
                sortSelected: this.sortKey == key,
                sortOrder: this.sortOrder,
                defaultSortOrder: defaultSortOrder(key, { mode: this.mode }),
            }
        },
        onColumnFilter(key, value) {
            if (key == 'tax' && value != null) {
                value = taxFilterFor(this.taxonomyReport, value)
            }
            this.setFilter(key, value)
        },
        clearFilters() {
            this.filters = {}
        },
    },
}
</script>

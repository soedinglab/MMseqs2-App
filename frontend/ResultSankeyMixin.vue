<script>
import SankeyDiagram from './SankeyDiagram.vue';
export default {
    name: 'ResultSankeyMixin',
    components: { SankeyDiagram },
    data() {
        return {
            isSankeyVisible: {}, // Track visibility for each db's Sankey Diagram
            // Column key -> filter value; `tax` is { taxId, name, ids }.
            filters: {},
        }
    },
    computed: {
        localSelectedTaxId() {
            return this.filters.tax ? String(this.filters.tax.taxId) : null;
        },
        filteredHitsTaxIds() {
            return this.filters.tax ? this.filters.tax.ids : [];
        },
    },
    watch: {
        selectedTaxId() {
            this.setFilter('tax', null);
        }
    },
    methods: {
        toggleSankeyVisibility(db) {
            // Toggle visibility for the specific entry.db
            this.$set(this.isSankeyVisible, db, !this.isSankeyVisible[db]);
        },
        setFilter(key, value) {
            const next = { ...this.filters };
            if (value == null) {
                delete next[key];
            } else {
                next[key] = value;
            }
            this.filters = next;
        },
        handleSankeySelect({ nodeId, descendantIds, name }) {
            this.closeAlignment();
            this.setFilter('tax', descendantIds == null ? null : {
                taxId: nodeId,
                name,
                ids: descendantIds.map(Number),
            });
        },
    }
}
</script>

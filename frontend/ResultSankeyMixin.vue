<script>
import SankeyDiagram from './SankeyDiagram.vue';
export default {
    name: 'ResultSankeyMixin',
    components: { SankeyDiagram },
    data() {
        return {
            isSankeyVisible: {}, // Track visibility for each db's Sankey Diagram
            localSelectedTaxId: null,
            filteredHitsTaxIds: [],
        }
    },
    watch: {
        selectedTaxId(newVal) {
            this.localSelectedTaxId = newVal;
            this.handleSankeySelect({ nodeId: newVal, db: this.selectedDb });
        }
    },
    methods: {
        toggleSankeyVisibility(db) {
            // Toggle visibility for the specific entry.db
            this.$set(this.isSankeyVisible, db, !this.isSankeyVisible[db]);
        },
        handleSankeySelect({ nodeId, descendantIds, db }) {
            this.closeAlignment();
            this.localSelectedTaxId = nodeId;
            this.filteredHitsTaxIds = descendantIds ? descendantIds.map(Number) : null; 
            this.selectedDb = db;
        },
    }
}
</script>
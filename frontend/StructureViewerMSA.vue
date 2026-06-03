<template>
<div class="structure-panel">
    <MolstarStructureViewer
        ref="viewer"
        :scene="scene"
        :sceneInput="sceneInput"
        :toolbar="toolbar"
        :bgColorLight="bgColorLight"
        :bgColorDark="bgColorDark"
        @makeImage="handleMakeImage"
        @makeCIF="handleMakeCIF"
        @sceneEvent="handleSceneEvent"
    >
        <template v-slot:overlay>
            <StructureHoverTooltip :value="hoverInfo" />
        </template>
    </MolstarStructureViewer>
</div>
</template>

<script>
import MolstarStructureViewer from './molstar/StructureViewer.vue';
import StructureHoverTooltip from './StructureHoverTooltip.vue';
import { foldmasonResult } from './molstar/foldmasonResult.js';
import { downloadBlob } from './alignmentPanelUtils.js';

export default {
    name: "StructureViewerMSA",
    components: {
        MolstarStructureViewer,
        StructureHoverTooltip,
    },
    data: () => ({
        scene: foldmasonResult,
        previewIndex: -1,
        hoverInfo: null,
        focusColumn: -1,
        focusToken: 0,
        updateToken: 0,
    }),
    props: {
        entries: { type: Array, required: true },
        selection: { type: Array, required: true, default: () => [0, 1] },
        mask: { type: [Array, Uint8Array], required: true },
        reference: { type: Number, required: true },
        bgColorLight: { type: String, default: "white" },
        bgColorDark: { type: String, default: "#1E1E1E" },
        selectedColumns: { type: Array, default: () => [] },
        previewColumn: { type: Number, required: false, default: -1 },
        previewStructureIndex: { type: Number, required: false, default: -1 },
    },
    computed: {
        sceneInput() {
            this.updateToken;
            return {
                entries: this.entries,
                selection: this.selection.slice(),
                reference: this.reference,
                mask: Array.from(this.mask || []),
                selectedColumns: this.selectedColumns.slice(),
                previewColumn: this.previewColumn,
                previewStructureIndex: this.previewStructureIndex >= 0
                    ? this.previewStructureIndex
                    : this.previewIndex,
                focusColumn: this.focusColumn,
                focusToken: this.focusToken,
            };
        },
        toolbar() {
            return {
                disableArrowButton: true,
                disableQueryButton: true,
                disableTargetButton: true,
                cifButtonLabel: 'Save CIF',
            };
        },
    },
    methods: {
        handleResize() {
            this.$refs.viewer?.handleResize?.();
        },
        resetView() {
            this.$refs.viewer?.handleResetView?.();
        },
        moveView(alnPos) {
            this.focusColumn = Number(alnPos);
            this.focusToken++;
            this.updateToken++;
        },
        updateMask() {
            this.updateToken++;
        },
        updateAllHighlights() {
            this.updateToken++;
        },
        updateAllPreview() {
            this.updateToken++;
        },
        async handleMakeCIF(cif) {
            if (!cif) return;
            downloadBlob(new Blob([cif], { type: 'text/plain' }), "foldmason.cif");
        },
        async handleMakeImage(blob) {
            if (!blob) return;
            downloadBlob(blob, "foldmason.png");
        },
        handleSceneEvent(event) {
            if (!event || event.column < 0) {
                if (event?.type === 'structure-hover') {
                    if (event.hasLoci && event.residue) {
                        this.hoverInfo = event;
                    } else if (!event.hasLoci) {
                        this.clearTimer();
                    }
                }
                return;
            }
            if (event.type === 'structure-click') {
                if (this.selectedColumns.includes(event.column)) {
                    this.$emit('removeHighlight', event.column);
                } else {
                    this.$emit('addHighlight', event.column);
                }
                return;
            }
            if (event.type === 'structure-hover') {
                this.hoverInfo = event;
                this.previewIndex = event.index;
                this.$emit('changePreview', event.column, true);
            }
        },
        clearTimer() {
            this.previewIndex = -1;
            this.hoverInfo = null;
            this.$emit('changePreview', -1, true);
        },
    },
    watch: {
        selection() {
            this.updateToken++;
        },
        mask() {
            this.updateToken++;
        },
        selectedColumns() {
            this.updateToken++;
        },
        previewColumn() {
            this.updateToken++;
        },
    },
};
</script>

<style scoped>
.structure-panel {
    width: 100%;
    height: 100%;
    position: relative;
}
</style>

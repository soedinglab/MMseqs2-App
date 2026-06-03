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
        @toggleQuery="handleToggleQuery"
        @toggleTarget="handleToggleTarget"
        @sceneEvent="handleSceneEvent"
    >
        <template v-slot:overlay>
            <table class="tmscore-panel" :class="{ fullscreen: isFullscreen }">
                <tr>
                    <td class="left-cell">idf-score:</td>
                    <td class="right-cell">{{ alignment.idfscore }}</td>
                </tr>
                <tr>
                    <td class="left-cell">RMSD:</td>
                    <td class="right-cell">{{ alignment.rmsd }}</td>
                </tr>
            </table>
            <StructureHoverTooltip :value="hoverInfo" />
        </template>
    </MolstarStructureViewer>
</div>
</template>

<script>
import MolstarStructureViewer from './molstar/StructureViewer.vue';
import StructureHoverTooltip from './StructureHoverTooltip.vue';
import { folddiscoResult } from './molstar/folddiscoResult.js';
import { downloadBlob } from './alignmentPanelUtils.js';

export default {
    name: "StructureViewerMotif",
    components: {
        MolstarStructureViewer,
        StructureHoverTooltip,
    },
    data: () => ({
        scene: folddiscoResult,
        showQuery: 0,
        showTarget: 0,
        hoverInfo: null,
        isFullscreen: false,
    }),
    props: {
        alignment: { type: Object, required: true },
        lineLen: { type: Number, required: true },
        queryPdb: { type: String, required: true },
        targetPdb: { type: String, required: true },
        bgColorLight: { type: String, default: "white" },
        bgColorDark: { type: String, default: "#1E1E1E" },
    },
    computed: {
        sceneInput() {
            return {
                alignment: this.alignment,
                queryPdb: this.queryPdb,
                targetPdb: this.targetPdb,
                showQuery: this.showQuery,
                showTarget: this.showTarget,
            };
        },
        toolbar() {
            return {
                showQuery: this.showQuery,
                showTarget: this.showTarget,
                disableArrowButton: true,
                cifButtonLabel: 'Save CIF',
            };
        },
    },
    methods: {
        handleToggleQuery() {
            this.showQuery = __LOCAL__
                ? (this.showQuery === 0 ? 1 : 0)
                : (this.showQuery === 2 ? 0 : this.showQuery + 1);
        },
        handleToggleTarget() {
            this.showTarget = __LOCAL__
                ? (this.showTarget === 0 ? 1 : 0)
                : (this.showTarget === 2 ? 0 : this.showTarget + 1);
        },
        async handleMakeCIF(cif) {
            if (!cif) return;
            const title = `folddisco-${this.alignment.target.replace(/\.(pdb|cif)$/, '')}`;
            downloadBlob(new Blob([cif], { type: 'text/plain' }), `${title}.cif`);
        },
        async handleMakeImage(blob) {
            if (!blob) return;
            const title = `folddisco-${this.alignment.target.replace(/\.(pdb|cif)$/, '')}`;
            downloadBlob(blob, `${title}.png`);
        },
        handleSceneEvent(event) {
            if (event?.type === 'structure-hover' && event.hasLoci) {
                this.hoverInfo = event;
            } else if (event?.type === 'structure-hover') {
                this.hoverInfo = null;
            }
        },
    },
};
</script>

<style scoped>
.structure-panel {
    width: 100%;
    height: 400px;
    position: relative;
}

.tmscore-panel {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    border-collapse: collapse;
    color: rgba(0, 0, 0, 0.75);
}

.theme--dark .tmscore-panel {
    color: rgba(255, 255, 255, 0.85);
}

.tmscore-panel.fullscreen {
    margin-top: 10px;
    font-size: 2em;
    line-height: 2em;
}

.left-cell {
    text-align: right;
    padding-right: 8px;
    font-weight: 600;
}

.right-cell {
    text-align: left;
}

</style>

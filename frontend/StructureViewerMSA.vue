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
            <v-fade-transition>
                <v-card
                    v-if="hoverInfo"
                    class="msa-cell-tooltip structure-cell-tooltip"
                    :style="structureTooltipStyle"
                    elevation="6"
                    v-html="refRes"
                />
            </v-fade-transition>
        </template>
    </MolstarStructureViewer>
</div>
</template>

<script>
import MolstarStructureViewer from './molstar/StructureViewer.vue';
import { foldmasonResult } from './molstar/foldmasonResult.js';
import { downloadBlob } from './alignmentPanelUtils.js';

const oneToThree = {
    A: 'ALA', R: 'ARG', N: 'ASN', D: 'ASP', C: 'CYS',
    E: 'GLU', Q: 'GLN', G: 'GLY', H: 'HIS', I: 'ILE',
    L: 'LEU', K: 'LYS', M: 'MET', F: 'PHE', P: 'PRO',
    S: 'SER', T: 'THR', W: 'TRP', Y: 'TYR', V: 'VAL',
    U: 'SEC', O: 'PYL', X: 'ALA',
};

function getResidueIndex(seq, alignmentPos) {
    if (seq[alignmentPos] === '-') return -1;

    let residueIndex = -1;
    for (let i = 0; i <= alignmentPos && i < seq.length; i++) {
        if (seq[i] !== '-') residueIndex++;
    }
    return residueIndex;
}

export default {
    name: "StructureViewerMSA",
    components: {
        MolstarStructureViewer,
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
                previewStructureIndex: this.previewIndex,
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
        structureTooltipStyle() {
            return {
                left: '8px',
                bottom: '48px',
            };
        },
        refRes() {
            if (this.hoverInfo) {
                const name = this.hoverInfo.name || this.entries[this.hoverInfo.index]?.name || '';
                const residue = this.hoverInfo.residue || {};
                const chain = String(residue.chain || '').trim();
                const number = residue.residue != null && residue.residue !== ''
                    ? String(residue.residue)
                    : '';
                const one = String(residue.oneLetter || '').trim();
                const three = residue.threeLetter
                    ? String(residue.threeLetter).charAt(0) + String(residue.threeLetter).slice(1).toLowerCase()
                    : '';
                const residueType = one && three ? `${one} (${three})` : (three || one || '');
                const location = [
                    chain ? `Chain ${chain}` : '',
                    number ? `Residue ${number}` : '',
                ].filter(Boolean).join(', ');
                const residueText = residueType || 'Residue';
                const locationText = location ? `<br><span>${location}</span>` : '';
                return `<span class="tooltip-name">${name}</span><br><strong>${residueText}</strong>${locationText}`;
            }

            if (this.previewColumn < 0 || this.previewIndex < 0) return "";
            const targetObj = this.entries[this.previewIndex];
            const name = this.formatName(targetObj.name);
            const symbol = targetObj.aa?.[this.previewColumn] || '';
            const aa = oneToThree[symbol] || 'ALA';
            const formatted = aa.charAt(0) + aa.toLowerCase().slice(1, 3);
            let resNo = getResidueIndex(targetObj.aa, this.previewColumn) + 1;
            if (resNo < 1) return "";

            const chain = targetObj.suffix ? `${targetObj.chains?.[resNo] || 'A'}:` : "";
            const residue = targetObj.suffix
                ? targetObj.resns?.[resNo] || resNo
                : resNo;

            return `<span>${name}:&nbsp;</span><strong>${chain}${formatted}${residue}</strong>`;
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
        formatName(name) {
            return name?.length > 12
                ? name.slice(0, 9) + '...'
                : name;
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

.msa-cell-tooltip {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    min-width: 150px;
    max-width: min(500px, calc(100% - 16px));
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.35;
    white-space: normal;
    overflow-wrap: anywhere;
}

.structure-cell-tooltip {
    position: absolute;
}

.msa-cell-tooltip >>> .tooltip-name {
    display: inline-block;
    max-width: 100%;
}
</style>

<template>
    <div class="alignment-panel" slot="content">
        <div class="alignment-wrapper-outer">
            <template v-for="(alignment, index) in alignments">
                <div :key="`hdr-${alignment.id}`" class="alignment-title">
                    {{ chainOf(alignment.query) }} &rarr; {{ alignment.target }}
                </div>
                <Alignment
                    :key="`aln-${alignment.id}`"
                    :alnIndex="index"
                    :alignment="alignment"
                    :lineLen="lineLen"
                    :queryMap="queryMaps[index]"
                    :targetMap="targetMaps[index]"
                    :highlights="emptyHighlights[index]"
                    :queryHighlights="emptyHighlights[index]"
                    :interfaceHighlights="interfaceHighlights.target[index]"
                    :queryInterfaceHighlights="interfaceHighlights.query[index]"
                    :hover="getAlignmentHover(index)"
                    :colorscheme="colorscheme"
                    @residuePointerMove="onResiduePointerMove"
                    @residuePointerLeave="onResiduePointerLeave"
                />
            </template>
        </div>
        <div class="alignment-structure-wrapper">
            <MolstarStructureViewer
                v-if="alignments.length > 0"
                :key="`interface-structure-${alignments[0].id}`"
                class="structure-panel"
                :scene="foldseekResult"
                :scene-input="structureSceneInput"
                :toolbar="structureToolbar"
                bg-color-light="white"
                bg-color-dark="#1E1E1E"
                @makeImage="handleMakeImage"
                @makeCIF="handleMakeCIF"
                @toggleQuery="handleToggleQuery"
                @toggleTarget="handleToggleTarget"
                @toggleArrows="handleToggleArrows"
                @sceneState="handleStructureSceneState"
            />
        </div>
    </div>
</template>

<script>
import Alignment from './Alignment.vue';
import { foldseekResult } from './molstar/foldseekResult.js';
import { prepareFoldseekStructureInput } from './molstar/foldseekData.js';
import { getChainName } from './molstar/foldseekUtilities.js';
import { downloadBlob, exportAlignmentTitle, getResiduePointerOffset, makePositionMap } from './alignmentPanelUtils.js';

export default {
    name: 'InterfaceAlignmentPanel',
    components: {
        Alignment,
        MolstarStructureViewer: () => import('./molstar/StructureViewer.vue'),
    },
    props: {
        alignments: { type: Array, required: true },
        lineLen: { type: Number, required: true },
        hits: { type: Object },
    },
    data: () => ({
        foldseekResult,
        foldseekStructureInput: {},
        hasQueryStructure: true,
        showQuery: 0,
        showTarget: 0,
        showArrows: false,
        tmAlignResults: null,
        queryMaps: [],
        targetMaps: [],
        sceneInterfaceRegions: { query: [], target: [] },
        structureHover: null,
        structureFocus: null,
        alignmentHover: null,
        hoverFocusTimer: null,
        colorscheme: 'clustal2',
    }),
    computed: {
        emptyHighlights() {
            return this.alignments.map(alignment => (
                new Array(Math.ceil(alignment.qAln.length / this.lineLen)).fill([undefined, undefined])
            ));
        },
        interfaceHighlights() {
            return {
                query: this.alignments.map((alignment, index) => (
                    this.lineRangesForInterface(index, 'query', getChainName(alignment.query))
                )),
                target: this.alignments.map((alignment, index) => (
                    this.lineRangesForInterface(index, 'target', getChainName(alignment.target))
                )),
            };
        },
        structureToolbar() {
            return {
                showQuery: this.showQuery,
                showTarget: this.showTarget,
                showArrows: this.showArrows,
                disableQueryButton: !this.hasQueryStructure,
                disableTargetButton: false,
                disableArrowButton: true,
                cifButtonLabel: 'Save CIF',
            };
        },
        structureSceneInput() {
            return {
                ...this.foldseekStructureInput,
                structureMode: 'interface',
                interfaceCutoff: 10,
                showQuery: this.showQuery,
                showTarget: this.showTarget,
                showArrows: this.showArrows,
                highlightSelections: [],
                hoverSelection: this.structureHover,
                focusSelection: this.structureFocus,
            };
        },
    },
    methods: {
        async prepareStructureViewer() {
            if (__APP__ !== 'foldseek') return;

            const input = await prepareFoldseekStructureInput({
                alignments: this.alignments,
                hits: this.hits,
                axios: this.$axios,
                route: this.$route,
                root: this.$root,
                isLocal: this.$LOCAL,
                structureMode: 'interface',
                interfaceCutoff: 10,
            });

            this.foldseekStructureInput = input;
            this.hasQueryStructure = Boolean(input.hasQuery);
        },
        updateMaps() {
            this.queryMaps = this.alignments.map(alignment => makePositionMap(alignment.qStartPos, alignment.qAln));
            this.targetMaps = this.alignments.map(alignment => makePositionMap(alignment.dbStartPos, alignment.dbAln));
        },
        lineRangesForInterface(index, side, chain) {
            const map = side === 'query' ? this.queryMaps[index] : this.targetMaps[index];
            const alignment = this.alignments[index];
            if (!map || !alignment) return [];

            const regions = (this.sceneInterfaceRegions[side] || []).filter(region => region.chain === chain);
            const lineCount = Math.ceil(alignment.qAln.length / this.lineLen);
            const lines = Array.from({ length: lineCount }, () => []);
            if (regions.length === 0) return lines;

            for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
                let start = null;
                for (let offset = 0; offset < this.lineLen; offset++) {
                    const alnOffset = lineIndex * this.lineLen + offset;
                    if (alnOffset >= map.length) break;
                    const residue = map[alnOffset];
                    const isInterface = Number.isFinite(residue)
                        && regions.some(region => residue >= region.start && residue <= region.end);
                    if (isInterface && start === null) start = offset;
                    if ((!isInterface || offset === this.lineLen - 1 || alnOffset === map.length - 1) && start !== null) {
                        const end = isInterface ? offset + 1 : offset;
                        lines[lineIndex].push([start, end]);
                        start = null;
                    }
                }
            }
            return lines;
        },
        chainOf(name) {
            return getChainName(name);
        },
        handleToggleQuery() {
            this.showQuery = this.showQuery === 2 ? 0 : this.showQuery + 1;
        },
        handleToggleTarget() {
            this.showTarget = this.showTarget === 2 ? 0 : this.showTarget + 1;
        },
        handleToggleArrows() {
            this.showArrows = false;
        },
        getAlignmentHover(index) {
            return this.alignmentHover?.index === index ? this.alignmentHover : null;
        },
        onResiduePointerMove(event, alnIndex, lineNo, side = 'target') {
            const span = event.currentTarget;
            const offset = this.getResiduePointerOffset(event, span);
            const map = side === 'query' ? this.queryMaps[alnIndex] : this.targetMaps[alnIndex];
            const residue = map?.[(lineNo - 1) * this.lineLen + offset];
            if (!Number.isFinite(residue)) {
                this.clearHover();
                return;
            }
            if (
                this.structureHover?.side === side
                && this.structureHover?.index === alnIndex
                && this.structureHover?.start === residue
            ) return;
            this.setHover({
                side,
                index: alnIndex,
                lineNo,
                offset,
                structureSelection: { side, index: alnIndex, start: residue, length: 1 },
            }, true);
        },
        onResiduePointerLeave() {
            this.clearHover();
        },
        handleMakeImage(blob) {
            downloadBlob(blob, `${exportAlignmentTitle(this.alignments, this.hasQueryStructure)}.png`);
        },
        handleMakeCIF(cif) {
            if (!cif) return;
            downloadBlob(new Blob([cif], { type: 'text/plain' }), `${exportAlignmentTitle(this.alignments, this.hasQueryStructure)}.cif`);
        },
        handleStructureSceneState(state) {
            this.tmAlignResults = state?.tmAlignResults || null;
            this.sceneInterfaceRegions = state?.interfaceRegions || { query: [], target: [] };
        },
        setHover(hover, allowDelayedFocus) {
            this.setAlignmentHover(hover);
            this.structureHover = hover.structureSelection;

            if (allowDelayedFocus) {
                this.scheduleHoverFocus(hover.structureSelection);
            } else {
                this.clearHoverFocusTimer();
            }
        },
        setAlignmentHover(hover) {
            this.alignmentHover = {
                side: hover.side,
                index: hover.index,
                lineNo: hover.lineNo,
                offset: hover.offset,
            };
        },
        clearHover() {
            this.structureHover = null;
            this.alignmentHover = null;
            this.clearHoverFocusTimer();
        },
        clearHoverFocusTimer() {
            if (this.hoverFocusTimer) {
                clearTimeout(this.hoverFocusTimer);
                this.hoverFocusTimer = null;
            }
        },
        scheduleHoverFocus(selection) {
            this.clearHoverFocusTimer();
            if (!selection) return;

            const key = `${selection.side}:${selection.index}:${selection.start}`;
            this.hoverFocusTimer = setTimeout(() => {
                const activeKey = this.structureHover
                    ? `${this.structureHover.side}:${this.structureHover.index}:${this.structureHover.start}`
                    : null;
                if (activeKey !== key) return;
                this.structureFocus = { ...selection, token: Date.now() };
            }, 800);
        },
        getResiduePointerOffset(event, span) {
            return getResiduePointerOffset(event, span);
        },
    },
    watch: {
        alignments: {
            deep: true,
            handler() {
                this.updateMaps();
                this.prepareStructureViewer();
            },
        },
        hits: {
            deep: true,
            handler() {
                this.prepareStructureViewer();
            },
        },
    },
    beforeMount() {
        this.updateMaps();
    },
    mounted() {
        this.prepareStructureViewer();
    },
    beforeDestroy() {
        this.clearHoverFocusTimer();
    },
};
</script>

<style scoped>
.alignment-panel {
    display: inline-flex;
    flex-wrap: nowrap;
    justify-content: center;
    width: 100%;
}

.alignment-wrapper-outer {
    display: inline-flex;
    flex-direction: column;
}

.alignment-header {
    line-height: 1.2em;
    margin-bottom: 0.75em;
}

.alignment-title {
    margin-top: 0.5em;
    font-weight: 500;
}

.alignment-structure-wrapper {
    min-width: 450px;
    width: 500px;
    height: 400px;
    flex: 0 0 500px;
    margin: 0;
    margin-bottom: auto;
    overflow: hidden;
}

.structure-panel {
    width: 100%;
    height: 100%;
    margin: 0 auto;
}

@media screen and (max-width: 960px) {
    .alignment-panel {
        display: flex;
        flex-direction: column-reverse;
    }

    .alignment-wrapper-outer,
    .alignment-structure-wrapper {
        align-self: center;
    }

    .alignment-structure-wrapper {
        width: 100%;
        min-width: 0;
        padding-bottom: 1em;
    }
}

@media screen and (min-width: 961px) {
    .alignment-structure-wrapper {
        padding-left: 2em;
    }
}
</style>

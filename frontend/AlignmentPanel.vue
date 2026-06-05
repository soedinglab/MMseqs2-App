<template>
    <div class="alignment-panel" slot="content">
        <div class="alignment-wrapper-outer">
            <div class="alignment-content">
                <div class="alignment-header">
                    <div class="alignment-controls">
                        <v-select
                            class="alignment-colorscheme"
                            persistent-hint
                            label="Colorscheme"
                            v-model="colorscheme"
                            :items="schemes"
                            attach
                        >
                        <template v-slot:item="{ item, on, attrs }">
                            <v-list-item two-line v-on="on" v-bind="attrs">
                                <v-list-item-content>
                                   <v-list-item-title>{{ item.text }}</v-list-item-title>
                                   <v-list-item-subtitle :class="item.value" v-if="alignments && alignments.length > 0">{{ alignments[0].qAln.substring(0, 25) }}&hellip;</v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </template>
                        </v-select>
                        <v-btn
                            class="alignment-clear-button"
                            small
                            title="Clear sequence selection"
                            @click="clearAllSelection"
                            :disabled="hasSelection"
                        >
                            {{ (alignments[0].hasOwnProperty("complexu")) ? "Clear all selections" : "Clear selection" }}&nbsp;
                            <v-icon style="width: 16px;">{{ $MDI.CloseCircle }}</v-icon>
                        </v-btn>
                    </div>
                    <small v-if="$APP == 'foldseek'" class="alignment-hint">
                        Select query or target residues to highlight their structure.<br style="height: 0.2em">
                        Click on highlighted sequences to dehighlight the corresponding chain.
                    </small>
                </div>

                <div
                    class="alignment-entry"
                    v-for="(alignment, index) in alignments"
                        :key="alignmentKey(alignment, index)"
                >
                    <div class="alignment-title">
                        {{ alignment.query.lastIndexOf('_') != -1 ? alignment.query.substring(alignment.query.lastIndexOf('_')+1) : '' }} ➔ {{ alignment.target }}
                    </div>
                    <Alignment
                        :alnIndex="index"
                        :alignment="alignment"
                        :lineLen="effectiveLineLen"
                        :queryMap="queryMaps[index]"
                        :targetMap="targetMaps[index]"
                        :highlights="highlights[index]"
                        :queryHighlights="queryHighlights[index]"
                        :hover="getAlignmentHover(index)"
                        :colorscheme="colorscheme"
                        ref="alignments"
                        @residueSelectStart="onResidueSelectStart"
                        @residuePointerDown="onResiduePointerDown"
                        @residuePointerUp="onResiduePointerUp"
                        @residuePointerMove="onResiduePointerMove"
                        @residuePointerLeave="onResiduePointerLeave"
                        @residueClickHighlight="onResidueClickHighlight"
                    />
                </div>
            </div>
        </div>
        <div v-if=" $APP == 'foldseek'" class="alignment-structure-wrapper">
            <MolstarStructureViewer
                v-if="alignments.length > 0 && 'tCa' in alignments[0]"
                :key="`struc2-${alignments[0].id}`"
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
                @sceneEvent="handleStructureSceneEvent"
                @sceneState="handleStructureSceneState"
            >
                <template v-slot:overlay>
                    <table v-if="tmAlignResults" class="tmscore-panel" v-bind="tmPanelBindings">
                        <tr>
                            <td class="left-cell">TM-Score:</td>
                            <td class="right-cell">{{ tmAlignResults.tmScore }}</td>
                        </tr>
                        <tr>
                            <td class="left-cell">RMSD:</td>
                            <td class="right-cell">{{ tmAlignResults.rmsd }}</td>
                        </tr>
                    </table>
                    <StructureHoverTooltip :value="structureHoverInfo" />
                </template>
            </MolstarStructureViewer>
        </div>
    </div>
</template>

<script>
import Alignment from './Alignment.vue'
import StructureHoverTooltip from './StructureHoverTooltip.vue'
import { foldseekResult } from './molstar/foldseekResult.js';
import { resolvedChainForState } from './molstar/foldseekSelections.js';
import { getChainName } from './molstar/foldseekUtilities.js'
import { downloadBlob, exportAlignmentTitle, getResiduePointerOffset, makePositionMap, residueTextOffset } from './alignmentPanelUtils.js';
import { prepareFoldseekStructureInput } from './molstar/foldseekData.js';

export default {
    components: {
        MolstarStructureViewer: () => import('./molstar/StructureViewer.vue'),
        Alignment,
        StructureHoverTooltip,
    },
    data: () => ({
        foldseekResult,
        foldseekStructureInput: {},
        queryMaps: [],
        targetMaps: [],
        hasQueryStructure: true,
        tmAlignResults: null,
        showArrows: false,
        showQuery: 0,
        showTarget: 0,
        highlights: [],
        queryHighlights: [],
        structureHighlights: [],
        queryStructureHighlights: [],
        structureHover: null,
        structureHoverInfo: null,
        structureFocus: null,
        alignmentHover: null,
        sceneChainOverrides: { query: {}, target: {} },
        hoverFocusTimer: null,
        isSelecting: false,
        isPointerDown: false,
        adaptiveLineLen: null,
        resizeObserver: null,
        cachedResidueCharWidth: null,
        observedContainerWidth: null,
        resizeFrame: null,
        colorscheme: 'clustal2',
        schemes: [
            { text: "Clustal2", value: "clustal2" },
            { text: "Buried", value: "buried" },
            { text: "Cinema", value: "cinema" },
            { text: "Helix", value: "helix" },
            { text: "Hydrophobicity", value: "hydrophobicity" },
            { text: "Lesk", value: "lesk" },
            { text: "MAE", value: "mae" },
            { text: "Strand", value: "strand" },
            { text: "Taylor", value: "taylor" },
            { text: "Turn", value: "turn" },
            { text: "Zappo", value: "zappo" },
        ],
    }),
    props: {
        alignments: { type: Array, required: true, },
        lineLen: { type: Number, required: true, },
        hits: { type: Object },
        searchType: { type: String },
    },
    computed: {
        effectiveLineLen() {
            return this.adaptiveLineLen || this.lineLen;
        },
        hasSelection() {
            return !this.structureHighlights.some(e => e !== null)
                && !this.queryStructureHighlights.some(e => e !== null);
        },
        structureToolbar() {
            return {
                showQuery: this.showQuery,
                showTarget: this.showTarget,
                showArrows: this.showArrows,
                disableQueryButton: !this.hasQueryStructure,
                disableTargetButton: false,
                disableArrowButton: !this.hasQueryStructure,
                cifButtonLabel: 'Save CIF',
            };
        },
        structureSceneInput() {
            return {
                ...this.foldseekStructureInput,
                structureMode: this.structureMode,
                showQuery: this.showQuery,
                showTarget: this.showTarget,
                showArrows: this.showArrows,
                highlightSelections: [
                    ...this.queryStructureHighlights
                        .map((value, index) => value ? { side: 'query', index, start: value[0], length: value[1] } : null),
                    ...this.structureHighlights
                        .map((value, index) => value ? { side: 'target', index, start: value[0], length: value[1] } : null),
                ].filter(Boolean),
                hoverSelection: this.structureHover,
                focusSelection: this.structureFocus,
            };
        },
        tmPanelBindings() {
            return this.$vuetify.breakpoint.mdAndDown
                ? {}
                : { style: this.$vuetify.theme.dark ? 'color: white;' : '' };
        },
        structureMode() {
            if (this.searchType === 'interfacesearch') return 'interface';
            if (this.hits?.type === 'complexsearch') return 'multimer';
            return 'alignment';
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
                structureMode: this.structureMode,
            });

            this.foldseekStructureInput = input;
            this.hasQueryStructure = Boolean(input.hasQuery);
        },
        handleToggleQuery() {
            if (__LOCAL__) {
                this.showQuery = this.showQuery === 0 ? 1 : 0;
            } else {
                this.showQuery = this.showQuery === 2 ? 0 : this.showQuery + 1;
            }
        },
        handleToggleTarget() {
            if (__LOCAL__) {
                this.showTarget = this.showTarget === 0 ? 1 : 0;
            } else {
                this.showTarget = this.showTarget === 2 ? 0 : this.showTarget + 1;
            }
        },
        handleToggleArrows() {
            this.showArrows = !this.showArrows;
        },
        handleMakeImage(blob) {
            downloadBlob(blob, `${exportAlignmentTitle(this.alignments, this.hasQueryStructure)}.png`);
        },
        handleMakeCIF(cif) {
            if (!cif) return;
            downloadBlob(new Blob([cif], { type: 'text/plain' }), `${exportAlignmentTitle(this.alignments, this.hasQueryStructure)}.cif`);
        },
        getFirstResidueNumber(map, i) {
            let start = this.effectiveLineLen * (i - 1);
            while (map[start] === null) start--;
            return map[start];
        },
        getQueryRowStartPos(alnIndex, i) { return this.getFirstResidueNumber(this.queryMaps[alnIndex], i) },
        getTargetRowStartPos(alnIndex, i) { return this.getFirstResidueNumber(this.targetMaps[alnIndex], i) },
        getAlignmentHover(index) {
            return this.alignmentHover?.index === index ? this.alignmentHover : null;
        },
        alignmentKey(alignment, index) {
            const id = alignment.id ?? `${alignment.query || ''}-${alignment.target || ''}`;
            return `aln2-${index}-${id}`;
        },
        updateAdaptiveLineLen() {
            if (!this.$el || !this.alignments?.length || !this.observedContainerWidth) return;

            const panelWidth = this.observedContainerWidth;
            const structureEl = this.$el.querySelector('.alignment-structure-wrapper');
            const structureWidth = structureEl
                ? Math.round(structureEl.getBoundingClientRect().width)
                : 0;
            const gap = structureWidth ? this.alignmentPanelGap() : 0;
            const labelWidth = 80;
            const charWidth = this.cachedResidueCharWidth || this.measureResidueCharWidth();

            const availableWidth = Math.max(260, panelWidth - structureWidth - gap - labelWidth);
            const maxAlignmentLength = Math.max(...this.alignments.map(alignment => alignment.alnLength || alignment.qAln?.length || 0));
            const next = Math.max(20, Math.min(maxAlignmentLength || this.lineLen, Math.floor(availableWidth / charWidth)));

            if (!this.adaptiveLineLen || Math.abs(next - this.adaptiveLineLen) > 1) {
                this.clearHover();
                this.adaptiveLineLen = next;
                this.redrawAlignmentSelections();
            }
        },
        alignmentPanelGap() {
            if (typeof window === 'undefined') return 32;
            const style = window.getComputedStyle(this.$el);
            return Number.parseFloat(style.columnGap || style.gap) || 32;
        },
        measureResidueCharWidth() {
            if (this.cachedResidueCharWidth) return this.cachedResidueCharWidth;
            if (typeof document === 'undefined') return 10;

            const probe = document.createElement('span');
            probe.className = 'residues';
            probe.style.position = 'absolute';
            probe.style.visibility = 'hidden';
            probe.style.pointerEvents = 'none';
            probe.style.whiteSpace = 'pre';
            probe.textContent = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
            document.body.appendChild(probe);
            const width = probe.getBoundingClientRect().width / probe.textContent.length;
            document.body.removeChild(probe);

            this.cachedResidueCharWidth = width > 0 ? width : 10;
            return this.cachedResidueCharWidth;
        },
        resizeTarget() {
            return this.$el?.parentElement || this.$el;
        },
        handleWindowResize() {
            this.setObservedContainerWidth(this.resizeTarget()?.clientWidth);
        },
        setObservedContainerWidth(width) {
            const next = Math.round(width || 0);
            if (!next || next === this.observedContainerWidth) return;
            this.observedContainerWidth = next;

            if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
            this.resizeFrame = requestAnimationFrame(() => {
                this.resizeFrame = null;
                this.updateAdaptiveLineLen();
            });
        },
        setEmptyHighlight() {
            this.highlights = this.alignments.map(a => new Array(Math.ceil(a.qAln.length / this.effectiveLineLen)).fill([undefined, undefined]))
            this.queryHighlights = this.alignments.map(a => new Array(Math.ceil(a.qAln.length / this.effectiveLineLen)).fill([undefined, undefined]))
        },
        setEmptyStructureHighlight() {
            this.structureHighlights = new Array(this.alignments.length).fill(null);
            this.queryStructureHighlights = new Array(this.alignments.length).fill(null);
        },
        clearAllSelection() {
            this.setEmptyHighlight();
            this.setEmptyStructureHighlight();
        },
        setSideHighlight(side) {
            const value = this.alignments.map(a => new Array(Math.ceil(a.qAln.length / this.effectiveLineLen)).fill([undefined, undefined]));
            if (side === 'query') this.queryHighlights = value;
            else this.highlights = value;
        },
        setAlignmentSelection(selections, side = 'target') {
            // array per alignment, then array per line in alignment
            this.setSideHighlight(side);
            const highlights = side === 'query' ? this.queryHighlights : this.highlights;
            for (let [ alnId, startLine, startOffset, endLine, endOffset, _ ] of selections) {
                for (let i = startLine; i <= endLine; i++) {
                    if (i === startLine) {
                        highlights[alnId][i] = [startOffset, (i === endLine) ? endOffset : this.effectiveLineLen];
                    } else if (i === endLine) {
                        highlights[alnId][i] = [0, endOffset];
                    } else {
                        highlights[alnId][i] = [0, this.effectiveLineLen];
                    }
                }
            }
        },
        redrawAlignmentSelections() {
            this.highlights = this.structureHighlights.map((selection, index) => (
                this.alignmentHighlightFromResidueSelection(index, selection, 'target')
            ));
            this.queryHighlights = this.queryStructureHighlights.map((selection, index) => (
                this.alignmentHighlightFromResidueSelection(index, selection, 'query')
            ));
        },
        alignmentHighlightFromResidueSelection(alnIndex, selection, side) {
            const alignment = this.alignments[alnIndex];
            const empty = new Array(Math.ceil((alignment?.qAln?.length || 0) / this.effectiveLineLen)).fill([undefined, undefined]);
            if (!alignment || !selection) return empty;

            const [seqStart, seqLength] = selection;
            const seqEnd = seqStart + seqLength;
            const map = side === 'query' ? this.queryMaps[alnIndex] : this.targetMaps[alnIndex];
            const offsets = [];
            for (let i = 0; i < map.length; i++) {
                const residue = map[i];
                if (Number.isFinite(residue) && residue >= seqStart && residue < seqEnd) {
                    offsets.push(i);
                }
            }
            if (offsets.length === 0) return empty;

            const start = offsets[0];
            const end = offsets[offsets.length - 1] + 1;
            const startLine = Math.floor(start / this.effectiveLineLen);
            const endLine = Math.floor((end - 1) / this.effectiveLineLen);

            for (let line = startLine; line <= endLine; line++) {
                const lineStart = line * this.effectiveLineLen;
                const lineEnd = lineStart + this.effectiveLineLen;
                empty[line] = [
                    Math.max(0, start - lineStart),
                    Math.min(this.effectiveLineLen, end - lineStart, lineEnd - lineStart),
                ];
            }
            return empty;
        },
        updateMaps() {
            if (!this.alignments) return
            this.queryMaps = [];
            this.targetMaps = [];
            for (let alignment of this.alignments) {
                this.queryMaps.push(makePositionMap(alignment.qStartPos, alignment.qAln));
                this.targetMaps.push(makePositionMap(alignment.dbStartPos, alignment.dbAln));
            }

        },
        onResidueSelectStart(event, alnIndex, lineNo, side = 'target') {
            this.isSelecting = true;
            this.clearHover();
            const wrapper = this.$el.querySelector(".alignment-wrapper-outer");
            wrapper?.classList.remove("inselection-query", "inselection-target");
            wrapper?.classList.add("inselection", `inselection-${side}`);
        },
        onResiduePointerDown() {
            this.isPointerDown = true;
            this.clearHover();
        },
        onResiduePointerUp(event, targetAlnIndex, targetLineNo, side = 'target') {
            if (!this.isSelecting) {
                this.clearSelection(side, targetAlnIndex);
                window.getSelection().removeAllRanges();
                this.isPointerDown = false;
                return;
            }
            const selection = window.getSelection();
            const chunks = this.getSelectedChunks(selection, side);

            // For structure: aln Id, start in sequence, selection length
            for (let [ alnId, { seqStart, seqLength } ] of chunks) {
                if (side === 'query') {
                    this.queryStructureHighlights.splice(alnId, 1, [seqStart, seqLength]);
                } else {
                    this.structureHighlights.splice(alnId, 1, [seqStart, seqLength]);
                }
            }
            
            // For sequence: aln Id, line and start position (in start line), line and end position (in end line)
            this.setAlignmentSelection(chunks.map(([ alnId, { startLine, startOffset, endLine, endOffset }, chunk ]) => (
                [ alnId, startLine - 1, startOffset, endLine - 1, endOffset, chunk.length ]
            )), side);

            // Make everything else selectable again
            this.resetUserSelect();

            // Clear selection afterwards to prevent weird highlighting after inserting spans
            window.getSelection().removeAllRanges();
        },
        onResidueClickHighlight(event, alnIndex, lineNo, side = 'target') {
            event.preventDefault();
            event.stopPropagation();
            this.clearSelection(side, alnIndex);
            window.getSelection().removeAllRanges();
        },
        onResiduePointerMove(event, alnIndex, lineNo, side = 'target') {
            if (this.isSelecting || this.isPointerDown) return;

            const span = event.currentTarget;
            const offset = this.getResiduePointerOffset(event, span);
            const map = side === 'query' ? this.queryMaps[alnIndex] : this.targetMaps[alnIndex];
            const residue = map?.[(lineNo - 1) * this.effectiveLineLen + offset];
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
        handleStructureSceneEvent(event) {
            if (event?.type !== 'structure-hover' && event?.type !== 'structure-click') return;
            if (!event.residue) {
                if (event.type === 'structure-hover') this.clearHover();
                return;
            }

            if (event.sequenceMappable === false) {
                if (event.type === 'structure-hover') {
                    this.structureHoverInfo = this.structureTooltipInfo(event, null);
                    this.structureHover = null;
                    this.alignmentHover = null;
                    this.clearHoverFocusTimer();
                } else {
                    this.clearHover();
                }
                return;
            }

            const hover = this.findStructureResidueHover(event.side, event.chain, event.residues || [event.residue]);
            if (!hover) {
                if (event.type === 'structure-hover') {
                    this.structureHoverInfo = this.structureTooltipInfo(event, null);
                    this.structureHover = null;
                    this.alignmentHover = null;
                    this.clearHoverFocusTimer();
                } else {
                    this.clearHover();
                }
                return;
            }

            if (event.type === 'structure-hover') {
                this.structureHoverInfo = this.structureTooltipInfo(event, hover);
                if (event.hoverSource === 'molstar') {
                    hover.structureSelection = {
                        ...hover.structureSelection,
                        source: 'molstar',
                        hoverKey: event.hoverKey,
                    };
                }
            }
            this.setHover(hover, false);
            if (event.type === 'structure-click') {
                this.structureFocus = { ...hover.structureSelection, token: Date.now() };
            }
        },
        structureTooltipInfo(event, hover) {
            return {
                ...event,
                name: hover
                    ? this.structureDisplayName(event.side, hover.index) || event.name
                    : event.name,
            };
        },
        structureDisplayName(side, index) {
            const alignment = this.alignments[index ?? 0];
            if (!alignment) return '';
            return side === 'query'
                ? (alignment.query || '')
                : (alignment.target || '');
        },
        handleStructureSceneState(state) {
            this.tmAlignResults = state?.tmAlignResults || null;
            this.sceneChainOverrides = state?.chainOverrides || { query: {}, target: {} };
        },
        findStructureResidueHover(side, chain, residues) {
            const residueCandidates = Array.isArray(residues) ? residues : [residues];
            const chainState = { chainOverrides: this.sceneChainOverrides };
            for (let index = 0; index < this.alignments.length; index++) {
                const alignment = this.alignments[index];
                const alignmentName = side === 'query' ? alignment.query : alignment.target;
                const alignmentChain = resolvedChainForState(chainState, side, getChainName(alignmentName));
                if (chain && chain !== alignmentChain) continue;

                const map = side === 'query' ? this.queryMaps[index] : this.targetMaps[index];
                const residue = residueCandidates.find(value => map?.includes(value));
                const alnOffset = map?.indexOf(residue);
                if (alnOffset < 0) continue;

                return {
                    side,
                    index,
                    lineNo: Math.floor(alnOffset / this.effectiveLineLen) + 1,
                    offset: alnOffset % this.effectiveLineLen,
                    structureSelection: { side, index, start: residue, length: 1 },
                };
            }
            return null;
        },
        setHover(hover, allowDelayedFocus) {
            this.alignmentHover = {
                side: hover.side,
                index: hover.index,
                lineNo: hover.lineNo,
                offset: hover.offset,
            };
            this.structureHover = hover.structureSelection;

            if (allowDelayedFocus) {
                this.scheduleHoverFocus(hover.structureSelection);
            } else {
                this.clearHoverFocusTimer();
            }
        },
        clearHover() {
            this.structureHover = null;
            this.structureHoverInfo = null;
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
        clearSelection(side, alnIndex) {
            const alignment = this.alignments[alnIndex];
            if (!alignment) return;
            const empty = new Array(Math.ceil(alignment.qAln.length / this.effectiveLineLen)).fill([undefined, undefined]);
            if (side === 'query') {
                this.queryHighlights.splice(alnIndex, 1, empty);
                this.queryStructureHighlights.splice(alnIndex, 1, null);
            } else {
                this.highlights.splice(alnIndex, 1, empty);
                this.structureHighlights.splice(alnIndex, 1, null);
            }
            if (this.structureHover?.side === side && this.structureHover?.index === alnIndex) this.clearHover();
        },
        getSelectedChunks(selection, side = 'target') {
            if (!selection || selection.rangeCount === 0) return [];

            const segments = [];
            const residueSpans = Array.from(this.$el.querySelectorAll(`.alignment-wrapper-inner span.residues.${side}`));
            for (let i = 0; i < selection.rangeCount; i++) {
                const range = selection.getRangeAt(i);
                for (const span of residueSpans) {
                    if (!range.intersectsNode(span)) continue;

                    const line = span.closest(".line");
                    const wrapper = span.closest(".alignment-wrapper-inner");
                    const lineNo = parseInt(line.id);
                    const alnId = parseInt(wrapper.id);
                    let startOffset = span.contains(range.startContainer)
                        ? residueTextOffset(range.startContainer, range.startOffset)
                        : 0;
                    let endOffset = span.contains(range.endContainer)
                        ? residueTextOffset(range.endContainer, range.endOffset, true)
                        : span.textContent.length;

                    startOffset = Math.max(0, Math.min(startOffset, span.textContent.length));
                    endOffset = Math.max(0, Math.min(endOffset, span.textContent.length));
                    if (endOffset <= startOffset) continue;

                    segments.push({
                        alnId,
                        lineNo,
                        startOffset,
                        endOffset,
                        text: span.textContent.slice(startOffset, endOffset),
                    });
                }
            }

            const byAlignment = new Map();
            for (const segment of segments) {
                if (!byAlignment.has(segment.alnId)) byAlignment.set(segment.alnId, []);
                byAlignment.get(segment.alnId).push(segment);
            }

            const chunks = [];
            for (const [alnId, alignmentSegments] of byAlignment.entries()) {
                alignmentSegments.sort((a, b) => a.lineNo - b.lineNo || a.startOffset - b.startOffset);
                const first = alignmentSegments[0];
                const last = alignmentSegments[alignmentSegments.length - 1];
                const residueMap = side === 'query' ? this.queryMaps[alnId] : this.targetMaps[alnId];
                let seqStart = null;
                let seqLength = 0;

                for (const segment of alignmentSegments) {
                    const alnStart = (segment.lineNo - 1) * this.effectiveLineLen + segment.startOffset;
                    const alnEnd = (segment.lineNo - 1) * this.effectiveLineLen + segment.endOffset;
                    for (let i = alnStart; i < alnEnd; i++) {
                        if (residueMap[i] === null || typeof residueMap[i] === 'undefined') continue;
                        if (seqStart === null) seqStart = residueMap[i];
                        seqLength += 1;
                    }
                }

                if (seqStart === null || seqLength === 0) continue;
                chunks.push([
                    alnId,
                    {
                        startLine: first.lineNo,
                        startOffset: first.startOffset,
                        endLine: last.lineNo,
                        endOffset: last.endOffset,
                        seqStart,
                        seqLength,
                    },
                    alignmentSegments.map(segment => segment.text).join(''),
                ]);
            }
            return chunks;
        },
        resetUserSelect() {
            this.isSelecting = false;
            this.isPointerDown = false;
            let noselects = document.querySelectorAll(".inselection");
            noselects.forEach(el => {
                el.classList.remove("inselection", "inselection-query", "inselection-target")
            });
        }
    },
    watch: {
        alignments: {
            deep: true,
            handler() {
                this.updateMaps();
                this.prepareStructureViewer();
                this.$nextTick(() => this.setObservedContainerWidth(this.resizeTarget()?.clientWidth));
            },
        },
        hits: {
            deep: true,
            handler() {
                this.prepareStructureViewer();
            },
        },
        'alignment': function() {
            this.updateMaps()
        }
    },
    beforeMount() {
        this.adaptiveLineLen = this.lineLen;
        this.updateMaps()
        this.setEmptyHighlight();
        this.setEmptyStructureHighlight();
    },
    async mounted() {
        this.prepareStructureViewer();
        this.$nextTick(() => {
            this.measureResidueCharWidth();
            this.setObservedContainerWidth(this.resizeTarget()?.clientWidth);
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver((entries) => {
                    const entry = entries[0];
                    const box = Array.isArray(entry?.borderBoxSize) ? entry.borderBoxSize[0] : entry?.borderBoxSize;
                    const width = box?.inlineSize ?? entry?.contentRect?.width;
                    this.setObservedContainerWidth(width);
                });
                const target = this.resizeTarget();
                if (target) this.resizeObserver.observe(target);
            }
            window.addEventListener('resize', this.handleWindowResize);
        });
    },
    beforeDestroy() {
        this.clearHoverFocusTimer();
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
        window.removeEventListener('resize', this.handleWindowResize);
    },
}
</script>

<style scoped>
.alignment-panel {
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-start;
    align-items: flex-start;
    width: 100%;
    gap: 2em;
    overflow-x: auto;
}

.alignment-wrapper-outer {
    flex: 0 1 auto;
    min-width: 0;
}

.alignment-content {
    display: inline-flex;
    flex-direction: column;
    width: max-content;
    min-width: min(100%, 28rem);
}

.alignment-header {
    line-height: 1.2em;
    display: flex;
    flex-direction: column;
    width: 100%;
    justify-content: space-between;
    margin-bottom: 1em;
}

.alignment-controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    width: 100%;
}

.alignment-colorscheme {
    flex: 1 1 auto;
    min-width: 0;
}

.alignment-clear-button {
    flex: 0 0 auto;
}

.alignment-hint {
    display: block;
    width: 100%;
}

.alignment-entry {
    display: block;
}

.alignment-title {
    display: block;
}

.alignment-wrapper-inner {
    padding-bottom: 1em;
}

.alignment-structure-wrapper {
    flex: 0 0 clamp(440px, 36vw, 680px);
    min-width: 440px;
    width: clamp(440px, 36vw, 680px);
    max-width: 680px;
    height: 400px;
    margin: 0;
    margin-bottom: auto;
    overflow: hidden;
}

.structure-panel {
    width: 100%;
    height: 100%;
    margin: 0 auto;
}

.tmscore-panel {
    position: absolute;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 2;
    pointer-events: none;
}

.tmscore-panel .left-cell {
    text-align: right;
    padding-right: 0.35em;
}

.tmscore-panel .right-cell {
    text-align: left;
}

</style>

<style>
span.selected {
    border-radius: 4px;
    background-color: rgba(0, 255, 255, 0.1);
    box-shadow: 0 0 .4em .1em rgba(0, 255, 255, 0.5);
    cursor: pointer;
}
span.hovered {
    border-radius: 4px;
    background-color: rgba(255, 64, 255, 0.16);
    box-shadow: 0 0 .3em .08em rgba(255, 64, 255, 0.55);
}

.alignment-wrapper-outer.inselection,
.alignment-wrapper-outer.inselection * {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
}

.alignment-wrapper-outer.inselection-query span.residues.query,
.alignment-wrapper-outer.inselection-query span.residues.query *,
.alignment-wrapper-outer.inselection-target span.residues.target,
.alignment-wrapper-outer.inselection-target span.residues.target * {
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    user-select: text !important;
}

.alignment-wrapper-outer.inselection-query span.residues.target::selection,
.alignment-wrapper-outer.inselection-query span.residues.target *::selection,
.alignment-wrapper-outer.inselection-target span.residues.query::selection,
.alignment-wrapper-outer.inselection-target span.residues.query *::selection {
    color: inherit;
    background: transparent;
}

/* TODO Some sort of banding thing here? */
/* .alignment-wrapper-inner:nth-child(odd) span.selected {
    background-color: rgba(0, 255, 100, 0.1);
    box-shadow: 0 0 .4em .1em rgba(0, 255, 100, 0.5);
} */
</style>

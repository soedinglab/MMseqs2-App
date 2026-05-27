<template>
<div>
    <v-container fluid pa-2 style="overflow: visible; min-height: 100%;">
        <v-row ref="topRow" style="justify-content: center;">
            <v-col class="flex-col" cols="12" sm="5" md="3">
                <v-card style="height: 100%">
                    <v-card-title>Summary</v-card-title>
                    <v-card-text>
                        <v-simple-table style="height: 100%;" id="settings" class="settings auto-height-table">
                            <tbody>
                                <tr v-if="$LOCAL && statistics.hasOwnProperty('db')">
                                    <td>Database</td>
                                    <td id="msa-database">{{ statistics.db }}</td>
                                </tr>
                                <tr v-if="$LOCAL && statistics.hasOwnProperty('msaFile')">
                                    <td>MSA file</td>
                                    <td id="msa-file">{{ statistics.msaFile }}</td>
                                </tr>
                                <tr v-if="statistics.hasOwnProperty('msaLDDT')">
                                    <td>MSA LDDT</td>
                                    <td id="msa-lddt">{{ statistics.msaLDDT.toFixed(3) }}</td>
                                </tr>
                                <tr v-if="statistics.hasOwnProperty('cmdString')">
                                    <td>Command</td>
                                    <td id="msa-cmd">{{ statistics.cmdString }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                    </v-card-text>
                </v-card>
            </v-col>
            <v-col class="flex-col" v-if="tree" cols="12" sm="7" md="4">
                <v-card class="fill-height" style="position: relative; padding-top: 54px" >
                    <v-card-title
                        ref="treeLabel"
                        style="position: absolute; left: 0; top: 0; margin: 0; padding: 16px; z-index: 1;">Guide Tree</v-card-title>
                    <Tree
                        :newick="tree"
                        :order="entries.map(e => e.name)"
                        :selection="structureViewerSelection.map(i => entries[i].name)"
                        :reference="structureViewerReference"
                        :labelWidth="treeLabelWidth"
                        :labelHeight="treeLabelHeight"
                        @newStructureSelection="handleNewStructureViewerSelection"
                        @newStructureReference="handleNewStructureViewerReference"
                    />
                </v-card>
            </v-col>
            <v-col class="flex-col" cols="12" md="5" sm="8">
                <v-card class="fill-height" style="position: relative; padding-top: 54px;">
                    <v-card-title style="position: absolute; left: 0; top: 0; margin: 0; padding: 16px; z-index: 1;">Structure</v-card-title>
                    <div style="padding: 10px; height: 100%; width: 100%;" ref="originalWrapper">
                        <StructureViewerMSA
                            :entries="entries"
                            :selection="structureViewerSelection"
                            :reference="structureViewerReference"
                            :mask="visibleColumnMask"
                            :selectedColumns="selectedColumns"
                            :previewColumn="previewColumn"
                            @loadingChange="handleStructureLoadingChange"
                            @addHighlight="i => pushActiveIndex(i, true)"
                            @removeHighlight="spliceActiveIndex"
                            @changePreview="changePreview"
                            ref="structViewer"
                            id="structure-viewer"
                        />
                    </div>
                    <v-card-text v-if="structureViewerSelection.length == 0" style="position: absolute; top: calc(50% - 27px); left: 0; text-align: center;">
                        No structures loaded.
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-card pa-2 class="msa-viewer-card">
                    <div class="msa-top-left">
                        <MSAConfig
                            v-if="msaViewerReady"
                            :representations="msaViewerState.representations"
                            :active-representation-id="msaViewerState.activeRepresentationId"
                            :schemes="msaViewerState.schemes"
                            :active-scheme="msaViewerState.activeScheme"
                            :active-scheme-source-representation-id="msaViewerState.activeSchemeSourceRepresentationId"
                            :tracks="msaViewerState.tracks"
                            :track-display-mode="msaViewerState.trackDisplayMode"
                            :gap-threshold="gapThreshold"
                            :selection-count="selectedColumns.length"
                            :busy="msaViewerBusy"
                            @change-representation="setMSAViewerRepresentation"
                            @change-scheme="setMSAViewerScheme"
                            @change-track="setMSAViewerTrackEnabled"
                            @reset-track-defaults="resetMSAViewerTrackDefaults"
                            @change-gap-threshold="setMSAViewerGapThreshold"
                            @clear-selection="clearSelection"
                            @export-selection-fasta="exportMSAViewerSelectionAsFasta"
                        />
                    </div>
                    <div class="msa-bottom-left">
                        <v-tooltip
                            bottom
                            transition="fade-transition"
                            nudge-left="48px"
                            nudge-top="4px"
                            color="primary"
                        >
                            <template v-slot:activator="{ on, attrs }">
                                <v-btn
                                    class="floating-viewer-toggle"
                                    :outlined="!showViewer"
                                    color="primary"
                                    fab
                                    dark
                                    v-bind="attrs"
                                    v-on="on"
                                    @click.stop="toggleView"
                                >
                                    <v-icon>{{ $MDI.Monomer }}</v-icon>
                                </v-btn>
                            </template>
                            <span>{{ showViewer ? 'Hide' : 'Show' }} floating viewer</span>
                        </v-tooltip>
                    </div>
                    <div ref="msaViewerRoot" id="msa-viewer-root"></div>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <portal>
        <v-fade-transition
        >
            <div
                id="floating-viewer" v-show="showViewerCondition"
             >
                <v-card style="position: relative; width: 100%; height: 100%; padding: 8px" class="elevation-12">
                    <div 
                        style="display: flex; 
                            flex-direction: row; 
                            justify-content: space-between; 
                            align-items: center;"
                    >
                        <div class="drag-handle" style="flex-grow: 1; align-self: stretch;"/>
                        <v-btn icon @click="toggleView" style="display: block;">
                            <v-icon>
                                {{ $MDI.CloseCircleOutline }}
                            </v-icon>
                        </v-btn>
                    </div>
                    <div style="padding: 6px; height: calc(100% - 36px); width: 100%; position: relative" ref="floatingWrapper">
                        <v-card-text v-if="structureViewerSelection.length == 0" style="position: absolute; top: calc(50% - 45px); left: 0; text-align: center; z-index: 1;">
                            No structures loaded.
                        </v-card-text>
                    </div>
                </v-card>
            </div>
        </v-fade-transition>
    </portal>
</div>
</template>

<script>
import StructureViewerMSA from './StructureViewerMSA.vue';
import Tree from './Tree.vue';
import { debounce, tryFixName, mockPDB } from './Utilities.js'
import interact from 'interactjs';
import { MSAViewer } from 'msa-webgpu';
import MSAConfig from './MSAConfig.vue';

const position = {x: 0, y: 0}
const PAGE_HEADER_HEIGHT = 48;
const MSA_VIEWER_HEADER_WIDTH = 200;
const LDDT_TRACK_DEFINITION = {
    id: "lddt",
    label: "Column Score",
    sublabel: "Hmean(LDDT, Occupancy)",
    supports: {
        alphabets: null,
        shared: true,
    },
    source: {
        type: "values",
        representation: "active",
        values: null,
    },
    valueRange: { min: 0, max: 1 },
    lanes: [
        {
            layers: [
                {
                    type: "bar",
                    height: 60,
                    style: {
                        fillStyle: "rgba(128, 128, 128, 0.2)",
                        strokeStyle: "#080947",
                        lineWidth: null,
                    },
                    colorRamps: {
                        fill: {
                            min: 0,
                            max: 1,
                            colormap: "viridis",
                            missingValue: -1,
                        },
                    },
                },
            ],
        },
    ],
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function downloadTextFile(text, fileName, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

export default {
    components: {
        MSAConfig,
        StructureViewerMSA,
        Tree
    },
    props: {
        entries: [],
        scores: [],
        statistics: {},
        tree: "",
        ticket: "",
    },
    data() {
        return {
            visibleColumnMask: [],
            gapThresholdInner: 1.0,
            structureViewerSelection: [],
            structureViewerReference: 0,
            isLoadingStructure: false,
            treeLabelWidth: 0,
            treeLabelHeight: 0,
            showViewer: true,
            previewColumn: -1,
            selectedColumns: [],
            showViewerCondition: false,
            msaViewerReady: false,
            msaViewerBusy: false,
            msaViewerState: {
                representations: [],
                activeRepresentationId: null,
                schemes: [],
                tracks: [],
                trackDisplayMode: "active-only",
                activeScheme: "lddt",
                activeSchemeSourceRepresentationId: null,
            },
            updatingFromMSAViewer: false,
            scrollTicking: false,
        }
    },
    beforeCreate() {
        this.msaViewer = null;
    },
    watch: {
        '$vuetify.theme.dark': function() {
            this.applyMSAViewerTheme();
        },
        gapThreshold: debounce(function() {
            this.updateMSAViewerGapThreshold();
        }, 400),
    },
    beforeMount() {
        const parseSuffix = (suffix) => {
            if (!suffix) return []

            return suffix.split("-").map((s) => {
                const out = {};
                const info = s.split("_");

                if (info.length != 3) return out;

                out.chain = info[0];
                out.end = Number(info[1]);
                out.offset = Number(info[2]);
                return out;
            });
        }

        const chainToOffset = (arr) => {
            if (!arr || arr.length == 0) {
                return {'A' : 0}
            }

            const out = {}
            for (let obj of arr) {
                out[obj.chain] = obj.offset
            }
            return out
        }

        const indexToChainAndOrigResn = (aa, arr) => {
            const length = aa.replaceAll('-', '').length
            const chains = Array(length + 1).fill('A')
            const resns = Array.from({length: length + 1}, (_, i) => i)

            if (!arr || arr.length == 0) {
                return {chains: chains, resns: resns}
            }

            let index = 0

            for (let i = 1; i < length + 1; i++) {
                chains[i] = arr[index].chain
                resns[i] = i - arr[index].offset

                if (i == arr[index].end) {
                    index++
                }
            }
            return {chains: chains, resns: resns}
        }
        
        for (let entry of this.entries) {
            if (/-_-_-_/.test(entry.name)) {
                entry.suffix = entry.name.split("-_-_-_")[1];
            }
            const parsed = parseSuffix(entry.suffix)
            
            entry.offsets = chainToOffset(parsed)
            
            const obj = indexToChainAndOrigResn(entry.aa, parsed)
            entry.chains = obj.chains
            entry.resns = obj.resns
            
            entry.name = tryFixName(entry.name)
        }
    },
    mounted() {
        window.addEventListener("scroll", this.handleScroll);
        this.structureViewerSelection = this.entries.length > 1 ? [0, 1] : this.entries.length ? [0] : [];
        if (this.$refs.treeLabel) {
            this.treeLabelWidth = this.$refs.treeLabel.clientWidth - 16;
            this.treeLabelHeight = this.$refs.treeLabel.clientHeight - 32;
        }
        this.toggleView = this.toggleView.bind(this)
        this.$nextTick(() => {
            setTimeout(() => {
                this.initInteract()
            }, 0)
        })
        this.initMSAViewer();
    },
    beforeDestroy() {
        window.removeEventListener("scroll", this.handleScroll);
        this.msaViewer?.destroy?.();
        this.msaViewer = null;
    },
    computed: {
        gapThreshold: {
            get() {
                return this.gapThresholdInner;
            },
            set(value) {
                this.gapThresholdInner = clamp(value, 0.0, 1.0);
                this.$emit('input', this.gapThresholdInner);
            }
        },
    },
    methods: {
        async updateMSAViewerGapThreshold() {
            if (!this.msaViewer) return;
            try {
                await this.msaViewer.setConfig({
                    behavior: {
                        masking: {
                            gapThreshold: this.normalizedMSAViewerGapThreshold(),
                        },
                    },
                });
                this.syncMSAViewerColumnVisibility();
            } catch (error) {
                console.error("Failed to update MSAViewer gap threshold", error);
            }
        },
        normalizedMSAViewerGapThreshold() {
            return this.gapThreshold;
        },
        syncMSAViewerColumnVisibility() {
            const visible = this.msaViewer?.getColumnVisibility?.()?.visible;
            this.visibleColumnMask = visible || this.defaultVisibleColumnMask();
        },
        defaultVisibleColumnMask() {
            return this.entries[0]?.aa
                ? new Uint8Array(this.entries[0].aa.length).fill(1)
                : [];
        },
        handleStructureLoadingChange(isLoading) {
            this.isLoadingStructure = isLoading;
        },
        makeFasta(alphabet) {
            return this.entries.map((entry, index) => {
                const name = String(entry.name || `sequence_${index + 1}`).replace(/[\r\n]/g, " ");
                return `>${name}\n${entry[alphabet] || ""}`;
            }).join("\n") + "\n";
        },
        getLDDTTrackDefinition() {
            return {
                ...LDDT_TRACK_DEFINITION,
                source: {
                    ...LDDT_TRACK_DEFINITION.source,
                    values: this.scores,
                },
            };
        },
        getMSAViewerTheme() {
            const dark = this.$vuetify.theme.dark;
            return {
                mode: dark ? "dark" : "light",
                scrollerBg: dark ? "#1e1e1e" : "#ffffff",
                headerBg: dark ? "#1e1e1e" : "#ffffff",
                headerBorder: dark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
                gridLine: dark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
                text: dark ? "rgba(255, 255, 255, 0.87)" : "rgba(0, 0, 0, 0.87)",
            };
        },
        applyMSAViewerTheme() {
            const root = this.$refs.msaViewerRoot;
            const theme = this.getMSAViewerTheme();
            if (root) {
                root.dataset.theme = theme.mode;
                root.style.colorScheme = theme.mode;
                root.style.color = theme.text;
                root.style.setProperty("--msa-scroller-bg", theme.scrollerBg);
                root.style.setProperty("--msa-header-bg", theme.headerBg);
                root.style.setProperty("--msa-header-border", theme.headerBorder);
                root.style.setProperty("--msa-grid-line", theme.gridLine);
                root.style.setProperty("--msa-track-row-gap", "0px");
            }
            this.msaViewer?.setConfig?.({
                theme: { mode: theme.mode },
            })?.catch?.((error) => {
                console.error("Failed to update MSAViewer theme", error);
            });
        },
        resetMSAViewerState() {
            this.msaViewerReady = false;
            this.msaViewerBusy = false;
            this.msaViewerState = {
                representations: [],
                activeRepresentationId: null,
                schemes: [],
                tracks: [],
                trackDisplayMode: "active-only",
                activeScheme: "lddt",
                activeSchemeSourceRepresentationId: null,
            };
        },
        syncMSAViewerState() {
            if (!this.msaViewer) return;
            const config = this.msaViewer.getConfig();
            const activeRepresentation = this.msaViewer.getActiveRepresentation();
            const activeRepresentationId = activeRepresentation?.id ?? null;
            const schemes = this.msaViewer.getSchemes();
            this.msaViewerState = {
                representations: this.msaViewer.getRepresentations(),
                activeRepresentationId,
                schemes,
                tracks: this.msaViewer.getTracks(),
                trackDisplayMode: config.trackDisplay.defaults,
                activeScheme: config.rendering.scheme,
                activeSchemeSourceRepresentationId: config.rendering.schemeSourceRepresentationId ?? null,
            };
        },
        async initMSAViewer() {
            const root = this.$refs.msaViewerRoot;
            if (!root || this.entries.length === 0) return;
            this.resetMSAViewerState();
            this.msaViewer?.destroy?.();
            this.msaViewer = null;
            root.textContent = "";

            this.applyMSAViewerTheme();

            let viewer = null;
            try {
                viewer = new MSAViewer({ root });
                this.msaViewer = viewer;
                await viewer.registerColorScheme("lddt", {
                    label: "LDDT",
                    values: this.scores,
                    min: 0,
                    max: 1,
                    colormap: "viridis",
                    missingValue: -1
                });
                await viewer.setConfig({
                    theme: { mode: this.getMSAViewerTheme().mode },
                    layout: {
                        header: { width: MSA_VIEWER_HEADER_WIDTH },
                    },
                    tracks: [this.getLDDTTrackDefinition()],
                    trackDisplay: {
                        variants: [{ trackId: "lddt", representation: "active", enabled: true }],
                        order: ["lddt", "consensus", "quality", "conservation", "occupancy"],
                    },
                    behavior: {
                        selectionMode: "column",
                        masking: {
                            gapThreshold: this.normalizedMSAViewerGapThreshold(),
                        },
                    },
                    rendering: { scheme: "lddt" },
                });
                this.applyMSAViewerTheme();
                viewer.addEventListener("error", (event) => {
                    console.error("MSAViewer error", event.detail?.error || event);
                });
                viewer.addEventListener("sequenceclick", this.handleMSAViewerSequenceClick);
                viewer.addEventListener("selectionchange", this.handleMSAViewerSelectionChange);
                viewer.addEventListener("visibilitychange", this.handleMSAViewerVisibilityChange);
                await viewer.loadData([
                    { source: this.makeFasta("aa"), format: "fasta", id: "sequence", label: "Sequence", alphabetId: "aa", },
                    { source: this.makeFasta("ss"), format: "fasta", id: "structure", label: "Structure", alphabetId: "3di", },
                ], { activeId: "sequence" });
                if (this.msaViewer !== viewer) return;
                this.syncMSAViewerState();
                this.syncMSAViewerColumnVisibility();
                this.syncMSAViewerRowStyles();
                this.msaViewerReady = true;
            } catch (error) {
                console.error("Failed to initialize MSAViewer", error);
                if (this.msaViewer === viewer) {
                    this.msaViewer?.destroy?.();
                    this.msaViewer = null;
                    root.textContent = "";
                    this.resetMSAViewerState();
                }
            }
        },
        async setMSAViewerRepresentation(representationId) {
            if (!this.msaViewer || !representationId || representationId === this.msaViewerState.activeRepresentationId) return;
            this.msaViewerBusy = true;
            try {
                await this.msaViewer.setActiveRepresentation(representationId);
                this.syncMSAViewerState();
                this.syncMSAViewerColumnVisibility();
            } catch (error) {
                console.error("Failed to set MSAViewer representation", error);
            } finally {
                this.msaViewerBusy = false;
            }
        },
        async setMSAViewerScheme({ scheme, schemeSourceRepresentationId }) {
            if (!this.msaViewer || !scheme) return;
            const sourceId = schemeSourceRepresentationId || null;
            if (
                scheme === this.msaViewerState.activeScheme
                && sourceId === this.msaViewerState.activeSchemeSourceRepresentationId
            ) return;
            this.msaViewerBusy = true;
            try {
                await this.msaViewer.setConfig({
                    rendering: {
                        scheme,
                        schemeSourceRepresentationId: sourceId,
                    },
                });
                this.syncMSAViewerState();
            } catch (error) {
                console.error("Failed to set MSAViewer scheme", error);
            } finally {
                this.msaViewerBusy = false;
            }
        },
        async setMSAViewerTrackEnabled({ trackId, representation, enabled }) {
            if (!this.msaViewer || !trackId) return;
            try {
                await this.msaViewer.setTrackEnabled({ trackId, representation }, enabled);
                this.syncMSAViewerState();
            } catch (error) {
                console.error("Failed to update MSAViewer track", error);
            }
        },
        async resetMSAViewerTrackDefaults() {
            if (!this.msaViewer) return;
            this.msaViewerBusy = true;
            try {
                await this.msaViewer.setConfig({
                    trackDisplay: {
                        defaults: "active-only",
                        variants: [],
                    },
                });
                this.syncMSAViewerState();
            } catch (error) {
                console.error("Failed to reset MSAViewer tracks", error);
            } finally {
                this.msaViewerBusy = false;
            }
        },
        setMSAViewerGapThreshold(value) {
            this.gapThreshold = value;
        },
        handleMSAViewerVisibilityChange(event) {
            const visible = event?.detail?.columnVisibility?.visible;
            this.visibleColumnMask = visible || this.defaultVisibleColumnMask();
        },
        handleMSAViewerSequenceClick(event) {
            const rowIndex = event?.detail?.rowIndex;
            if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= this.entries.length) {
                return;
            }
            if (this.structureViewerSelection.length === 0 || event.detail?.originalEvent?.altKey) {
                this.handleNewStructureViewerReference(rowIndex);
            } else {
                this.handleNewStructureViewerSelection(rowIndex);
            }
        },
        syncMSAViewerRowStyles() {
            this.msaViewer?.setRowStyles?.(this.structureViewerSelection.map((rowIndex) => ({
                rowIndex,
                headerColor: rowIndex === this.structureViewerReference ? "#1E88E5" : "#e6ac00",
            })));
        },
        getColumnsFromMSAViewerSelection(selection) {
            const ranges = Array.isArray(selection?.ranges) ? selection.ranges : [];
            const columns = new Set();
            const maxCols = this.entries[0]?.aa?.length ?? 0;
            for (const range of ranges) {
                const start = Math.max(0, range.colStart ?? 0);
                const end = Math.min(maxCols, range.colEnd ?? start);
                for (let col = start; col < end; col++) {
                    columns.add(col);
                }
            }
            return Array.from(columns).sort((a, b) => a - b);
        },
        getMSAViewerSelectionRanges(columns) {
            const sorted = Array.from(new Set(columns))
                .filter(Number.isInteger)
                .sort((a, b) => a - b);
            const ranges = [];
            for (const col of sorted) {
                const last = ranges[ranges.length - 1];
                if (last && col === last.colEnd) {
                    last.colEnd = col + 1;
                } else {
                    ranges.push({
                        rowStart: 0,
                        rowEnd: this.entries.length,
                        colStart: col,
                        colEnd: col + 1,
                    });
                }
            }
            return ranges;
        },
        syncMSAViewerSelectionFromSelectedColumns() {
            if (!this.msaViewer || this.updatingFromMSAViewer) return;
            this.msaViewer.setSelection({
                mode: "column",
                ranges: this.getMSAViewerSelectionRanges(this.selectedColumns),
            });
        },
        handleMSAViewerSelectionChange(event) {
            const columns = this.getColumnsFromMSAViewerSelection(event?.detail?.selection);
            this.updatingFromMSAViewer = true;
            this.selectedColumns.splice(0, this.selectedColumns.length, ...columns);
            this.$emit('changedSelection', this.selectedColumns);
            this.$nextTick(() => {
                this.$refs.structViewer?.updateAllHighlights?.();
                if (columns.length > 0) {
                    this.$refs.structViewer?.moveView?.(columns[columns.length - 1]);
                }
                this.updatingFromMSAViewer = false;
            });
        },
        handleNewStructureViewerReference(entryIndex) {
            if (entryIndex === this.structureViewerReference) {
                this.structureViewerSelection = [];
                this.structureViewerReference = -1;
                this.syncMSAViewerRowStyles();
                this.$emit('changedReference', -1);
                return;
            }
            const selection = this.structureViewerSelection.slice();
            const index = selection.indexOf(entryIndex);
            if (index === -1) {
                selection.push(entryIndex);
            }
            this.structureViewerSelection = selection;
            this.structureViewerReference = entryIndex;
            this.syncMSAViewerRowStyles();
            this.$emit('changedReference', entryIndex);
        },
        handleNewStructureViewerSelection(entryIndex) {
            if (entryIndex === this.structureViewerReference) {
                this.structureViewerSelection = [];
                this.structureViewerReference = -1;
                this.syncMSAViewerRowStyles();
                this.$emit('changedReference', -1);
                return;
            }
            const selection = this.structureViewerSelection.slice();
            const index = selection.indexOf(entryIndex);
            if (index !== -1) {
                selection.splice(index, 1);
            } else {
                selection.push(entryIndex);
            }
            this.structureViewerSelection = selection;
            this.syncMSAViewerRowStyles();
        },
        handleScroll() {
            if (!this.scrollTicking) {
                this.scrollTicking = true;
                window.requestAnimationFrame(() => {
                    this._doHandleScroll();
                    this.scrollTicking = false;
                });
            }
        },
        _doHandleScroll() {
            if (!!document.fullscreenElement) return

            const topRowBottom = this.$refs.topRow.getBoundingClientRect().bottom
            const structureViewerEl = this.$refs.structViewer?.$el;
            if (!structureViewerEl) return;
            this.showViewerCondition = this.showViewer
                && topRowBottom <= PAGE_HEADER_HEIGHT

            if (
                this.showViewerCondition
            ) {
                if (!this.$refs.floatingWrapper
                    .contains(structureViewerEl)) {
                    this.$refs.floatingWrapper.appendChild(structureViewerEl)
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.$refs.structViewer?.handleResize?.()
                        }, 0)
                    })
                }
            } else {
                if (!this.$refs.originalWrapper
                    .contains(structureViewerEl)) {
                    this.$refs.originalWrapper.appendChild(structureViewerEl)
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.$refs.structViewer?.handleResize?.()
                        }, 0)
                    })
                }
            }
        },
        initInteract() {
            const viewer = document.getElementById('floating-viewer')
            if (!viewer) return;
            const structureViewer = this.$refs.structViewer
            interact(viewer).draggable({
                allowFrom: '.drag-handle',
                listeners: {
                    move (event) {
                        const { target } = event
                        const x = position.x + event.delta.x
                        const y = position.y + event.delta.y

                        target.style.transform = `translate(${x}px, ${y}px)`

                        position.x = x
                        position.y = y
                    }
                }
            }).resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                ignoreFrom: '.drag-handle',
                margin: 8,

                modifiers: [
                    interact.modifiers.restrictSize({
                        min: { width: 300, height: 310 },
                        max: { width: 750, height: 650 }
                    })
                ],

                listeners: {
                    move(event) {
                        const { target } = event;
                        let x = position.x;
                        let y = position.y;

                        target.style.width = event.rect.width + 'px';
                        target.style.height = event.rect.height + 'px';

                        x += event.deltaRect.right;
                        y += event.deltaRect.bottom;

                        target.style.transform = `translate(${x}px, ${y}px)`;
                        position.x = x
                        position.y = y
                        structureViewer?.handleResize?.()
                    }
                }
            })
        },
        resetViewer() {
            const viewer = document.getElementById('floating-viewer')
            position.x = 0
            position.y = 0
            viewer.style.width = this.$vuetify.breakpoint.smAndDown ? '300px' : '360px'
            viewer.style.height = this.$vuetify.breakpoint.smAndDown ? '310px' : '380px'
            viewer.style.transform = ''
            if (this.showViewerCondition) this.$refs.structViewer?.stage?.handleResize()
        },
        toggleView() {
            const stage = this.$refs.structViewer
            const structureViewerEl = stage?.$el;
            if (!structureViewerEl) return;
            if (!this.showViewer) {
                this.showViewer = true
                const topRowBottom = this.$refs.topRow.getBoundingClientRect().bottom
                this.showViewerCondition = this.showViewer
                    && topRowBottom <= PAGE_HEADER_HEIGHT
                if (this.showViewerCondition
                    && !this.$refs.floatingWrapper.contains(structureViewerEl)
                ) {
                    this.$refs.floatingWrapper.appendChild(structureViewerEl)
                }
                this.$nextTick(() => {
                    setTimeout(() => {
                        stage?.handleResize?.()
                    }, 0)
                })
            } else {
                this.showViewer = false
                this.showViewerCondition = false
                if (!this.$refs.originalWrapper.contains(structureViewerEl)
                ) {
                    this.$refs.originalWrapper.appendChild(structureViewerEl)
                    this.$nextTick(() => {
                        setTimeout(() => {
                            stage?.handleResize?.()
                        }, 0)
                    })
                }
            }
        },
        pushActiveIndex(idx, move=false) {
            if (!this.selectedColumns.includes(idx)) {
                this.selectedColumns.push(idx)
            }
            if (this.selectedColumns.length > 32) {
                this.selectedColumns.shift()
            }
            this.$emit('changedSelection', this.selectedColumns)
            this.syncMSAViewerSelectionFromSelectedColumns()
            this.$refs.structViewer?.updateAllHighlights?.()
            this.$refs.structViewer?.moveView?.(idx)
        },
        spliceActiveIndex(idx) {
            let i = this.selectedColumns.indexOf(idx)
            if (i < 0) {
                console.error("Error: tried to remove index which doesn't exist in selected column array")
                return
            }
            
            this.selectedColumns.splice(i, 1)
            this.$emit('changedSelection', this.selectedColumns)
            this.syncMSAViewerSelectionFromSelectedColumns()
            this.$refs.structViewer?.updateAllHighlights?.()
        },
        changePreview(idx, fromStruct=false) {
            if (idx < 0) {
                if (this.previewColumn >= 0 ) {
                    this.previewColumn = -1
                    this.$nextTick(() => {
                        setTimeout(()=> {
                            this.$refs.structViewer?.updateAllPreview?.()
                        })
                    })

                }
            } else {
                this.previewColumn = Number(idx)

                if (fromStruct) {
                    this.$nextTick(() => {
                        setTimeout(()=>{
                            this.$refs.structViewer?.updateAllPreview?.()
                        })
                    })
                } else {
                    this.$nextTick(() => {
                        setTimeout(()=>{
                            this.$refs.structViewer?.updateAllPreview?.()
                            this.$refs.structViewer?.moveView?.(Number(idx))
                        })
                    })
                }

            }
        },
        clearSelection() {
            this.selectedColumns.splice(0)
            this.$emit('changedSelection', this.selectedColumns)
            if (!this.updatingFromMSAViewer) {
                this.msaViewer?.clearSelection?.()
            }
            this.$refs.structViewer?.updateAllHighlights?.()
        },
        async exportMSAViewerSelectionAsFasta() {
            if (!this.msaViewer || this.selectedColumns.length === 0) return;
            try {
                const fasta = await this.msaViewer.exportSelectionAsFasta();
                if (!fasta) return;
                const activeRepresentation = this.msaViewer.getActiveRepresentation?.();
                const fileStem = activeRepresentation?.id || "selection";
                downloadTextFile(fasta, `${fileStem}-selection.fasta`, "text/fasta;charset=utf-8");
            } catch (error) {
                console.error("Failed to export MSAViewer selection as FASTA", error);
            }
        },
    },
}
</script>

<style>
@media only screen and (min-width: 961px) {
    .flex-col {
        /* flex: 1 0 0px; */
        height: 500px;
    }
    .flex-col:nth-child(1) {
        /* flex: 3; */
        padding-right: 6px;
    }
    /* .flex-col:nth-child(2),
    .flex-col:nth-child(3) {
        flex: 4.5;
    } */
    .flex-col:nth-child(3) {
        min-width: 300px;
        padding-left: 6px;
    }
}

@media only screen and (min-width: 601px) and (max-width: 960px) {
    .flex-col {
        height: 400px;
        padding: 6px;
    }
}

@media only screen and (max-width: 600px) {
    .flex-col {
        height: 400px;
        flex-basis: 100%;
        padding-bottom: 6px;
        padding-top: 6px;
    }
    .flex-col:nth-child(1) {
        height: 300px;
    }
}
#floating-viewer {
    position: fixed;
    display: block;
    z-index: 100;
    width: 360px;
    height: 380px;
    bottom: 64px;
    right: 108px;
    touch-action: none;
    user-select: none;
    /* -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    backface-visibility: hidden; */
}

#floating-viewer * {
    user-select: none;
}

#msa-viewer-root {
    --msa-page-header-height: 48px;
    --msa-page-vertical-spacing: 20px;
    --msa-track-row-gap: 1px;
    height: calc(100vh - var(--msa-page-header-height) - var(--msa-page-vertical-spacing));
    min-height: 0;
    width: 100%;
    overflow: hidden;
}

.msa-viewer-card {
    position: relative;
    overflow: hidden;
}

.msa-top-left {
    position: absolute;
    top: 8px;
    left: 20px;
    z-index: 2;
    width: 170px;
}

.msa-bottom-left {
    position: absolute;
    left: 20px;
    bottom: 8px;
    z-index: 2;
}

#floating-viewer > div {
    box-shadow: 0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12);
}

@media only screen and (max-width: 960px) {
    #floating-viewer {
        width: 300px;
        height: 310px;
        bottom: 100px;
        right: 32px;
    }
}

.drag-handle {
    cursor: grab;
}
.drag-handle:active {
    cursor: grabbing;
}

</style>

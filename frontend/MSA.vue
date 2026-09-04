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
                            :previewStructureIndex="previewStructureIndex"
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
                    <div
                        v-show="structurePreviewMarker.visible"
                        class="structure-preview-column-marker"
                        :style="structurePreviewMarkerStyle"
                    />
                    <div ref="msaViewerRoot" id="msa-viewer-root"></div>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <v-fade-transition>
        <v-card
            v-if="cellHover.visible"
            ref="cellTooltip"
            class="msa-cell-tooltip"
            :style="cellHoverStyle"
            elevation="6"
        >
            {{ cellHover.alignmentRow }}. {{ cellHover.name }}, {{ cellHover.residueLabel }} ({{ cellHover.alignmentColumn }})
        </v-card>
    </v-fade-transition>
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
import { debounce, tryFixName, mockPDB, oneToThree, getResidueIndices } from './Utilities.js'
import interact from 'interactjs';
import { MSAViewer } from 'msa-webgpu';
import MSAConfig from './MSAConfig.vue';
import { registerResultApi } from './lib/resultsApi.js';
import { getColumnTable, getColumnMetrics, getConsensus, getTrackCatalog,
    getTrackValues, getColumnVisibility, resolveAlphabet } from './lib/msaTracks.js';

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
            previewStructureIndex: -1,
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
            lastMSAViewerHoverColumn: -1,
            msaViewerColumnToggleCandidate: null,
            scrollTicking: false,
            scrollPositionTick: 0,
            structurePreviewMarker: {
                visible: false,
                left: 0,
                top: 0,
                width: 0,
                height: 0,
            },
            cellHover: {
                visible: false,
                x: 0,
                y: 0,
                name: "",
                alignmentColumn: "",
                alignmentRow: "",
                residueLabel: "",
                structureLabel: "",
            },
        }
    },
    beforeCreate() {
        this.msaViewer = null;
        this.previewMarkerScrollHandlers = [];
        this.msaViewerColumnToggleCleanup = null;
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
        // Registered here so MSALocal.vue — which renders MSA with no host around it — still gets a
        // working API. A host that owns more of the page (ResultFoldMason, which holds the send panel)
        // listens for `api-surface` and re-registers an augmented version; the registry's disposer
        // only releases a slot it still owns, so both teardowns are safe in either order.
        const apiSurface = {
            ensureReady: this.ensureReady,
            getColumnSummary: this.getColumnSummary,
            getColumnTable: this.getColumnTable,
            getColumnMetrics: this.getColumnMetrics,
            getConsensus: this.getConsensus,
            getTrackValues: this.getTrackValues,
            getTracks: this.getTracks,
            getColumnVisibility: this.getColumnVisibility,
            getEntries: this.getEntries,
            getCoordinates: this.getCoordinates,
            getFasta: this.getFasta,
            getSelectionFasta: this.getSelectionFasta,
            getScores: this.getScores,
            setReference: this.setReference,
            setRepresentation: this.setRepresentation,
            getSelectedColumns: this.getSelectedColumns,
            setSelectedColumns: this.setSelectedColumns,
            clearSelection: this.clearSelection,
            getMotif: this.getMotif,
            setGapThreshold: this.setGapThreshold,
            getGapThreshold: this.getGapThreshold,
            describePage: this.describePage,
            _vm: this,   // unstable escape hatch; see describe()
        };
        this._apiSurface = apiSurface;
        this._disposeApi = registerResultApi('foldmason', apiSurface);
        this.$emit('api-surface', apiSurface);
        // Keep the promise so ensureReady() can await it instead of every caller polling.
        this._viewerInit = this.initMSAViewer();
    },
    beforeDestroy() {
        window.removeEventListener("scroll", this.handleScroll);
        this._disposeApi?.();
        this.unbindMSAPreviewMarkerScroll();
        this.unbindMSAViewerColumnToggle();
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
        cellHoverStyle() {
            this.scrollPositionTick;
            const padding = 4;
            const tooltip = this.$refs.cellTooltip?.$el;
            const shadowRoot = this.$refs.msaViewerRoot?.shadowRoot;
            const alnViewport = shadowRoot?.querySelector(".msa-alignment-viewport");
            const anchorRect = alnViewport?.getBoundingClientRect();
            const width = tooltip?.offsetWidth || 260;
            if (!anchorRect) {
                return {
                    left: `${Math.max(padding, this.cellHover.x + padding)}px`,
                    top: `${Math.max(padding, this.cellHover.y + padding)}px`,
                };
            }
            const left = Math.min(
                Math.max(padding, anchorRect.left + padding),
                window.innerWidth - width - padding,
            );
            const top = Math.max(padding, anchorRect.top + padding);
            return { left: `${left}px`, top: `${top}px`, };
        },
        structurePreviewMarkerStyle() {
            return {
                left: `${this.structurePreviewMarker.left}px`,
                top: `${this.structurePreviewMarker.top}px`,
                width: `${this.structurePreviewMarker.width}px`,
                height: `${this.structurePreviewMarker.height}px`,
            };
        },
    },
    methods: {
        // ---------------------------------------------------------------------------------
        // Public API (also exposed as window.resultsApi — see lib/resultsApi.js)
        // Track values come from the viewer's compute shader via lib/msaTracks.js, which
        // falls back to CPU computation if the library internals move.
        // ---------------------------------------------------------------------------------
        // The CPU fallback must be fed the sequences and alphabet of the representation actually
        // being asked about — feeding aa strings while reporting alphabetId "3di" produces
        // confidently wrong numbers, which is worse than no numbers.
        _fallbackInput(representationId = null) {
            const repId = representationId
                ?? this.msaViewer?.getActiveRepresentation?.()?.id
                ?? null;
            const { alphabetId, symbols } = resolveAlphabet(this.msaViewer, repId);
            const field = alphabetId === '3di' ? 'ss' : 'aa';
            return { sequences: this.entries.map(e => e[field] || ''), symbols: symbols || undefined };
        },
        /**
         * Await the WebGPU viewer's initialisation.
         *
         * Every caller of the column/track surface otherwise hand-rolls a poll on
         * describePage().ready, and one that forgets gets `{pending: true}` — a shape that reads like
         * a result. Not a visibility problem: the viewer is driven by a ResizeObserver on a root whose
         * height is CSS-derived, so it initialises off-screen too.
         */
        async ensureReady({ timeoutMs = 30000 } = {}) {
            if (this.msaViewerReady) return { ok: true, waitedMs: 0 };
            const t0 = Date.now();
            await Promise.race([
                this._viewerInit ?? Promise.resolve(),
                new Promise(r => setTimeout(r, timeoutMs)),
            ]);
            const waitedMs = Date.now() - t0;
            // Check the flag, not promise resolution: initMSAViewer catches its own errors, so a
            // failed init resolves just like a successful one.
            return this.msaViewerReady
                ? { ok: true, waitedMs }
                : { ok: false, waitedMs,
                    reason: `MSA viewer did not initialise within ${timeoutMs}ms` };
        },
        /** Cheap survey of every column — the orientation call for this surface. */
        async getColumnSummary({ representationId = null, topN = 10 } = {}) {
            if (!this.msaViewerReady) return { pending: true, reason: 'MSA viewer is still initialising' };
            const m = await getColumnMetrics(this.msaViewer, {
                representationId, ...this._fallbackInput(representationId) });
            const vis = getColumnVisibility(this.msaViewer, { representationId });
            const stat = (arr) => {
                const real = (arr ?? []).filter(v => Number.isFinite(v) && v !== -1);
                if (!real.length) return null;
                const sum = real.reduce((a, b) => a + b, 0);
                return { min: +Math.min(...real).toFixed(4), max: +Math.max(...real).toFixed(4),
                    mean: +(sum / real.length).toFixed(4), missing: (arr ?? []).length - real.length };
            };
            const scores = this.scores ?? [];
            const rank = (arr, n) => (arr ?? [])
                .map((v, i) => ({ column: i, value: Number.isFinite(v) ? +v.toFixed(4) : null }))
                .filter(x => x.value !== null && x.value !== -1)
                .sort((a, b) => b.value - a.value).slice(0, Math.max(0, n));
            return {
                ok: true,
                source: m?.source ?? null,
                representationId: m?.representationId ?? null,
                alphabetId: m?.alphabetId ?? null,
                totalColumns: scores.length || (m?.entropy?.length ?? 0),
                visibleColumns: vis?.visibleCount ?? null,
                selectedColumns: this.selectedColumns.length,
                lddt: stat(scores),
                quality: stat(m?.quality),
                occupancy: stat(m?.occupancy),
                entropy: stat(m?.entropy),
                conservation: stat(m?.conservationScore),
                topColumns: { byLddt: rank(scores, topN),
                    byConservation: rank(m?.conservationScore, topN) },
            };
        },
        /**
         * Normalise (representationId, opts) when the caller passed options first.
         *
         * A representation id is a string, so an object in that slot can only be options.
         */
        _repIdOrOpts(representationId, opts) {
            if (representationId !== null && typeof representationId === 'object') {
                return { representationId: null, opts: representationId };
            }
            return { representationId, opts: opts ?? {} };
        },
        // T3/T6: these are float32 GPU values printed as float64 (occupancy 0.9333333969116211),
        // and getConsensus ships a hex colour per letter per column. Rounding to 4 decimals took
        // getColumnMetrics from 3,400 to 1,546 tokens; dropping colours and rounding took
        // getConsensus from 16,017 to 10,447. Neither loses anything a caller can use.
        _lean(value, { precision = 4, dropColor = true } = {}) {
            return JSON.parse(JSON.stringify(value, (k, v) => {
                if (dropColor && k === 'color') return undefined;
                if (typeof v === 'number' && !Number.isInteger(v)) return +v.toFixed(precision);
                return v;
            }));
        },
        async getColumnTable(opts = {}) {
            if (!this.msaViewerReady || !this.msaViewer) {
                return { pending: true, reason: 'MSA viewer is still initialising' };
            }
            // 200 returned every column of a typical alignment: 21,412 tokens. Scoped to specific
            // columns it is 211 and exactly the right shape, so the default is what changes, not the
            // method. getColumnSummary() is the survey.
            const { representationId = null, columns = null, offset = 0, limit = 20,
                precision = 4, fields = null, includeLetters = false } = opts;
            const out = await getColumnTable(this.msaViewer, {
                representationId, columns, offset, limit,
                ...this._fallbackInput(representationId),
                // The app's own per-column LDDT, registered as a `values` track. Not a viewer
                // metric — it comes from the FoldMason backend.
                extraValues: { lddt: this.scores },
                selectedColumns: this.selectedColumns,
            });
            let lean = this._lean(out, { precision });
            // Keep the winning character, drop the rest of the logo. `letters` is a per-column
            // distribution — rendering data for a sequence logo — and it dominates the response.
            // getConsensus() is the method for the full distribution, which also gives that method a
            // clear reason to exist rather than overlapping this one.
            if (!includeLetters && Array.isArray(lean.columns)) {
                for (const c of lean.columns) {
                    if (c.consensus && Array.isArray(c.consensus.letters)) {
                        const n = c.consensus.letters.length;
                        delete c.consensus.letters;
                        // Always set, even at 1: a field that vanishes is a field the caller has to
                        // guess the meaning of.
                        c.consensus.distinctLetters = n;
                    }
                }
            }
            // Field projection, mirroring getTable({fields}). `column` is always kept — a projected
            // row you cannot locate is useless.
            if (Array.isArray(fields) && Array.isArray(lean.columns)) {
                const keep = new Set(['column', ...fields]);
                lean = { ...lean, fields,
                    columns: lean.columns.map(c => Object.fromEntries(
                        Object.entries(c).filter(([k]) => keep.has(k)))) };
            }
            if (!columns && lean.returned < lean.totalColumns) {
                lean.truncated = true;
                lean.hint = 'getColumnSummary() surveys every column; pass columns or limit for more';
            }
            return lean;
        },
        // Stays unbounded: as parallel arrays this is the most token-efficient representation on the
        // page (1,546 rounded, for the most data). Bounding it would push callers to the row-shaped
        // getColumnTable, which costs an order of magnitude more per column.
        async getColumnMetrics(representationId = null, opts = {}) {
            // Accept ({precision}) as well as (repId, {precision}). Without this an options object in
            // the first slot binds to representationId and the options silently keep their defaults.
            ({ representationId, opts } = this._repIdOrOpts(representationId, opts));
            const { precision = 4 } = opts;
            if (!this.msaViewerReady) return { pending: true };
            return this._lean(await getColumnMetrics(this.msaViewer, {
                representationId, ...this._fallbackInput(representationId) }), { precision });
        },
        async getConsensus(representationId = null, opts = {}) {
            ({ representationId, opts } = this._repIdOrOpts(representationId, opts));
            const { limit = 20, offset = 0, precision = 4 } = opts;
            if (!this.msaViewerReady) return { pending: true };
            const full = await getConsensus(this.msaViewer, {
                representationId, ...this._fallbackInput(representationId) });
            const cols = full?.columns ?? [];
            const page = cols.slice(offset, offset + limit);
            return this._lean({
                ...full, totalColumns: cols.length, offset, returned: page.length,
                ...(page.length < cols.length ? { truncated: true } : {}),
                columns: page,
            }, { precision });
        },
        async getTrackValues(trackId, representationId = null) {
            if (!this.msaViewerReady) return { pending: true };
            return await getTrackValues(this.msaViewer, trackId, {
                representationId, ...this._fallbackInput(representationId) });
        },
        getTracks() {
            return {
                catalog: getTrackCatalog(this.msaViewer),
                enabledDefaults: this.msaViewerState.trackDisplayMode,
                activeScheme: this.msaViewerState.activeScheme,
                representations: this.msaViewerState.representations,
                activeRepresentationId: this.msaViewerState.activeRepresentationId,
            };
        },
        getColumnVisibility(representationId = null) {
            return getColumnVisibility(this.msaViewer, { representationId });
        },
        // ---- raw result access ----------------------------------------------------------
        // Deliberately three orthogonal getters rather than one projected getAlignment():
        // sequences via getFasta, coordinates via getCoordinates, per-column scores via
        // getScores. An earlier getAlignment() duplicated getFasta for aa/ss, and hand-rolled a
        // column window that the viewer already does better through exportSelectionAsFasta().
        // `ca` is per-entry rather than per-column, so a caller almost never wants all of them:
        // one entry is ~2.4 KB against ~30 KB for all 15 here. Defaults to the structure-viewer
        // reference, matching getMotif().
        getCoordinates(indexOrIndices = null) {
            const totalEntries = this.entries.length;
            let idx;
            if (indexOrIndices === null || indexOrIndices === undefined) {
                idx = this.structureViewerReference >= 0 ? [this.structureViewerReference] : [0];
            } else {
                idx = (Array.isArray(indexOrIndices) ? indexOrIndices : [indexOrIndices]).map(Number);
            }
            const bad = idx.filter(i => !Number.isInteger(i) || i < 0 || i >= totalEntries);
            if (bad.length) {
                return { error: `entry index out of range: ${bad.join(', ')}`,
                    validRange: [0, totalEntries - 1] };
            }
            return {
                totalEntries,
                format: 'comma-separated x,y,z triplets, one per ungapped residue — indices are '
                    + 'residue positions, not alignment columns',
                entries: idx.map(i => {
                    const e = this.entries[i];
                    const parts = (e.ca ?? '').split(',');
                    return {
                        index: i,
                        name: e.name,
                        residueCount: Math.floor(parts.length / 3),
                        alignedLength: (e.aa ?? '').length,
                        bytes: (e.ca ?? '').length,
                        ca: e.ca,
                    };
                }),
            };
        },
        // Bounded on purpose: this is now the only path to the sequences, and unbounded it
        // would return a single ~14 MB string at FoldMason's 4999-structure ceiling.
        getFasta(alphabet = 'aa', { entries = null, offset = 0, limit = 500 } = {}) {
            if (!['aa', 'ss'].includes(alphabet)) {
                return { error: `unknown alphabet: ${alphabet}`, valid: ['aa', 'ss'] };
            }
            const total = this.entries.length;
            let idx = entries ?? Array.from({ length: total }, (_, i) => i);
            idx = idx.filter(i => Number.isInteger(i) && i >= 0 && i < total);
            const bad = (entries ?? []).filter(i => !Number.isInteger(i) || i < 0 || i >= total);
            idx = idx.slice(offset, offset + limit);

            const text = idx.map(i => {
                const e = this.entries[i];
                const name = String(e.name || `sequence_${i + 1}`).replace(/[\r\n]/g, ' ');
                return `>${name}\n${e[alphabet] || ''}`;
            }).join('\n') + '\n';

            return { alphabet, totalEntries: total, returned: idx.length,
                truncated: idx.length < total,
                ...(bad.length ? { rejected: bad } : {}),
                bytes: text.length, fasta: text };
        },
        // The selected columns only, through the viewer's own exporter — it respects the current
        // selection and column masking, which a hand-rolled slice of `aa` would not.
        async getSelectionFasta({ representationId = null } = {}) {
            if (!this.msaViewerReady || !this.msaViewer) {
                return { pending: true, reason: 'MSA viewer is still initialising' };
            }
            if (this.selectedColumns.length === 0) {
                return { ok: false, reason: 'no columns selected; call setSelectedColumns() first' };
            }
            try {
                const fasta = await this.msaViewer.exportSelectionAsFasta({ representationId });
                return { ok: true, columns: [...this.selectedColumns],
                    bytes: fasta?.length ?? 0, fasta };
            } catch (e) {
                return { ok: false, reason: `export failed: ${e?.message ?? e}` };
            }
        },
        // Per-column LDDT from the FoldMason backend.
        //
        // The track definition in this file labels it "Column Score / Hmean(LDDT, Occupancy)",
        // which appears to be a mislabel introduced with the msa-webgpu integration (f537af3):
        // that commit added the sublabel without changing the backend or transforming the values
        // (the track passes `values: this.scores` through raw), and the pre-integration UI called
        // the same array "per-column LDDT" throughout. So LDDT is the accurate name.
        //
        // Note the values are normalised over the full sequence count, not the occupied count, so
        // sparsely-occupied columns score low structurally — do not read a low score on a
        // 2-of-15 column as poor superposition. -1 marks a column with too few residues to score.
        // `columns` is a LIST of column indices, `range` is [start, end). It used to be the only
        // place where an array meant a range, so getScores({columns:[0,40,41]}) silently returned 40
        // columns instead of 3 — no error, just forty times the answer.
        getScores({ columns = null, range = null } = {}) {
            const all = this.scores ?? [];
            const totalColumns = all.length;
            let slice, start, end;
            if (Array.isArray(columns)) {
                slice = columns.map(i => all[i]).filter(v => v !== undefined);
                start = null; end = null;
            } else {
                [start, end] = Array.isArray(range)
                    ? [Math.max(0, range[0] ?? 0), Math.min(totalColumns, range[1] ?? totalColumns)]
                    : [0, totalColumns];
                slice = all.slice(start, end);
            }
            const real = slice.filter(v => v !== -1 && Number.isFinite(v));
            return {
                totalColumns,
                ...(start === null ? { columns } : { columnRange: [start, end] }),
                returned: slice.length,
                label: 'LDDT',
                definition: 'per-column LDDT, normalised over the full sequence count, so '
                    + 'sparsely-occupied columns are capped low by construction; -1 = too few '
                    + 'residues to score',
                range: [0, 1],
                missingValue: -1,
                summary: real.length ? {
                    min: Math.min(...real), max: Math.max(...real),
                    mean: real.reduce((a, b) => a + b, 0) / real.length,
                    missing: slice.length - real.length,
                } : null,
                msaLDDT: this.statistics?.msaLDDT ?? null,
                scores: slice,
            };
        },
        getEntries() {
            return this.entries.map((e, index) => ({
                index,
                name: e.name,
                length: (e.aa || '').replace(/-/g, '').length,
                alignedLength: (e.aa || '').length,
                chains: e.chains ? [...new Set(e.chains)] : ['A'],
                isReference: index === this.structureViewerReference,
                inStructureView: this.structureViewerSelection.includes(index),
            }));
        },
        setReference(rowIndex) {
            const i = Number(rowIndex);
            if (!Number.isInteger(i) || i < 0 || i >= this.entries.length) {
                return { ok: false, reason: `row ${rowIndex} out of range (0..${this.entries.length - 1})` };
            }
            if (i !== this.structureViewerReference) this.handleNewStructureViewerReference(i);
            return { ok: true, reference: this.structureViewerReference,
                name: this.entries[this.structureViewerReference]?.name ?? null };
        },
        // Switching representation is the only way to get GPU-computed metrics for the 3Di
        // track — the library only populates the active one, and neither setTrackEnabled nor
        // setConfig will force a non-active representation (verified against a live result).
        async setRepresentation(id) {
            const valid = this.msaViewerState.representations.map(r => r.id);
            if (!valid.includes(id)) {
                return { ok: false, reason: `unknown representation: ${id}`, valid };
            }
            await this.setMSAViewerRepresentation(id);
            return { ok: true, activeRepresentationId: this.msaViewerState.activeRepresentationId };
        },
        getSelectedColumns() {
            return [...this.selectedColumns];
        },
        setSelectedColumns(cols) {
            const maxCol = this.entries[0]?.aa?.length ?? 0;
            const clean = [...new Set((Array.isArray(cols) ? cols : [cols]).map(Number))]
                .filter(c => Number.isInteger(c) && c >= 0 && c < maxCol)
                .sort((a, b) => a - b);
            this.selectedColumns.splice(0, this.selectedColumns.length, ...clean);
            this.$emit('changedSelection', this.selectedColumns);
            this.syncMSAViewerSelectionFromSelectedColumns();
            this.$refs.structViewer?.updateAllHighlights?.();
            return this.selectedColumns.length;
        },
        // Mirrors what "send to FoldDisco" would transmit — same chain+resno mapping as
        // SelectToSendPanelFoldMason.motifStr, so an agent can read it before sending.
        getMotif() {
            const idx = this.structureViewerReference;
            const entry = this.entries[idx];
            if (!entry || idx < 0) {
                return { reference: null, residues: [], motifString: '' };
            }
            if (this.selectedColumns.length === 0) {
                return { reference: entry.name, referenceIndex: idx, residues: [], motifString: '' };
            }
            const resnos = getResidueIndices(entry.aa, this.selectedColumns).map(i => i + 1);
            const residues = resnos.map(i => {
                const chain = entry.chains?.[i] ?? 'A';
                const resno = i - (entry.offsets?.[chain] ?? 0);
                return chain + String(resno);
            });
            return { reference: entry.name, referenceIndex: idx,
                columns: [...this.selectedColumns], residues, motifString: residues.join(', ') };
        },
        // The genuine gap filter: masks alignment columns whose gap fraction exceeds `value`.
        // (FoldDisco's similarly-named `gapFilter` is a matched-residue pattern, not this.)
        setGapThreshold(value) {
            const v = Number(value);
            if (!Number.isFinite(v)) return { ok: false, reason: 'gapThreshold must be a number 0..1' };
            this.gapThreshold = v;      // computed setter clamps to [0,1]
            return { ok: true, gapThreshold: this.gapThreshold,
                note: 're-read getColumnVisibility() after a moment; masking is debounced' };
        },
        getGapThreshold() {
            return this.gapThreshold;
        },
        describePage() {
            return {
                tool: 'foldmason',
                ready: this.msaViewerReady,
                // The reference row is what the send panel forwards (its targetIndex is bound to
                // ResultFoldMason.selectedReference, which setReference() drives), so it belongs in
                // the orientation call rather than only as an isReference flag inside getEntries().
                // -1 means the UI toggled the reference off; a send would then have no structure.
                reference: this.structureViewerReference,
                referenceName: this.structureViewerReference >= 0
                    ? (this.entries[this.structureViewerReference]?.name ?? null) : null,
                entries: this.entries.length,
                columns: this.entries[0]?.aa?.length ?? 0,
                representations: this.msaViewerState.representations.map(r => r.id),
                activeRepresentationId: this.msaViewerState.activeRepresentationId,
                tracks: getTrackCatalog(this.msaViewer).map(t => t.id),
                statistics: this.statistics,
                alignment: { entries: this.entries.length,
                    columns: this.entries[0]?.aa?.length ?? 0 },
                notes: [
                    'ca is indexed by ungapped residue; aa, scores and columns by alignment column.',
                    '`source` is "viewer" or "cpu-fallback"; the fallback yields null quality '
                        + 'and conservation.',
                    'Metrics exist only for the active representation — setRepresentation() first, '
                        + 'or accept the CPU fallback.',
                    'getSelectionFasta() respects column masking; getFasta() does not.',
                ],
            };
        },
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
            this.lastMSAViewerHoverColumn = -1;
            this.msaViewerColumnToggleCandidate = null;
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
            this.unbindMSAViewerColumnToggle();
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
                viewer.addEventListener("cellhover", this.handleMSAViewerCellHover);
                this.bindMSAViewerColumnToggle(root);
                await viewer.loadData([
                    { source: this.makeFasta("aa"), format: "fasta", id: "sequence", label: "Sequence", alphabetId: "aa", },
                    { source: this.makeFasta("ss"), format: "fasta", id: "structure", label: "Structure", alphabetId: "3di", },
                ], { activeId: "sequence" });
                if (this.msaViewer !== viewer) return;
                this.syncMSAViewerState();
                this.syncMSAViewerColumnVisibility();
                this.syncMSAViewerRowStyles();
                this.msaViewerReady = true;
                this.bindMSAPreviewMarkerScroll();
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
        bindMSAPreviewMarkerScroll() {
            this.unbindMSAPreviewMarkerScroll();
            const shadowRoot = this.$refs.msaViewerRoot?.shadowRoot;
            const scrollers = [
                shadowRoot?.querySelector(".msa-alignment-horizontal-scroller"),
                shadowRoot?.querySelector(".msa-alignment-interaction-proxy"),
            ].filter(Boolean);
            this.previewMarkerScrollHandlers = scrollers.map((node) => {
                const handler = () => this.updateStructurePreviewMarker();
                node.addEventListener("scroll", handler, { passive: true });
                return { node, handler };
            });
            window.addEventListener("resize", this.updateStructurePreviewMarker, { passive: true });
        },
        unbindMSAPreviewMarkerScroll() {
            for (const { node, handler } of this.previewMarkerScrollHandlers || []) {
                node.removeEventListener("scroll", handler);
            }
            this.previewMarkerScrollHandlers = [];
            window.removeEventListener("resize", this.updateStructurePreviewMarker);
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
        handleMSAViewerCellHover(event) {
            const detail = event?.detail || {};
            const rowIndex = detail.rowIndex;
            const rawColumn = detail.rawColumn;
            if (!Number.isInteger(rowIndex) || !Number.isInteger(rawColumn)) {
                this.cellHover.visible = false;
                this.lastMSAViewerHoverColumn = -1;
                this.clearStructurePreviewFromAlignment();
                return;
            }
            const entry = this.entries[rowIndex];
            if (!entry) {
                this.cellHover.visible = false;
                this.lastMSAViewerHoverColumn = -1;
                this.clearStructurePreviewFromAlignment();
                return;
            }
            this.lastMSAViewerHoverColumn = rawColumn;
            const residueNumber = detail.sequenceResidueNumber;
            const symbol = detail.symbol || entry.aa?.[rawColumn] || "";
            const AA = oneToThree[symbol.toUpperCase()] || "";
            const formatted = AA?.charAt(0) + AA?.toLowerCase().slice(1, 3)
            const isGap = symbol === "-" || residueNumber == null;
            if (isGap) {
                this.clearStructurePreviewFromAlignment();
            } else {
                this.previewStructureFromAlignment(rawColumn, rowIndex);
            }
            const chain = isGap ? null : entry.chains?.[residueNumber];
            const structureResidueNumber = isGap ? null : entry.resns?.[residueNumber];
            this.cellHover = {
                visible: true,
                x: detail.originalEvent?.clientX ?? this.cellHover.x,
                y: detail.originalEvent?.clientY ?? this.cellHover.y,
                name: entry.name || detail.record?.name || `Sequence ${rowIndex + 1}`,
                alignmentRow: String(rowIndex),
                alignmentColumn: String(rawColumn + 1),
                residueLabel: isGap ? "Gap" : `${formatted}${residueNumber}`,
                structureLabel: chain && structureResidueNumber != null
                    ? `${structureResidueNumber}:${chain}`
                    : "",
            };
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
                if (columns.length > 0) {
                    this.$refs.structViewer?.moveView?.(columns[columns.length - 1]);
                } else {
                    this.$refs.structViewer?.refreshScene?.();
                }
                this.updatingFromMSAViewer = false;
            });
        },
        bindMSAViewerColumnToggle(root) {
            this.unbindMSAViewerColumnToggle();

            const onMouseDown = (event) => {
                const column = this.lastMSAViewerHoverColumn;
                this.msaViewerColumnToggleCandidate = event.button === 0 && this.selectedColumns.includes(column)
                    ? { column, x: event.clientX, y: event.clientY }
                    : null;
            };
            const onClick = (event) => {
                const candidate = this.msaViewerColumnToggleCandidate;
                this.msaViewerColumnToggleCandidate = null;
                if (!candidate) return;
                if (Math.abs(event.clientX - candidate.x) > 3 || Math.abs(event.clientY - candidate.y) > 3) {
                    return;
                }
                this.$nextTick(() => {
                    if (this.selectedColumns.includes(candidate.column)) {
                        this.spliceActiveIndex(candidate.column);
                    }
                });
            };

            root.addEventListener('mousedown', onMouseDown, true);
            root.addEventListener('click', onClick, true);
            this.msaViewerColumnToggleCleanup = () => {
                root.removeEventListener('mousedown', onMouseDown, true);
                root.removeEventListener('click', onClick, true);
            };
        },
        unbindMSAViewerColumnToggle() {
            this.msaViewerColumnToggleCleanup?.();
            this.msaViewerColumnToggleCleanup = null;
            this.msaViewerColumnToggleCandidate = null;
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
                    this.scrollPositionTick++;
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
            if (this.showViewerCondition) this.$refs.structViewer?.handleResize?.()
        },
        toggleView() {
            const structureViewer = this.$refs.structViewer
            const structureViewerEl = structureViewer?.$el;
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
                        structureViewer?.handleResize?.()
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
                            structureViewer?.handleResize?.()
                        }, 0)
                    })
                }
            }
        },
        pushActiveIndex(idx, move=false) {
            if (this.selectedColumns.includes(idx)) {
                this.spliceActiveIndex(idx)
                return
            }
            this.selectedColumns.push(idx)
            if (this.selectedColumns.length > 32) {
                this.selectedColumns.shift()
            }
            this.$emit('changedSelection', this.selectedColumns)
            this.syncMSAViewerSelectionFromSelectedColumns()
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
            this.$refs.structViewer?.refreshScene?.()
        },
        clearStructurePreviewFromAlignment() {
            this.previewColumn = -1;
            this.previewStructureIndex = -1;
            this.structurePreviewMarker.visible = false;
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$refs.structViewer?.refreshScene?.();
                });
            });
        },
        previewStructureFromAlignment(idx, rowIndex) {
            if (!this.structureViewerSelection.includes(rowIndex)) {
                this.clearStructurePreviewFromAlignment();
                return;
            }
            this.previewColumn = Number(idx);
            this.previewStructureIndex = rowIndex;
            this.structurePreviewMarker.visible = false;
            this.$nextTick(() => {
                setTimeout(() => {
                    this.$refs.structViewer?.refreshScene?.();
                });
            });
        },
        changePreview(idx, fromStruct=false) {
            this.previewStructureIndex = -1;
            if (idx < 0) {
                if (this.previewColumn >= 0 ) {
                    this.previewColumn = -1
                    this.structurePreviewMarker.visible = false
                    this.$nextTick(() => {
                        setTimeout(()=> {
                            this.$refs.structViewer?.refreshScene?.()
                        })
                    })

                }
            } else {
                this.previewColumn = Number(idx)

                if (fromStruct) {
                    this.$nextTick(() => {
                        setTimeout(()=>{
                            this.$refs.structViewer?.refreshScene?.()
                            this.updateStructurePreviewMarker()
                        })
                    })
                } else {
                    this.$nextTick(() => {
                        setTimeout(()=>{
                            this.$refs.structViewer?.refreshScene?.()
                            this.updateStructurePreviewMarker()
                            this.$refs.structViewer?.moveView?.(Number(idx))
                        })
                    })
                }

            }
        },
        updateStructurePreviewMarker() {
            const column = this.previewColumn;
            if (!this.msaViewer || !Number.isInteger(column) || column < 0) {
                this.structurePreviewMarker.visible = false;
                return;
            }

            const root = this.$refs.msaViewerRoot;
            const card = root?.closest(".msa-viewer-card");
            const shadowRoot = root?.shadowRoot;
            const viewport = shadowRoot?.querySelector(".msa-alignment-viewport");
            const scroller = shadowRoot?.querySelector(".msa-alignment-horizontal-scroller");
            if (!card || !viewport || !scroller) {
                this.structurePreviewMarker.visible = false;
                return;
            }

            const visibility = this.msaViewer.getColumnVisibility?.();
            const visibleColumn = visibility?.rawToVisible
                ? visibility.rawToVisible[column]
                : column;
            if (!Number.isFinite(visibleColumn) || visibleColumn < 0) {
                this.structurePreviewMarker.visible = false;
                return;
            }

            const cellWidth = this.msaViewer.alignmentView?.getRenderedCellWidthCss?.() || 12;
            const viewportRect = viewport.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const x = visibleColumn * cellWidth - scroller.scrollLeft;
            if (x + cellWidth < 0 || x > viewportRect.width) {
                this.structurePreviewMarker.visible = false;
                return;
            }

            const clippedX = Math.max(0, x);
            this.structurePreviewMarker = {
                visible: true,
                left: viewportRect.left - cardRect.left + clippedX,
                top: viewportRect.top - cardRect.top,
                width: Math.max(2, Math.min(cellWidth, viewportRect.width - clippedX)),
                height: viewportRect.height,
            };
        },
        clearSelection() {
            const cleared = this.selectedColumns.length;
            this.selectedColumns.splice(0)
            this.$emit('changedSelection', this.selectedColumns)
            if (!this.updatingFromMSAViewer) {
                this.msaViewer?.clearSelection?.()
            }
            this.$refs.structViewer?.refreshScene?.()
            return { ok: true, count: this.selectedColumns.length, cleared };
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

.msa-cell-tooltip {
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    min-width: 150px;
    max-width: 500px;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.35;
}

.structure-preview-column-marker {
    position: absolute;
    z-index: 3;
    pointer-events: none;
    border-left: 1px dashed #ec3f5f;
    border-right: 1px dashed #ec3f5f;
    background: rgba(236, 63, 95, 0.18);
    box-shadow: 0 0 0 1px rgba(236, 63, 95, 0.55);
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

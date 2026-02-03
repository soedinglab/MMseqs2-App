<template>
<div>
    <v-container fluid pa-2 style="overflow: visible; height: 100%;">
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
                            :mask="mask"
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
        <v-card class="minimap fill-height">
            <v-row dense v-if="cssGradients" style="align-items: center;">
                <v-col align="center" no-gutters style="max-width: fit-content; margin-right: 4px; position: relative;">
                    <div style="display: flex; flex-direction: row;">
                        <div class="input-div-wrapper expansion-panel" :class="{ 'is-expanded': settingsPanelOpen }">
                            <div class="input-div">
                                <label
                                    title="Toggle between AA and 3Di alphabets"
                                    class="input-label"
                                >Alphabet</label>
                                <v-btn-toggle dense mandatory color="primary" v-model="alphabet">
                                    <v-btn x-small value="aa" style="width: 40px;">AA</v-btn>
                                    <v-btn x-small value="ss" style="width: 40px;">3Di</v-btn>
                                </v-btn-toggle>
                            </div>
                            <div class="input-div">
                                <label
                                    title="Hide columns with percentage of gaps above this cutoff"
                                    class="input-label"
                                >Gaps</label>
                                <v-text-field
                                    v-model="matchRatio"
                                    label="0.0"
                                    default="0.00"
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    single-line
                                    hide-details
                                    solo
                                    flat
                                    dense
                                    style="max-width: 80px; max-height: 20px;"
                                />                       
                            </div>
                            <div class="input-div">
                                <label
                                    title="Toggle between per-column LDDT and 3Di score matrix-based colorschemes"
                                    class="input-label"
                                >Colours</label>
                                <v-select dense flat hide-details solo
                                    style="max-width: 140px; max-height: 32px;"
                                    v-model="colorScheme"
                                    :items="schemes"
                                />
                            </div>
                        </div>
                        <div style="position: relative; display: flex; justify-content: center; align-items: center; width: fit-content; height: 80px;">
                            <v-btn class="toggle-button" @click="toggleSettingsPanel" small icon title="Toggle MSA viewing options">
                                <v-icon>{{ settingsBtnIcon }}</v-icon>
                            </v-btn>
                        </div>
                    </div>
                </v-col>
                <v-col class="minimap-col">
                    <div
                        v-for="(block, i) in cssGradients"
                        :key="'col-' + i"
                        class="gradient-block-col"
                        :style="minimapBlock(i)"
                        @click="handleMapBlockClick(i)"
                    >
                        <div class="gradient-block">
                            <div
                                v-for="(gradient, j) in block"
                                :key="'gradient-' + j"
                                class="gradient-row"
                                :style="{ 'background-image': gradient }"
                            />
                        </div>
                    </div>
                </v-col>
                <div class="pl-2">
                    
                    <v-tooltip bottom transition="fade-transition"
                    nudge-left="48px" nudge-top="4px" color="primary"
                    >
                        <template v-slot:activator="{on, attrs}">
                            <!-- <button 
                                
                                type="button"
                                v-bind="attrs" v-on="on" 
                                class="v-btn v-btn--icon v-btn--round v-btn--text v-size--x-large structure-panel-btn"
                                :class="{ 
                                            'v-btn--outlined' : showViewer,
                                            'primary--text' : showViewer,
                                            'theme--dark' : $vuetify.theme.dark
                                        }"
                            >
                                <span class="v-btn__content">
                                    <span aria-hidden="true" class="v-icon notranslate theme--dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                        <path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path>
                                    </svg>
                                    </span>
                                </span>
                            </button> -->
                            <v-btn :outlined="!showViewer" color="primary" v-bind="attrs" v-on="on"
                                @click.stop="toggleView" fab dark
                            >
                                <v-icon>{{ $MDI.Monomer }}</v-icon>
                            </v-btn>
                        </template> 
                        <span>
                            {{ showViewer ? 'Hide' : 'Show' }} floating viewer
                        </span>
                    </v-tooltip>
                    <v-btn 
                        icon text x-small 
                        style="position: absolute; right: 8px; bottom: 8px" 
                        title="Reset viewer"
                        @click.stop="resetViewer"
                    >
                        <v-icon>
                            {{ $MDI.Refresh }}
                        </v-icon>
                    </v-btn>
                </div>
            </v-row>
        </v-card>
        <v-card pa-2>
            <MSAView
                :entries="msaViewEntries"
                :scores="msaViewScores"
                :alnLen="alnLen"
                :alphabet="alphabet"
                :colorScheme="colorScheme"
                :selectedStructures="structureViewerSelection"
                :referenceStructure="structureViewerReference"
                :matchRatio="parseFloat(matchRatio)"
                :mask="mask"
                :highlightedColumns="selectedColumns"
                @cssGradients="handleCSSGradient"
                @lineLen="handleLineLen"
                @newStructureSelection="handleNewStructureViewerSelection"
                @newStructureReference="handleNewStructureViewerReference"
                @addHighlight="pushActiveIndex"
                @removeHighlight="spliceActiveIndex"
                @changePreview="changePreview"
                ref="msaView"
            />
        </v-card>
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
                        <!-- <div style="
                            width: 36px;
                            height: 36px;
                            display: flex; 
                            justify-content: center; 
                            align-items: center;" class="drag-handle">
                            <v-icon style="display: block;">
                                {{ $MDI.CursorMove }}
                            </v-icon>
                        </div> -->
                        <div class="drag-handle" style="flex-grow: 1; align-self: stretch;"/>
                        <!-- <v-card-title>Structure</v-card-title> -->
                        <v-btn icon @click="toggleView" style="display: block;">
                            <v-icon>
                                {{ $MDI.CloseCircleOutline }}
                            </v-icon>
                        </v-btn>
                    </div>
                    <div style="padding: 6px; height: calc(100% - 36px); width: 100%; position: relative" ref="floatingWrapper">
                        <!-- <StructureViewerMSA
                            :entries="entries"
                            :selection="structureViewerSelection"
                            :reference="structureViewerReference"
                            :mask="mask"
                            :selectedColumns="selectedColumns"
                            :previewColumn="previewColumn"
                            @loadingChange="handleStructureLoadingChange"
                            @addHighlight="pushActiveIndex"
                            @removeHighlight="spliceActiveIndex"
                            ref="structViewer"
                        /> -->
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
import MSAView from './MSAView.vue';
import StructureViewer from './StructureViewer.vue';
import StructureViewerMSA from './StructureViewerMSA.vue';
import Tree from './Tree.vue';
import { debounce, makePositionMap, tryFixName, mockPDB } from './Utilities.js'
import MDI from './MDI.js';
import interact from 'interactjs';

const position = {x: 0, y: 0}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeMatchRatioMask(entries, ratio) {
    const columnLength = entries[0].aa.length;
    const mask = new Array(columnLength).fill(0);
    for (let i = 0; i < columnLength; i++) {
        let gap = 0;
        let nonGap = 0;
        for (let j = 0; j < entries.length; j++) {
            if (entries[j].aa[i] === '-') {
                gap++;
            } else {
                nonGap++;
            }
        }
        let fraction = nonGap / (gap + nonGap);
        if (fraction >= ratio) {
            mask[i] = 1;
        }
    }
    return mask;
}

function mockAlignment(one, two) {
    let res = { backtrace: "" };
    let started = false; // flag for first Match column in backtrace
    let m = 0;           // index in msa
    let qr = 0;          // index in seq
    let tr = 0;
    while (m < one.length) {
        const qc = one[m];
        const tc = two[m];
        if (qc === '-' && tc === '-') {
            // Skip gap columns
        } else if (qc === '-') {
            if (started) res.backtrace += 'D';
            ++tr;
        } else if (tc === '-') {
            if (started) res.backtrace += 'I';
            ++qr;
        } else {
            if (!started) {
                started = true;
                res.qStartPos = qr;
                res.dbStartPos = tr;
            }
            res.backtrace += 'M';
            res.qEndPos = qr;
            res.dbEndPos = tr;
            ++qr;
            ++tr;
        }
        ++m;
    }
    res.qStartPos++;
    res.dbStartPos++;
    return res;
}

export default {
    components: {
        MSAView,
        StructureViewer,
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
            mask: [],
            structures: [],       
            lineLen: 80,
            cssGradients: null,
            gradientRatio: null,
            blockIndex: 0,
            alphabet: 'aa',
            colorScheme: 'lddt',
            schemes: [
                { header: "Structure-based" },
                { text: "LDDT", value: "lddt" },
                { text: "3Di", value: "3di" },
                { header: "Sequence-based" },
                { text: "Clustal", value: "clustal" },
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
            matchRatioInner: 0.0,
            structureViewerSelection: [],
            structureViewerReference: 0,
            isLoadingStructure: false,
            numMinimapGradients: 30,
            settingsPanelOpen: true,
            treeLabelWidth: 0,
            treeLabelHeight: 0,
            showViewer: true,
            previewColumn: -1,
            selectedColumns: [],
            showViewerCondition: false,
        }
    },    
    watch: {
        matchRatio: debounce(function() {
            this.handleUpdateMatchRatio();
        }, 400),
    },
    beforeMount() {
        this.handleUpdateMatchRatio();
        for (let entry of this.entries) {
            entry.name = tryFixName(entry.name)
        }
    },
    mounted() {
        window.addEventListener("scroll", this.handleScroll);
        this.structureViewerSelection = [0, 1];
        this.treeLabelWidth = this.$refs.treeLabel.clientWidth - 16;
        this.treeLabelHeight = this.$refs.treeLabel.clientHeight - 32;
        this.toggleView = this.toggleView.bind(this)
        this.$nextTick(() => {
            setTimeout(() => {
                this.initInteract()
            }, 0)
        })
    },
    beforeDestroy() {
        window.removeEventListener("scroll", this.handleScroll);
    },
    computed: {
        matchRatio: {
            get() {
                return this.matchRatioInner;
            },
            set(value) {
                this.matchRatioInner = clamp(value, 0.0, 1.0);
                this.$emit('input', this.matchRatioInner);
            }
        },
        alnLen() {
            if (this.entries.length > 0) {
                return this.mask.reduce((count, value) => count + value, 0);
                // return this.entries[0].aa.length;
            }
            return 0;
        },
        structureViewerProps() {
            return { structures: this.entries };
        },
        structureViewerEntries() {
            return this.structureViewerSelection.map(index => this.entries[index]);
        },
        msaViewEntries() {
            const entries = this.entries.map(entry => {
                const copy = {
                    name: entry.name,
                    aa: "",
                    ss: ""
                }
                for (let i = 0; i < this.mask.length; i++) {
                    if (this.mask[i] === 1) {
                        copy.aa += entry.aa[i];
                        copy.ss += entry.ss[i];
                    }
                }
                return copy;
            })
            return entries
        },
        msaViewScores() {
            return this.scores.filter((_, index) => this.mask[index] === 1);
        },
        settingsBtnIcon() {
            return this.settingsPanelOpen ? MDI.ChevronLeft : MDI.ChevronRight;
        },
    },
    methods: {
        log(v) {
            console.log(v)
            return v
        },
        toggleSettingsPanel() {
            this.settingsPanelOpen = !this.settingsPanelOpen;
        },
        handleUpdateMatchRatio: function() {
            if (this.matchRatio === 0.0) {
                this.mask = new Array(this.entries[0].aa.length).fill(1);
            } else {
                this.mask = makeMatchRatioMask(this.entries, this.matchRatio);
            }
        },
        handleStructureLoadingChange(isLoading) {
            this.isLoadingStructure = isLoading;
        },
        // New reference emitted from MSAView.
        // entryIndex is based on ALL entries, not just selection (taken from row of MSA block)
        // Add new structure to selection if index not already in selection,
        // otherwise just switch reference index.
        handleNewStructureViewerReference(entryIndex) {
            if (entryIndex === this.structureViewerReference) {
                this.structureViewerSelection = [];
                this.structureViewerReference = -1;
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
            this.$emit('changedReference', entryIndex);
        },
        handleNewStructureViewerSelection(entryIndex) {
            if (entryIndex === this.structureViewerReference) {
                this.structureViewerSelection = [];
                this.structureViewerReference = -1;
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
        },
        getEntry(name) {
            return this.entries.find(item => item.name === name);
        },
        makeMockAlignment(one, two) {
            const entryOne = this.entries[one];
            const entryTwo = this.entries[two];
            if (!entryOne || !entryTwo) {
                return;
            }
            const alignment  = mockAlignment(entryOne.aa, entryTwo.aa);
            alignment.query  = entryOne.name;
            alignment.target = entryTwo.name;
            alignment.qCa    = entryOne.ca;
            alignment.tCa    = entryTwo.ca;
            alignment.qSeq   = entryOne.aa.replace(/-/g, '');
            alignment.qAln   = entryOne.aa;
            alignment.tSeq   = entryTwo.aa.replace(/-/g, '');
            alignment.dbAln  = entryTwo.aa;
            return {
                queryMap: makePositionMap(alignment.qStartPos, alignment.qAln), 
                targetMap: makePositionMap(alignment.dbStartPos, alignment.dbAln), 
                alignment: alignment
            };
        },
        handleMapBlockClick(index) {
            const top = document.querySelector('.minimap').offsetHeight + 64;  // app-bar + minimap
            const box = this.$refs.msaView.$el.children[index].getBoundingClientRect();
            window.scrollTo({ behavior: 'smooth', top: box.top + window.scrollY - top });
        },
        handleAlphabetChange(event) {
            this.alphabet = event.target.value;
        },
        gradientBlockCSS(gradient) {
            return { width: '100%' };
        },
        handleLineLenChange: function(event) {
            this.lineLen = parseInt(event.target.value);
        },
        minimapBlock: function(index) {
            return {
                '--bg-color': (this.blockIndex === index) ? 'rgba(255, 0, 0, 0.3)' : null,
                '--bg-color-hover': this.$vuetify.theme.dark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.5)',
                'flex-basis': `${this.gradientRatio[index]}%`
            }
        },
        handleScroll() {
            const box = this.$refs.msaView.$el.getBoundingClientRect()
            const scrollOffset = window.scrollY
            const rowHeight = this.$refs.topRow.scrollHeight

            const numBlocks = Math.ceil(this.alnLen / this.lineLen);
            const blockSize = box.height / numBlocks;
            const top = window.scrollY + box.top;  // top of the msa relative to entire document
            const bot = top + box.height;          // bottom
            let scroll = window.scrollY + 180;     // current scroll pos + minimap height
            if (scroll < top) {
                this.blockIndex = 0;
            } else if (scroll > bot) {
                this.blockIndex = numBlocks;
            } else {
                this.blockIndex = Math.floor((scroll - top) / blockSize);
            }
            
            if (!!document.fullscreenElement) return

            this.showViewerCondition = this.showViewer 
                && scrollOffset >= rowHeight
            
            if (
                this.showViewerCondition
            ) {
                if (!this.$refs.floatingWrapper
                    .contains(this.$refs.structViewer.$el)) {
                    this.$refs.floatingWrapper.appendChild(this.$refs.structViewer.$el)
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.$refs.structViewer?.handleResize?.()
                        }, 0)
                    })
                }
            } else {
                if (!this.$refs.originalWrapper
                    .contains(this.$refs.structViewer.$el)) {
                    this.$refs.originalWrapper.appendChild(this.$refs.structViewer.$el)
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.$refs.structViewer?.handleResize?.()
                        }, 0)
                    })
                }
            }
            
        },
        handleLineLen(lineLen) {
            this.lineLen = lineLen;
        },
        handleCSSGradient(gradients) {
            const numBlocks = Math.ceil(this.alnLen / this.lineLen);
            const blockSize = gradients.length / numBlocks;

            // Organise into blocks. Subsetted to numMinimapGradients for large MSAs
            // Use a step to ensure coverage over entire MSA.
            this.cssGradients = Array.from({ length: numBlocks }, () => []);
            if (blockSize < this.numMinimapGradients) {
                this.cssGradients.forEach((arr, i) => {
                    let block = i * blockSize;
                    let slice = gradients.slice(block, block + blockSize);
                    arr.push(...slice);
                });
            } else {
                const step = (blockSize - 1) / (this.numMinimapGradients - 1);
                for (let i = 0; i < numBlocks; i++) {
                    for (let j = 0; j < this.numMinimapGradients; j++) {
                        this.cssGradients[i].push(gradients[Math.round(j * step) + i * blockSize]);
                    }
                }
            }

            // Calculate length of last block (all others will be lineLen)
            // Get array of %s that sum to 100%
            const lastBlockLen = this.cssGradients[numBlocks - 1][0].split('%,').length / 2;
            const total = (numBlocks - 1) * this.lineLen + lastBlockLen;
            this.gradientRatio = new Array(numBlocks - 1).fill(this.lineLen / total * 100);
            this.gradientRatio.push(lastBlockLen / total * 100);
        },
        initInteract() {
            const viewer = document.getElementById('floating-viewer')
            const structureStage = this.$refs.structViewer?.stage
            interact(viewer).draggable({
                // modifiers: [
                //     interact.modifiers.restrictRect({
                //         restriction: {x: 0, y:0, width: window.innerWidth, height: document.documentElement.scrollHeight},
                //         endOnly: false,
                //     })
                // ],
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
                        structureStage?.handleResize?.()
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
            const scrollOffset = window.scrollY
            const rowHeight = this.$refs.topRow.scrollHeight
            const stage = this.$refs.structViewer
            if (!this.showViewer) {
                this.showViewer = true
                this.showViewerCondition = this.showViewer 
                    && scrollOffset >= rowHeight
                if (this.showViewerCondition
                    && !this.$refs.floatingWrapper.contains(stage.$el)
                ) {
                    this.$refs.floatingWrapper.appendChild(stage.$el)
                }
                this.$nextTick(() => {
                    setTimeout(() => {
                        stage?.handleResize?.()
                    }, 0)
                })
            } else {
                this.showViewer = false
                this.showViewerCondition = false
                if (!this.$refs.originalWrapper.contains(stage.$el)
                ) {
                    this.$refs.originalWrapper.appendChild(stage.$el)
                    this.$nextTick(() => {
                        setTimeout(() => {
                            stage?.handleResize?.()
                        }, 0)
                    })
                }
            }
        },
        pushActiveIndex(idx, move=false) {
            this.selectedColumns.push(idx)
            if (this.selectedColumns.length > 32) {
                this.$refs.msaView.removeHighlightColumn(this.selectedColumns[0])
                this.selectedColumns.shift()
            }
            this.$emit('changedSelection', this.selectedColumns)
            this.$refs.msaView.addHighlightColumn(idx, move && this.showViewer)
            this.$refs.structViewer.updateAllHighlights()
            this.$refs.structViewer.moveView(idx)
        },
        spliceActiveIndex(idx) {
            let i = this.selectedColumns.indexOf(idx)
            if (i < 0) {
                console.error("Error: tried to remove index which doesn't exist in selected column array")
                return
            }
            
            this.selectedColumns.splice(i, 1)
            this.$emit('changedSelection', this.selectedColumns)
            this.$refs.msaView.removeHighlightColumn(idx)
            this.$refs.structViewer.updateAllHighlights()
        },
        changePreview(idx, fromStruct=false) {
            if (idx < 0) {
                if (this.previewColumn >= 0 ) {
                    this.previewColumn = -1
                    this.$nextTick(() => {
                        setTimeout(()=> {
                            this.$refs.structViewer.updateAllPreview()
                        })
                    })

                    if (fromStruct) {
                        this.$refs.msaView.resetPreviewState()
                    }
                }
            } else {
                this.previewColumn = Number(idx)

                if (fromStruct) {
                    this.$refs.msaView.activateColumn(idx, true, true && this.showViewerCondition)
                    this.$nextTick(() => {
                        setTimeout(()=>{
                            this.$refs.structViewer.updateAllPreview()
                        })
                    })
                } else {
                    this.$nextTick(() => {
                        setTimeout(()=>{
                            this.$refs.structViewer.updateAllPreview()
                            this.$refs.structViewer.moveView(Number(idx))
                        })
                    })
                }

            }
        },
        clearSelection() {
            this.selectedColumns.splice(0)
            this.$emit('changedSelection', this.selectedColumns)
            this.$refs.msaView.clearHighlightColumns()
            this.$refs.structViewer.updateAllHighlights()
            this.$refs.structViewer.resetView()
        },
    },
}
</script>

<style>
.gradient-block-col {
    position: relative;
    display: inline-block;
    border: 1px solid grey; 
    height: 80px;
}
.gradient-block {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.gradient-row {
    flex: 1;
}
.minimap {
    position: sticky;
    top: 48px;
    padding: 16px;
    margin-top: 1em;
    margin-bottom: 2px;
    height: fit-content;
    z-index: 10;
}
.minimap-col {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
    padding: 0;
    margin: 0;
}
.gradient-block-col::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bg-color);
    z-index: 2;
}
.gradient-block-col:hover:before {
    background-color: var(--bg-color-hover);
    cursor: pointer;
}
.input-label {
    margin: 0 8px 0 0 !important;
}
.input-btn {
    height: 25px;
}
div.input-div-wrapper {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    height: 80px;
    text-align: center;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
}
div.input-div {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
}
div.input-div .v-text-field {
    min-height: 0 !important;
    max-height: 20px;
    max-width: 80px;
    padding: 0 !important;
}
div.input-div .v-input__control, div.input-div .v-input__control * {
    padding: 0;
    min-height: 0 !important;
    max-height: 20px;
}
div.input-div .v-input__slot {
    padding: 0 4px !important;
}
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
.expansion-panel {
    /* transition: width 0.3s ease; */
    overflow: hidden;
    width: 100%;
    position: relative;
}
.expansion-panel:not(.is-expanded) {
    width: 0;
}
.toggle-button {
    color: black;
    z-index: 2;
}
#floating-viewer {
    position: fixed;
    display: block;
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

.structure-panel-btn {
    transition: background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.structure-panel-btn:not(.primary--text):hover {
    background-color: rgba(0, 0, 0, 0.05);
}

.structure-panel-btn:not(.primary--text):active {
    background-color: rgba(0, 0, 0, 0.15);
}

.theme--dark .structure-panel-btn:not(.primary--text):hover {
    background-color: rgba(255, 255, 255, 0.05);
}

.theme--dark .structure-panel-btn:not(.primary--text):hover {
    background-color: rgba(255, 255, 255, 0.15);
}

.structure-panel-btn.primary--text:hover {
    background-color: rgba(25, 118, 210, 12%);
}

.structure-panel-btn.primary--text:active {
    background-color: rgba(25, 118, 210, 20%);
}
</style>
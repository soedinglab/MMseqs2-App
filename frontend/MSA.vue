<template>
<div>
    <v-container fluid pa-2 style="overflow: visible; height: 100%;">
        <v-row>
            <v-col class="flex-col">
                <v-card style="height: 100%">
                    <v-card-title>Summary</v-card-title>
                    <v-card-text>
                        <v-simple-table style="height: 100%;" id="settings" class="settings auto-height-table">
                            <tbody>
                                <tr v-if="statistics.hasOwnProperty('db')">
                                    <td>Database</td>
                                    <td id="msa-database">{{ statistics.db }}</td>
                                </tr>
                                <tr v-if="statistics.hasOwnProperty('msaFile')">
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
            <v-col class="flex-col" v-if="tree">
                <v-card class="fill-height" style="position: relative;">
                    <v-card-title style="position: absolute; left: 0; top: 0; margin: 0; padding: 16px; z-index: 1;">Guide Tree</v-card-title>
                    <Tree
                        :newick="tree"
                        :order="entries.map(e => e.name)"
                        :selection="structureViewerEntries.map(e => e.name)"
                        :reference="structureViewerReference"
                    />
                </v-card>
            </v-col>
            <v-col class="flex-col">
                <v-card class="fill-height" style="position: relative;">
                    <v-card-title style="position: absolute; left: 0; top: 0; margin: 0; padding: 16px; z-index: 1;">Structure</v-card-title>
                    <div v-if="structureViewerSelection" style="padding: 10px; height: 100%; width: 100%;">
                        <StructureViewerMSA
                            :entries="structureViewerEntries"
                            :reference="structureViewerReference"
                            @loadingChange="handleStructureLoadingChange"
                        />
                    </div>
                    <v-card-text v-else>
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
                                <v-btn-toggle dense mandatory color="primary" v-model="colorScheme">
                                    <v-btn x-small value="lddt" style="width: 40px;">LDDT</v-btn>
                                    <v-btn x-small value="3di"  style="width: 40px;">3Di</v-btn>
                                </v-btn-toggle>
                            </div>
                        </div>
                        <div style="position: relative; display: flex; justify-content: center; align-items: center; width: fit-content; height: 80px;">
                            <v-btn class="toggle-button" @click="toggleSettingsPanel" small icon title="Toggle MSA viewing options">
                                <v-icon>{{ settingsBtnIcon }}</v-icon>
                            </v-btn>
                        </div>
                    </div>
                </v-col>
                <v-col style="display: flex; flex-direction: row; height: 100%; width: 100%; padding: 0; margin: 0;">
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
                @cssGradients="handleCSSGradient"
                @lineLen="handleLineLen"
                @newStructureSelection="handleNewStructureViewerSelection"
                @newStructureReference="handleNewStructureViewerReference"
                ref="msaView"
            />
        </v-card>
    </v-container>
</div>
</template>

<script>
import MSAView from './MSAView.vue';
import StructureViewer from './StructureViewer.vue';
import StructureViewerMSA from './StructureViewerMSA.vue';
import Tree from './Tree.vue';
import { debounce, makePositionMap } from './Utilities.js'
import MDI from './MDI.js';

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
        tree: ""
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
            matchRatio: 0.0,
            structureViewerSelection: [],
            structureViewerReference: 0,
            isLoadingStructure: false,
            numMinimapGradients: 30,
            settingsPanelOpen: true,
        }
    },    
    watch: {
        matchRatio: debounce(function() {
            this.handleUpdateMatchRatio();
        }, 400)
    },
    beforeMount() {
        this.handleUpdateMatchRatio();
    },
    mounted() {
        window.addEventListener("scroll", this.handleScroll);
        this.structureViewerSelection = [0, 1];
    },
    beforeDestroy() {
        window.removeEventListener("scroll", this.handleScroll);
    },
    computed: {
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
        }
    },
    methods: {
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
        handleNewStructureViewerReference(entryIndex) {
            // New reference emitted from MSAView.
            // entryIndex is based on ALL entries, not just selection (taken from row of MSA block)
            // Add new structure to selection if index not already in selection,
            // otherwise just switch reference index.
            const selection = this.structureViewerSelection.slice();
            const index = selection.indexOf(entryIndex);
            if (index === this.structureViewerReference) {
                this.structureViewerSelection = [];
                this.structureViewerReference = 0;
                return;
            }
            if (index === -1) {
                selection.push(entryIndex);
            }
            this.structureViewerSelection = selection;
            this.structureViewerReference = this.structureViewerSelection.indexOf(entryIndex);
        },
        handleNewStructureViewerSelection(entryIndex) {
            const selection = this.structureViewerSelection.slice();
            const index = selection.indexOf(entryIndex);
            if (index === this.structureViewerReference) {
                this.structureViewerSelection = [];
                this.structureViewerReference = 0;
                return;
            }
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
            const top = document.querySelector('.minimap').offsetHeight + 60;  // app-bar + minimap
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
    },
}
</script>

<style>
.gradient-block-col {
    position: relative;
    display: inline-block;
    border: 1px solid grey; 
}
.gradient-block-col:not(:last-child) {
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
    z-index: 1;
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
@media only screen and (min-width: 800px) {
    .flex-col {
        flex: 1 1 0px;
        height: 500px;
    }
    .flex-col:nth-child(1) {
        flex: 3;
        padding-right: 6px;
    }
    .flex-col:nth-child(2),
    .flex-col:nth-child(3) {
        flex: 4.5;
    }
    .flex-col:nth-child(3) {
        padding-left: 6px;
    }
}
@media only screen and (max-width: 800px) {
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
</style>
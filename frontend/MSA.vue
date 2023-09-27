<template>
<div>
    <v-container fluid pa-2 style="overflow: visible; height: 100%;">
        <v-row style="height: 400px;">
            <v-col fill-height>
                <v-card style="height: 100%">
                    <v-card-title>Settings</v-card-title>
                    <v-card-text>
                        <v-simple-table style="height: 100%;" id="settings" class="settings auto-height-table">
                            <tbody>
                                <tr>
                                    <td style="width: 50%; vertical-align: middle;">Display alphabet</td>
                                    <td style="width: 0px;" class="settings-td">
                                        <v-select
                                            v-model="alphabet"
                                            :items="alphabetOptions"
                                            default="aa"
                                            hide-details
                                            single-line
                                            outlined
                                            dense
                                            style="max-width: 200px; max-height: 40px; line-height: 40px; border: none;"
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td style="width: 50%;">Match ratio</td>
                                    <td style="width: 200px;" class="settings-td">
                                        <v-text-field
                                            v-model="matchRatio"
                                            label="0"
                                            default="0"
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            single-line
                                            hide-details
                                            outlined
                                            dense
                                            style="max-width: 200px; max-height: 40px; line-height: 40px; border: none;"
                                        />
                                    </td>
                                </tr>
                                <tr v-if="statistics.db">
                                    <td>Database</td>
                                    <td id="msa-database">{{ statistics.db }}</td>
                                </tr>
                                <tr v-if="statistics.msaFile">
                                    <td>MSA file</td>
                                    <td id="msa-file">{{ statistics.msaFile }}</td>
                                </tr>
                                <tr v-if="statistics.msaLDDT">
                                    <td>MSA LDDT</td>
                                    <td id="msa-lddt">{{ statistics.msaLDDT }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                    </v-card-text>
                </v-card>
            </v-col>
            <v-col>
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
            <v-row dense v-if="cssGradients">
                <v-col
                    v-for="(block, i) in cssGradients"
                    :key="'col-' + i"
                    class="gradient-block-col"
                    :style="minimapBlock(i)"
                    @click="handleMapBlockClick(i)"
                >
                    <div>
                        <div
                            v-for="(gradient, j) in block"
                            :key="'gradient-' + j"
                            class="gradient-block"
                        >
                            <div :style="{ width: '100%', height: '3px', 'background-image': gradient }"></div>
                        </div>                           
                    </div>
                </v-col>
            </v-row>
        </v-card>
        <v-card pa-2>
            <MSAView
                :entries="entries"
                :scores="scores"
                :alnLen="alnLen"
                :alphabet="alphabet"
                :selectedStructures="structureViewerSelection"
                :referenceStructure="structureViewerReference"
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
import { makePositionMap } from './Utilities.js'

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
    },
    props: {
        entries: [],
        scores: [],
        statistics: {},
    },
    data() {
        return {
            structures: [],       
            lineLen: 80,
            cssGradients: null,
            gradientRatio: null,
            blockIndex: 0,
            alphabet: 'aa',
            alphabetOptions: [
                { text: 'Amino Acids', value: 'aa' },
                { text: '3D Interactions (3Di)', value: 'ss' }
            ],
            matchRatio: null,
            structureViewerSelection: [],
            structureViewerReference: 0,
            isLoadingStructure: false
        }
    },    
    watch: {
        // TODO might need when parsing from convertalis
        // scores: function() {
        //     this.scores = new Array(this.alnLen).fill(-1);
        //     for (const [idx, score] of raw.scores) {
        //         this.scores[idx] = score;
        //     }
        // }
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
                return this.entries[0].aa.length;
            }
            return 0;
        },
        structureViewerProps() {
            return { structures: this.entries };
        },
        structureViewerEntries() {
            return this.structureViewerSelection.map(index => this.entries[index]);
        }
    },
    methods: {
        handleStructureLoadingChange(isLoading) {
            console.log('loading state change', isLoading)
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
            const top = window.scrollY + box.top;  // top of the msa
            const bot = top + box.height;          // bottom
            let scroll = top + window.scrollY;     // current scroll pos, relative to msaview offset
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
            const maxSize = 30;
            const numBlocks = Math.ceil(this.alnLen / this.lineLen);
            const blockSize = gradients.length / numBlocks;

            // Organise into blocks. Subsetted to maxSize for large MSAs
            // Use a step to ensure coverage over entire MSA.
            this.cssGradients = Array.from({ length: numBlocks }, () => []);
            const step = Math.max(Math.floor(blockSize / maxSize), 1);
            for (let i = 0; i < numBlocks; i++) {
                for (let j = 0; j < Math.min(blockSize, maxSize); j += step) {
                    this.cssGradients[i].push(gradients[j + i * blockSize]);
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
    margin-right: -1px;
}
.minimap {
    position: sticky;
    top: 48px;
    padding: 16px;
    margin-top: 1em;
    margin-bottom: 1em;
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
.settings-td {
    text-align: right;
    vertical-align: middle;
    padding: 0;
    margin: 0;
    height: 75px !important;
}
</style>
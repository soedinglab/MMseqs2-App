<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <template v-if="!$LOCAL && (!hits || !hits.query)">
                        <NameField :ticket="ticket"></NameField>
                    </template>
                    <template v-else-if="hits">
                        <span  class="hidden-sm-and-down">Results:&nbsp;</span>
                        <small class="ticket">{{ hits.query.header }}</small>
                    </template>
                </template>

                <div slot="desc" v-if="!$LOCAL && resultState == 'PENDING'">
                    <v-container fill-height grid-list-md>
                        <v-layout justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-search_2x.png" srcset="./assets/marv-search_2x.png 2x, ./assets/marv-search_3x.png 3x" />
                            </v-flex>
                            <v-flex xs8>
                                <h3>Still Pending</h3>
                                <p>Please wait a moment</p>
                            </v-flex>
                        </v-layout>
                    </v-container>
                </div>
                <div slot="desc" v-else-if="!$LOCAL && resultState == 'EMPTY'">
                    <v-container fill-height grid-list-md>
                        <v-layout justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-result_2x.png" srcset="./assets/marv-result_2x.png 2x, ./assets/marv-result_3x.png 3x" />
                            </v-flex>
                            <v-flex xs8>
                                <h3>No hits found!</h3>
                                <p>Start a <v-btn to="/search">New Search</v-btn>?</p>
                            </v-flex>
                        </v-layout>
                    </v-container>
                </div>
                <div slot="desc" v-else-if="!$LOCAL && resultState != 'RESULT'">
                    <v-container fill-height grid-list-md>
                        <v-layout justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
                            </v-flex>
                            <v-flex xs8>
                                <h3>Error! </h3>
                                <p>Start a <v-btn to="/search">New Search</v-btn>?</p>
                            </v-flex>
                        </v-layout>
                    </v-container>
                </div>

                <template slot="content" v-if="resultState == 'RESULT' && hits && hits.results">
                    <!-- hack to get a menu that can be used from outside the list -->
                    <!-- we don't want to make potentially thousands of menus -->
                    <v-menu offset-y ref="menuwrapper" absolute style="z-index: 99999 !important;">
                        <template v-slot:activator="{ on: activation, attrs: attrs }">
                            <div style="display: none">{{ menuActivator = activation }}</div>
                        </template>
                        <v-list>
                            <v-list-item two-line
                                v-for="(item, index) in menuItems"
                                :key="index"
                                :href="item.href"
                                target="_blank"
                                rel="noopener"
                                >
                                <v-list-item-content>
                                    <v-list-item-title>{{ item .label }}</v-list-item-title>
                                    <v-list-item-subtitle>
                                        {{ item.accession }}
                                    </v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                    
                    <v-sheet style="position:sticky; min-height: 44px; padding-bottom: 2em; 
                        z-index: 99999 !important;" :style="{'top': hits.results.length < 2 ? '48px' : '64px'}"
                        class="sticky-tabs">
                        
                        <v-tabs
                        :color="selectedDatabases > 0 ? hits.results[selectedDatabases - 1].color : null"
                        center-active
                        grow
                        v-model="tabModel"
                        show-arrows
                        @change="handleChangeDatabase()"
                        v-if="hits.results.length > 1"
                        >
                        <!-- <v-tab>All databases</v-tab> -->
                        <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db }} ({{ entry.alignments ? Object.values(entry.alignments).length : 0 }})</v-tab>
                    </v-tabs>
                    </v-sheet>
                <ResultFoldseekDB v-for="(entry, entryidx) in hits.results"  :key="entry.db"
                    v-if="selectedDatabases == 0 || (entryidx + 1) == selectedDatabases"
                    :tableMode="tableMode" :entryidx="entryidx" :entry="entry" :toggleSourceDb="toggleSourceDb"
                    :mode="mode" :selectedStates="selectedStates[entryidx]" :selectedCounts="selectedCountPerDb[entryidx]"
                    :totalSelectedCounts="selectedCounts" :selectUpperbound="selectUpperbound" :alignment="alignment"
                    :onlyOne="hits.results.length == 1"
                    @switchTableMode="(n) => switchTableMode(n)" 
                    @forwardDropdown="(e, h) => forwardDropdown(e, h)"
                    @showAlignment="(i, e) => showAlignment(i, entry.db, e)"
                    @updateToggleSource="(db) => updateToggleSourceDb(db)"
                    @toggleSelection="(i, v) => handleToggleSelection(entryidx, i, v)"
                    @bulkToggle="(a, v) => handleBulkToggle(entryidx, a, v)"
                ></ResultFoldseekDB>
                </template>
                </panel>
                <SelectToSendPanel
                    :hits="hits" :ticket="ticket" :selectedCounts="selectedCounts"
                    :isComplex="isComplex" :selectUpperbound="selectUpperbound"
                    :dbToIdx="dbToIdx" :banList="banList"
                    :closeAlignment="closeAlignment"
                    :getSingleSelectionInfo="getSingleSelectionInfo"
                    :getMultipleSelectionInfo="getMultipleSelectionInfo"
                    :getSinglePdb="getMockPdb"
                    :getMockPdb="getMockPdb"
                    :getFullPdb="fetchStructureFileURL"
                    @clearAll="clearAllEntries"
                >
                </SelectToSendPanel>
                <NavigationButton 
                    :selectedDatabases="selectedDatabases" 
                    :scrollOffsetArr="scrollOffsetArr" 
                    :tabOffset="tabOffset"
                    @needUpdate="updateScrollOffsetArr"
                ></NavigationButton>
            </v-flex>
        </v-layout>
        <portal>
            <panel v-if="alignment != null" class="alignment" :style="{ 'top': alnBoxOffset + 'px',  
            width: $vuetify.breakpoint.smAndDown ? 'calc(100% - 16px)' : 'calc(100% - 32px)', 
            right: $vuetify.breakpoint.smAndDown ? '8px' : '16px'}" ref="alignment_panel" v-click-outside="closeAlignment">
                <template slot="desc">
                    <v-btn icon @click="closeAlignment" style="display: block; margin-left: auto;">
                        <v-icon>
                            {{ $MDI.CloseCircleOutline }}
                        </v-icon>
                    </v-btn>
                </template>
                <AlignmentPanel
                    slot="content"
                    :key="alignment ? `ap-${alignment.id}` : 'ap-'"
                    :alignments="alignment"
                    :lineLen="fluidLineLen"
                    :hits="hits"
                />
            </panel>
        </portal>
    </v-container>
</template>

<script>
import Panel from './Panel.vue';
import AlignmentPanel from './AlignmentPanel.vue';
import Ruler from './Ruler.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import AllAtomPredictMixin from './AllAtomPredictMixin.vue';
import NavigationButton from './NavigationButton.vue';

import { mockPDB, mergePdbs, concatenatePdbs, 
    getChainName, getAccession, getAbsOffsetTop} from './Utilities';

import { debounce } from './lib/debounce';
import ResultFoldseekDB from './ResultFoldseekDB.vue';
import SelectToSendPanel from './SelectToSendPanel.vue';
import NameField from './NameField.vue';

export default {
    name: 'ResultView',
    mixins: [ ResultSankeyMixin, AllAtomPredictMixin ],
    components: { Panel, AlignmentPanel, Ruler, 
        NavigationButton, ResultFoldseekDB, SelectToSendPanel, NameField },
    data() {
        return {
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0,
            selectedStates: {},
            selectedCountsPerDb: {},
            selectedCounts: 0,
            selectedSets: new Set(),
            tableMode: 0,
            // banList: ['bfmd', 'cath50', 'gmgcl_id'],
            banList: [],
            menuActivator: null,
            menuItems: [],
            toggleSourceDb: "",
            dbToIdx: null,
            scrollOffsetArr: [],
            tabOffset: 140,
            selectUpperbound: 1000,
            sheetHeights: null,
        }
    },
    props: {
        ticket: "",
        error: "",
        hits: null,
        selectedTaxId: null,
    },
    created() {
        this.getSingleSelectionInfo = this.getSingleSelectionInfo.bind(this)
        this.getMultipleSelectionInfo = this.getMultipleSelectionInfo.bind(this)
        this.getMockPdb = this.getMockPdb.bind(this)
        this.fetchStructureFileURL = this.fetchStructureFileURL.bind(this)
    },
    mounted() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
        if (this.hits && !this.selectedStates && !this.selectedCountPerDb && !this.dbToIdx) {
            const obj = Object.fromEntries(
                n.results.map(( e, i ) => [i, Object.fromEntries(
                    e.alignments.map((_, j) => [j, false])
                )])
            )
            const obj2 = Object.fromEntries(
                n.results.map(( e,i ) => [i, 0])
            )
            const obj3 = Object.fromEntries(
                n.results.map((e, i) => [e.db, i])
            )
            this.selectedStates = obj
            this.selectedCountPerDb = obj2
            this.dbToIdx = obj3
            this.$nextTick(() => {
                setTimeout(() => {
                    this.updateScrollOffsetArr()
                }, 0)
            })
        }
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
    },
    watch: {
        hits: {
            handler(n, o) {
                if (n && n.results) {
                    const obj = Object.fromEntries(
                        n.results.map((e, i) => [i, Object.fromEntries(
                            [...Array(e.alignments.length)].keys().map(j => [j, false])
                        )])
                    )
                    const obj2 = Object.fromEntries(
                        n.results.map((e, i) => [i, 0])
                    )
                    const obj3 = Object.fromEntries(
                        n.results.map((e, i) => [e.db, i])
                    )
                    this.selectedStates = obj
                    this.selectedCountPerDb = obj2
                    this.dbToIdx = obj3
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.updateScrollOffsetArr()
                        }, 0)
                    })
                }
            },
            immediate: false,
            deep: true,
        },
    },
    computed: {
        mode() {
            return this.hits?.mode ?? "";
        },
        isComplex() {
            if (this.hits?.results?.[0]?.alignments?.[0]?.[0]?.complexqtm != null) {
                return true;
            }
            return false;
        },
        fluidLineLen() {
            if (this.$vuetify.breakpoint.xsOnly) {
                return 30;
            } else if (this.$vuetify.breakpoint.smAndDown) {
                return 60;
            } else if (this.$vuetify.breakpoint.mdAndDown) {
                return 45;
            } else {
                return 80;
            }
        },
        resultState() {
            if (this.error != "") {
                return "ERROR";
            }
            if (this.hits == null) {
                return "PENDING";
            }
            if (!this.hits.results) {
                return "ERROR";
            }
            if (this.hits.results.length == 0) {
                return "EMPTY";
            }
            for (var i in this.hits.results) {
                if (this.hits.results[i].alignments != null) {
                    return "RESULT";
                }
            }

            return "ERROR";
        },
        onlyOne() {
            return this.hits?.results?.length == 1
        },
        tabModel: {
            get() {
            return this.selectedDatabases - 1;
            },
            set(val) {
            this.selectedDatabases = val + 1;
            }
        },
    },
    methods: {
        log(args) {
            console.log(args);
            return args;
        },
        showAlignment(item, db, event) {
            if (this.alignment === item) {
                this.closeAlignment();
            } else {
                this.alignment = null;
                this.$nextTick(() => {
                    item.map(item => item.db = db);
                    this.alignment = item;
                    this.activeTarget = event.target.closest('.alignment-action');
                    this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
                });
            }
        },
        switchTableMode(value) {
            this.tableMode = value
        },
        closeAlignment() {
            this.$nextTick(() => {
                this.alignment = null;
                this.activeTarget = null;
            })
        },
        handleAlignmentBoxResize: debounce(function() {
            if (this.activeTarget != null) {
                this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
            }
        }, 32, false),
        forwardDropdown(event, items) {
            if (this.menuActivator) {
                this.menuItems = items;
                this.menuActivator.click(event);
            }
        },
        handleChangeDatabase() {
            this.closeAlignment();
        },
        handleToggleSelection(db, idx, value) {
            if (!this.selectedStates || !this.selectedStates[db]
                || this.selectedCounts > this.selectUpperbound && value) {
                return
            }
            
            const id = db + '#' + idx.toString()
            const deltaUnit = value ? 1 : -1
            const toCall = value ? this.selectedSets.add.bind(this.selectedSets) : 
                this.selectedSets.delete.bind(this.selectedSets)
            if (this.selectedStates[db][idx] != value) {
                // Does it really reflect changes?
                this.selectedStates[db][idx] = value
                let el = document.getElementById(id)
                if (el) {
                    el.classList.toggle('selected', value)
                }
                const newVal = this.selectedCountPerDb[db] + deltaUnit
                this.selectedCountPerDb[db] = newVal
                this.selectedCounts += deltaUnit
                toCall(id)
                
                // update select-all button state
                const targetDbLength = this.selectedStates[db].length
                el = document.getElementById(db + '#select-all')
                if (el) {
                    el.classList.toggle('any-selected', newVal > 0)
                    el.classList.toggle('all-selected', newVal == targetDbLength)
                }
            }
        },
        handleBulkToggle(db, indices, value) {
            if (!this.selectedStates || !this.selectedStates[db]
                || this.selectedCounts > this.selectUpperbound && value) {
                return
            }

            let delta = 0
            const deltaUnit = value ? 1 : -1
            const deltaUpperbound = this.selectUpperbound - this.selectedCounts
            const toCall = value ? this.selectedSets.add.bind(this.selectedSets) : 
                this.selectedSets.delete.bind(this.selectedSets)
            
            for (const i of indices) {
                if (value && delta >= deltaUpperbound) {
                    break;
                }
                if (this.selectedStates[db][i] != value) {
                    let id = db + '#' + i.toString()
                    let el = document.getElementById(id)
                    if (el) {
                        el.classList.toggle('selected', value)
                    }
                    this.selectedStates[db][i] = value
                    toCall(id)
                    delta += deltaUnit
                }
            }
            
            this.selectedCounts += delta
            const newVal = this.selectedCountPerDb[db] + delta
            this.selectedCountPerDb[db] = newVal
            
            // update select-all button state
            const selectAllButton = document.getElementById(db+'#select-all')
            if (selectAllButton) {
                const dbLength = Number(selectAllButton.getAttribute('length'))
                selectAllButton.classList.toggle('any-selected', newVal > 0)
                selectAllButton.classList.toggle('all-selected', newVal == dbLength)
            }
        },
        clearAllEntries() {
            if (!this.selectedStates) {
                return
            }
            
            let el = undefined
            this.selectedCounts = 0
            for (const key of Object.keys(this.selectedStates)) {
                this.selectedCountPerDb[key] = 0
                
                // update select-all button states manually
                el = document.getElementById(key+'#select-all')
                if (el) {
                    el.classList.toggle('any-selected', false)
                    el.classList.toggle('all-selected', false)
                }
            }
            
            // update selected states manually
            let prevSelected = document.querySelectorAll('.selected')
            if (prevSelected.length > 0) {
                for (let el of prevSelected) {
                    el.classList.toggle('selected', false)
                }
            }

            this.selectedSets.forEach(e => {
                let [ db, idx ] = e.split('#')
                this.selectedStates[Number( db )][Number(idx)] = false
            });
            this.selectedSets.clear()
        },
        getSingleSelectionInfo() {
            const info = {}
            if (this.selectedCounts != this.selectedSets.size && this.selectedCounts != 1) {
                console.error("Inconsistent set size and selected counts")
                return
            }
            let db, idx

            for (const e of this.selectedSets) {
                [ db, idx ] = e.split("#")
                idx = Number(idx)
                break
            }

            info.db = this.hits.results[db].db
            info.idx = idx
            // If there is no selection, then idx would be -1
            return info
        },
        getMultipleSelectionInfo() {
            if (this.selectedCounts != this.selectedSets.size && this.selectedCounts < 2) {
                console.error("Inconsistent set size and selected counts")
                return
            }
            
            const arr = []
            for (const e of this.selectedSets) {
                let [ db, idx ] = e.split('#')
                idx = Number(idx)
                arr.push(
                    {db: this.hits.results[db].db, idx}
                )
            }

            return arr
        },
        async getMockPdb (info /* info: {db, idx} */, signal) {
            if (signal?.aborted) { 
                throw new DOMException('Aborted', 'AbortError')
            }

            let {db, idx} = info
            if (idx == -1) {
                return;
            }

            const ticket = this.$route.params.ticket;
            let response

            try {
                response = await this.$axios.get("api/result/" 
                    + ticket + '/' + this.$route.params.entry 
                    + '?format=brief&index=' + idx 
                    + '&database=' + db, {signal});
            } catch (error) {
                if (signal?.aborted) { 
                    throw new  DOMException('Aborted', 'AbortError')
                } else { 
                    throw new DOMException('Failed to fetch', 'FetchError') 
                }
            }

            let dataArr = response.data
            const arr = []
            let name = getAccession(dataArr[0].target)
            let chainset = "_"

            for (let data of dataArr) {
                if (signal?.aborted) { 
                    throw new DOMException('Aborted', 'AbortError') 
                }
                const chain = getChainName(data.target)
                chainset += chain
                const tCa = data.tCa
                const tSeq = data.tSeq
                const pdb = mockPDB(tCa, tSeq, chain)
                // const mock = mockPDB(tCa, tSeq, chain)
                // const pdb = await pulchra(mock)
                arr.push({pdb, chain})
            }
            let out = ""
            if (arr.length > 1) {
                // out = mergePdbs(arr)
                out = concatenatePdbs(arr) // For now, just concatenate chains into one single chain
                name += chainset
            } else {
                out = arr[0].pdb
            }
            return { pdb: out, isMultimer: arr.length > 1, name: name}
        },
        updateScrollOffsetArr() {
            const arr = document.querySelectorAll('[class^="result-entry-"]')
            const offsetArr = [...arr].map(n => Math.ceil(n.getBoundingClientRect().top + window.scrollY))
            this.scrollOffsetArr = offsetArr
        },
        updateToggleSourceDb(db) {
            this.toggleSourceDb = db
        },
        async fetchStructureFileURL (accession, info, signal=undefined) {
            const db = info.db
            const fetchWithURL = async (url, retry) => {
                const response = await fetch(url, {signal})
                if (signal?.aborted) { 
                    throw new DOMException('Aborted', 'AbortError') 
                }
                if (!response.ok) {
                    if (retry) { 
                        return await fetchWithURL(url.replace(/\.pdb$/, ".cif"), false) 
                    }
                    else { 
                        throw new DOMException('Failed to fetch', 'FetchError') 
                    }
                } return await response.text()
            }

            if (!db || !accession) { 
                throw new DOMException('Invalid entry', 'FetchError') 
            }
            if (signal?.aborted) { 
                throw new DOMException('Aborted', 'AbortError') 
            }

            try {
                if (db == "BFVD") {
                    const url = `https://bfvd.steineggerlab.workers.dev/pdb/${accession}.pdb`
                    return await fetchWithURL(url, false)
                } else if (db.startsWith('afdb')) {
                    // First attempt pdb, then cif.
                    const url = `https://alphafold.ebi.ac.uk/files/${accession}.pdb`
                    return await fetchWithURL(url, true)
                } else if (db.includes('esm')) {
                    const url = `https://api.esmatlas.com/fetchPredictedStructure/${ accession }.pdb`
                    return await fetchWithURL(url, false)
                } else if (db.startsWith('pdb')) {
                    // First attempt pdb, then cif.
                    // PDB accepts only the first 4 characters as accession.
                    const url = `https://files.rcsb.org/download/${accession.substring(0, 4).toUpperCase()}.cif`
                    return await fetchWithURL(url, true)
                } else { 
                    const mock = await this.getMockPdb(info, signal)
                    // throw new Error()
                    const pdb = await this.predictGivenPdb(mock.pdb, signal)
                    return pdb
                }
            } catch (error) {
                throw error
            }
        }
    }
};
</script>

<style lang="scss">
.hide {
    display: none;
}


@media print, screen and (max-width: 599px) {
    small.ticket {
        display: inline-block;
        line-height: 0.9;
    }
}

// mask the gap between sticky tab and top of parent element
// unless it would show passing elements through the gap
.sticky-tabs::before {
    content: "";
    width: 100%;
    position: absolute;
    top: -16px;
    background-color: inherit;
    display: block;
    height: 16px;
    z-index: inherit;
} 

.alignment {
    position:absolute;
    z-index: 999;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12) !important;
}

</style>
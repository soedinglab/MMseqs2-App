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
                        v-model="selectedDatabases"
                        show-arrows
                        @change="handleChangeDatabase()"
                        v-if="hits.results.length > 1"
                        >
                        <v-tab>Summary</v-tab>
                        <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db }} ({{ entry.alignments ? Object.values(entry.alignments).length : 0 }})</v-tab>
                    </v-tabs>
                    </v-sheet>
                    <TopHits
                        v-if="hits && hits.results && hits.results.length > 1"
                        v-show="selectedDatabases == 0"
                        :hits="hits" :mode="isComplex ? 1 : 0" :alignMode="mode" :searchType="searchType"
                        @jumpTo="i => selectedDatabases = i+1" 
                    />
                    <keep-alive>
                        <Top100Foldseek
                            v-if="hits && hits.results && hits.results.length > 1 && selectedDatabases == 0" ref="top100"
                            :hits="hits" :mode="mode" :isComplex="isComplex" :tableMode="tableMode" :alignment="alignment"
                            :selectedStates="selectedStates" :selectedCounts="selectedCounts" :selectUpperbound="selectUpperbound"
                            :searchType="searchType"
                            @switchTableMode="(n) => switchTableMode(n)" 
                            @showAlignment="(o, db, e) => showAlignment(o, db, e)"
                            @toggleSelection="(db, i, v) => handleToggleSelection(db, i, v, true)"
                            @bulkToggle="(a, v) => handleBulkToggleFromTop100(a, v)"
                            @forwardDropdown="(e, h) => forwardDropdown(e, h)"
                            @jumpTo="i => selectedDatabases = i+1" 
                        />
                    </keep-alive>
                    <ResultFoldseekDB v-for="(entry, entryidx) in hits.results"  :key="entry.db"
                        :ref="'dbComponent' + entryidx"
                        v-if="(entryidx + 1) == selectedDatabases"
                        :tableMode="tableMode" :entryidx="entryidx" :entry="entry" :toggleSourceDb="toggleSourceDb"
                        :mode="mode" :selectedStates="selectedStates[entryidx]" :selectedCounts="selectedCountPerDb[entryidx]"
                        :totalSelectedCounts="selectedCounts" :selectUpperbound="selectUpperbound" :alignment="alignment"
                        :onlyOne="hits.results.length == 1" :isComplex="isComplex" :searchType="searchType"
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
                    ref="sendPanel"
                    :hits="hits" :ticket="ticket" :selectedCounts="selectedCounts"
                    :isComplex="isComplex" :selectUpperbound="selectUpperbound"
                    :dbToIdx="dbToIdx" :banList="banList"
                    :closeAlignment="closeAlignment"
                    :getSingleSelectionInfo="getSingleSelectionInfo"
                    :getMultipleSelectionInfo="getMultipleSelectionInfo"
                    :getSinglePdb="getMultimerPdb"
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
            <panel
                v-if="alignment != null"
                :class="alignmentModalClass"
                ref="alignment_panel"
                v-click-outside="closeAlignment"
            >
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
                    :searchType="searchType"
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
    getChainName, getAccession,
    encodeMultimer} from './Utilities';

import { debounce } from './lib/debounce';
import { normalizeId, splitId } from './lib/hitId.js';

import ResultFoldseekDB from './ResultFoldseekDB.vue';
import SelectToSendPanel from './SelectToSendPanel.vue';
import NameField from './NameField.vue';
import TopHits from './TopHits.vue';
import Top100Foldseek from './Top100Foldseek.vue';

export default {
    name: 'ResultView',
    mixins: [ ResultSankeyMixin, AllAtomPredictMixin ],
    components: { Panel, AlignmentPanel, Ruler,
        NavigationButton, ResultFoldseekDB, SelectToSendPanel, 
        NameField, TopHits, Top100Foldseek },
    data() {
        return {
            alignment: null,
            selectedDatabases: 0,
            selectedStates: null,
            // Was declared as `selectedCountsPerDb` (extra "s") while every use is
            // `selectedCountPerDb`, so the real field was undeclared and non-reactive and the
            // child's :selectedCounts prop never updated. Safe to make reactive: `selectedCounts`
            // appears nowhere in either table template, so nothing re-renders on change.
            selectedCountPerDb: null,
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
        searchType: "",
    },
    created() {
        this.getSingleSelectionInfo = this.getSingleSelectionInfo.bind(this)
        this.getMultipleSelectionInfo = this.getMultipleSelectionInfo.bind(this)
        this.getMockPdb = this.getMockPdb.bind(this)
        this.getMultimerPdb = this.getMultimerPdb.bind(this)
        this.fetchStructureFileURL = this.fetchStructureFileURL.bind(this)
    },
    mounted() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
        if (this.hits && !this.selectedStates && !this.selectedCountPerDb && !this.dbToIdx) {
            const obj = Object.fromEntries(
                this.hits.results.map(( e, i ) => [i, Object.fromEntries(
                    Array.from({ length: e.alignments?.length ?? 0 }, (_, j) => [j, false])
                )])
            )
            const obj2 = Object.fromEntries(
                this.hits.results.map(( e,i ) => [i, 0])
            )
            const obj3 = Object.fromEntries(
                this.hits.results.map((e, i) => [e.db, i])
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
                            Array.from({ length: e.alignments?.length ?? 0 }, (_, j) => [j, false])
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
                    this.selectedDatabases = this.onlyOne ? 1 : 0
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
            return this.hits?.type == "complexsearch";
        },
        alignmentModalClass() {
            return ['alignment', this.isComplex || this.searchType === 'interfacesearch' ? 'alignment--large' : 'alignment--compact'];
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
    },
    methods: {
        _applySelection(ids, value) {
            const changed = [], rejected = [];
            if (!this.selectedStates) return { changed, rejected: ids, selectedCount: 0 };

            const deltaPerDb = {};
            let delta = 0;
            const room = this.selectUpperbound - this.selectedCounts;

            for (const raw of ids) {
                const id = normalizeId(raw, this.dbToIdx);
                if (!id) { rejected.push({ id: raw, reason: 'unresolvable id' }); continue; }
                const { dbIdx, entryIdx } = splitId(id);
                if (!this.hits?.results?.[dbIdx]?.alignments?.[entryIdx]) {
                    rejected.push({ id: raw, reason: 'no such entry' }); continue;
                }
                if (value && delta >= room) {
                    rejected.push({ id: raw, reason: 'selection cap reached' }); continue;
                }
                if (!!this.selectedStates[dbIdx][entryIdx] === !!value) continue;

                this.$set(this.selectedStates[dbIdx], entryIdx, value);
                document.getElementById(id)?.classList.toggle('selected', value);
                document.getElementById('top.' + id)?.classList.toggle('selected', value);
                value ? this.selectedSets.add(id) : this.selectedSets.delete(id);
                deltaPerDb[dbIdx] = (deltaPerDb[dbIdx] || 0) + (value ? 1 : -1);
                delta += value ? 1 : -1;
                changed.push(id);
            }

            // Each db gets its own share. The previous Top100 handler added the grand total to
            // every touched db, which is what made the per-tab counters drift.
            for (const [dbIdx, d] of Object.entries(deltaPerDb)) {
                const next = (this.selectedCountPerDb[dbIdx] || 0) + d;
                this.selectedCountPerDb[dbIdx] = next;
                const el = document.getElementById(dbIdx + '#select-all');
                if (el) {
                    // Group count from the data, not `selectedStates[dbIdx].length` — that is a
                    // plain object, so `.length` was undefined and "all selected" never lit.
                    const total = Object.keys(this.hits?.results?.[dbIdx]?.alignments ?? {}).length;
                    el.classList.toggle('any-selected', next > 0);
                    el.classList.toggle('all-selected', total > 0 && next === total);
                }
            }
            this.selectedCounts += delta;
            // Recompute Top100's own counter from scratch instead of tracking a delta into it.
            // Incremental counters kept in two places are precisely what drifted before.
            this.$refs.top100?.reflectSelectionState?.();
            return { changed, rejected, selectedCount: this.selectedCounts };
        },
        // Replaces the selection: after this, exactly `ids` are selected. The old name promised
        // this and the old behaviour was additive, so a caller paging through results accumulated
        // instead of replacing while every count it read back looked right.
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
                });
            }
        },
        switchTableMode(value) {
            this.tableMode = value
        },
        closeAlignment() {
            this.$nextTick(() => {
                this.alignment = null;
            })
        },
        forwardDropdown(event, items) {
            if (this.menuActivator) {
                this.menuItems = items;
                this.menuActivator.click(event);
            }
        },
        handleChangeDatabase() {
            this.closeAlignment();
        },
        // The three handlers below are the click paths from ResultFoldseekDB and Top100Foldseek.
        // They keep their existing signatures so no call site changes; all three are now thin
        // adapters over _applySelection, which is also what the public API uses. Previously
        // these were three near-identical copies that had drifted apart — see claude-plan.
        //
        // `fromTop100` is retained for signature compatibility and is no longer needed:
        // _applySelection updates both DOM mirrors and refreshes Top100 unconditionally.
        handleToggleSelection(db, idx, value, fromTop100 = false) {
            this._applySelection([`${db}#${idx}`], value)
        },
        handleBulkToggle(db, indices, value) {
            this._applySelection(indices.map(i => `${db}#${i}`), value)
        },
        handleBulkToggleFromTop100(indices, value) {
            // Already "dbIdx#entryIdx" strings.
            this._applySelection(indices, value)
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
            el = document.getElementById("top#select-all")
            if (el) {
                el.classList.toggle("any-selected", false)
                el.classList.toggle("all-selected", false)
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
        // `combine` picks how a multi-chain hit is assembled:
        //   'encode' — one chain + a name suffix recording the boundaries. What FoldMason needs
        //              (MSA.vue parseSuffix/decodeMultimer reads it back).
        //   'merge'  — a genuine multi-chain PDB, chain ids preserved, TER per chain. What
        //              Multimer search needs; encoding here would hand it a monomer.
        async getMockPdb (info /* info: {db, idx} */, signal, { combine = 'encode' } = {}) {
            if (signal?.aborted) { 
                throw new DOMException('Aborted', 'AbortError')
            }

            let {db, idx} = info
            if (idx == -1) {
                return;
            }

            const ticket = this.$route.params.ticket;
            let dataArr = this.hits?.results?.[this.dbToIdx?.[db]]?.alignments?.[idx]
            if (!dataArr || dataArr.length == 0 || Number.isInteger(dataArr[0].tCa)) {
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
                dataArr = response.data
            }
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
                if (combine === 'merge') {
                    out = mergePdbs(arr)
                    name += chainset
                } else {
                    const result = encodeMultimer(arr)
                    out = result.pdb
                    name += chainset
                    name += result.suffix
                }
            } else {
                out = arr[0].pdb
            }
            return { pdb: out, isMultimer: arr.length > 1, name: name}
        },
        // Used for "send to Foldseek": a complex selection lands on Multimer search, which
        // needs the chains kept apart. Previously this shared getMockPdb's FoldMason encoding
        // and forwarded a concatenated single chain.
        async getMultimerPdb (info, signal) {
            return await this.getMockPdb(info, signal, { combine: 'merge' })
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
    position: fixed;
    top: 64px;
    right: 16px;
    left: 16px;
    z-index: 999;
    overflow: hidden;
    overscroll-behavior: contain;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12) !important;
}

.alignment--large {
    bottom: 16px;
}

.alignment--compact {
    height: clamp(520px, 72vh, 760px);
    max-height: calc(100vh - 80px);
}

.alignment .panel {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

.alignment .subheading {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 2;
    padding: 4px 8px;
}

.alignment .panel-content {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    position: absolute;
    top: 44px;
    right: 0;
    bottom: 0;
    left: 0;
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
    padding: 16px;
    overflow: hidden;
}

@media print, screen and (max-width: 599px) {
    .alignment {
        top: 56px;
        right: 8px;
        left: 8px;
    }

    .alignment--large {
        bottom: 8px;
    }

    .alignment--compact {
        height: calc(100vh - 64px);
        max-height: calc(100vh - 64px);
    }
}

</style>

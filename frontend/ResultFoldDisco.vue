<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <template v-if="!$LOCAL && (!hits || !hits.query)">
                        <!-- <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
                        <small class="ticket">{{ ticket }}</small> -->
                        <NameField :ticket="ticket"/>
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
                                    <v-list-item-title>{{ item.label }}</v-list-item-title>
                                    <v-list-item-subtitle>
                                        {{ item.accession }}
                                    </v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                    <v-sheet style="position: sticky; padding-bottom: 2em; top: 64px; z-index: 99999 !important;" class="sticky-tabs">
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
                            <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db.replaceAll(/_folddisco$/g, '') }} ({{ entry.alignments ? Object.values(entry.alignments).length : 0 }})</v-tab>
                        </v-tabs>
                    </v-sheet>
                    <ResultFoldDiscoDB v-for="(entry, entryidx) in hits.results" :key="entry.db"
                        v-if="selectedDatabases == 0 || (entryidx + 1) == selectedDatabases"
                        :entryidx="entryidx" :entry="entry" :toggleSourceDb="toggleSourceDb"
                        :selectedStates="selectedStates[entryidx]" :selectedCounts="selectedCountPerDb[entryidx]"
                        :totalSelectedCounts="selectedCounts" :selectUpperbound="selectUpperbound" :alignment="alignment"
                        :onlyOne="hits.results.length == 1"
                        @forwardDropdown="(e, h) => forwardDropdown(e, h)"
                        @showAlignment="(i, e) => showAlignment(i, entry.db, e)"
                        @updateToggleSource="(db) => updateToggleSourceDb(db)"
                        @toggleSelection="(i, v) => handleToggleSelection(entryidx, i, v)"
                        @bulkToggle="(a, v) => handleBulkToggle(entryidx, a, v)"
                        @updateScroll="() => updateScrollOffsetArr()"
                    ></ResultFoldDiscoDB>
                </template>
                </panel>
                <SelectToSendPanel
                    :hits="hits" :ticket="ticket" :selectedCounts="selectedCounts"
                    :isComplex="false" :selectUpperbound="selectUpperbound"
                    :dbToIdx="dbToIdx" :banList="[]"
                    :closeAlignment="closeAlignment"
                    :getSingleSelectionInfo="getSingleSelectionInfo"
                    :getMultipleSelectionInfo="getMultipleSelectionInfo"
                    :getSinglePdb="getPdbToSend"
                    :getMockPdb="getPdbToSend"
                    :getOrigPdb="getOrigPdbToSend"
                    :batchSize="4"
                    :chunkSize="32"
                    @clearAll="clearAllEntries"
                >
                </SelectToSendPanel>
                <NavigationButton :selectedDatabases="selectedDatabases"
                    :scrollOffsetArr="scrollOffsetArr"
                    :tabOffset="tabOffset"
                    @needUpdate="updateScrollOffsetArr"
                ></NavigationButton>
            </v-flex>
        </v-layout>
        <portal>
            <panel v-if="alignment != null && targetPdb != null" 
                class="alignment" :style="'top: ' + alnBoxOffset + 'px;'" 
                v-click-outside="closeAlignment">
                <template slot="desc">
                    <v-btn icon @click="closeAlignment" style="display: block; margin-left: auto;">
                    <v-icon>
                        {{ $MDI.CloseCircleOutline }}
                    </v-icon>
                </v-btn></template>
                <StructureViewerMotif
                    slot="content"
                    :key="`ap-${alignment.dbkey}`"
                    :alignment="alignment"
                    :queryPdb="queryPdb"
                    :targetPdb="targetPdb"
                    :lineLen="fluidLineLen"
                />
            </panel>
        </portal>
    </v-container>
</template>

<script>
import { download, parseResultsFoldDisco, dateTime, getAccession, sleep } from './Utilities.js';
import ResultMixin from './ResultMixin.vue';
import Panel from './Panel.vue';
// import AlignmentPanel from './AlignmentPanel.vue';
import StructureViewerMotif from './StructureViewerMotif.vue';
// import Ruler from './Ruler.vue';
// import makeZip from './lib/zip.js'
// import SankeyDiagram from './SankeyDiagram.vue';
import { debounce } from './lib/debounce.js';
// import { thresholdScott } from 'd3';
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import NavigationButton from './NavigationButton.vue';
import ResultFoldDiscoDB from './ResultFoldDiscoDB.vue';
import SelectToSendPanel from './SelectToSendPanel.vue';
import NameField from './NameField.vue';

function getAbsOffsetTop($el) {
    var sum = 0;
    while ($el) {
        sum += $el.offsetTop;
        $el = $el.offsetParent;
    }
    return sum;
}


export default {
    name: 'ResultFoldDisco',
    tool: 'folddisco',
    components: { Panel, StructureViewerMotif, NavigationButton, ResultFoldDiscoDB, SelectToSendPanel, NameField },
    // components: { ResultView },
    mixins: [ ResultMixin, ResultSankeyMixin ],
    data() {
        return {
            ticket: "",
            error: "",
            hits: null,
            queryPdb: null,
            targetPdb: null,
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0,
            selectedDb: null,
            menuActivator: null,
            selectedTaxId: null,
            queryResidues: null,
            menuItems: [],
            toggleSourceDb: "",
            dbToIdx: null,
            selectUpperbound: 100,
            selectedStates: {},
            selectedCounts: 0,
            selectedCountPerDb: {},
            selectedSets: new Set(),
            scrollOffsetArr: null,
        }
    },
    created() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
        this.getSingleSelectionInfo = this.getSingleSelectionInfo.bind(this)
        this.getMultipleSelectionInfo = this.getMultipleSelectionInfo.bind(this)
        this.getPdbToSend = this.getPdbToSend.bind(this)
        this.getTargetPdb = this.getTargetPdb.bind(this)
        this.getOrigPdbToSend = this.getOrigPdbToSend.bind(this)
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
    },
    computed: {
        // mode() {
        //     return this.hits?.mode ?? "";
        // },
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
        dbGaps() {
            if (!this.hits) {
                return {};
            }
            let dbGaps = {};
            for (let dbs of this.hits.results) {
                let uniqueGaps = new Set();
                for (let hit of Object.keys(dbs.alignments)) {
                    uniqueGaps.add(dbs.alignments[hit][0].gaps);
                }
                dbGaps[dbs.db] = [...uniqueGaps, ''];
            }
            return dbGaps;
        },
        tabModel: {
            get() {
            return this.selectedDatabases - 1;
            },
            set(val) {
            this.selectedDatabases = val + 1;
            }
        },
        tabOffset() {
            let addend = this.hits?.results?.length == 1 ? 92 : 140
            let sheetHeight = this.$vuetify.breakpoint.xsOnly ? 356 : this.$vuetify.breakpoint.mdAndDown ? 304 : 180
            let colheadHeight = 32
            return addend + sheetHeight + colheadHeight
        }
    },
    mounted() {
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

        this.$root.$on('downloadJSON', () => {
            let data;
            if (this.ticket.startsWith('user-')) {
                data = this.$root.userData;
                download(data, `${`Foldseek_${dateTime()}.json`}`)
            } else {
                this.fetchAllData();
            }
        })
        if (this.hits) {
            return;
        }
        this.fetchData();
    },
    destroyed () {
        this.$root.$off('downloadJSON');
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
        },
        hits: {
            handler(n, o) {
                this.setColorScheme();
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
            deep: true
        },
    },
    methods: {
        log(args) {
            console.log(args);
            return args;
        },
        showAlignment(item, db, event) {
            // throw new Error()
            if (this.alignment === item) {
                this.closeAlignment();
            } else {
                this.alignment = null;
                this.targetPdb = null;
                this.$nextTick(async () => {
                    item.db = db;
                    this.alignment = item;
                    this.targetPdb = await this.getTargetPdb(item, db);
                    this.activeTarget = event.target.closest('.alignment-action');
                    this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
                });
            }
        },
        async getTargetPdb(item, db) {
            let target = item.dbkey;
            if (db.startsWith("pdb_")) {
                target = item.target;
            }
            const re = "api/result/folddisco/" + this.$route.params.ticket + '?database=' + db +'&id=' + target;
            const MAX_RETRIES = 4
            let attempt = 0;
            while (attempt < MAX_RETRIES) {
                try {
                    const request = await this.$axios.get(re, {
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0',
                            'Accept': 'text/plain',
                        },
                        transformResponse: [(d) => d],
                    });
                    return request.data;
                } catch (e) {
                    attempt++;
                    // throw new Error("Failed to get target structure: " + e.message);
                    // alert("Error: Failed to get target structure" + e.message);
                    if (attempt >= MAX_RETRIES) {
                        console.error(`Max attempt reached for ${target} in ${db}:\n`, e);
                        throw e
                    }
                    
                    await sleep(300 * attempt)
                }
            }
        },
        closeAlignment() {
            this.alignment = null;
            this.activeTarget = null;
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
        updateToggleSourceDb(db) {
            this.toggleSourceDb = db
        },
        handleChangeDatabase() {
            this.closeAlignment();
            this.localSelectedTaxId = null;
            this.filteredHitsTaxIds = [];
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
        async getPdbToSend(info, signal) {
            // Alternative of getMockPdb()
            if (signal?.aborted) { 
                throw new DOMException('Aborted', 'AbortError')
            }
            
            let item = this.hits.results[this.dbToIdx[info.db]]?.alignments?.[info.idx]?.[0]
            let pdb = await this.getTargetPdb(item, info.db)
            return {pdb: pdb, isMultimer: false, name: getAccession(item.target)}
        },
        async getOrigPdbToSend(item, db, signal) {
            // Alternative of fetchStructureFileURL()
            if (signal?.aborted) { 
                throw new DOMException('Aborted', 'AbortError')
            }
            
            let pdb = await this.getTargetPdb(item, db)
            let residues = item.targetresidues
            return [pdb, residues]
        },
        resetProperties() {
            this.ticket = this.$route.params.ticket;
            this.error = "";
            this.hits = null;
            this.queryPdb = null;
            this.selectedDatabases = 0;
            // this.tableMode = 0;
            // this.selectedTaxId = 0;
            // this.$nextTick(() => {
            //     this.selectedTaxId = null;
            // });
        },
        async fetchData() {
            this.resetProperties();
            try {
                let hits;
                if (this.ticket.startsWith('user-')) {
                    let localData = this.$root.userData;
                    hits = localData[this.$route.params.entry];
                } else {
                    const response = await this.$axios.get("api/result/folddisco/" + this.ticket); //Rachel: recover
                    // const response = await this.$axios.get("api/result/folddisco/" + this.ticket, {
                    //     headers: {
                    //         'Cache-Control': 'no-cache'
                    //     },
                    //     // transformResponse: [(d) => {d}]
                    // });
                    const data = response.data;
                    
                    if (data.alignments == null || data.alignments.length > 0) {
                        hits = parseResultsFoldDisco(data);
                    } else {
                        throw new Error("No hits found");
                    }
                }
                this.hits = hits;
            } catch {
                this.error = "Failed";
                this.hits = null;
            }

            try {
                const response = await this.$axios.get(`api/result/${this.ticket}/query`,{
                    transformResponse: [(d) => d]
                });
                // let query = {};
                // query.pdb = response.data;
                const query = response.data;
                this.queryPdb = query
            } catch {
                this.error = "Query not available"
                this.queryPdb = null;
            }
        },
        updateScrollOffsetArr() {
            const arr = document.querySelectorAll('[class^="result-entry-"]')
            const offsetArr = [...arr].map(n => Math.ceil(n.getBoundingClientRect().top + window.scrollY))
            this.scrollOffsetArr = offsetArr
        }
    },
};
</script>


<style lang="scss" scoped>
.hide {
    display: none;
}

.db {
    border-left: 5px solid black;
}

@media print, screen and (max-width: 599px) {
    small.ticket {
        display: inline-block;
        line-height: 0.9;
    }
}

.result-table {
    a.anchor {
        display: block;
        position: relative;
        top: -125px;
        visibility: hidden;
    }

    a:not([href]) {
        color: #333;
        &:not([href]):hover {
            text-decoration: none;
        }
    }

    td, th {
        padding: 0 6px;
        text-align: left;
    }

    .hit.active {
        background: #f9f9f9;
    }

    // tbody:hover td[rowspan], tbody tr:hover {
    //     background: #eee;
    // }

    .alignment-action {
        text-align: center;
        word-wrap: normal;
    }
}

.matched-residues-text {
    display: inline-block;
    max-width: 100%;
    overflow: scroll;
    scrollbar-width: none;
}


.theme--dark {
    .result-table {
        a:not([href])  {
            color: #eee;
        }

        .hit.active {
            background: #333;
        }

        // tbody:hover td[rowspan], tbody tr:hover {
        //     background: #333;
        // }
    }
}

@media print, screen and (min-width: 961px) {
    .result-table {
        table-layout: fixed;
        border-collapse: collapse;
        width: 100%;
        th.thin, td.thin {
            white-space: nowrap;
        }
        .long {
            overflow: hidden;
            word-break: keep-all;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

    }
}

@media print {
    .result-table .alignment-action {
        display: none;
    }
}

@media screen and (max-width: 960px) {
    .result-table {
        width: 100%;
        col {
            width: auto !important;
        }
        .long {
            height: 100% !important;
            white-space: normal !important;
            min-height: 48px;
        }
        .hits {
            min-width: 300px;
        }
        tbody td a {
            min-width: 100px;
        }
        tbody td.graphical div.ruler {
            margin: 10px 0;
        }
        thead {
            display: none;
        }
        tfoot th {
            border: 0;
            display: inherit;
        }
        tr {
            box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1);
            max-width: 100%;
            position: relative;
            display: block;
            padding: 0.5em;
        }
        tr td {
            border: 0;
            display: inherit;
        }
        tr td:last-child {
            border-bottom: 0;
        }
        tr:not(:last-child) {
            margin-bottom: 1rem;
        }
        tr:not(.is-selected) {
            background: inherit;
        }
        tr:not(.is-selected):hover {
            background-color: inherit;
        }
        tr.detail {
            margin-top: -1rem;
        }
        tr:not(.detail):not(.is-empty):not(.table-footer) td {
            display: flex;
            border-bottom: 1px solid #eee;
            flex-direction: row;

            &:last-child {
                border-bottom: 0;
            }
        }
        tr:not(.detail):not(.is-empty):not(.table-footer) td:before {
            content: attr(data-label);
            font-weight: 600;
            margin-right: auto;
            padding-right: 0.5em;
            word-break: keep-all;
            flex: 1;
            white-space: nowrap;
        }

        tbody td a, tbody td span {
            flex: 2;
            margin-left: auto;
            text-align: right;
            word-wrap: anywhere;
        }
    }

    .matched-residues-text {
        white-space: normal;
        word-break: break-all;
        max-width: none;
    }

}

.alignment {
    position:absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12) !important;

    .residues {
        font-family: Protsolata, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
        white-space: pre;
    }

    .theme--dark & {
        .residues {
            color: #fff;
        }
    }
}

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

.collapse-icon:not(.collapsed) {
    transform: rotate(90deg);
}

.collapse-icon {
    cursor: pointer;
}
</style>

<style scoped>
>>> .v-input__append-inner {
    align-self: center !important;
}
</style>

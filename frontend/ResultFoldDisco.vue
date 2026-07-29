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
                        v-model="selectedDatabases"
                        show-arrows
                        @change="handleChangeDatabase()"
                        v-if="hits.results.length > 1"
                        >
                            <v-tab>Summary</v-tab>
                            <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db.replaceAll(/_folddisco$/g, '') }} ({{ entry.alignments ? Object.values(entry.alignments).length : 0 }})</v-tab>
                        </v-tabs>
                    </v-sheet>
                    <TopHits
                        v-if="hits && hits.results && hits.results.length > 1"
                        v-show="selectedDatabases == 0"
                        :hits="hits" :mode="2"
                        @jumpTo="i => selectedDatabases = i+1"
                    />
                    <keep-alive>
                        <Top100Folddisco
                            v-if="hits && hits.results && hits.results.length > 1 && selectedDatabases == 0"
                            ref="top100" :hits="hits" :alignment="alignment" :selectedStates="selectedStates"
                            :selectedCounts="selectedCounts" :selectUpperbound="selectUpperbound"
                            @showAlignment="(o, db, e) => showAlignment(o, db, e)"
                            @toggleSelection="(db, i, v) => handleToggleSelection(db, i, v, true)"
                            @bulkToggle="(a, v) => handleBulkToggleFromTop100(a, v)"
                            @forwardDropdown="(e, h) => forwardDropdown(e, h)"
                            @clearAll="clearAllEntries" @jumpTo="i => selectedDatabases = i+1"
                        />
                    </keep-alive>
                    <ResultFoldDiscoDB v-for="(entry, entryidx) in hits.results" :key="entry.db"
                        :ref="'dbComponent' + entryidx"
                        v-if="(entryidx + 1) == selectedDatabases"
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
                        @clusterInfo="(info) => handleClusterInfo(entryidx, info)"
                        @clearAll="clearAllEntries"
                    ></ResultFoldDiscoDB>
                </template>
                </panel>
                <SelectToSendPanel
                    ref="sendPanel"
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
                    :hasMoreClusters="hasMoreClusters"
                    @needUpdate="updateScrollOffsetArr"
                    @needRenderNext="handleNeedRenderNext"
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
import { registerResultApi, normalizeId, splitId } from './lib/resultsApi.js';

// See ResultView: hits per database entering a merged ranking, before the 100-row cap.
const MERGE_POOL_PER_DB = 100;
import { defaultSortOrder, isValidSortKey, FOLDDISCO_SORT_KEYS, rowFieldForSortKey,
    createSortMemo } from './lib/resultSort.js';
import { expandDescendants, findTaxonRow, findTaxonByName,
    summarizeTaxonomy } from './lib/taxonomyFilter.js';
// import { thresholdScott } from 'd3';
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import NavigationButton from './NavigationButton.vue';
import ResultFoldDiscoDB from './ResultFoldDiscoDB.vue';
import SelectToSendPanel from './SelectToSendPanel.vue';
import SendToMixin from './SendToMixin.vue';
import NameField from './NameField.vue';
import TopHits from './TopHits.vue';
import Top100Folddisco from './Top100Folddisco.vue';

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
    components: { Panel, 
        StructureViewerMotif, 
        NavigationButton, 
        ResultFoldDiscoDB, 
        SelectToSendPanel, 
        NameField, 
        TopHits,
        Top100Folddisco,
    },
    // components: { ResultView },
    mixins: [ ResultMixin, ResultSankeyMixin, SendToMixin ],
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
            selectedStates: null,
            selectedCounts: 0,
            selectedCountPerDb: null,
            selectedSets: new Set(),
            scrollOffsetArr: [],
            clusterInfoPerDb: {},
        }
    },
    created() {
        this._sortMemo = createSortMemo();
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
        this.getSingleSelectionInfo = this.getSingleSelectionInfo.bind(this)
        this.getMultipleSelectionInfo = this.getMultipleSelectionInfo.bind(this)
        this.getPdbToSend = this.getPdbToSend.bind(this)
        this.getTargetPdb = this.getTargetPdb.bind(this)
        this.getOrigPdbToSend = this.getOrigPdbToSend.bind(this)
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
        this._disposeApi?.();
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
        tabOffset() {
            let addend = this.hits?.results?.length == 1 ? 92 : 140
            let sheetHeight = this.$vuetify.breakpoint.xsOnly ? 356 : this.$vuetify.breakpoint.mdAndDown ? 304 : 180
            let colheadHeight = 32
            return addend + sheetHeight + colheadHeight
        },
        hasMoreClusters() {
            for (const key in this.clusterInfoPerDb) {
                const info = this.clusterInfoPerDb[key]
                if (info.totalClusterCount > info.renderedClusterCount) return true
            }
            return false
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

        this._disposeApi = registerResultApi('folddisco', {
            getTable: this.getTable,
            getTableSummary: this.getTableSummary,
            getState: this.getState,
            selectAll: this.selectAll,
            selectVisible: this.selectVisible,
            setSelection: this.setSelection,
            select: this.select,
            deselect: this.deselect,
            getSelection: this.getSelection,
            clearSelection: this.clearSelection,
            selectDatabase: this.selectDatabase,
            getTaxonomy: this.getTaxonomy,
            setTaxonomyFilter: this.setTaxonomyFilter,
            getMotifPatterns: this.getMotifPatterns,
            setMotifFilter: this.setMotifFilter,
            getFilters: this.getFilters,
            clearFilters: this.clearFilters,
            sendTo: this.sendTo,
            describePage: this.describePage,
            _vm: this,   // unstable escape hatch; see describe()
        });
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
                    this.selectedDatabases = n.results.length == 1 ? 1 : 0
                }
            },
            immediate: false,
            deep: true
        },
    },
    methods: {
        // ---------------------------------------------------------------------------------
        // Public API (also exposed as window.resultsApi — see lib/resultsApi.js)
        // ---------------------------------------------------------------------------------
        _resolveDb(db) {
            if (db === undefined || db === null) return null;
            if (typeof db === 'number') return this.hits?.results?.[db] ? db : null;
            if (/^\d+$/.test(String(db))) {
                const i = Number(db);
                return this.hits?.results?.[i] ? i : null;
            }
            if (this.dbToIdx?.[db] !== undefined) return this.dbToIdx[db];
            // Tabs display the db name with the _folddisco suffix stripped; accept either form.
            const i = this.hits?.results?.findIndex(
                r => r.db.replace(/_folddisco$/, '') === String(db));
            return i === undefined || i < 0 ? null : i;
        },
        _activeChild() {
            if (!this.selectedDatabases) return null;
            const refs = this.$refs['dbComponent' + (this.selectedDatabases - 1)];
            return Array.isArray(refs) ? refs[0] : refs || null;
        },
        getTable(opts = {}) {
            if (!this.hits?.results) return { page: 'folddisco', error: 'no results loaded' };
            const { db = null, sortKey = null, sortOrder = null,
                offset = 0, limit = 20, fields = null } = opts;

            let targets;
            if (db === '*' || db === 'all') {
                targets = this.hits.results.map((_, i) => i);
            } else if (db === null || db === undefined) {
                const active = this.selectedDatabases ? this.selectedDatabases - 1 : null;
                if (active === null) {
                    return { page: 'folddisco',
                        error: 'no database tab is open; pass db, or db:"*" for all',
                        available: this.hits.results.map(r => r.db) };
                }
                targets = [active];
            } else {
                const i = this._resolveDb(db);
                if (i === null) {
                    return { page: 'folddisco', error: `unknown database: ${db}`,
                        available: this.hits.results.map(r => r.db) };
                }
                targets = [i];
            }

            const child = this._activeChild();
            const activeIdx = this.selectedDatabases ? this.selectedDatabases - 1 : null;

            const databases = targets.map(dbIdx => {
                const entry = this.hits.results[dbIdx];
                const alignments = entry.alignments || {};
                const isActive = dbIdx === activeIdx && !!child;
                const key = sortKey || (isActive ? child.sortKey : 'idf');
                if (!isValidSortKey(key, 'folddisco')) {
                    return { db: entry.db, dbIndex: dbIdx, error: `invalid sortKey: ${key}`,
                        validSortKeys: FOLDDISCO_SORT_KEYS };
                }
                const order = sortOrder != null ? Number(sortOrder)
                    : (isActive && !sortKey ? child.sortOrder : defaultSortOrder(key));

                // Clustering lives in the mounted child (FolddiscoHitCluster). For a closed tab
                // there is no cluster assignment at all, so say so rather than inventing one.
                let ordered, clustered = false, clusterOf = null;
                if (isActive && child.sortedIndices && Object.keys(child.sortedIndices).length) {
                    clustered = true;
                    clusterOf = {};
                    ordered = [];
                    for (const [cluKey, ids] of Object.entries(child.sortedIndices)) {
                        for (const id of ids) { clusterOf[id] = cluKey; ordered.push(id); }
                    }
                } else {
                    ordered = this._sortMemo.get(`${dbIdx}`, alignments, key, order,
                        { tool: 'folddisco' });
                }

                const page = ordered.slice(offset, offset + limit);
                return {
                    db: entry.db, dbIndex: dbIdx, sortKey: key, sortOrder: order,
                    total: ordered.length, offset, returned: page.length,
                    hasDescription: !!entry.hasDescription,
                    hasTaxonomy: !!entry.hasTaxonomy,
                    clustered,
                    filtersApplied: isActive,
                    rows: page.map((gid, i) => this._rowFor(
                        dbIdx, gid, entry, offset + i, isActive ? child : null,
                        clusterOf, fields)),
                };
            });

            return {
                page: 'folddisco',
                motif: this.hits.motif ?? null,
                query: this.hits.query?.header ?? null,
                activeDatabase: activeIdx === null ? null : this.hits.results[activeIdx]?.db,
                databases,
            };
        },
        _rowFor(dbIdx, groupId, entry, rank, child, clusterOf, fields) {
            const head = entry.alignments[groupId][0];
            const row = {
                id: `${dbIdx}#${groupId}`,
                entryIndex: Number(groupId),
                rank,
                cluster: clusterOf ? (clusterOf[groupId] ?? null) : null,
                selected: !!this.selectedStates?.[dbIdx]?.[groupId],
                visible: child ? child.isRowVisible(groupId) : true,
                target: head.target,
                targetName: head.targetname,
                dbkey: head.dbkey,
                idfscore: head.idfscore,
                rmsd: head.rmsd,
                nodecount: head.nodecount,
                targetresidues: head.targetresidues,
                // Per-query-residue bitmask: "1" matched, "0" missing. This is what the
                // "Query residues" filter selects on — see setMotifFilter().
                motifPattern: head.gaps,
            };
            if (entry.hasDescription) row.description = head.description;
            if (entry.hasTaxonomy) { row.taxId = head.taxId; row.taxName = head.taxName; }
            if (!fields) return row;
            const picked = {};
            for (const f of ['id', 'entryIndex', 'rank', ...fields]) {
                if (f in row) picked[f] = row[f];
            }
            return picked;
        },
        /** See ResultView.selectAll. Note FoldDisco is single-selection unless ?d2m=1. */
        selectAll(db = null) {
            const i = db == null
                ? (this.selectedDatabases ? this.selectedDatabases - 1 : null)
                : this._resolveDb(db);
            const entry = i === null ? null : this.hits?.results?.[i];
            if (!entry) {
                return { ok: false, reason: db == null ? 'no database tab is open' : `unknown database: ${db}` };
            }
            const ids = Object.keys(entry.alignments || {}).map(g => `${i}#${g}`);
            return this._bulkSelectionResult(this._applySelection(ids, true));
        },
        selectVisible(db = null) {
            const got = this._requireActiveChild(db);
            if (got.error) return { ok: false, reason: got.error };
            const i = this.selectedDatabases - 1;
            const entry = this.hits.results[i];
            const ids = Object.keys(entry.alignments || {})
                .filter(g => got.child.isRowVisible(Number(g)))
                .map(g => `${i}#${g}`);
            return this._bulkSelectionResult(this._applySelection(ids, true));
        },
        // Counts, not id lists — see ResultView._bulkSelectionResult.
        _bulkSelectionResult(r) {
            const reasons = [...new Set(r.rejected.map(x => x.reason))];
            return {
                ok: r.rejected.length === 0,
                count: r.selectedCount ?? this.selectedCounts,
                added: r.changed.length,
                rejected: r.rejected.length,
                ...(reasons.length ? { reasons } : {}),
            };
        },
        /** See ResultView.getTableSummary. */
        getTableSummary(opts = {}) {
            if (!this.hits?.results) return { ok: false, page: 'folddisco', error: 'no results loaded' };
            const { db = '*', topN = 3, merged = false } = opts;
            const activeIdx = this.selectedDatabases ? this.selectedDatabases - 1 : null;
            const child = this._activeChild();

            let targets;
            if (db === '*' || db === 'all') targets = this.hits.results.map((_, i) => i);
            else {
                const i = this._resolveDb(db);
                if (i === null) {
                    return { ok: false, page: 'folddisco', error: `unknown database: ${db}`,
                        available: this.hits.results.map(r => r.db) };
                }
                targets = [i];
            }
            const num = v => {
                const n = typeof v === 'string' ? Number(v) : v;
                return Number.isFinite(n) ? n : null;
            };
            const all = [];
            const databases = targets.map(dbIdx => {
                const entry = this.hits.results[dbIdx];
                const alignments = entry.alignments || {};
                const isActive = dbIdx === activeIdx && !!child;
                const key = isActive ? child.sortKey : 'idf';
                const order = isActive ? child.sortOrder : defaultSortOrder(key);
                const sorted = this._sortMemo.get(`${dbIdx}`, alignments, key, order,
                    { tool: 'folddisco' });
                // _rowFor here is (dbIdx, groupId, entry, rank, child, clusterOf, fields).
                const row = (gid, f) => this._rowFor(dbIdx, gid, entry, 0, null, null, f);
                const field = rowFieldForSortKey(key, 'folddisco');
                const valAt = gid => num(row(gid, [field])?.[field]);
                const summary = {
                    db: entry.db, dbIndex: dbIdx,
                    total: sorted.length,
                    visibleCount: isActive
                        ? Object.keys(alignments).filter(g => child.isRowVisible(Number(g))).length
                        : sorted.length,
                    selectedCount: this.selectedCountPerDb?.[dbIdx] ?? 0,
                    sortKey: key, sortOrder: order,
                    sortKeySource: isActive ? 'active' : 'default',
                    hasTaxonomy: !!entry.hasTaxonomy,
                    metrics: { [key]: sorted.length
                        ? { best: valAt(sorted[0]),
                            median: valAt(sorted[Math.floor(sorted.length / 2)]),
                            worst: valAt(sorted[sorted.length - 1]) }
                        : null },
                    ...(topN > 0
                        ? { top: sorted.slice(0, topN).map(gid => row(gid, ['target', field])) }
                        : {}),
                };
                // Independent of topN — see ResultView.getTableSummary.
                if (merged) {
                    for (const gid of sorted.slice(0, MERGE_POOL_PER_DB)) {
                        const r = row(gid, ['target', field]);
                        all.push({ ...r, db: entry.db, _v: num(r[field]) });
                    }
                }
                return summary;
            });
            const out = { ok: true, page: 'folddisco',
                activeDatabase: activeIdx === null ? null : this.hits.results[activeIdx]?.db,
                databases };
            if (merged) {
                // One ranking across every database, mirroring what Top100Folddisco.vue builds
                // internally (db_idx + '#' + k over all hits.results) and never returns.
                const key = databases[0]?.sortKey;
                const order = databases[0]?.sortOrder ?? 1;
                const ranked = all.filter(r => r._v !== null)
                    .sort((a, b) => (a._v - b._v) * (order < 0 ? -1 : 1))
                    .slice(0, 100)
                    .map(({ _v, ...r }) => r);
                out.merged = { sortKey: key, sortOrder: order, count: ranked.length, topN: ranked };
            }
            return out;
        },
        /** See ResultView.getState. No `query`/`entry`: this route has no :entry param. */
        getState() {
            const child = this._activeChild();
            const activeIdx = this.selectedDatabases ? this.selectedDatabases - 1 : null;
            const sel = this.getSelection();
            return {
                ok: true,
                page: 'folddisco',
                ticket: this.ticket || this.$route?.params?.ticket || null,
                ready: !!this.hits?.results,
                multiSelectEnabled: child?.multipleSelectionEnabled ?? false,
                activeDatabase: activeIdx === null ? null : this.hits?.results?.[activeIdx]?.db,
                databases: (this.hits?.results ?? []).map((r, i) => ({
                    db: r.db, dbIndex: i,
                    hits: r.alignments ? Object.keys(r.alignments).length : 0,
                    hasTaxonomy: !!r.hasTaxonomy,
                    selectedCount: this.selectedCountPerDb?.[i] ?? 0,
                })),
                selection: { count: sel.count, upperbound: sel.upperbound },
                filters: child ? this.getFilters() : null,
            };
        },
        _applySelection(ids, value) {
            const changed = [], rejected = [];
            if (!this.selectedStates) return { changed, rejected: ids, selectedCount: 0 };

            const child = this._activeChild();
            // FoldDisco is single-selection unless ?d2m=1 enabled it on the child.
            const multi = child ? child.multipleSelectionEnabled : true;
            if (value && !multi && ids.length > 1) {
                rejected.push(...ids.slice(1).map(id => ({ id,
                    reason: 'FoldDisco is single-selection; add ?d2m=1 to enable multi-select' })));
                ids = ids.slice(0, 1);
            }
            if (value && !multi) this.clearAllEntries();

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

            for (const [dbIdx, d] of Object.entries(deltaPerDb)) {
                const next = (this.selectedCountPerDb[dbIdx] || 0) + d;
                this.selectedCountPerDb[dbIdx] = next;
                const el = document.getElementById(dbIdx + '#select-all');
                if (el) {
                    const total = Object.keys(this.hits?.results?.[dbIdx]?.alignments ?? {}).length;
                    el.classList.toggle('any-selected', next > 0);
                    el.classList.toggle('all-selected', total > 0 && next === total);
                }
            }
            this.selectedCounts += delta;
            this.$refs.top100?.reflectSelectionState?.();
            return { changed, rejected, selectedCount: this.selectedCounts };
        },
        // Replaces the selection: after this, exactly `ids` are selected. The old name promised
        // this and the old behaviour was additive, so a caller paging through results accumulated
        // instead of replacing while every count it read back looked right.
        setSelection(ids, ...rest) {
            if (rest.length > 0) {
                // Ignoring a stale `value` would turn setSelection(ids, false) — a deselect — into a
                // replace. Refuse loudly rather than do the opposite of what was meant.
                return { ok: false, count: this.selectedCounts, applied: [], rejected: [],
                    reason: 'setSelection takes only ids and replaces the selection; '
                        + 'use select(ids) to add or deselect(ids) to remove' };
            }
            const list = Array.isArray(ids) ? ids : [ids];
            // Diff rather than clear-and-reselect: _applySelection mirrors `.selected` onto DOM
            // nodes, so replacing a 1000-row selection with a near-identical one would otherwise do
            // ~2000 pointless class toggles.
            const target = new Set();
            const rejected = [];
            for (const raw of list) {
                const id = normalizeId(raw, this.dbToIdx);
                if (!id) rejected.push({ id: raw, reason: 'unresolvable id' });
                else target.add(id);
            }
            const remove = [...this.selectedSets].filter(id => !target.has(id));
            const add = [...target].filter(id => !this.selectedSets.has(id));
            const off = remove.length ? this._applySelection(remove, false)
                : { changed: [], rejected: [] };
            const on = add.length ? this._applySelection(add, true)
                : { changed: [], rejected: [] };
            // Report the two directions separately. A flat `applied` here would mix ids that were
            // just selected with ids that were just deselected — indistinguishable to the caller.
            return {
                ok: rejected.length + off.rejected.length + on.rejected.length === 0,
                count: this.selectedCounts,
                applied: on.changed,
                removed: off.changed,
                rejected: [...rejected, ...off.rejected, ...on.rejected],
            };
        },
        /** Additive — leaves entries outside `ids` alone. */
        select(ids) {
            return this._selectionResult(
                this._applySelection(Array.isArray(ids) ? ids : [ids], true));
        },
        deselect(ids) {
            return this._selectionResult(
                this._applySelection(Array.isArray(ids) ? ids : [ids], false));
        },
        // _applySelection already builds `rejected` with per-id reasons; the old count-only return
        // threw it away. `applied` is not "input minus rejected" — entries already in the requested
        // state are skipped as no-ops.
        _selectionResult(r) {
            return {
                ok: r.rejected.length === 0,
                count: r.selectedCount ?? this.selectedCounts,
                applied: r.changed,
                rejected: r.rejected,
            };
        },
        getSelection() {
            const ids = [...this.selectedSets];
            const byDb = {};
            for (const id of ids) {
                const { dbIdx } = splitId(id);
                const name = this.hits?.results?.[dbIdx]?.db ?? String(dbIdx);
                (byDb[name] ||= []).push(id);
            }
            return { count: this.selectedCounts, upperbound: this.selectUpperbound, ids, byDb };
        },
        clearSelection() {
            const cleared = this.selectedCounts;
            this.clearAllEntries();
            return { ok: true, count: this.selectedCounts, cleared };
        },
        selectDatabase(db) {
            const i = this._resolveDb(db);
            if (i === null) {
                return { ok: false, reason: `unknown database: ${db}`,
                    available: this.hits?.results?.map(r => r.db) ?? [] };
            }
            this.selectedDatabases = i + 1;
            return { ok: true, activeDatabase: this.hits.results[i].db, dbIndex: i };
        },
        _requireActiveChild(db) {
            const child = this._activeChild();
            if (!child) return { error: 'no database tab is open; call selectDatabase(db) first' };
            if (db != null) {
                const i = this._resolveDb(db);
                if (i === null) return { error: `unknown database: ${db}` };
                if (i !== this.selectedDatabases - 1) {
                    return { error: `"${this.hits.results[i].db}" is not the open tab; `
                        + `call selectDatabase("${this.hits.results[i].db}") first` };
                }
            }
            return { child };
        },
        _afterFilterChange(child, entry) {
            // Recompute synchronously before counting: FoldDisco's visibilityTable is only
            // rebuilt inside updateVisibility(), so reading isRowVisible() before it runs
            // reports the pre-filter counts. The $nextTick pass repairs the DOM after re-render.
            child.updateVisibility();
            child.$nextTick(() => child.syncRenderedState?.());
            const total = Object.keys(entry.alignments || {}).length;
            const visible = Object.keys(entry.alignments || {})
                .filter(g => child.isRowVisible(Number(g))).length;
            return { applied: true, db: entry.db,
                taxIdCount: (child.filteredHitsTaxIds ?? []).length,
                visibleCount: visible, totalCount: total };
        },
        getTaxonomy(db = null, opts = {}) {
            const i = db == null ? (this.selectedDatabases - 1) : this._resolveDb(db);
            const entry = this.hits?.results?.[i];
            if (!entry) return { error: `unknown database: ${db}` };
            const report = entry.taxonomyreports?.[0];
            if (!report?.length) {
                return { db: entry.db, available: false,
                    reason: 'no taxonomy data for this database' };
            }
            return { db: entry.db, available: true, totalNodes: report.length,
                taxa: summarizeTaxonomy(report, opts) };
        },
        setTaxonomyFilter(taxon, { includeDescendants = true, db = null } = {}) {
            const got = this._requireActiveChild(db);
            if (got.error) return { applied: false, reason: got.error };
            const child = got.child;
            const entry = this.hits.results[this.selectedDatabases - 1];
            const report = entry.taxonomyreports?.[0];

            let taxIds;
            if (taxon == null || (Array.isArray(taxon) && !taxon.length)) {
                taxIds = [];
            } else if (Array.isArray(taxon)) {
                taxIds = taxon.map(Number);
            } else {
                if (!report?.length) {
                    return { applied: false, db: entry.db,
                        reason: 'no taxonomy data for this database' };
                }
                let id = taxon;
                if (typeof taxon === 'string' && !/^\d+$/.test(taxon)) {
                    id = findTaxonByName(report, taxon);
                    resolvedId = id;
                    if (id === null) {
                        return { applied: false, db: entry.db,
                            reason: `no taxon named "${taxon}" in this database` };
                    }
                }
                if (resolvedId === null) resolvedId = Number(id);
                if (!findTaxonRow(report, id)) {
                    return { applied: false, db: entry.db, reason: `taxon ${id} not in report` };
                }
                taxIds = (includeDescendants ? expandDescendants(report, id) : [id]).map(Number);
            }
            child.localSelectedTaxId = taxIds.length ? Number(resolvedId ?? taxIds[0]) : null;
            child.apiSelectedTaxon = taxIds.length ? taxon : null;
            child.filteredHitsTaxIds = taxIds;
            child.selectedDb = entry.db;
            return this._afterFilterChange(child, entry);
        },
        getMotifPatterns(db = null) {
            const i = db == null ? (this.selectedDatabases - 1) : this._resolveDb(db);
            const entry = this.hits?.results?.[i];
            if (!entry) return { error: `unknown database: ${db}` };
            const counts = {};
            for (const g of Object.values(entry.alignments || {})) {
                const p = g[0].gaps;
                counts[p] = (counts[p] || 0) + 1;
            }
            return {
                db: entry.db,
                queryResidues: entry.queryresidues ?? null,
                note: 'one character per query residue: "1" matched, "0" missing',
                patterns: Object.entries(counts)
                    .map(([pattern, hits]) => ({ pattern, hits }))
                    .sort((a, b) => b.hits - a.hits),
            };
        },
        // NOT setGapFilter: this selects a matched-query-residue pattern, not sequence gaps.
        // The child's variable is called gapFilter only because the derived field is `gaps`.
        setMotifFilter(pattern, { db = null } = {}) {
            const got = this._requireActiveChild(db);
            if (got.error) return { applied: false, reason: got.error };
            const child = got.child;
            const entry = this.hits.results[this.selectedDatabases - 1];
            const value = pattern == null ? '' : String(pattern);
            if (value !== '') {
                const known = new Set(Object.values(entry.alignments || {}).map(g => g[0].gaps));
                if (!known.has(value)) {
                    return { applied: false, db: entry.db,
                        reason: `no hits with pattern "${value}"`,
                        available: [...known] };
                }
            }
            child.gapFilter = value;
            return { ...this._afterFilterChange(child, entry), motifPattern: value || null };
        },
        getFilters() {
            const child = this._activeChild();
            if (!child) return { activeDatabase: null, taxonomy: null, motif: null };
            const entry = this.hits.results[this.selectedDatabases - 1];
            const total = Object.keys(entry.alignments || {}).length;
            const visible = Object.keys(entry.alignments || {})
                .filter(g => child.isRowVisible(Number(g))).length;
            const taxIds = child.filteredHitsTaxIds ?? [];
            return {
                activeDatabase: entry.db,
                taxonomy: {
                    // `selected` records what was asked for — including a name — and
                    // `selectedTaxId` the id it resolved to. Previously a name filter left
                    // `selected: null` while 193 rows were hidden, so anything testing `selected`
                    // for truthiness got the wrong answer; `active` is still the authority.
                    selected: child.apiSelectedTaxon ?? child.localSelectedTaxId ?? null,
                    selectedTaxId: child.localSelectedTaxId ?? null,
                    taxIdCount: taxIds.length,
                    active: taxIds.length > 0,
                },
                motif: { pattern: child.gapFilter || null, active: !!child.gapFilter },
                visibleCount: visible,
                totalCount: total,
            };
        },
        clearFilters() {
            const child = this._activeChild();
            if (!child) return { cleared: false, reason: 'no database tab is open' };
            const entry = this.hits.results[this.selectedDatabases - 1];
            child.localSelectedTaxId = null;
            child.filteredHitsTaxIds = [];
            child.apiSelectedTaxon = null;
            child.gapFilter = '';
            // `applied` dropped — see ResultView.clearFilters.
            const { applied, ...rest } = this._afterFilterChange(child, entry);
            return { ok: true, cleared: true, active: false, ...rest };
        },
        describePage() {
            return {
                tool: 'folddisco',
                validSortKeys: FOLDDISCO_SORT_KEYS,
                selectionUpperbound: this.selectUpperbound,
                multiSelectEnabled: this._activeChild()?.multipleSelectionEnabled ?? false,
                databases: this.hits?.results?.map((r, i) => ({
                    db: r.db, dbIndex: i,
                    hits: r.alignments ? Object.keys(r.alignments).length : 0,
                    hasTaxonomy: !!r.hasTaxonomy,
                })) ?? [],
                idFormat: 'dbIdx#entryIdx — also accepts {db, idx} or [dbIdx, entryIdx]',
                filters: ['taxonomy (subtree)', 'motif (matched-query-residue pattern)'],
                sendTargets: { foldseek: '1 entry', folddisco: '1 entry',
                    foldmason: '1+ entries; opt includeQuery:bool prepends the query structure' },
                notes: [
                    'getTable() is read-only and defaults to the open tab; db:"*" for all.',
                    '`cluster` is populated only for the open tab.',
                    'Single-selection unless the URL carries ?d2m=1.',
                    'setMotifFilter() matches a query-residue bitmask, not sequence gaps.',
                    'sendTo() is side-effectful: writes IndexedDB and navigates away.',
                    '_vm is the live component — unstable.',
                ],
            };
        },
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
            if (db.startsWith("pdb")) {
                target = item.target;
            }
            const re = "api/result/folddisco/" + this.$route.params.ticket + '?database=' + db +'&id=' + target;
            const MAX_RETRIES = 4
            let attempt = 0;
            while (attempt < MAX_RETRIES) {
                try {
                    const request = await this.$axios.get(re, {
                        // headers: {
                        //     // 'Cache-Control': 'no-cache, no-store, must-revalidate',
                        //     // 'Pragma': 'no-cache',
                        //     // 'Expires': '0',
                        //     'Accept': 'text/plain, application/octet-stream',
                        // },
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
        // Thin adapters over _applySelection — the same mutator the public API uses.
        // Signatures unchanged so no call site in ResultFoldDiscoDB or Top100Folddisco moves.
        // Previously three near-identical copies carrying the per-db-delta and
        // `selectedStates[db].length` bugs; see claude-plan/ai-friendly-results.
        handleToggleSelection(db, idx, value, fromTop100 = false) {
            this._applySelection([`${db}#${idx}`], value)
        },
        handleBulkToggle(db, indices, value) {
            this._applySelection(indices.map(i => `${db}#${i}`), value)
        },
        handleBulkToggleFromTop100(indices, value) {
            this._applySelection(indices, value)
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
            el = document.getElementById('top#select-all')
            if (el) {
                el.classList.toggle('any-selected', false)
                el.classList.toggle('all-selected', false)
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
        },
        handleClusterInfo(entryidx, info) {
            this.$set(this.clusterInfoPerDb, entryidx, info)
        },
        async handleNeedRenderNext() {
            // Find the first child component that has unrendered clusters
            const results = this.hits?.results
            if (!results) return
            for (let i = 0; i < results.length; i++) {
                if (this.selectedDatabases != 0 && (i + 1) != this.selectedDatabases) continue
                const refs = this.$refs['dbComponent' + i]
                const comp = Array.isArray(refs) ? refs[0] : refs
                if (!comp) continue
                const info = this.clusterInfoPerDb[i]
                if (!info || info.totalClusterCount <= info.renderedClusterCount) continue
                // Find the next unrendered cluster key
                const nextKey = comp.clusterKeys[comp.renderedClusterKeys.length]
                if (!nextKey) continue
                await comp.renderUpToCluster(nextKey)
                this.$nextTick(() => {
                    this.updateScrollOffsetArr()
                    // Scroll to the newly rendered cluster
                    const el = document.querySelector('.result-entry-' + i + nextKey)
                    if (el) {
                        const top = Math.ceil(el.getBoundingClientRect().top + window.scrollY) - this.tabOffset
                        window.scrollTo({ top, left: 0, behavior: 'smooth' })
                    }
                })
                return
            }
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

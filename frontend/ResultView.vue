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
                <component
                    :is="searchType === 'interfacesearch' ? 'InterfaceAlignmentPanel' : 'AlignmentPanel'"
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
import InterfaceAlignmentPanel from './InterfaceAlignmentPanel.vue';
import Ruler from './Ruler.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import AllAtomPredictMixin from './AllAtomPredictMixin.vue';
import NavigationButton from './NavigationButton.vue';

import { mockPDB, mergePdbs, concatenatePdbs, 
    getChainName, getAccession, getAbsOffsetTop,
    encodeMultimer} from './Utilities';

import { debounce } from './lib/debounce';
import { registerResultApi, awaitPageApi, normalizeId, splitId } from './lib/resultsApi.js';
import { sortIndices, defaultSortOrder, isValidSortKey, FOLDSEEK_SORT_KEYS,
    createSortMemo } from './lib/resultSort.js';
import { expandDescendants, findTaxonRow, findTaxonByName,
    summarizeTaxonomy } from './lib/taxonomyFilter.js';
import ResultFoldseekDB from './ResultFoldseekDB.vue';
import SelectToSendPanel from './SelectToSendPanel.vue';
import NameField from './NameField.vue';
import TopHits from './TopHits.vue';
import Top100Foldseek from './Top100Foldseek.vue';

export default {
    name: 'ResultView',
    mixins: [ ResultSankeyMixin, AllAtomPredictMixin ],
    components: { Panel, AlignmentPanel, InterfaceAlignmentPanel, Ruler, 
        NavigationButton, ResultFoldseekDB, SelectToSendPanel, 
        NameField, TopHits, Top100Foldseek },
    data() {
        return {
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
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
        this._sortMemo = createSortMemo();
        this.getSingleSelectionInfo = this.getSingleSelectionInfo.bind(this)
        this.getMultipleSelectionInfo = this.getMultipleSelectionInfo.bind(this)
        this.getMockPdb = this.getMockPdb.bind(this)
        this.getMultimerPdb = this.getMultimerPdb.bind(this)
        this.fetchStructureFileURL = this.fetchStructureFileURL.bind(this)
    },
    mounted() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
        this._disposeApi = registerResultApi('foldseek', {
            getTable: this.getTable,
            setSelection: this.setSelection,
            getSelection: this.getSelection,
            clearSelection: this.clearSelection,
            selectDatabase: this.selectDatabase,
            getTaxonomy: this.getTaxonomy,
            setTaxonomyFilter: this.setTaxonomyFilter,
            getFilters: this.getFilters,
            clearFilters: this.clearFilters,
            sendTo: this.sendTo,
            describePage: this.describePage,
            _vm: this,   // unstable escape hatch; see describe()
        });
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
        this._disposeApi?.();
    },
    watch: {
        hits: {
            handler(n, o) {
                if (n && n.results) {
                    this._sortMemo?.clear();
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
            if (this.hits?.type == "complexsearch" || this.hits?.queries?.length > 1) {
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
            const i = this.dbToIdx?.[db];
            return i === undefined ? null : i;
        },
        _activeChild() {
            if (!this.selectedDatabases) return null;
            const refs = this.$refs['dbComponent' + (this.selectedDatabases - 1)];
            return Array.isArray(refs) ? refs[0] : refs || null;
        },
        _rowFor(dbIdx, groupId, entry, rank, child, includeChains, fields) {
            const group = entry.alignments[groupId];
            const head = group[0];
            const row = {
                id: `${dbIdx}#${groupId}`,
                entryIndex: Number(groupId),
                rank,
                selected: !!this.selectedStates?.[dbIdx]?.[groupId],
                visible: child ? child.isRowVisible(groupId) : true,
                target: head.target,
                chainCount: group.length,
            };
            if (entry.hasDescription) row.description = head.description;
            if (entry.hasTaxonomy) { row.taxId = head.taxId; row.taxName = head.taxName; }
            if (head.complexqtm !== undefined) {
                row.complexqtm = head.complexqtm;
                row.complexttm = head.complexttm;
            }
            Object.assign(row, {
                prob: head.prob, seqId: head.seqId, eval: head.eval, score: head.score,
                qStartPos: head.qStartPos, qEndPos: head.qEndPos, qLen: head.qLen,
                dbStartPos: head.dbStartPos, dbEndPos: head.dbEndPos, dbLen: head.dbLen,
            });
            if (includeChains) {
                row.chains = group.map(c => ({
                    query: c.query, target: c.target, seqId: c.seqId,
                    eval: c.eval, score: c.score, prob: c.prob,
                }));
            }
            if (!fields) return row;
            const picked = {};
            for (const f of ['id', 'entryIndex', 'rank', ...fields]) {
                if (f in row) picked[f] = row[f];
            }
            return picked;
        },
        getTable(opts = {}) {
            if (!this.hits?.results) return { page: 'foldseek', error: 'no results loaded' };
            const {
                db = null, sortKey = null, sortOrder = null,
                offset = 0, limit = 100, includeChains = false, fields = null,
            } = opts;

            let targets;
            if (db === '*' || db === 'all') {
                // Explicit opt-in: 9 databases x `limit` rows is a large payload, so it should
                // never be what you get by accident.
                targets = this.hits.results.map((_, i) => i);
            } else if (db === null || db === undefined) {
                // Default to the open tab — the one whose filter state is real.
                const active = this.selectedDatabases ? this.selectedDatabases - 1 : null;
                if (active === null) {
                    return { page: 'foldseek',
                        error: 'no database tab is open; pass db, or db:"*" for all',
                        available: this.hits.results.map(r => r.db) };
                }
                targets = [active];
            } else {
                const i = this._resolveDb(db);
                if (i === null) {
                    return { page: 'foldseek', error: `unknown database: ${db}`,
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
                const key = sortKey
                    || (isActive ? child.sortKey : (this.isComplex ? 'qtm' : 'score'));
                if (!isValidSortKey(key, 'foldseek')) {
                    return { db: entry.db, dbIndex: dbIdx, error: `invalid sortKey: ${key}`,
                        validSortKeys: FOLDSEEK_SORT_KEYS };
                }
                const order = sortOrder != null
                    ? Number(sortOrder)
                    : (isActive && !sortKey ? child.sortOrder
                        : defaultSortOrder(key, { mode: this.mode }));

                const sorted = this._sortMemo.get(
                    `${dbIdx}:${this.mode}`, alignments, key, order,
                    { mode: this.mode, isComplex: this.isComplex, tool: 'foldseek' });

                const page = sorted.slice(offset, offset + limit);
                return {
                    db: entry.db,
                    dbIndex: dbIdx,
                    sortKey: key,
                    sortOrder: order,
                    total: sorted.length,
                    offset,
                    returned: page.length,
                    hasDescription: !!entry.hasDescription,
                    hasTaxonomy: !!entry.hasTaxonomy,
                    // Filtering and the `visible` flag only exist for the mounted tab; say so
                    // rather than reporting visible:true as if no filter were active.
                    filtersApplied: isActive,
                    rows: page.map((gid, i) => this._rowFor(
                        dbIdx, gid, entry, offset + i, isActive ? child : null,
                        includeChains, fields)),
                };
            });

            return {
                page: 'foldseek',
                type: this.hits.type || 'structuresearch',
                mode: this.mode,
                isComplex: this.isComplex,
                query: this.hits.query?.header ?? null,
                activeDatabase: activeIdx === null ? null : this.hits.results[activeIdx]?.db,
                databases,
            };
        },
        // Single canonical selection mutator. The three existing handlers still have their own
        // copies (Phase 2 routes them through here); this one is what the API uses.
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
        setSelection(ids, value = true) {
            const list = Array.isArray(ids) ? ids : [ids];
            return this._applySelection(list, !!value).selectedCount;
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
            this.clearAllEntries();
            return this.selectedCounts;
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
        // --- filtering -------------------------------------------------------------------
        // Filter state lives in ResultSankeyMixin on the *child*, and only the active tab's
        // child is mounted, so filters are per-active-tab. Rather than pretend otherwise, these
        // reject with a pointer to selectDatabase().
        _requireActiveChild(db) {
            const child = this._activeChild();
            if (!child) return { error: 'no database tab is open; call selectDatabase(db) first' };
            if (db != null) {
                const i = this._resolveDb(db);
                if (i === null) return { error: `unknown database: ${db}` };
                if (i !== this.selectedDatabases - 1) {
                    return { error: `"${this.hits.results[i].db}" is not the open tab; `
                        + `call selectDatabase("${this.hits.results[i].db}") first`,
                        activeDatabase: this.hits.results[this.selectedDatabases - 1]?.db };
                }
            }
            return { child };
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
            if (taxon === null || taxon === undefined
                || (Array.isArray(taxon) && taxon.length === 0)) {
                taxIds = [];                                  // clears the filter
            } else if (Array.isArray(taxon)) {
                taxIds = taxon.map(Number);                   // explicit list, used verbatim
            } else {
                if (!report?.length) {
                    return { applied: false, db: entry.db,
                        reason: 'no taxonomy data for this database' };
                }
                let id = taxon;
                if (typeof taxon === 'string' && !/^\d+$/.test(taxon)) {
                    id = findTaxonByName(report, taxon);
                    if (id === null) {
                        return { applied: false, db: entry.db,
                            reason: `no taxon named "${taxon}" in this database` };
                    }
                }
                if (!findTaxonRow(report, id)) {
                    return { applied: false, db: entry.db, reason: `taxon ${id} not in report` };
                }
                taxIds = (includeDescendants
                    ? expandDescendants(report, id)
                    : [id]).map(Number);
            }

            // Same fields the Sankey click sets, then the same repaint path — so an API filter
            // and a diagram click cannot produce different DOM.
            child.localSelectedTaxId = taxIds.length ? Number(Array.isArray(taxon) ? taxIds[0] : taxon) : null;
            child.filteredHitsTaxIds = taxIds;
            child.selectedDb = entry.db;
            return this._afterFilterChange(child, entry);
        },
        _afterFilterChange(child, entry) {
            child.recomputeVisibility?.();
            child.$nextTick(() => child.syncRenderedState?.());
            const total = Object.keys(entry.alignments || {}).length;
            const visible = Object.keys(entry.alignments || {})
                .filter(g => child.isRowVisible(Number(g))).length;
            return { applied: true, db: entry.db, taxIds: child.filteredHitsTaxIds,
                visibleCount: visible, totalCount: total };
        },
        getFilters() {
            const child = this._activeChild();
            if (!child) return { activeDatabase: null, taxonomy: null };
            const entry = this.hits.results[this.selectedDatabases - 1];
            const total = Object.keys(entry.alignments || {}).length;
            const visible = Object.keys(entry.alignments || {})
                .filter(g => child.isRowVisible(Number(g))).length;
            return {
                activeDatabase: entry.db,
                taxonomy: {
                    selected: child.localSelectedTaxId ?? null,
                    taxIds: child.filteredHitsTaxIds ?? [],
                    active: (child.filteredHitsTaxIds?.length ?? 0) > 0,
                },
                // Foldseek has taxonomy filtering only. FoldDisco adds a matched-residue
                // pattern filter (motif); FoldMason has the gap-fraction column threshold.
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
            return { cleared: true, ...this._afterFilterChange(child, entry) };
        },
        // --- forwarding the current selection to another tool ------------------------------
        // Unlike everything else here this is genuinely side-effectful: it fetches structures,
        // writes them to IndexedDB and navigates away. Returns a promise that settles once the
        // panel has finished its work.
        async sendTo(target) {
            const panel = this.$refs.sendPanel;
            if (!panel) return { ok: false, reason: 'send panel not mounted' };
            const n = this.selectedCounts;
            if (n === 0) return { ok: false, reason: 'nothing selected' };

            const plans = {
                foldseek:  { fn: 'sendToFoldseek',  needs: n === 1, want: 'exactly one entry' },
                folddisco: { fn: 'sendToFoldDisco', needs: n === 1, want: 'exactly one entry' },
                foldmason: { fn: 'sendToFoldMason', needs: n >= 1,  want: 'at least one entry' },
            };
            const plan = plans[String(target).toLowerCase()];
            if (!plan) {
                return { ok: false, reason: `unknown target: ${target}`,
                    valid: Object.keys(plans) };
            }
            if (!plan.needs) {
                return { ok: false, reason: `${target} needs ${plan.want}; ${n} selected` };
            }
            if (target === 'folddisco' && this.banList.includes(this.getSingleSelectionInfo()?.db)) {
                return { ok: false, reason: 'this database is not supported by FoldDisco' };
            }
            // A complex selection routes to the Multimer page, a monomer one to Search
            // (SelectToSendPanel.vue:219-225) — so the requested target is not always the
            // destination, and the two pages take different mode prefixes.
            // isSelectionComplex lives on the PANEL, not here; reading it off `this` silently
            // yielded undefined and made this branch dead.
            const expected = target === 'foldseek' && panel.isSelectionComplex ? 'multimer' : target;
            await panel[plan.fn]();
            // $router.push resolves before the destination mounts, so without this the caller's
            // next line would see window.searchApi undefined. awaitPageApi lives in the module,
            // not in this component, so it survives our own unmount.
            let ready = true;
            try { await awaitPageApi('search'); } catch { ready = false; }
            return {
                ok: true, target, sent: n,
                destination: expected,
                route: this.$route?.name ?? null,
                searchApiReady: ready,
            };
        },
        describePage() {
            return {
                tool: 'foldseek',
                validSortKeys: FOLDSEEK_SORT_KEYS,
                selectionUpperbound: this.selectUpperbound,
                databases: this.hits?.results?.map((r, i) => ({
                    db: r.db, dbIndex: i,
                    hits: r.alignments ? Object.keys(r.alignments).length : 0,
                    hasTaxonomy: !!r.hasTaxonomy,
                })) ?? [],
                idFormat: 'dbIdx#entryIdx — also accepts {db, idx} or [dbIdx, entryIdx]',
                sendTargets: { foldseek: '1 entry', folddisco: '1 entry', foldmason: '1+ entries' },
                notes: [
                    'getTable() is read-only and defaults to the open tab; db:"*" for all.',
                    'Filters apply to the open tab only; rows elsewhere report '
                        + 'filtersApplied:false and visible:true.',
                    'setTaxonomyFilter() takes a taxId, a taxon name, or an id array.',
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
    position:absolute;
    z-index: 999;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12) !important;
}

</style>
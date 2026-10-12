<template>
    <div :key="entry.db">
        <v-sheet style="position: sticky; z-index: 99997 !important; padding-bottom: 16px;"
            :style="{'height': headHeight, 'top': headTop,
                'box-shadow': $vuetify.breakpoint.smAndDown ? 'rgba(0, 0, 0, 0.2) 0px 8px 6px -6px' : '',
            }"
        >
            <v-flex
                class="d-flex"
                :style="{
                    'flex-direction' : $vuetify.breakpoint.xsOnly ? 'column' : 'row',
                    'align-items': 'center',
                    'flex': '0',
                    'white-space': 'nowrap',
                }">
                <h2 style="margin-top: 0.5em; margin-bottom: 1em;" class="mr-auto result-title">
                    <!-- <div style="width: 24px; display: inline-block;"></div> -->
                    <v-icon @click="isCollapsed = !isCollapsed"
                        style="transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1); margin-right: 8px;"
                        :style="{'transform': isCollapsed ? 'rotate(-90deg)' : ''}"
                        :title="isCollapsed ? 'Show actions' : 'Hide actions'"
                    >
                        {{ $MDI.ChevronDown }}
                    </v-icon>
                    <span style="text-transform: uppercase;">{{ entry.db.replaceAll(/_folddisco$/g, '') }}</span>
                    <small class="ml-2">{{ hitCountLabel }}</small>
                    <span v-if="filterChips.length > 0 && !$vuetify.breakpoint.smAndDown" class="filter-chips">
                        <v-chip v-for="chip in filterChips" :key="chip.key" small outlined close
                            :color="entry.color" class="ml-2" :title="chip.text"
                            @click:close="onColumnFilter(chip.key, null)">{{ chip.text }}</v-chip>
                        <v-chip v-if="filterChips.length > 1" small class="ml-2" @click="clearFilters">Clear all</v-chip>
                    </span>
                </h2>
                <v-btn v-if="hasTaxonomyReport && (!$vuetify.breakpoint.xsOnly || !isCollapsed)" @click="toggleSankeyVisibility(entry.db)" 
                    :class="{ 'mr-2': $vuetify.breakpoint.smAndUp , 'mb-2': $vuetify.breakpoint.xsOnly}" large>
                    {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
                </v-btn>
            </v-flex>
            <v-flex
                v-if="!isCollapsed"
                class="d-flex"
                :style="{
                    'flex-direction' : $vuetify.breakpoint.mdAndDown ? 'column' : 'row',
                    'align-items': 'center',
                    'white-space': 'nowrap',
                    'gap': '24px',
                    'padding-left': '36px',
                }"
                >
                <div style="flex-basis: 100%; width: 100%">
                    <h3>Filter
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Filter hits by which query residues are present in the match. Select a pattern to show only hits matching that specific subset of query residues.</span>
                        </v-tooltip>
                    </h3>
                    <motif-filter
                        :items="dbGaps"
                        :value="gapFilter ? gapFilter : ''"
                        @input="gapFilter = $event"
                        @click:clear="gapFilter = ''"
                        :queryresidues="entry.queryresidues"
                        :color="entry.color"
                    >
                    </motif-filter>
                </div>
                <v-flex class="d-flex" style="flex-basis: 100%; width: 100%">
                    <div style="width: 100%">
                        <h3>Cluster
                            <v-tooltip open-delay="300" top>
                                <template v-slot:activator="{ on }">
                                    <v-icon v-on="on" style="font-size: 16px;">{{ $MDI.HelpCircleOutline }}</v-icon>
                                </template>
                                <div>
                                    Group hits by similarity of their matched inter-residue distances using DBSCAN density-based clustering. <br> Hits with similar geometric arrangements are placed in the same cluster.
                                    <ul class="mt-1 ml-4">
                                        <li><b>Min Points:</b> minimum number of hits required to form a cluster; smaller groups are labeled as noise.</li>
                                        <li><b>Epsilon:</b> maximum squared distance between two points to be considered neighbors.</li>
                                    </ul>
                                </div>
                            </v-tooltip>
                        </h3>
                        <folddisco-hit-cluster :hits="entry" v-on:cluster="clusters = $event"></folddisco-hit-cluster>
                    </div>
                    <div v-if="$vuetify.breakpoint.smAndDown" class="mobile-table-actions">
                        <ResultFilterMenu :columns="mobileFilterColumns" :color="entry.color"
                            @filter="onColumnFilter" @clear="clearFilters"></ResultFilterMenu>
                        <v-menu bottom left>
                            <template v-slot:activator="{on, attrs}">
                                <v-btn icon v-bind="attrs" v-on="on" title="Sort options">
                                    <v-icon>{{ $MDI.Sort }}</v-icon>
                                </v-btn>
                            </template>
                            <v-list flat dense>
                                <v-list-item-group mandatory :color="entry.color" :value="filterKeys.indexOf(sortKey)">
                                    <v-list-item v-for="key in filterKeys" :key="key" @click.stop="changeSortMode(key)">
                                        <v-list-item-title>{{ columnLabels[key] }}</v-list-item-title>
                                        <v-list-item-icon>
                                            <v-icon :style="{ opacity: sortKey == key ? 1 : 0 }">
                                                {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp }}
                                            </v-icon>
                                        </v-list-item-icon>
                                    </v-list-item>
                                </v-list-item-group>
                            </v-list>
                        </v-menu>
                    </div>
                </v-flex>
            </v-flex>
        </v-sheet>
        <v-flex v-if="hasEntries && hasTaxonomyReport && isSankeyVisible[entry.db]">
            <SankeyDiagram :rawData="entry.taxonomyreports[0]" :currentSelectedNodeId="localSelectedTaxId" @selectTaxon="handleSankeySelect"></SankeyDiagram>
        </v-flex>

        <table class="v-table result-table" style="position:relative; margin-bottom: 3em;"
            v-if="hasEntries" :style="{'--active-color': entry.color}">
            <colgroup>
                <col style="width: 36px;"> <!--index-->
                <col style="min-width: 12%;" /> <!-- target -->
                <col v-if="entry.hasDescription" style="width: 25%;" /> 
                <col v-if="entry.hasTaxonomy" style="width: 15%;" />
                <col style="width: 8%;" /> <!-- idf-score --> 
                <col style="width: 6%;" /> <!-- RMSD --> 
                <col style="width: 6%;" /> <!-- nodecount -->
                <col style="min-width: 12%;" /> <!-- Matched residues --> 
                <!-- <col style="width: 20%;" /> Interresidue --> 
                <col style="width: 6%;" /> <!-- action -->
            </colgroup>
            <thead style="position: sticky; z-index: 99997 !important;" class="sticky-thead"
                :style="{'top': colheadTop, 
                'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
                <tr>
                    <th class="thin select-all-th" style="position: relative">
                        <!-- Replaced this checkbox too, for the colored undeterminate state -->
                        <div class="v-input--selection-controls__input select-all custom-checkbox" :id="entryidx+'#select-all'" style="user-select: none;
                            -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" @click.stop="toggleDbEntries($event)" :length="entryLength"
                            :title="multipleSelectionEnabled ? 'click to select all the entries' : 'select the first entry (multiple selection is WIP)'">
                            <span aria-hidden="true" class="v-icon notranslate" :class="{'theme--light': !$vuetify.theme.dark, 'theme--dark': $vuetify.theme.dark}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                    <path class="unchecked" d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"></path>
                                    <path class="checked" d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3Z"></path>
                                    <path class="undeterminate" d="M17,13H7V11H17M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3Z"></path>
                                </svg>
                            </span>
                        </div>
                    </th>
                    <th :class="['wide-' + (3 - entry.hasDescription - entry.hasTaxonomy), 
                    {'sort-selected': this.sortKey == 'target', 'sort-down': this.sortOrder < 0}]" 
                    class="sort-criterion">
                        <span class="th-label">Target</span>
                        <ResultColumnMenu v-bind="columnMenuProps('target')" @sort="changeSortMode('target')" @filter="v => onColumnFilter('target', v)" />
                    </th>
                    <th v-if="entry.hasDescription" class="sort-criterion has-help"
                    :class="{'sort-selected':this.sortKey == 'desc', 'sort-down': this.sortOrder < 0}">
                        <span class="th-label">Description</span>
                        <ResultColumnMenu v-bind="columnMenuProps('desc')" @sort="changeSortMode('desc')" @filter="v => onColumnFilter('desc', v)" />
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" class="th-help">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                    </th>
                    <th v-if="entry.hasTaxonomy" :class="{'sort-selected':this.sortKey == 'tax', 'sort-down': this.sortOrder < 0}" 
                        class="sort-criterion">
                        <span class="th-label">Scientific Name</span>
                        <ResultColumnMenu v-bind="columnMenuProps('tax')" @sort="changeSortMode('tax')" @filter="v => onColumnFilter('tax', v)" />
                    </th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'idf', 'sort-down': this.sortOrder < 0}" 
                        title="IDF-score">
                        <span class="th-label">{{ $vuetify.breakpoint.mdAndDown ? 'IDF' :'IDF-score' }}</span>
                        <ResultColumnMenu v-bind="columnMenuProps('idf')" @sort="changeSortMode('idf')" @filter="v => onColumnFilter('idf', v)" />
                    </th>
                    <th class="thin sort-criterion" :class="{'sort-selected':this.sortKey == 'rmsd', 'sort-down': this.sortOrder < 0}" 
                        title="RMSD">
                        <span class="th-label">RMSD</span>
                        <ResultColumnMenu v-bind="columnMenuProps('rmsd')" @sort="changeSortMode('rmsd')" @filter="v => onColumnFilter('rmsd', v)" />
                    </th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'node', 'sort-down': this.sortOrder < 0}" 
                        title="Node count">
                        <span class="th-label">Nodes</span>
                        <ResultColumnMenu v-bind="columnMenuProps('node')" @sort="changeSortMode('node')" @filter="v => onColumnFilter('node', v)" />
                    </th>
                    <th>
                        {{ $vuetify.breakpoint.lgAndDown ? 'Residues' : 'Matched residues' }}
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>The position of the aligned motif residues in the target</span>
                        </v-tooltip>
                    </th>
                    <!-- <th>Interresidue Dist</th> -->
                    <th class="alignment-action thin">Structure</th>
                </tr>
            </thead>
            <tbody><tr aria-hidden="true" style="height: 8px"></tr></tbody>
            <tbody v-for="(clu, key) in visibleSortedIndices">
                {{ void(clusterShown = false) }}
                <template v-for="(groupidx, sortIdx) in clu" >
                    <tr v-if="clusters[key].length != entryLength 
                        && visibleCluster[key] 
                        && clusterShown == false" :class="'result-entry-'+ entryidx + key">
                        <td colspan="7"><strong>Cluster: {{ key == -1 ? "Noise" : key }}</strong></td>
                    </tr>
                    {{ void(clusterShown = true) }}
                    <tr v-for="(item, index) in entry.alignments[groupidx]" :class="['hit', { 'active' : item.active, 'invisible': !isRowVisible(groupidx) }]"
                        :key="`${groupidx}-${index}`" @click.stop="$vuetify.breakpoint.smAndDown ? onCheckboxClick(key, sortIdx, $event) : () => {}"
                    >
                        <td v-if="index == 0" :rowspan="entry.alignments[groupidx].length" class="entry-checkbox" :id="entryidx + '#' + groupidx">
                            <!-- performance issue with thousands of v-checkboxes, hardcode the simple checkbox instead -->
                            <div class="v-input--selection-controls__input custom-checkbox" 
                            style="user-select: none; -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" 
                            @click.stop="onCheckboxClick(key, sortIdx, $event)"
                            :title="multipleSelectionEnabled ? 'click to select, shift-click for multiple selection' : 'click to toggle the selection'">
                                <span aria-hidden="true" 
                                    class="v-icon notranslate" 
                                    :class="{'theme--light': !$vuetify.theme.dark, 'theme--dark': $vuetify.theme.dark}"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                        <path class="unchecked" d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"></path>
                                        <path class="checked" d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3Z"></path>
                                    </svg>
                                </span>
                            </div>
                        </td>
                        <td class="db long" data-label="Target" :style="{ 'border-color' : entry.color}">
                            <a :id="item.id" class="anchor" style="position: absolute; top: 0" @click.stop></a>
                            <a style="text-decoration: underline; color: #2196f3;" 
                                v-if="Array.isArray(item.href)" @click.stop="emitForwardDropdown($event, item.href)"
                                rel="noopener" :title="item.target">{{item.targetname}}</a>
                            <a v-else :href="item.href" target="_blank" rel="noopener" 
                                :title="item.target" @click.stop>{{item.targetname}}</a>
                        </td>
                        <td class="long" data-label="Description" v-if="entry.hasDescription">
                            <span :title="item.description">{{ item.description }}</span>
                        </td>
                        <td class="long" v-if="entry.hasTaxonomy" data-label="Taxonomy">
                            <a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" 
                            target="_blank" rel="noopener" :title="item.taxName" @click.stop>{{ item.taxName }}</a>
                        </td>
                        <td class="thin" data-label="idf-score">{{ item.idfscore }}</td>
                        <td class="thin" data-label="RMSD">{{ item.rmsd }}</td>
                        <td class="thin" data-label="Node count">{{ item.nodecount }}</td>
                        <td data-label="Matched residues">
                            <span class="matched-residues-text" :title="item.targetresidues">{{ item.targetresidues }}</span>
                        </td> 
                        <td class="alignment-action thin" :rowspan="1">
                            <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                            <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                                <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                            </v-btn> -->
                            <button 
                                @click.stop="showAlignment(groupidx, $event)"
                                type="button"
                                class="v-btn v-btn--icon v-btn--round v-btn--text v-size--default"
                                :class="{ 
                                            'v-btn--outlined' : alignment && item.target == alignment.target,
                                            'theme--dark' : $vuetify.theme.dark
                                        }"
                                >
                                <span class="v-btn__content">
                                    <span aria-hidden="true" class="v-icon notranslate theme--dark">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                        <path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path></svg>
                                </span></span>
                            </button>
                        </td>
                    </tr>
                </template>
            </tbody>
            <tbody v-if="shownCount < filteredTotal" ref="sentinel">
                <tr aria-hidden="true" style="height: 1px"></tr>
            </tbody>
            <tbody v-if="shownCount < filteredTotal">
                <tr>
                    <td :colspan="fullColSpan" style="text-align: center; padding: 8px; color: #888;">
                        Showing {{ shownCount }} of {{ filteredTotal }} hits
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import MotifFilter from './MotifFilter.vue';
import FolddiscoHitCluster from './FolddiscoHitCluster.vue';
import ResultTableFilterMixin from './ResultTableFilterMixin.vue';
import { buildSortCache, makeComparator, defaultSortOrder } from './lib/resultSort.js';
import { makeGroupPredicate } from './lib/resultFilter.js';

export default {
    name: 'ResultFoldDiscoDB',
    components: {MotifFilter, FolddiscoHitCluster},
    mixins: [ ResultTableFilterMixin ],
    data() {
        return {
            toggleTargetValue: true,
            toggleSourceKey: "",
            toggleSourceIdx: -1,
            // Keyed by group id, assigned wholesale so it stays reactive.
            visibilityTable: {},
            sortKey: 'idf',
            isCollapsed: false,
            sortOrder: -1,
            clusters: {},
            gapFilter: "",
            visibleCluster: {1 : true},
            multipleSelectionEnabled: false,
            renderLimit: 100,
        }
    },
    created() {
        this.BATCH_SIZE = 100;
        if (this.tableState) {
            this.gapFilter = this.tableState.gapFilter ?? ""
        }
    },
    props: {
        entryidx: {
            type: Number,
            default: 0,
        },
        entry: {
            type: Object,
            default: null
        },
        toggleSourceDb: {
            type: String,
            default: ""
        },
        selectedStates: {
            type: Object,
            default: null
        },
        selectedCounts: {
            type: Number,
            default: 0,
        },
        totalSelectedCounts: {
            type: Number,
            default: 0
        },
        selectUpperbound: {
            type: Number,
            default: 1000
        },
        alignment: {
            type: Object,
            default: null
        },
        closeAlignment: {
            type: Function,
            default: () => {}
        },
        onlyOne: {
            type: Boolean,
            default: false
        },
    },
    watch: {
        filters() {
            this.toggleSourceKey = ""
            this.toggleSourceIdx = -1
            this.toggleSourceValue = true
            this.updateVisibility()
            this.renderLimit = this.nextRenderLimit(0)
            this.$nextTick(() => this.setupObserver())
        },
        toggleSourceDb(n, o) {
            if (n != this.db) {
                this.toggleSourceKey = ""
                this.toggleSourceIdx = -1
                this.toggleSourceValue = true
            }
        },
        entry(n, o) {
            if (n && Object.keys(this.visibilityTable).length == 0) {
                this.updateVisibility()
            }
            if (n) {
                this.$nextTick(() => { this.setupObserver() })
            }
        },
        gapFilter(n, o) {
            this.updateVisibility()
            this.renderLimit = this.nextRenderLimit(0)
            this.$nextTick(() => this.setupObserver())
        },
        clusters(n, o) {
            this.updateVisibility()
            this.renderLimit = this.nextRenderLimit(0)
            this.$nextTick(() => {
                this.setupObserver()
                setTimeout(() => {
                    this.updateVisibility()
                    this.$emit('updateScroll')
                }, 0)
            })
        },
        renderedClusterKeys(n, o) {
            this.$emit('clusterInfo', {
                totalClusterCount: this.clusterKeys.length,
                renderedClusterCount: n.length,
            })
        },
    },
    mounted() {
        if (this.entry && Object.keys(this.visibilityTable).length == 0) {
            this.updateVisibility()
            this.$nextTick(() => {
                setTimeout(() => {
                    this.reflectSelectionState()
                }, 0)
            })
        }

        if (this.$route.query.d2m && this.$route.query.d2m == 1) {
            this.multipleSelectionEnabled = true
        }
        this.setupObserver()
    },
    beforeDestroy() {
        if (this._observer) {
            this._observer.disconnect()
            this._observer = null
        }
    },
    computed: {
        db() {
            return this.entry ? this.entry.db : ""
        },
        entryLength() {
            return this.entry ? Object.values(this.entry.alignments).length : 0
        },
        hasEntries() {
            return this.entry ? this.entryLength > 0 : false
        },
        persistedState() {
            return {
                sortKey: this.sortKey, sortOrder: this.sortOrder,
                filters: this.activeFilters, gapFilter: this.gapFilter,
            }
        },
        columnLabels() {
            return {
                target: 'Target',
                desc: 'Description',
                tax: 'Scientific Name',
                idf: 'IDF-score',
                rmsd: 'RMSD',
                node: 'Node Count',
            }
        },
        filterKeys() {
            return [
                'target',
                ...(this.entry.hasDescription ? ['desc'] : []),
                ...(this.entry.hasTaxonomy ? ['tax'] : []),
                'idf', 'rmsd', 'node',
            ]
        },
        anySelected() {
            return this.selectedCounts > 0
        },
        selectAllStatus() {
            return this.selectedCounts == this.entryLength
        },
        sortedIndices() {
            if (!this.clusters) return this.clusters

            let copiedArrs = Object.fromEntries(Object.entries(this.clusters).map(([k, v]) => [k, [...v]]))

            for (let key in copiedArrs) {
                copiedArrs[key].sort(this.comparator)
            }

            return copiedArrs
        },
        visibleSortedIndices() {
            if (!this.sortedIndices) return this.sortedIndices
            let count = 0
            const result = {}
            for (const key in this.sortedIndices) {
                const clu = this.sortedIndices[key]
                if (count >= this.renderLimit) break
                const remaining = this.renderLimit - count
                if (clu.length <= remaining) {
                    result[key] = clu
                    count += clu.length
                } else {
                    result[key] = clu.slice(0, remaining)
                    count += remaining
                }
            }
            return result
        },
        totalSortedCount() {
            if (!this.sortedIndices) return 0
            let count = 0
            for (const key in this.sortedIndices) {
                count += this.sortedIndices[key].length
            }
            return count
        },
        totalVisibleCount() {
            let count = 0
            for (const key in this.visibleSortedIndices) {
                count += this.visibleSortedIndices[key].length
            }
            return count
        },
        shownCount() {
            let n = 0
            for (const key in this.visibleSortedIndices) {
                for (const g of this.visibleSortedIndices[key]) if (this.isRowVisible(g)) n++
            }
            return n
        },
        filteredTotal() {
            let n = 0
            for (const key in this.sortedIndices) {
                for (const g of this.sortedIndices[key]) if (this.isRowVisible(g)) n++
            }
            return n
        },
        clusterKeys() {
            if (!this.sortedIndices) return []
            return Object.keys(this.sortedIndices)
        },
        renderedClusterKeys() {
            if (!this.visibleSortedIndices) return []
            return Object.keys(this.visibleSortedIndices)
        },
        sortKeyCache() {
            return buildSortCache(this.entry.alignments, { tool: 'folddisco' })
        },
        comparator() {
            return makeComparator(this.entry.alignments, this.sortKey, this.sortOrder, this.sortKeyCache)
        },
        headTop() {
            return this.onlyOne ? '92px' : '140px'
        },
        colheadTop() {
            const addend = !this.onlyOne ? 140 : 92
            const breakpointAddend = this.$vuetify.breakpoint.xsOnly ? 176 : this.$vuetify.breakpoint.mdAndDown ? 124 : 0
            const auxOffset = this.isCollapsed ? this.$vuetify.breakpoint.mdAndDown ? ( this.$vuetify.breakpoint.md ? -236 : -248 ) : -116 : 0
            const taxOffset = this.$vuetify.breakpoint.xsOnly && this.isCollapsed ? -52 : 0
            return String(180 + addend + breakpointAddend + auxOffset + taxOffset) + 'px'
        },
        dbGaps() {
            if (!this.entry) {
                return {};
            }
            let uniqueGaps = new Set()
            for (let hit of Object.keys(this.entry.alignments)) {
                uniqueGaps.add(this.entry.alignments[hit][0].gaps)
            }
            return [...uniqueGaps, ''];
        },
        headHeight() {
            const taxHeight = this.entry.hasTaxonomy && !this.isCollapsed && this.$vuetify.breakpoint.xsOnly ? 52 : 0
            const auxHeight = this.isCollapsed ? -116: this.$vuetify.breakpoint.mdAndDown ? 124 : 0
            return String(taxHeight + auxHeight + 180) + 'px'
        },
        fullColSpan() {
            let defaultVal = 7
            let desc = this.entry.hasDescription ? 1 : 0
            let tax = this.entry.hasTaxonomy ? 1 : 0
            return defaultVal + desc + tax
        }
    },
    methods: {
        setupObserver() {
            if (this._observer) {
                this._observer.disconnect()
            }
            this._observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    this.loadMore()
                }
            })
            this.$nextTick(() => {
                if (this.$refs.sentinel) {
                    this._observer.observe(this.$refs.sentinel)
                }
            })
        },
        nextRenderLimit(from = this.renderLimit) {
            let shown = 0, i = 0, limit = from
            for (const key in this.sortedIndices) {
                for (const groupidx of this.sortedIndices[key]) {
                    i++
                    if (i <= from) continue
                    if (this.isRowVisible(groupidx)) shown++
                    limit = i
                    if (shown >= this.BATCH_SIZE) return limit
                }
            }
            return Math.max(limit, this.totalSortedCount)
        },
        loadMore() {
            if (this.renderLimit >= this.totalSortedCount) return
            const oldLimit = this.renderLimit
            this.renderLimit = this.nextRenderLimit()
            this.$nextTick(() => {
                this.reflectSelectionState()
                if (this.$refs.sentinel && this._observer) {
                    this._observer.disconnect()
                    this._observer.observe(this.$refs.sentinel)
                }
            })
        },
        renderUpToCluster(clusterKey) {
            if (!this.sortedIndices) return Promise.resolve()
            let count = 0
            for (const key in this.sortedIndices) {
                count += this.sortedIndices[key].length
                if (key == clusterKey) break
            }
            if (count > this.renderLimit) {
                this.renderLimit = Math.ceil(count / this.BATCH_SIZE) * this.BATCH_SIZE
            }
            return this.$nextTick()
        },
        log(a) {
            console.log(a)
            return a
        },
        isRowVisible(groupId) {
            return this.visibilityTable[groupId] !== false
        },
        syncRenderedState() {
            this.reflectSelectionState()
            this.updateVisibility()
        },
        updateVisibility() {
            if (!this.entry) return

            const predicate = makeGroupPredicate(this.filters, this.filterKeys)
            const table = {}
            for (const groupId of Object.keys(this.entry.alignments || {})) {
                const group = this.entry.alignments[groupId]
                table[groupId] = (!predicate || predicate(group)) && this.isItemVisible(group[0])
            }
            this.visibilityTable = table

            // Compute cluster visibility from ALL clusters (data level)
            const visibility = Object.keys(this.clusters).reduce((acc, key) => {
                acc[key] = false;
                return acc;
            }, {});
            for (const key in this.clusters) {
                if (this.clusters[key].length == this.entryLength) continue

                for (const idx of this.clusters[key]) {
                    if (this.isRowVisible(idx)) {
                        visibility[key] = true
                        break
                    }
                }
            }
            this.visibleCluster = visibility
        },
        toggleDbEntries(value) {
            if (!this.selectedStates) {
                return 
            }

            if (this.anySelected) {
                value = false
            } else {
                value = true
            }
            
            if (!value) {
                const arr = []
                for (let i = 0; i < this.entryLength; i++) {
                    if (this.selectedStates[i]) {
                        arr.push(i)
                    }
                }
                this.$emit('bulkToggle', arr, value)
                return
            }

            if (this.multipleSelectionEnabled) {
                const arr = []
                let deltaUpperbound = this.selectUpperbound - this.totalSelectedCounts
                let delta = 0
                for (let key in this.sortedIndices) {
                    for (let i of this.sortedIndices[key]) {
                        if (delta >= deltaUpperbound) {
                            break
                        }
                        if (this.isRowVisible(i) && this.selectedStates[i] != value) {
                            arr.push(i)
                            delta++
                        }
                    }
                    if (delta >= deltaUpperbound) {
                        break
                    }
                }
                if (delta > 0) {
                    this.$emit('bulkToggle', arr, value)
                }
            } else {
                const arr = []
                for (let key in this.sortedIndices) {
                    for (let i of this.sortedIndices[key]) {
                        if (this.isRowVisible(i) && this.selectedStates[i] != true) {
                            arr.push(i)
                            break;
                        }
                    }
                    if (arr.length > 0) {
                        break
                    }
                }
                if (arr.length > 0) {
                    this.$emit('bulkToggle', arr, true)
                }
            }
        },
        emitForwardDropdown(event, href) {
            this.$emit('forwardDropdown', event, href)
        },
        showAlignment(groupidx, event) {
            this.$emit('showAlignment', this.entry.alignments[groupidx][0], event)
        },
        isItemVisible(item) {
            if (!this.gapFilter) return true
            return this.gapFilter == '' || item.gaps == this.gapFilter;
        },
        onCheckboxClick(key, idx, event) {
            if (!this.selectedStates) { 
                return 
            }

            let targetIdx = this.sortedIndices[key][idx]
            let value = !this.selectedStates[targetIdx]

            const needRangedToggle = this.multipleSelectionEnabled 
                && event.shiftKey 
                && this.toggleSourceKey == key 
                && (this.toggleSourceIdx != idx && this.toggleSourceIdx != -1)

            if (!needRangedToggle) {
                // simple click. just toggle it.
                // If selected count exceeds upperbound, than simply ignore

                if (!this.multipleSelectionEnabled) {
                    this.$emit('clearAll')
                }

                if (this.totalSelectedCounts > this.selectUpperbound && value) { 
                    return 
                }
                this.toggleSourceKey = key
                this.toggleSourceIdx = idx
                this.toggleTargetValue = value
                this.$emit('updateToggleSource', this.db)
                this.$emit('toggleSelection', targetIdx, value)
            } else {
                const startIdx = Math.min(this.toggleSourceIdx, idx)
                const endIdx = Math.max(this.toggleSourceIdx, idx) + 1
                this.handleRangedToggle(key, startIdx, endIdx, this.toggleTargetValue)
            }
        },
        handleRangedToggle(key, startIdx, endIdx, value) {
            if (!this.selectedStates || this.totalSelectedCounts > this.selectUpperbound && value) {
                return
            }

            const deltaUpperbound = this.selectUpperbound - this.totalSelectedCounts
            let delta = 0
            const deltaUnit = value ? 1 : -1
            const arr = []

            for (let i = startIdx; i < endIdx; i++) {
                if (delta >= deltaUpperbound) {
                    break
                }
                let targetIdx = this.sortedIndices[key][i]
                if (this.isRowVisible(targetIdx) && this.selectedStates[targetIdx] != value) {
                    delta += deltaUnit
                    arr.push(targetIdx)
                }
            }

            if (delta != 0) {
                this.$emit('bulkToggle', arr, value)
            }
        },
        reflectSelectionState() {
            let value = false
            let id = ""
            // Only iterate rendered entries
            for (const key in this.visibleSortedIndices) {
                for (const groupidx of this.visibleSortedIndices[key]) {
                    value = this.selectedStates[groupidx]
                    id = this.entryidx + "#" + String(groupidx)
                    let el = document.getElementById(id)
                    if (el) {
                        el.classList.toggle('selected', value ? true : false)
                    }
                }
            }
            let select_all_button = document.getElementById(this.entryidx + '#select-all')
            if (select_all_button) {
                select_all_button.classList.toggle('any-selected', this.selectedCounts > 0)
                select_all_button.classList.toggle('all-selected', this.selectedCounts == this.entryLength)
            }
        },
        changeSortMode(key) {
            if (this.sortKey == key) {
                this.sortOrder *= -1
            } else {
                this.sortKey = key
                this.sortOrder = defaultSortOrder(key)
            }
            this.toggleSourceKey = ""
            this.toggleSourceIdx = -1
            this.toggleTargetValue = true
            this.renderLimit = this.nextRenderLimit(0)
            this.$nextTick(() => {
                window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'smooth',
                })
                this.setupObserver()
                setTimeout(() => {
                    this.reflectSelectionState()
                    this.updateVisibility()
                }, 0)
            })
        },
    }
}
</script>

<style lang="scss" scoped>
@import "result-table";

@media screen and (max-width: 960px) {
    .result-table .long {
        min-height: 48px;
        padding-bottom: 0;
    }
}
</style>
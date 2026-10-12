<template>
    <div>
        <v-sheet style="position: sticky; z-index: 99997 !important; padding-bottom: 16px;" 
            :db="entryidx" class="sticky-sheet" :class="`result-entry-${entryidx}`" 
            :style="{'height': headHeight, 'top': headTop,
                'box-shadow': $vuetify.breakpoint.smAndDown ? 'rgba(0, 0, 0, 0.2) 0px 8px 6px -6px' : '',
                'padding-bottom': $vuetify.breakpoint.smAndDown ? 0 : '16px',
            }">
            <v-flex class="d-flex" :style="{ 'flex-direction' : $vuetify.breakpoint.smAndDown ? 'column' : null, 
                'align-items': 'center', 'justify-content': $vuetify.breakpoint.smAndDown ? 'center' : 'space-between'}">
                <h2 style="margin-top: 0.5em; margin-bottom: 1em;" class="mr-auto result-title">
                    <div style="width: 24px; display: inline-block;"
                        v-if="!$vuetify.breakpoint.smAndDown"
                    ></div>
                    <v-icon @click="isCollapsed = !isCollapsed"
                        v-if="$vuetify.breakpoint.smAndDown"
                        style="transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1); margin-right: 8px;"
                        :style="{'transform': isCollapsed ? 'rotate(-90deg)' : ''}"
                        :title="isCollapsed ? 'Show actions' : 'Hide actions'"
                    >
                        {{ $MDI.ChevronDown }}
                    </v-icon>
                    <span style="text-transform: uppercase;">{{ entry.db }}</span>
                    <small class="ml-2">{{ hitCountLabel }}</small>
                    <span v-if="filterChips.length > 0 && !$vuetify.breakpoint.smAndDown" class="filter-chips">
                        <v-chip v-for="chip in filterChips" :key="chip.key" small outlined close
                            :color="entry.color" class="ml-2" :title="chip.text"
                            @click:close="onColumnFilter(chip.key, null)">{{ chip.text }}</v-chip>
                        <v-chip v-if="filterChips.length > 1" small class="ml-2" @click="clearFilters">Clear all</v-chip>
                    </span>
                </h2>

                <div
                    style="display: flex; justify-content: center; align-items: center;" :style="{'width' : $vuetify.breakpoint.smAndDown ? '100%' : ''}"
                    v-if="!$vuetify.breakpoint.smAndDown || !isCollapsed"
                >
                    <div style="display: flex; justify-content: center; align-items: center;"
                    :style="{'width': $vuetify.breakpoint.smAndDown ? '100%' : '', 'flex-direction': $vuetify.breakpoint.smAndDown ? 'column' : 'row'}">
                        <!-- Button to toggle Sankey Diagram visibility -->
                        <v-btn v-if="hasEntries && hasTaxonomyReport" @click="toggleSankeyVisibility(entry.db)" :class="{ 'mr-2': $vuetify.breakpoint.mdAndUp , 'mb-2': $vuetify.breakpoint.smAndDown}" large>
                            <!-- TODO: later, isSankeyVisible should be modified as bool, not an object
                                after ResultFoldDisco also is refactored as well. 
                            -->
                            {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
                        </v-btn>
                        <v-btn-toggle v-if="hasEntries" mandatory :value="tableMode" @change="switchTableMode" :class="{'mb-2': $vuetify.breakpoint.smAndDown}">
                            <v-btn>
                                Graphical
                            </v-btn>

                            <v-btn>
                                Numeric
                            </v-btn>
                        </v-btn-toggle>
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
                </div>
            </v-flex>
        </v-sheet>
        <v-flex v-if="hasEntries && hasTaxonomyReport && isSankeyVisible[entry.db]" class="mb-2">
            <SankeyDiagram :rawData="entry.taxonomyreports[0]" :currentSelectedNodeId="localSelectedTaxId" @selectTaxon="handleSankeySelect"></SankeyDiagram>
        </v-flex>
        <v-sheet v-if="!hasEntries"><div class="text-h5 mt-3 pa-2">No hits found...</div></v-sheet>
        <table class="v-table result-table" style="position:relative; margin-bottom: 3em;" v-if="hasEntries" :style="{'--active-color': entry.color}">
            <colgroup>
                <col style="width: 36px;">
                <template v-if="isComplex">
                    <col style="width: 6.5%;" />
                    <col style="width: 6.5%;" />
                </template>
                <col style="min-width: 10%;" />
                <col v-if="entry.hasDescription" style="min-width: 25%;" />
                <col v-if="entry.hasTaxonomy" style="min-width: 15%;" />
                <col v-if="searchType !== 'interfacesearch'" style="width: 7%;" />
                <col style="width: 8%;" />
                <col v-if="searchType !== 'interfacesearch'" style="width: 7%;" />
                <template v-if="tableMode == 0">
                    <col style="min-width: 20%;" />
                </template>
                <template v-else>
                    <col v-if="mode !== 'lolalign'" style="width: 6%;" />
                    <col :style="{ width: mode !== 'lolalign' ? '9%' : '11%' }" />
                    <col :style="{ width: mode !== 'lolalign' ? '9%' : '11%' }" />
                </template>
                <col style="width: 6%;" />
            </colgroup>
            <thead style="position: sticky; z-index: 99997 !important;" class="sticky-thead"
                :style="{'top': colheadTop, 
                'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
                <tr v-if="isComplex">
                    <th colspan="1"></th>
                    <th colspan="2" style="text-align:center; width:10%; border-right: 1px solid #333; border-bottom: 1px solid #333;">{{ searchType === 'interfacesearch' ? 'Interface' : 'Complex' }}</th>
                    <th :colspan="6 +  entry.hasDescription + entry.hasTaxonomy + ((tableMode == 1) ? 2 : 0) - (searchType === 'interfacesearch' ? 2 : 0)" style="text-align:center; border-bottom: 1px solid #333;">Chain</th>
                </tr>
                <tr>
                    <th class="thin select-all-th" style="position: relative">
                        <!-- Replaced this checkbox too, for the colored undeterminate state -->
                        <div class="v-input--selection-controls__input select-all custom-checkbox" :id="entryidx+'#select-all'" style="user-select: none;
                            -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" @click.stop="toggleDbEntries($event)" :length="entryLength"
                            title="click to select all the entries">
                            <span aria-hidden="true" class="v-icon notranslate" :class="{'theme--light': !$vuetify.theme.dark, 'theme--dark': $vuetify.theme.dark}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                    <path class="unchecked" d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"></path>
                                    <path class="checked" d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3Z"></path>
                                    <path class="undeterminate" d="M17,13H7V11H17M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3Z"></path>
                                </svg>
                            </span>
                        </div>
                    </th>
                    <template v-if="isComplex">
                        <!-- <th class="thin">ID</th> -->
                        <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'qtm', 'sort-down': this.sortOrder < 0}"
                            :title="searchType === 'interfacesearch' ? 'Query Interface TM-score' : 'Query TM-score'">
                            <span class="th-label">qTM</span>
                            <ResultColumnMenu v-bind="columnMenuProps('qtm')" @sort="changeSortMode('qtm')" @filter="v => onColumnFilter('qtm', v)" />
                        </th>
                        <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'ttm', 'sort-down': this.sortOrder < 0}"
                            :title="searchType === 'interfacesearch' ? 'Target Interface TM-score' : 'Target TM-score'" style="border-right: 1px solid #333; ">
                            <span class="th-label">tTM</span>
                            <ResultColumnMenu v-bind="columnMenuProps('ttm')" @sort="changeSortMode('ttm')" @filter="v => onColumnFilter('ttm', v)" />
                        </th>
                    </template>
                    <th :class="[`wide-${3 - entry.hasDescription - entry.hasTaxonomy}`, {'sort-selected': this.sortKey == 'target', 'sort-down': this.sortOrder < 0}]" 
                        class="sort-criterion">
                        <span class="th-label"><template v-if="isComplex">
                            Chain pairing
                        </template>
                        <template v-else>
                            Target
                        </template></span>
                        <ResultColumnMenu v-bind="columnMenuProps('target')" @sort="changeSortMode('target')" @filter="v => onColumnFilter('target', v)" />
                    </th>
                    <th v-if="entry.hasDescription" class="sort-criterion has-help" :class="{'sort-selected':this.sortKey == 'desc', 'sort-down': this.sortOrder < 0}">
                        <span class="th-label">Description</span>
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" class="th-help">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                        <ResultColumnMenu v-bind="columnMenuProps('desc')" @sort="changeSortMode('desc')" @filter="v => onColumnFilter('desc', v)" />
                    </th>
                    <th v-if="entry.hasTaxonomy"  :class="{'sort-selected':this.sortKey == 'tax', 'sort-down': this.sortOrder < 0}" 
                        class="sort-criterion">
                        <span class="th-label">Scientific Name</span>
                        <ResultColumnMenu v-bind="columnMenuProps('tax')" @sort="changeSortMode('tax')" @filter="v => onColumnFilter('tax', v)" />
                    </th>
                    <th v-if="searchType !== 'interfacesearch'" class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'prob', 'sort-down': this.sortOrder < 0}" 
                        title="Probability">
                        <span class="th-label">Prob.</span>
                        <ResultColumnMenu v-bind="columnMenuProps('prob')" @sort="changeSortMode('prob')" @filter="v => onColumnFilter('prob', v)" />
                    </th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'seqId', 'sort-down': this.sortOrder < 0}"
                        title="Sequence identity">
                        <span class="th-label">Seq. Id.</span>
                        <ResultColumnMenu v-bind="columnMenuProps('seqId')" @sort="changeSortMode('seqId')" @filter="v => onColumnFilter('seqId', v)" />
                    </th>
                    <th v-if="searchType !== 'interfacesearch'" class="thin sort-criterion" :class="{'sort-selected':this.sortKey == 'eval', 'sort-down': this.sortOrder < 0, 'default-down': mode == 'lolalign' || mode == 'tmalign'}"
                        :title="scoreColumnName">
                        <span class="th-label">{{ compactHeader ? compactScoreName : scoreColumnName }}</span>
                        <ResultColumnMenu v-bind="columnMenuProps('eval')" @sort="changeSortMode('eval')" @filter="v => onColumnFilter('eval', v)" />
                    </th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'score', 'sort-down': this.sortOrder < 0}"
                        v-if="this.mode !== 'lolalign'" v-show="tableMode == 1" title="Score">
                        <span class="th-label">Score</span>
                        <ResultColumnMenu v-bind="columnMenuProps('score')" @sort="changeSortMode('score')" @filter="v => onColumnFilter('score', v)" />
                    </th>
                    <th v-show="tableMode == 1" class="clip" title="Query position">Query Pos.</th>
                    <th v-show="tableMode == 1" class="clip" title="Target position">Target Pos.</th>
                    <th v-show="tableMode == 0">
                        {{ searchType === 'interfacesearch' ? 'Position in query interface' : 'Position in query' }}
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>The position of the aligned region of the target sequence in the query</span>
                        </v-tooltip>
                    </th>
                    <th class="alignment-action thin">Alignment</th>
                </tr>
            </thead>
            <tbody>
                <tr aria-hidden="true" style="height: 8px"></tr>
                <template v-for="(groupidx, sortIdx) in visibleSortedIndices" >
                <tr v-for="(item, index) in entry.alignments[groupidx]" :class="['hit', { 'active' : item.active, 'invisible': !isRowVisible(groupidx) }]"
                    @click.stop="$vuetify.breakpoint.width <= 960 ? onCheckboxClick(sortIdx, $event) : () => {}"
                    :key="`${groupidx}-${index}`"
                    >
                    <td v-if="index == 0" :rowspan="entry.alignments[groupidx].length" class="entry-checkbox" :id="entryidx + '#' + groupidx">
                        <!-- performance issue with thousands of v-checkboxes, hardcode the simple checkbox instead -->
                        <div class="v-input--selection-controls__input custom-checkbox" 
                        style="user-select: none; -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" 
                        @click.stop="onCheckboxClick(sortIdx, $event)"
                        title="click to select, shift-click for multiple selection">
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
                    <template v-if="index == 0 && isComplex">
                        <td class="thin" :data-label="searchType === 'interfacesearch' ? 'Query Interface TM-score' : 'Query TM-score'" :rowspan="entry.alignments[groupidx].length">{{ entry.alignments[groupidx][0].complexqtm.toFixed(2) }}</td>
                        <td class="thin" :data-label="searchType === 'interfacesearch' ? 'Target Interface TM-score' : 'Target TM-score'" :rowspan="entry.alignments[groupidx].length">{{ entry.alignments[groupidx][0].complexttm.toFixed(2) }}</td>
                    </template>
                    <td class="db long" data-label="Target" 
                        :style="{ 'border-width' : isComplex ? '5px' : null, 
                            'border-color' : entry.color, }"
                    >
                        <a :id="item.id" class="anchor" style="position: absolute; top: 0" @click.stop></a>
                        <template v-if="isComplex">
                            {{ item.query.lastIndexOf('_') != -1 ? item.query.substring(item.query.lastIndexOf('_')+1) : '' }} ➔ 
                        </template>
                        <a style="text-decoration: underline; color: #2196f3;" 
                            v-if="Array.isArray(item.href)" 
                            @click.stop="emitForwardDropdown($event, item.href)"
                            rel="noopener" :title="item.target">{{item.target}}</a>
                        <a v-else :href="item.href" target="_blank" rel="noopener" 
                            :title="item.target" @click.stop>{{item.target}}</a>
                    </td>
                    <td class="long" data-label="Description" v-if="entry.hasDescription">
                        <span :title="item.description">{{ item.description }}</span>
                    </td>
                    <td class="long" v-if="entry.hasTaxonomy" data-label="Taxonomy">
                        <a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" 
                            target="_blank" 
                            rel="noopener" 
                            :title="item.taxName" 
                            @click.stop>
                            {{ item.taxName }}
                        </a>
                    </td>
                    <td v-if="searchType !== 'interfacesearch'" class="thin" data-label="Probability">{{ item.prob }}</td>
                    <td class="thin" data-label="Sequence Identity">{{ item.seqId }}</td>
                    <td v-if="searchType !== 'interfacesearch'" class="thin" :data-label="scoreColumnName">{{ item.eval }}</td>
                    <td class="thin" v-if="mode !== 'lolalign'" v-show="tableMode == 1" data-label="Score">{{ item.score }}</td>
                    <td v-show="tableMode == 1" class="clip" data-label="Query Position" :title="`${item.qStartPos}-${item.qEndPos} (${item.qLen})`">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                    <td v-show="tableMode == 1" class="clip" data-label="Target Position" :title="`${item.dbStartPos}-${item.dbEndPos} (${item.dbLen})`">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                    <td class="graphical" :data-label="searchType === 'interfacesearch' ? 'Position in query interface' : 'Position'" v-show="tableMode == 0">
                        <Ruler :length="item.qLen" :start="item.qStartPos" :end="item.qEndPos" :color="item.color" :label="index == 0"></Ruler>
                    </td>
                    <td class="alignment-action" :rowspan="isComplex ? entry.alignments[groupidx].length : 1" v-if="index == 0">
                        <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                        <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                            <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                        </v-btn> -->
                        <button 
                            @click.stop="showAlignment(groupidx, $event)"
                            type="button"
                            class="v-btn v-btn--icon v-btn--round v-btn--text v-size--default"
                            :class="{ 
                                        'v-btn--outlined' : alignment && item.target == alignment[0].target,
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
                        </button>
                    </td>
                </tr>
                <tr aria-hidden="true" v-if="isComplex" style="height: 15px" :key="`spacer-${groupidx}`" :class="{ 'invisible': !isRowVisible(groupidx) }"></tr>
                </template>
                <tr v-if="shownCount < filteredTotal" ref="sentinel" aria-hidden="true" style="height: 1px"></tr>
                <tr v-if="shownCount < filteredTotal">
                    <td :colspan="fullColSpan" style="text-align: center; padding: 8px; color: #888;">
                        Showing {{ shownCount }} of {{ filteredTotal }} hits
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import Ruler from './Ruler.vue';
import ResultTableFilterMixin from './ResultTableFilterMixin.vue';
import { buildSortCache, makeComparator, defaultSortOrder } from './lib/resultSort.js';
import { makeGroupPredicate } from './lib/resultFilter.js';

export default {
    name: 'ResultFoldseekDB',
    mixins: [ ResultTableFilterMixin ],
    components: { Ruler },
    data() {
        return {
            toggleTargetValue: true,
            toggleSourceIdx: -1,
            // Keyed by group id (complexid), NOT by position. Complex searches return
            // sparse complexids, so a positional array silently misses most rows.
            visibilityTable: {},
            sortKey: 'score',
            sortOrder: -1,
            isCollapsed: false,
            renderLimit: 100,
        }
    },
    created() {
        this.BATCH_SIZE = 100;
        if (!this.tableState) {
            this.sortKey = this.isComplex ? 'qtm' : this.mode == 'lolalign' ? 'eval' : 'score'
        }
    },
    props: {
        tableMode: {
            type: Number,
            default: 0,
        },
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
        mode: {
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
            type: [Object, Array],
            default: null,
        },
        closeAlignment: {
            type: Function,
            default: () => {}
        },
        onlyOne: {
            type: Boolean,
            default: false
        },
        isComplex: {
            type: Boolean,
            default: false,
        },
        searchType: {
            type: String,
            default: "",
        },
    },
    watch: {
        filters() {
            this.toggleSourceIdx = -1
            this.recomputeVisibility()
            this.renderLimit = this.nextRenderLimit(0)
            this.$nextTick(() => {
                this.setupObserver()
                this.syncRenderedState()
            })
        },
        toggleSourceDb(n, o) {
            if (n != this.db) {
                this.toggleSourceIdx = -1
            }
        },
        entry(n, o) {
            if (n && Object.keys(this.visibilityTable).length == 0) {
                this.recomputeVisibility()
            }
            if (n) {
                this.$nextTick(() => { this.setupObserver() })
            }
        }
    },
    mounted() {
        if (this.entry && Object.keys(this.visibilityTable).length == 0) {
            this.recomputeVisibility()
            this.$nextTick(() => {
                setTimeout(() => {
                    this.syncRenderedState()
                }, 0)
            })
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
        origIndicesArr() {
            return this.entry ? Object.keys(this.entry.alignments).map(i => Number(i)) : []
        },
        db() {
            return this.entry ? this.entry.db : ""
        },
        entryLength() {
            return this.entry ? Object.values(this.entry.alignments).length : 0
        },
        hasEntries() {
            return this.entry ? this.entryLength > 0 : false
        },
        columnLabels() {
            const isInterface = this.searchType === 'interfacesearch'
            return {
                qtm: isInterface ? 'Query Interface TM-score' : 'Query TM-score',
                ttm: isInterface ? 'Target Interface TM-score' : 'Target TM-score',
                target: this.isComplex ? 'Chain pairing' : 'Target',
                desc: 'Description',
                tax: 'Scientific Name',
                prob: 'Probability',
                seqId: 'Sequence Identity',
                eval: this.scoreColumnName,
                score: 'Score',
            }
        },
        filterKeys() {
            const isInterface = this.searchType === 'interfacesearch'
            return [
                ...(this.isComplex ? ['qtm', 'ttm'] : []),
                'target',
                ...(this.entry.hasDescription ? ['desc'] : []),
                ...(this.entry.hasTaxonomy ? ['tax'] : []),
                ...(!isInterface ? ['prob'] : []),
                'seqId',
                ...(!isInterface ? ['eval'] : []),
                ...(this.mode !== 'lolalign' ? ['score'] : []),
            ]
        },
        // isComplex() {
        //     return this.entry?.alignments?.[0]?.[0]?.complexqtm != null
        // },
        anySelected() {
            return this.selectedCounts > 0
        },
        selectAllStatus() {
            return this.selectedCounts == this.entryLength
        },
        scoreColumnName() {
            if (__APP__ == 'foldseek') {
                switch (this.mode) {
                    case 'tmalign':
                        return 'TM-score';
                    case 'lolalign':
                        return 'LoL-score';
                }
            }
            return 'E-Value';
        },
        sortedIndices() {
            let copiedArr = [...this.origIndicesArr]
            return copiedArr.sort(this.comparator)
        },
        visibleSortedIndices() {
            return this.sortedIndices.slice(0, this.renderLimit)
        },
        shownCount() {
            return this.visibleSortedIndices.reduce(
                (n, g) => n + (this.isRowVisible(g) ? 1 : 0), 0)
        },
        filteredTotal() {
            return this.sortedIndices.reduce(
                (n, g) => n + (this.isRowVisible(g) ? 1 : 0), 0)
        },
        comparator() {
            return makeComparator(this.entry.alignments, this.sortKey, this.sortOrder, this.sortKeyCache)
        },
        headTop() {
            return this.onlyOne ? '92px' : '140px'
        },
        headHeight() {
            const auxHeight = this.$vuetify.breakpoint.smAndDown ? !this.isCollapsed ? 56 : 0 : 0
            const padding = this.$vuetify.breakpoint.smAndDown ? 0 : 16
            const taxHeight = this.$vuetify.breakpoint.smAndDown 
                && this.hasTaxonomyReport
                && !this.isCollapsed ? 52 : 0
            return String(auxHeight + 64 + padding + taxHeight) + 'px'
        },
        colheadTop() {
            let addend = !this.onlyOne ? 48 : 0
            let breakpointAddend = this.$vuetify.breakpoint.smAndDown ? 108 : 0
            return String(172 + addend + breakpointAddend) + 'px'
        },
        fullColSpan() {
            let defaultVal = 7
            let complex = this.isComplex ? 2 : 0
            let desc = this.entry.hasDescription ? 1 : 0
            let taxonomy = this.entry.hasTaxonomy ? 1: 0
            let tableMode = this.tableMode == 0 ? 0 : 2
            let interfaceHidden = this.searchType === 'interfacesearch' ? 2 : 0
            return defaultVal + complex + desc + taxonomy + tableMode - interfaceHidden
        },
        sortKeyCache() {
            return buildSortCache(this.entry.alignments, {
                mode: this.mode,
                isComplex: this.isComplex,
                tool: 'foldseek',
            })
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
            const sorted = this.sortedIndices
            let shown = 0
            let i = from
            for (; i < sorted.length; i++) {
                if (this.isRowVisible(sorted[i])) shown++
                if (shown >= this.BATCH_SIZE) { i++; break }
            }
            return i
        },
        loadMore() {
            if (this.renderLimit >= this.sortedIndices.length) return
            const oldLimit = this.renderLimit
            this.renderLimit = this.nextRenderLimit()
            this.$nextTick(() => {
                this.syncRenderedState(oldLimit)
                if (this.$refs.sentinel && this._observer) {
                    this._observer.disconnect()
                    this._observer.observe(this.$refs.sentinel)
                }
            })
        },
        // Group ids are complexid values from the backend and are NOT guaranteed dense,
        // so an unseen key must default to visible rather than silently hiding the row.
        isRowVisible(groupId) {
            return this.visibilityTable[groupId] !== false
        },
        recomputeVisibility() {
            const predicate = makeGroupPredicate(this.filters, this.filterKeys)
            const table = {}
            for (const groupId of this.origIndicesArr) {
                table[groupId] = predicate ? predicate(this.entry.alignments[groupId]) : true
            }
            this.visibilityTable = table
        },
        syncRenderedState(from = 0) {
            this.reflectSelectionState(from)
        },
        log(a) {
            console.log(a)
            return a
        },
        switchTableMode(newVal) {
            this.$emit('switchTableMode', newVal);
        },
        toggleDbEntries(value) {
            if (!this.selectedStates) {
                return 
            }

            if (this.selectedCounts > 0) {
                value = false
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

            const arr = []
            let deltaUpperbound = this.selectUpperbound - this.totalSelectedCounts
            let delta = 0
            for (const targetIdx of this.sortedIndices) {
                if (delta >= deltaUpperbound) {
                    break
                }
                if (this.isRowVisible(targetIdx) && this.selectedStates[targetIdx] != value) {
                    arr.push(targetIdx)
                    delta++
                }
            }
            if (delta > 0) {
                this.$emit('bulkToggle', arr, value)
            }
        },
        emitForwardDropdown(event, href) {
            this.$emit('forwardDropdown', event, href)
        },
        showAlignment(groupidx, event) {
            this.$emit('showAlignment', this.entry.alignments[groupidx], event)
        },
        onCheckboxClick(idx, event) {
            if (!this.selectedStates) { 
                return 
            }

            let targetIdx = this.sortedIndices[idx]
            let value = !this.selectedStates[targetIdx]

            const needRangedToggle = event.shiftKey && (this.toggleSourceIdx != idx && this.toggleSourceIdx != -1)

            if (!needRangedToggle) {
                // simple click. just toggle it.
                // If selected count exceeds upperbound, than simply ignore
                if (this.totalSelectedCounts > this.selectUpperbound && value) { 
                    return 
                }
                this.toggleSourceIdx = idx
                this.toggleTargetValue = value
                this.$emit('updateToggleSource', this.db)
                this.$emit('toggleSelection', targetIdx, value)
            } else {
                const startIdx = Math.min(this.toggleSourceIdx, idx)
                const endIdx = Math.max(this.toggleSourceIdx, idx) + 1
                this.handleRangedToggle(startIdx, endIdx, this.toggleTargetValue)
            }
        },
        handleRangedToggle(startIdx, endIdx, value) {
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
                let targetIdx = this.sortedIndices[i]
                if (this.isRowVisible(targetIdx) && this.selectedStates[targetIdx] != value) {
                    delta += deltaUnit
                    arr.push(targetIdx)
                }
            }

            if (delta != 0) {
                this.$emit('bulkToggle', arr, value)
            }
        },
        reflectSelectionState(from = 0) {
            const rows = this.visibleSortedIndices
            for (let i = from; i < rows.length; i++) {
                const entryIdx = rows[i]
                const value = this.selectedStates ? this.selectedStates[entryIdx] : false
                const id = this.entryidx + "#" + String(entryIdx)
                document.getElementById(id)?.classList.toggle('selected', value ? true : false)
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
                this.sortOrder = defaultSortOrder(key, { mode: this.mode })
            }
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
                    this.syncRenderedState()
                }, 0)
            })
        },
    }
}
</script>

<style lang="scss" scoped>
@import "result-table";
</style>
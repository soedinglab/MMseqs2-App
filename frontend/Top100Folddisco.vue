<template>
    <div>
        <v-sheet style="position: sticky; z-index: 99997 !important; padding-bottom: 16px; margin-top: 28px"
            :style="{'height': headHeight, 'top': headTop,
                'box-shadow': $vuetify.breakpoint.smAndDown ? 'rgba(0, 0, 0, 0.2) 0px 8px 6px -6px' : '',
            }"
        >
            <v-flex
                class="d-flex"
                :style="{
                    'flex-direction' : $vuetify.breakpoint.mdAndDown ? 'column' : 'row',
                    'align-items': 'start',
                    'white-space': 'nowrap',
                }">
                <div style="flex-basis: 100%; width: 100%; flex: 1">
                    <h2 style="margin-top: 0.5em; margin-bottom: 1em;" class="mr-auto result-title">
                    <!-- <div style="width: 24px; display: inline-block;"></div> -->
                     <div style="width: 24px; display: inline-block;"
                        v-if="!$vuetify.breakpoint.mdAndDown"
                    ></div>
                    <v-icon @click="isCollapsed = !isCollapsed" v-else
                        style="transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1); margin-right: 8px;"
                        :style="{'transform': isCollapsed ? 'rotate(-90deg)' : ''}"
                        :title="isCollapsed ? 'Show actions' : 'Hide actions'"
                    >
                        {{ $MDI.ChevronDown }}
                    </v-icon>
                    <span>Top 100</span>
                    <small v-if="filteredTotal < entryLength" class="ml-2">of {{ filteredTotal }} filtered hits</small>
                    <span v-if="filterChips.length > 0 && !$vuetify.breakpoint.smAndDown" class="filter-chips">
                        <v-chip v-for="chip in filterChips" :key="chip.key" small outlined close
                            :color="entry.color" class="ml-2" :title="chip.text"
                            @click:close="onColumnFilter(chip.key, null)">{{ chip.text }}</v-chip>
                        <v-chip v-if="filterChips.length > 1" small class="ml-2" @click="clearFilters">Clear all</v-chip>
                    </span>
                    </h2>
                </div>
                <v-flex
                    v-if="!isCollapsed || $vuetify.breakpoint.lgAndUp"
                    class="d-flex" style="width: 100%"
                    :style="{
                        'flex-direction' : $vuetify.breakpoint.mdAndDown ? 'column' : 'row',
                        'align-items': 'center',
                        'white-space': 'nowrap',
                        'gap': '24px',
                        'flex': $vuetify.breakpoint.mdAndDown ? '0' : '1',
                        'padding-left': $vuetify.breakpoint.mdAndDown ? '24px' : ''
                    }"
                    >
                    <v-flex class="d-flex" style="flex-basis: 100%; width: 100%;">
                        <div style="width: 100%">
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
                                :queryresidues="queryresidues"
                                :color="primaryColor"
                            >
                            </motif-filter>
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
            </v-flex>
            
        </v-sheet>
        <table class="v-table result-table" style="position:relative; margin-bottom: 3em;"
            v-if="hasEntries" :style="{'--active-color': primaryColor}">
            <colgroup>
                <col style="width: 36px;"> <!--index-->
                <col style="min-width: 12%;" /> <!-- target -->
                <col v-if="hasDescription" style="width: 25%;" /> 
                <col v-if="hasTaxonomy" style="width: 15%;" />
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
                        <div class="v-input--selection-controls__input select-all custom-checkbox" id="top#select-all" style="user-select: none;
                            -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" @click.stop="toggleSelectAll($event)" :length="entryLength"
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
                    <th :class="['wide-' + (3 - hasDescription - hasTaxonomy), {'sort-selected': sortKey == 'target', 'sort-down': sortOrder < 0}]" class="sort-criterion">
                        <span class="th-label">Target</span>
                        <ResultColumnMenu v-bind="columnMenuProps('target')" @sort="changeSortMode('target')" @filter="v => onColumnFilter('target', v)" />
                    </th>
                    <th v-if="hasDescription" class="sort-criterion has-help" :class="{'sort-selected': sortKey == 'desc', 'sort-down': sortOrder < 0}">
                        <span class="th-label">Description</span>
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" class="th-help">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                        <ResultColumnMenu v-bind="columnMenuProps('desc')" @sort="changeSortMode('desc')" @filter="v => onColumnFilter('desc', v)" />
                    </th>
                    <th v-if="hasTaxonomy" class="sort-criterion" :class="{'sort-selected': sortKey == 'tax', 'sort-down': sortOrder < 0}">
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
            <tbody>
                <template v-for="([ dbIdx, groupidx ], sortIdx) in sortedSplittedIndices" >
                    <tr v-for="(item, index) in hits.results[dbIdx].alignments[groupidx]" :class="['hit', { 'active' : item.active }]"
                        :key="`${dbIdx}-${groupidx}-${index}`" @click.stop="$vuetify.breakpoint.smAndDown ? onCheckboxClick(sortIdx, $event) : () => {}"
                        :style="{'--active-color': idxToColor[dbIdx]}"
                    >
                        <td class="entry-checkbox" :id="'top.' + dbIdx + '#' + groupidx">
                            <!-- performance issue with thousands of v-checkboxes, hardcode the simple checkbox instead -->
                            <div class="v-input--selection-controls__input custom-checkbox" 
                            style="user-select: none; -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" 
                            @click.stop="onCheckboxClick(sortIdx, $event)"
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
                            <div class="border-td" 
                            @click.stop="() => $emit('jumpTo', Number(dbIdx))"
                            :data-text="idxToDb[dbIdx].replaceAll(/_folddisco$/g, '').toUpperCase()"
                            ></div>
                        </td>
                        <td class="long" data-label="Target" :style="{ 'border-color' : 'var(--active-color)'}">
                            <a :id="item.id" class="anchor" style="position: absolute; top: 0" @click.stop></a>
                            <a style="text-decoration: underline; color: #2196f3;" 
                                v-if="Array.isArray(item.href)" @click.stop="emitForwardDropdown($event, item.href)"
                                rel="noopener" :title="item.target">{{item.targetname}}</a>
                            <a v-else :href="item.href" target="_blank" rel="noopener" 
                                :title="item.target" @click.stop>{{item.targetname}}</a>
                        </td>
                        <td class="long" data-label="Description" v-if="hasDescription">
                            <span :title="item.description ? item.description : '-'">{{ item.description ? item.description : '-'}}</span>
                        </td>
                        <td class="long" v-if="hasTaxonomy" data-label="Taxonomy">
                            <a v-if="item.taxName" :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" 
                            target="_blank" rel="noopener" :title="item.taxName ? item.taxName : '-'" @click.stop>{{item.taxName}}</a>
                            <span v-else>-</span>
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
                                @click.stop="showAlignment(dbIdx, groupidx, $event)"
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
        </table>
    </div>
</template>
<script>
import MotifFilter from './MotifFilter.vue';
import ResultTableFilterMixin from './ResultTableFilterMixin.vue';
import { defaultSortOrder } from './lib/resultSort.js';
import { makeGroupPredicate, mergedTaxonOptions, mergedTaxFilterFor } from './lib/resultFilter.js';

const STRING_FIELD = { target: 'target', desc: 'description', tax: 'taxName' };

export default {
    name: 'Top100Folddisco',
    mixins: [ ResultTableFilterMixin ],
    components: { MotifFilter },
    data() {
        return {
            origIndicesPerGaps: {},
            sortKeyCache: {},
            toggleTargetValue: true,
            toggleSourceKey: "",
            toggleSourceIdx: -1,
            idxToDb: {},
            idxToColor: {},
            sortKey: 'idf',
            sortOrder: -1,
            isCollapsed: false,
            gapFilter: "",
            multipleSelectionEnabled: false,
            selectedTopEntries: 0,
        }
    },
    created() {
        // Initialize sortKeyCache
        const obj = {}
        obj['idf'] = {}
        obj['rmsd'] = {}
        obj['node'] = {}
        const gapToIdx = {}

        let idxs = []
        let alns = {}
        for (let [db_idx, hit] of Object.entries(this.hits.results)) {
            alns = hit.alignments
            idxs = Object.keys(alns)

            // Storing indices
            const arr = idxs.map(k => db_idx + "#" + k)
            if (gapToIdx[""] == undefined) {
                gapToIdx[""] = []
            }
            gapToIdx[""].push(...arr)

            // Caching values required for sorting
            if (idxs.length > 0) {
                obj['idf'][db_idx] = Object.fromEntries(idxs.map(k => [k, alns[k][0].idfscore]))
                obj['rmsd'][db_idx] = Object.fromEntries(idxs.map(k => [k, alns[k][0].rmsd]))
                obj['node'][db_idx] = Object.fromEntries(idxs.map(k => [k, alns[k][0].nodecount]))
            }
            
            for (let i = 0; i < Object.keys(alns).length; i++) {
                const item = alns[i]
                const gap = item[0].gaps
                if (gapToIdx[gap] == undefined) {
                    gapToIdx[gap] = []
                }
                gapToIdx[gap].push(arr[i])
            }

            // db name and color caching
            this.idxToDb[db_idx] = hit.db
            this.idxToColor[db_idx] = hit.color
        }
        
        this.sortKeyCache = obj
        this.origIndicesPerGaps = gapToIdx
    },
    props: {
        hits: {
            type: Object,
            default: null
        },
        selectedStates: {
            type: Object,
            default: null
        },
        selectedCounts: {
            type: Number,
            default: 0,
        },
        selectUpperbound: {
            type: Number,
            default: 1000
        },
        alignment: {
            type: Object,
            default: null
        },
    },
    mounted() {
        if (this.$route.query.d2m && this.$route.query.d2m == 1) {
            this.multipleSelectionEnabled = true
        }
        this.$nextTick(() => {
            setTimeout(() => {
                this.reflectSelectionState()
            }, 0)
        })
    },
    activated() {
        this.toggleSourceIdx = -1
        this.toggleTargetValue = true
        this.$nextTick(() => {
            setTimeout(() => {
                this.reflectSelectionState()
            }, 0)
        })
    },
    watch: {
        sortedIndices() {
            this.toggleSourceIdx = -1
            this.$nextTick(() => {
                setTimeout(() => {
                    this.reflectSelectionState()
                }, 0)
            })
        },
    },
    computed: {
        entry() {
            return { color: this.primaryColor, hasTaxonomy: this.hasTaxonomy }
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
                ...(this.hasDescription ? ['desc'] : []),
                ...(this.hasTaxonomy ? ['tax'] : []),
                'idf', 'rmsd', 'node',
            ]
        },
        filterGroups() {
            return (this.origIndicesPerGaps[""] || []).map(id => this.groupOf(id))
        },
        taxOptions() {
            return this.hasTaxonomy ? mergedTaxonOptions(this.hits.results) : null
        },
        entryLength() {
            return (this.origIndicesPerGaps[""] || []).length
        },
        filteredTotal() {
            return this.filteredIndices.length
        },
        // The motif pattern chosen here, then the column filters.
        filteredIndices() {
            const indices = this.origIndicesPerGaps[this.gapFilter || ""] || []
            const predicate = makeGroupPredicate(this.filters, this.filterKeys)
            return predicate ? indices.filter(id => predicate(this.groupOf(id))) : indices
        },
        hasEntries() {
            return this.origIndicesPerGaps[""]?.length > 0
        },
        hasDescription() {
            let value = false
            for (let hit of Object.values(this.hits.results)) {
                if (hit.hasDescription && Object.keys(hit.alignments).length > 0) {
                    value = true
                    break
                }
            }
            return value
        },
        hasTaxonomy() {
            let value = false
            for (let hit of Object.values(this.hits.results)) {
                if (hit.hasTaxonomy && Object.keys(hit.alignments).length > 0) {
                    value = true
                    break
                }
            }
            return value
        },
        sortedIndices() {
            return [...this.filteredIndices].sort(this.comparator).slice(0, 100)
        },
        sortedCount() {
            if (!this.sortedIndices) return 0
            return this.sortedIndices.length
        },
        comparator() {
            const field = STRING_FIELD[this.sortKey]
            if (field) {
                return (a, b) => this.sortOrder * String(this.groupOf(a)[0][field] ?? '')
                    .localeCompare(String(this.groupOf(b)[0][field] ?? ''))
            }
            let sortCache = this.sortKeyCache[this.sortKey]
            let comp = (a, b) => {
                let [a_db, a_idx] = a.split("#")
                let [b_db, b_idx] = b.split("#")
                return this.sortOrder * ( sortCache[a_db][a_idx] - sortCache[b_db][b_idx])
            }
            return comp
        },
        headTop() {
            return "140px"
        },
        colheadTop() {
            const breakpointAddend = this.$vuetify.breakpoint.mdAndDown ? 56 : 0
            const auxOffset = this.isCollapsed && this.$vuetify.breakpoint.mdAndDown ? -126 : 0
            return String(274 + breakpointAddend + auxOffset) + 'px'
        },
        isGapFilterAvailable() {
            return !(!this.gapFilter || this.gapFilter == '')
        },
        dbGaps() {
            if (!this.hits) {
                return [];
            }
            return [...Object.keys(this.origIndicesPerGaps), ''];
        },
        headHeight() {
            const auxHeight = this.isCollapsed && this.$vuetify.breakpoint.mdAndDown ? -70 : this.$vuetify.breakpoint.mdAndDown ? 56 : 0
            return String(auxHeight + 134) + 'px'
        },
        sortedSplittedIndices() {
            return this.sortedIndices.map(idx => idx.split("#"))
        },
        queryresidues() {
            return this.hits.results[0]?.queryresidues ? this.hits.results[0].queryresidues : ""
        },
        primaryColor() {
            return this.$vuetify.theme.dark ? '#2196f3' : '#1976d2'
        }
    },
    methods: {
        log(a) {
            console.log(a)
            return a
        },
        toggleSelectAll(value) {
            if (!this.selectedStates) {
                return 
            }

            if (this.selectedTopEntries > 0) {
                value = false
            }
            
            if (!value) {
                const arr = []
                for (const [idx, [dbIdx, entryIdx]] of this.sortedSplittedIndices.entries()) {
                    if (this.selectedStates[dbIdx][entryIdx]) {
                        arr.push(this.sortedIndices[idx])
                    }
                }
                this.$emit('bulkToggle', arr, value)
                return
            } 

            if (this.multipleSelectionEnabled) {
                const arr = []
                let deltaUpperbound = this.selectUpperbound - this.selectedCounts
                let delta = 0
                for (let [idx, [dbIdx, entryIdx]] of this.sortedSplittedIndices.entries()) {
                    if (delta >= deltaUpperbound) {
                        break
                    }
                    if (this.selectedStates[dbIdx][entryIdx] != value) {
                        arr.push(this.sortedIndices[idx])
                        delta++
                    }
                }
                if (delta > 0) {
                    this.$emit('bulkToggle', arr, value)
                }
            } else {
                if (this.selectedCounts > 0) {
                    this.$emit('clearAll')
                }

                if (this.sortedSplittedIndices[0]) {
                    const [dbIdx, entryIdx] = this.sortedSplittedIndices[0]
                    this.$emit('toggleSelection', dbIdx, entryIdx, true)
                }
            }
        },
        groupOf(id) {
            const [dbIdx, groupIdx] = id.split("#")
            return this.hits.results[dbIdx].alignments[groupIdx]
        },
        resolveTaxFilter(option) {
            return mergedTaxFilterFor(this.hits.results, option)
        },
        emitForwardDropdown(event, href) {
            this.$emit('forwardDropdown', event, href)
        },
        showAlignment(dbIdx, groupidx, event) {
            this.$emit('showAlignment', this.hits.results[dbIdx].alignments[groupidx][0], this.idxToDb[dbIdx], event)
        },
        isItemVisible(item) {
            if (!this.gapFilter) return true
            return this.gapFilter == '' || item.gaps == this.gapFilter;
        },
        onCheckboxClick(idx, event) {
            if (!this.selectedStates) { 
                return 
            }

            let [dbIdx, targetIdx] = this.sortedSplittedIndices[idx]
            let value = !this.selectedStates[dbIdx][targetIdx]

            const needRangedToggle = this.multipleSelectionEnabled 
                && event.shiftKey && (this.toggleSourceIdx != idx && this.toggleSourceIdx != -1)

            if (!needRangedToggle) {
                // simple click. just toggle it.
                // If selected count exceeds upperbound, than simply ignore
                if (this.selectedCounts > 0) {
                    this.$emit('clearAll')
                }

                if (this.selectedCounts > this.selectUpperbound && value) { 
                    return 
                }
                this.toggleSourceIdx = idx
                this.toggleTargetValue = value
                this.$emit('toggleSelection', dbIdx, targetIdx, value)
            } else {
                const startIdx = Math.min(this.toggleSourceIdx, idx)
                const endIdx = Math.max(this.toggleSourceIdx, idx) + 1
                
                if (value && this.selectedCounts > this.selectUpperbound) {
                    return
                }

                const deltaUpperbound = this.selectUpperbound - this.selectedCounts
                let delta = 0
                const deltaUnit = value ? 1 : -1
                const arr = []

                for (let i = startIdx; i < endIdx; i++) {
                    if (delta >= deltaUpperbound) {
                        break
                    }
                    let [dbIdx, targetIdx] = this.sortedSplittedIndices[i]
                    if (this.selectedStates[dbIdx][targetIdx] != value) {
                        delta += deltaUnit
                        arr.push(this.sortedIndices[i])
                    }
                }

                if (delta != 0) {
                    this.$emit('bulkToggle', arr, value)
                }
            }
        },
        reflectSelectionState() {
            if (!this.selectedStates || Object.keys(this.selectedStates).length == 0) {
                return
            }

            let count = 0
            let value = false
            let id = ""
            for (const [idx, [dbIdx, entryIdx]] of this.sortedSplittedIndices.entries()) {
                id = this.sortedIndices[idx]

                value = this.selectedStates[dbIdx][entryIdx] ? true : false
                count += value

                document.getElementById('top.' + id)?.classList.toggle('selected', value)
            }
            
            let select_all_button = document.getElementById("top#select-all")
            if (select_all_button) {
                select_all_button.classList.toggle('any-selected', count > 0)
                select_all_button.classList.toggle('all-selected', this.sortedIndices.length == count)
            }
            this.selectedTopEntries = count
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

            this.$nextTick(() => {
                setTimeout(() => {
                    this.reflectSelectionState()
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
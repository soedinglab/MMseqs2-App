<template>
    <div>
        <v-sheet style="position: sticky; z-index: 99997 !important; padding-bottom: 16px; margin-top: 28px" 
            class="sticky-sheet" 
            :style="{'height': headHeight, 'top': '140px',
                'box-shadow': $vuetify.breakpoint.smAndDown ? 'rgba(0, 0, 0, 0.2) 0px 8px 6px -6px' : '',
                'padding-bottom': $vuetify.breakpoint.smAndDown ? 0 : '16px',
            }">
            <v-flex class="d-flex" :style="{ 'flex-direction' : $vuetify.breakpoint.smAndDown ? 'column' : null, 
                'align-items': 'center', 'justify-content': $vuetify.breakpoint.smAndDown ? 'center' : 'space-between'}">
                <h2 style="margin-top: 0.5em; margin-bottom: 1em;" class="mr-auto result-title">
                    <div style="width: 24px; display: inline-block;"
                    ></div>
                    <span>Top 100</span>
                    <small v-if="filteredTotal < entryLength" class="ml-2">of {{ filteredTotal }} filtered hits</small>
                    <span v-if="filterChips.length > 0 && !$vuetify.breakpoint.smAndDown" class="filter-chips">
                        <v-chip v-for="chip in filterChips" :key="chip.key" small outlined close
                            :color="entry.color" class="ml-2" :title="chip.text"
                            @click:close="onColumnFilter(chip.key, null)">{{ chip.text }}</v-chip>
                        <v-chip v-if="filterChips.length > 1" small class="ml-2" @click="clearFilters">Clear all</v-chip>
                    </span>
                </h2>

                <div
                    style="display: flex; justify-content: center; align-items: center;" :style="{'width' : $vuetify.breakpoint.smAndDown ? '100%' : ''}"
                >
                    <div style="display: flex; justify-content: center; align-items: center;"
                    :style="{'width': $vuetify.breakpoint.smAndDown ? '100%' : '', 'flex-direction': $vuetify.breakpoint.smAndDown ? 'column' : 'row'}">
                        <v-btn-toggle v-if="hasEntries" mandatory :value="tableMode" @change="$emit('switchTableMode', $event)" :class="{'mb-2': $vuetify.breakpoint.smAndDown}">
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
        <v-sheet v-if="!hasEntries"><div class="text-h5 mt-3 pa-2">No hits found...</div></v-sheet>
        <table class="v-table result-table" style="position:relative; margin-bottom: 3em;" v-if="hasEntries"
            :style="{'--active-color': $vuetify.theme.dark ? '#2196f3' : '#1976d2'}"
        >
            <colgroup>
                <col style="width: 36px;">
                <template v-if="isComplex">
                    <col style="width: 6.5%;" />
                    <col style="width: 6.5%;" />
                </template>
                <col style="min-width: 10%;" />
                <col v-if="hasDescription" style="min-width: 25%;" />
                <col v-if="hasTaxonomy" style="min-width: 15%;" />
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
                    <th :colspan="6 + hasDescription + hasTaxonomy + ((tableMode == 1) ? 2 : 0) - (searchType === 'interfacesearch' ? 2 : 0)" style="text-align:center; border-bottom: 1px solid #333;">Chain</th>
                </tr>
                <tr>
                    <th class="thin select-all-th" style="position: relative">
                        <!-- Replaced this checkbox too, for the colored undeterminate state -->
                        <div class="v-input--selection-controls__input select-all custom-checkbox" id="top#select-all" style="user-select: none;
                            -webkit-user-select: none; cursor: pointer; position: absolute; top: calc(50% - 12px); left: 6px;" @click.stop="toggleSelectAll($event)"
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
                            :title="searchType === 'interfacesearch' ? 'Query Interface TM-score' : 'Query TM-score'"><span class="th-label">qTM</span><ResultColumnMenu v-bind="columnMenuProps('qtm')" @sort="changeSortMode('qtm')" @filter="v => onColumnFilter('qtm', v)" /></th>
                        <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'ttm', 'sort-down': this.sortOrder < 0}"
                            :title="searchType === 'interfacesearch' ? 'Target Interface TM-score' : 'Target TM-score'" style="border-right: 1px solid #333; "><span class="th-label">tTM</span><ResultColumnMenu v-bind="columnMenuProps('ttm')" @sort="changeSortMode('ttm')" @filter="v => onColumnFilter('ttm', v)" /></th>
                    </template>
                    <th :class="[`wide-${3 - hasDescription - hasTaxonomy}`, {'sort-selected': sortKey == 'target', 'sort-down': sortOrder < 0}]" class="sort-criterion">
                        <span class="th-label"><template v-if="isComplex">
                            Chain pairing
                        </template>
                        <template v-else>
                            Target
                        </template></span>
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
                    <th class="thin sort-criterion default-down" v-if="mode !== 'lolalign'" :class="{'sort-selected':this.sortKey == 'score', 'sort-down': this.sortOrder < 0}"
                        v-show="tableMode == 1" title="Score">
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
                <template v-for="([dbIdx, groupidx], sortIdx) in sortedSplittedIndices" >
                <tr v-for="(item, index) in hits.results[dbIdx].alignments[groupidx]" :class="['hit', { 'active' : item.active }]"
                    @click.stop="$vuetify.breakpoint.width <= 960 ? onCheckboxClick(sortIdx, $event) : () => {}"
                    :key="`${dbIdx}-${groupidx}-${index}`" :style="{'--active-color': idxToColor[dbIdx] }"
                    >
                    <td v-if="index == 0" :rowspan="hits.results[dbIdx].alignments[groupidx].length" class="entry-checkbox" :id="'top.' + dbIdx + '#' + groupidx"
                    >
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
                        <div v-if="!isComplex" class="border-td" 
                        @click.stop="() => $emit('jumpTo', Number(dbIdx))"
                        :data-text="idxToDb[dbIdx].toUpperCase()"
                        ></div>
                    </td>
                    <template v-if="index == 0 && isComplex">
                        <td class="thin" :data-label="searchType === 'interfacesearch' ? 'Query Interface TM-score' : 'Query TM-score'" :rowspan="hits.results[dbIdx].alignments[groupidx].length">{{ item.complexqtm.toFixed(2) }}</td>
                        <td class="thin" :data-label="searchType === 'interfacesearch' ? 'Target Interface TM-score' : 'Target TM-score'" :rowspan="hits.results[dbIdx].alignments[groupidx].length"
                        >
                        {{ item.complexttm.toFixed(2) }}
                        <div class="border-td" :data-text="idxToDb[dbIdx].toUpperCase()"
                        @click.stop="() => $emit('jumpTo', Number(dbIdx))"
                        ></div>
                        </td>
                    </template>
                    <td class="long" data-label="Target" 
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
                    <td class="long" data-label="Description" v-if="hasDescription">
                        <span :title="item.description ? item.description : ''">{{ item.description ? item.description : '-' }}</span>
                    </td>
                    <td class="long" v-if="hasTaxonomy" data-label="Taxonomy">
                        <a v-if="item.taxName"
                            :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" 
                            target="_blank" 
                            rel="noopener" 
                            :title="item.taxName" 
                            @click.stop
                        >
                            {{ item.taxName }}
                        </a>
                        <span v-else>-</span>
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
                    <td class="alignment-action" :rowspan="isComplex ? hits.results[dbIdx].alignments[groupidx].length : 1" v-if="index == 0">
                        <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                        <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                            <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                        </v-btn> -->
                        <button 
                            @click.stop="showAlignment(dbIdx, groupidx, $event)"
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
                <tr aria-hidden="true" v-if="isComplex" style="height: 15px" :key="`spacer-${dbIdx}-${groupidx}`" ></tr>
                </template>
            </tbody>
        </table>
    </div>
</template>

<script>
import Ruler from './Ruler.vue';
import ResultTableFilterMixin from './ResultTableFilterMixin.vue';
import { defaultSortOrder } from './lib/resultSort.js';
import { makeGroupPredicate, mergedTaxonOptions, mergedTaxFilterFor } from './lib/resultFilter.js';

const STRING_FIELD = { target: 'target', desc: 'description', tax: 'taxName' };

export default {
    name: 'Top100Foldseek',
    mixins: [ ResultTableFilterMixin ],
    components: { Ruler },
    data() {
        return {
            origIndices: [],
            sortKey: 'score',
            sortOrder: -1,
            sortKeyCache: {},
            idxToDb: {},
            idxToColor: {},
            toggleSourceIdx: -1,
            toggleTargetValue: true,
            selectedTopEntries: 0,
        }
    },
    props: {
        hits: {type: Object, required: true},
        mode: {type: String, default: ""},
        isComplex: {type: Boolean, default: false},
        tableMode: {type: Number, default: 0},
        alignment: {default: null},
        selectedStates: {default: null},
        selectedCounts: {default: 0},
        selectUpperbound: {default: 1000},
        searchType: {type: String, default: ""},
    },
    methods: {
        changeSortMode(key) {
            if (key == this.sortKey) {
                this.sortOrder *= -1
            } else {
                this.sortKey = key
                this.sortOrder = defaultSortOrder(key, { mode: this.mode })
            }
            this.toggleSourceIdx = -1
            this.toggleTargetValue = true
            
            this.$nextTick(() => {
                setTimeout(() => {
                    this.reflectSelectionState()
                }, 0)
            })
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
        },
        onCheckboxClick(idx, event) {
            if (!this.selectedStates) { 
                return 
            }

            let [dbIdx, targetIdx] = this.sortedSplittedIndices[idx]
            let value = !this.selectedStates[dbIdx][targetIdx]

            const needRangedToggle = event.shiftKey && (this.toggleSourceIdx != idx && this.toggleSourceIdx != -1)

            if (!needRangedToggle) {
                // simple click. just toggle it.
                // If selected count exceeds upperbound, than simply ignore
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
        showAlignment(dbIdx, groupidx, event) {
            this.$emit('showAlignment',this.hits.results[dbIdx].alignments[groupidx], this.idxToDb[dbIdx], event)
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
        emitForwardDropdown(event, href) {
            this.$emit('forwardDropdown', event, href)
        },
        groupOf(id) {
            const [dbIdx, groupIdx] = id.split("#")
            return this.hits.results[dbIdx].alignments[groupIdx]
        },
        resolveTaxFilter(option) {
            return mergedTaxFilterFor(this.hits.results, option)
        },
    },
    created() {
        this.sortKey = this.mode == "lolalign" ? 'eval' : this.sortKey
        
        // Initialize sortKeyCache
        const obj = {}
        obj['qtm'] = {}
        obj['ttm'] = {}
        obj['prob'] = {}
        obj['seqId'] = {}
        obj['eval'] = {}
        obj['score'] = {}

        let idxs = []
        let alns = {}
        for (let [db_idx, hit] of Object.entries(this.hits.results)) {
            alns = hit.alignments
            idxs = Object.keys(alns)

            // Storing indices
            const arr = idxs.map(k => db_idx + "#" + k)
            this.origIndices.push(...arr)

            // Caching values required for sorting
            if (idxs.length > 0) {
                obj['prob'][db_idx] = Object.fromEntries(idxs.map(k => [k, Math.max(...alns[k].map(e => e.prob))]))
                obj['seqId'][db_idx] = Object.fromEntries(idxs.map(k => [k, Math.max(...alns[k].map(e => e.seqId))]))
                obj['score'][db_idx] = Object.fromEntries(idxs.map(k => [k, Math.max(...alns[k].map(e => e.score))]))
                const comp = this.mode == 'tmalign' || this.mode == 'lolalign' ? Math.max : Math.min
                obj['eval'][db_idx] = Object.fromEntries(idxs.map(k => [k, comp(...alns[k].map(e => e.eval))]))
                
                if (this.isComplex) {
                    obj['qtm'][db_idx] = Object.fromEntries(idxs.map(k => [k, Math.max(...alns[k].map(e => e.complexqtm))]))
                    obj['ttm'][db_idx] = Object.fromEntries(idxs.map(k => [k, Math.max(...alns[k].map(e => e.complexttm))])) 
                }
            }
            // db name and color caching
            this.idxToDb[db_idx] = hit.db
            this.idxToColor[db_idx] = hit.color
        }
        
        this.sortKeyCache = obj
        if (this.isComplex) {
            this.sortKey = 'qtm'
        }
        this.sortOrder = defaultSortOrder(this.sortKey, { mode: this.mode })
    },
    mounted() {
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
            return {
                color: this.$vuetify.theme.dark ? '#2196f3' : '#1976d2',
                hasTaxonomy: this.hasTaxonomy,
            }
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
                ...(this.hasDescription ? ['desc'] : []),
                ...(this.hasTaxonomy ? ['tax'] : []),
                ...(!isInterface ? ['prob'] : []),
                'seqId',
                ...(!isInterface ? ['eval'] : []),
                ...(this.mode !== 'lolalign' ? ['score'] : []),
            ]
        },
        filterGroups() {
            return this.origIndices.map(id => this.groupOf(id))
        },
        taxOptions() {
            return this.hasTaxonomy ? mergedTaxonOptions(this.hits.results) : null
        },
        entryLength() {
            return this.origIndices.length
        },
        filteredTotal() {
            return this.filteredIndices.length
        },
        filteredIndices() {
            const predicate = makeGroupPredicate(this.filters, this.filterKeys)
            return predicate ? this.origIndices.filter(id => predicate(this.groupOf(id))) : this.origIndices
        },
        hasEntries() {
            return this.origIndices.length > 0
        },
        hasDescription() {
            let value = false
            for (let hit of Object.values(this.hits.results)) {
                value = value || (hit.hasDescription && Object.keys(hit.alignments).length > 0)
            }
            return value
        },
        hasTaxonomy() {
            let value = false
            for (let hit of Object.values(this.hits.results)) {
                value = value || (hit.hasTaxonomy && Object.keys(hit.alignments).length > 0)
            }
            return value
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
        sortedIndices() {
            return [...this.filteredIndices].sort(this.comparator).slice(0, 100)
        },
        sortedSplittedIndices() {
            return this.sortedIndices.map(idx => idx.split("#"))
        },
        headHeight() {
            const auxHeight = this.$vuetify.breakpoint.smAndDown ? 54 : 16
            return String(auxHeight + 64) + 'px'
        },
        colheadTop() {
            const breakpointAddend = this.$vuetify.breakpoint.smAndDown ? 108 : 0
            return String(48 + 172 + breakpointAddend) + 'px'
        },
    },
}
</script>

<style lang="scss" scoped>
@import "result-table";
</style>
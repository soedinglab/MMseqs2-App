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
                    <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                    <!-- <div style="width: 24px; display: inline-block;"></div> -->
                     <div style="width: 24px; display: inline-block;"
                        v-if="!$vuetify.breakpoint.mdAndDown"
                    ></div>
                    <v-icon @click="isCollapsed = !isCollapsed" v-else
                        style="transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);"
                        :style="{'transform': isCollapsed ? 'rotate(-90deg)' : ''}"
                        :title="isCollapsed ? 'Show actions' : 'Hide actions'"
                    >
                        {{ $MDI.ChevronDown }}
                    </v-icon>
                    <span>Top 100</span> 
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
                        <v-menu v-show="$vuetify.breakpoint.smAndDown" bottom left :close-on-content-click='false'>
                            <template v-slot:activator="{on, attrs}">
                                <v-btn
                                    icon
                                    v-bind="attrs"
                                    v-on="on"
                                    v-show="$vuetify.breakpoint.smAndDown"
                                    style="align-self: flex-end; margin-bottom: 16px; margin-left: 8px"
                                    title="Sort options"
                                >
                                    <v-icon>
                                        {{ $MDI.Sort }}
                                    </v-icon>
                                </v-btn>
                            </template>
                            <v-list
                                flat dense
                            >
                                <v-list-item-group
                                    mandatory
                                    color="primary"
                                    :value="sortMenuValue"
                                >
                                    <v-list-item @click.stop="changeSortMode('idf')">
                                        <v-list-item-title>IDF-score</v-list-item-title>
                                        <v-list-item-icon>
                                            <v-icon :style="{'opacity' : sortKey == 'idf' ? '1' : 0}">
                                                {{$MDI.Check}}
                                            </v-icon>
                                        </v-list-item-icon>
                                    </v-list-item>
                                    <v-list-item @click.stop="changeSortMode('rmsd')">
                                        <v-list-item-title>RMSD</v-list-item-title>
                                        <v-list-item-icon>
                                            <v-icon :style="{'opacity' : sortKey == 'rmsd' ? '1' : 0}">
                                                {{$MDI.Check}}
                                            </v-icon>
                                        </v-list-item-icon>
                                    </v-list-item>
                                    <v-list-item @click.stop="changeSortMode('node')">
                                        <v-list-item-title>Node Count</v-list-item-title>
                                        <v-list-item-icon>
                                            <v-icon :style="{'opacity' : sortKey == 'node' ? '1' : 0}">
                                                {{$MDI.Check}}
                                            </v-icon>
                                        </v-list-item-icon>
                                    </v-list-item>
                                </v-list-item-group>
                            </v-list>
                        </v-menu>
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
                <col style="width: 6%;" /> <!-- idf-score --> 
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
                    <th :class="['wide-' + (3 - hasDescription - hasTaxonomy),]">
                        Target
                    </th>
                    <th v-if="hasDescription">
                        Description
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                    </th>
                    <th v-if="hasTaxonomy">Scientific Name</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'idf', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('idf')" title="Click to sort by IDF-score">{{ $vuetify.breakpoint.mdAndDown ? 'IDF' :'IDF-score' }}</th>
                    <th class="thin sort-criterion" :class="{'sort-selected':this.sortKey == 'rmsd', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('rmsd')" title="Click to sort by RMSD">RMSD</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'node', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('node')" title="Click to sort by node count" >Nodes</th>
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
                        <td class="db long" data-label="Target" :style="{ 'border-color' : 'var(--active-color)'}">
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
                                            'v-btn--outlined' : alignment && item.target == alignment[0].target,
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

export default {
    name: 'Top100Folddisco',
    components: {MotifFilter},
    data() {
        return {
            origIndicesPerGaps: {},
            cachedSortedIndices: {},
            sortKeyCache: {},
            toggleTargetValue: true,
            toggleSourceKey: "",
            toggleSourceIdx: -1,
            idxToDb: {},
            idxToColor: {},
            sortKey: 'node',
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
    computed: {
        entryLength() {
            return this.sortedIndices.length
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
            if (this.cachedSortedIndices[this.gapFilter] != undefined
                && this.cachedSortedIndices[this.gapFilter][this.sortKey] != undefined
            ) return this.cachedSortedIndices[this.gapFilter][this.sortKey]

            if (this.gapFilter == null) this.gapFilter = ""
            let copiedArrs = [...this.origIndicesPerGaps[this.gapFilter]]
            let sliced = copiedArrs.sort(this.comparator).slice(0, 100)
            if (this.cachedSortedIndices[this.gapFilter] == undefined) {
                this.cachedSortedIndices[this.gapFilter] = {}
            }
            this.cachedSortedIndices[this.gapFilter][this.sortKey] = sliced

            return sliced
        },
        sortedCount() {
            if (!this.sortedIndices) return 0
            return this.sortedIndices.length
        },
        comparator() {
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
        sortMenuValue() {
            switch (this.sortKey) {
                case 'idf': {
                    return 0
                }
                case 'rmsd': {
                    return 1
                }
                case 'node': {
                    return 2
                }
                default: {
                    return 2
                }
            }
        },
        sortedSplittedIndices() {
            return this.sortedIndices.map(idx => idx.split("#"))
        },
        sortOrder() { 
            if (this.sortKey == 'rmsd') return 1
            else return -1
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
                select_all_button.classList.toggle('all-selected', this.entryLength == count)
            }
            this.selectedTopEntries = count
        },
        changeSortMode(key) {
            if (this.sortKey == key) return

            this.sortKey = key
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
.hide {
    display: none;
}

.result-table {
    transform: translateY(0);
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

    tbody {
        counter-reset: row;
    }

    tbody tr.hit {
        counter-increment: row;
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
.matched-residues-text {
    display: inline-block;
    max-width: 100%;
    overflow: scroll;
    scrollbar-width: none;
}



// Sticky thead border
thead.sticky-thead th {
    position: relative;
    padding-top: 4px;
    padding-bottom: 4px;
}

thead.sticky-thead th::before {
    content: "";
    width: 100%;
    bottom: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.12);
    position: absolute;
    height: 1px;
    display: block;
    z-index: inherit;
}
.theme--dark thead.sticky-thead th::before {
    background-color: rgba(255, 255, 255, 0.12);
}

thead.sticky-thead th.sort-criterion {
    cursor: pointer;
    background-color: transparent;
    transition: color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

thead.sticky-thead th.sort-criterion:not(.sort-selected):hover  {
    background-color: rgba(0, 0, 0, 0.05);
}

thead.sticky-thead th.sort-criterion:not(.sort-selected):active  {
    background-color: rgba(0, 0, 0, 0.15);
}

.theme--dark .sticky-thead th.sort-criterion:not(.sort-selected):hover  {
    background-color: rgba(255, 255, 255, 0.05);
}

.theme--dark thead.sticky-thead th.sort-criterion:not(.sort-selected):active  {
    background-color: rgba(255, 255, 255, 0.15);
}

thead.sticky-thead th.sort-criterion.sort-selected:hover  {
    background-color: color-mix(in srgb, var(--active-color) 12%, transparent);
}

thead.sticky-thead th.sort-criterion.sort-selected:active  {
    background-color: color-mix(in srgb, var(--active-color) 20%, transparent);
}

thead.sticky-thead th.sort-criterion::before {
    transition: background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), height 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), bottom 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

thead.sticky-thead th.sort-criterion::after {
    transform-origin: bottom center;
    content: "";
    width: 0;
    height: 0;
    bottom: 1px;
    right: 0;
    position: absolute;
    display: block;
    z-index: inherit;
    border-bottom: 7px solid transparent;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    background-color: transparent;
    transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), border-bottom-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), bottom 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

thead.sticky-thead th.sort-criterion:not(.sort-selected):hover::after {
    border-bottom-color: rgba(0, 0, 0, 0.15);
}

.theme--dark .sticky-thead th.sort-criterion:not(.sort-selected):hover::after {
    border-bottom-color: rgba(255, 255, 255, 0.15);
}

thead.sticky-thead th.sort-criterion:not(.sort-selected).default-down:hover::after {
    bottom: 0px;
    transform: scaleY(-1);
}

thead.sticky-thead th.sort-criterion.sort-selected::before {
    background-color: var(--active-color);
    height: 2px;
    bottom: -1px;
}

thead.sticky-thead th.sort-criterion.sort-selected::after {
    border-bottom-color: var(--active-color);
}

thead.sticky-thead th.sort-criterion.sort-selected:not(.sort-down)::after {
    bottom: 1px;
}

thead.sticky-thead th.sort-criterion.sort-selected.sort-down::after {
    bottom: -1px;
    transform: scaleY(-1);
}

tr.hit .entry-checkbox:not(.selected) path.checked {
    opacity: 0;
}

tr.hit .entry-checkbox.selected path.unchecked{
    opacity: 0;
}

th.select-all-th .select-all path.undeterminate {
    opacity: 0;
}

th.select-all-th .select-all.any-selected:not(.all-selected) path.undeterminate {
    opacity: 1;
}

th.select-all-th .select-all:not(.all-selected) path.checked {
    opacity: 0;
}

th.select-all-th .select-all.any-selected path.unchecked {
    opacity: 0;
}

tr.hit .entry-checkbox svg, .select-all svg {
    transition: opacity 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    transition: background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

tr.hit .entry-checkbox, .select-all {
    position: relative;
}

.custom-checkbox::before,
.custom-checkbox::after {
    content: '';
    transition: opacity  0.3s cubic-bezier(0.075, 0.82, 0.165, 1), background-color  0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    border-radius: 50%;
    cursor: pointer;
    width: 34px;
    height: 34px;
    top: calc(50% - 17px);
    left: calc(50% - 17px);
    position: absolute;
    background-color: inherit;
}

:not(.selected) > .custom-checkbox:not(.any-selected)::before,
:not(.selected) > .custom-checkbox:not(.any-selected)::after {
    background-color: rgba(0,0,0,0.54);
}

.theme--dark :not(.selected) > .custom-checkbox:not(.any-selected)::before,
.theme--dark :not(.selected) > .custom-checkbox:not(.any-selected)::after {
    background-color: #fff;
}

.selected .custom-checkbox::before,
.selected .custom-checkbox::after,
.custom-checkbox.any-selected::before,
.custom-checkbox.any-selected::after
{
    background-color: var(--active-color);
}

.custom-checkbox:not(:hover)::before {
    opacity: 0;
}

.custom-checkbox:hover::before {
    opacity: 0.2;
}

.custom-checkbox::after {
    opacity: 0;
    transition: opacity  0.3s cubic-bezier(0.075, 0.82, 0.165, 1), background-color 0.3s cubic-bezier(0.075, 0.82, 0.165, 1), transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    transform: scale(0);
    transform-origin: center center;
}

.custom-checkbox:active::after {
    opacity: 0.2;
    transform: scale(1);
}

tr.hit .entry-checkbox.selected svg, .select-all.any-selected svg {
    fill: var(--active-color);
}

tr.hit:has(.invisible) {
    display: none;
}
th.sort-criterion {
    cursor: pointer;
}

th.sort-criterion.sort-selected {
    color: var(--active-color);
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
        th {
            // overflow: hidden;
            text-overflow: ellipsis;
        }
        td:has(.border-td) {
            position: relative;
            overflow-y: unset;
        }
        div.border-td {
            background-color: var(--active-color);
            position: absolute;
            left: calc(100% - 2.5px);
            top: 0;
            font-size: 0.7rem;
            font-weight: 600;
            color: white;
            width: auto;
            max-width: 5px;
            padding: 4px 0 4px 5px;
            height: 100%;
            transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
            cursor: pointer;
        }
        div.border-td::before {
            content: attr(data-text);
            background-color: var(--active-color);
            position: absolute;
            top: 0;
            left: 0;
            height: 1.375rem;
            max-width: 5px;
            overflow: hidden;
            white-space: nowrap;
            padding-left: 5px;
            transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        }
        div.border-td:hover::before {
            max-width: 120px;
            padding: 0 5px;
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
        
        td.entry-checkbox {
            display: none;
        }

        thead {
            display: none;
        }
        tfoot th {
            border: 0;
            display: inherit;
        }
        tr.hit {
            box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1);
            max-width: 100%;
            position: relative;
            display: block;
            padding: 2em;
            margin-left: 2em;
            margin-right: 2em;
            cursor: pointer;
        }

        tr.hit:has(.selected) {
            outline: 4px solid color-mix(in srgb, var(--active-color) 60%, transparent);
            outline-offset: -2px;
        }

        tr:not(.hit) {
            position: relative
        }

        tr:not(.hit)::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 1px;
            background-color: #cfcfcf;
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
        tr:not(.detail):not(.is-empty):not(.table-footer) td:not(.entry-checkbox) {
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

</style>
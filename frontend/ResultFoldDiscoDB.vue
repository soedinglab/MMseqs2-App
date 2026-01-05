<template>
    <div :key="entry.db">
        <v-sheet style="position: sticky; z-index: 99997 !important; padding-bottom: 16px;"
         :style="{'height': $vuetify.breakpoint.mdAndDown ? $vuetify.breakpoint.xsOnly ? '356px' : '304px' : '180px', 'top': headTop}">
            <v-flex
                class="d-flex"
                :style="{
                    'flex-direction' : $vuetify.breakpoint.xsOnly ? 'column' : 'row',
                    'align-items': 'center',
                    'flex': '0',
                    'white-space': 'nowrap',
                }">
                <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                    <div style="width: 24px; display: inline-block;"></div>
                    <span style="text-transform: uppercase;">{{ entry.db.replaceAll(/_folddisco$/g, '') }}</span> <small>{{entryLength > 1 ? entryLength.toString() + " hits" : entryLength > 0 ? "1 hit" : "no hit" }}</small>
                </h2>
                <v-btn v-if="entry.hasTaxonomy" @click="toggleSankeyVisibility(entry.db)" 
                    :class="{ 'mr-2': $vuetify.breakpoint.smAndUp , 'mb-2': $vuetify.breakpoint.xsOnly}" large>
                    {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
                </v-btn>
            </v-flex>
            <v-flex
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
                    <h3>Filter</h3>
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
                <div style="flex-basis: 100%; width: 100%">
                    <h3>Cluster</h3>
                    <folddisco-hit-cluster :hits="entry" v-on:cluster="clusters = $event"></folddisco-hit-cluster>
                </div>
            </v-flex>
        </v-sheet>
        <v-flex v-if="hasEntries && entry.hasTaxonomy && isSankeyVisible[entry.db]">
            <SankeyDiagram :rawData="entry.taxonomyreports[0]" :db="entry.db" :currentSelectedNodeId="localSelectedTaxId" :currentSelectedDb="selectedDb" @selectTaxon="handleSankeySelect"></SankeyDiagram>
        </v-flex>

        <table class="v-table result-table" style="position:relative; margin-bottom: 3em;"
            v-if="hasEntries" :style="{'--active-color': entry.color}">
            <colgroup>
                <col style="width: 36px;"> <!--index-->
                <col style="min-width: 12%;" /> <!-- target -->
                <col v-if="entry.hasDescription" style="width: 25%;" /> 
                <col v-if="entry.hasTaxonomy" style="width: 15%;" />
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
                    class="sort-criterion" @click="changeSortMode('target')" title="Click to sort by target name" >
                        Target
                    </th>
                    <th v-if="entry.hasDescription" class="sort-criterion" 
                    :class="{'sort-selected':this.sortKey == 'desc', 'sort-down': this.sortOrder < 0}"
                    @click="changeSortMode('desc')" title="Click to sort by description">
                        Description
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                    </th>
                    <th v-if="entry.hasTaxonomy" :class="{'sort-selected':this.sortKey == 'tax', 'sort-down': this.sortOrder < 0}" 
                        class="sort-criterion" @click="changeSortMode('tax')" 
                        title="Click to sort by scientific name">Scientific Name</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'idf', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('idf')" title="Click to sort by idf-score">idf-score</th>
                    <th class="thin sort-criterion" :class="{'sort-selected':this.sortKey == 'rmsd', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('rmsd')" title="Click to sort by RMSD">RMSD</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'node', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('node')" title="Click to sort by node count" >Nodes</th>
                    <th>
                        Matched residues
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
            <tbody v-for="(clu, key) in sortedIndices">
                {{ void(clusterShown = false) }}
                <template v-for="(groupidx, sortIdx) in clu" >
                    <tr v-if="clusters[key].length != entryLength 
                        && visibleCluster[key] 
                        && clusterShown == false" :class="'result-entry-'+ entryidx + key">
                        <td colspan="7"><strong>Cluster: {{ key == -1 ? "Noise" : key }}</strong></td>
                    </tr>
                    {{ void(clusterShown = true) }}
                    <tr v-for="(item, index) in entry.alignments[groupidx]" :class="['hit', { 'active' : item.active }]"
                        :key="`${groupidx}-${index}`"
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
        </table>
    </div>
</template>

<script>
import MotifFilter from './MotifFilter.vue';
import FolddiscoHitCluster from './FolddiscoHitCluster.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';

export default {
    name: 'ResultFoldDiscoDB',
    components: {MotifFilter, FolddiscoHitCluster},
    mixins: [ ResultSankeyMixin ],
    data() {
        return {
            toggleTargetValue: true,
            toggleSourceKey: "",
            toggleSourceIdx: -1,
            visibilityTable: [],
            selectedDb: "",
            sortKey: 'node',
            sortOrder: -1,
            clusters: {},
            gapFilter: "",
            visibleCluster: {1 : true},
            multipleSelectionEnabled: false,
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
        filteredHitsTaxIds: {
            handler(n, o) {
                // this.log(n)
                this.toggleSourceKey = ""
                this.toggleSourceIdx = -1
                this.toggleSourceValue = true
                this.$nextTick(() => {
                    setTimeout(() => {
                        this.updateVisibility()
                    }, 0)
                })
            },
            immediate: false,
            deep: true,
        },
        toggleSourceDb(n, o) {
            if (n != this.db) {
                this.toggleSourceKey = ""
                this.toggleSourceIdx = -1
                this.toggleSourceValue = true
            }
        },
        entry(n, o) {
            if (n && this.visibilityTable.length == 0) {
                this.visibilityTable = Array(this.entryLength).fill(true)
            }
        },
        gapFilter(n, o) {
            this.$nextTick(() => {
                setTimeout(() => {
                    this.updateVisibility()
                }, 0)
            })
        },
        clusters(n, o) {
            this.$nextTick(() => {
                setTimeout(() => {
                    this.updateVisibility()
                    this.$emit('updateScroll')
                }, 0)
            })
        },
    },
    mounted() {
        if (this.entry && this.visibilityTable.length == 0) {
            this.visibilityTable = Array(this.entryLength).fill(true)
            this.selectedDb = this.db
            this.$nextTick(() => {
                setTimeout(() => {
                    this.reflectSelectionState()
                }, 0)
            })
        }

        if (this.$route.query.d2m && this.$route.query.d2m == 1) {
            this.multipleSelectionEnabled = true
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
        anySelected() {
            return this.selectedCounts > 0
        },
        selectAllStatus() {
            return this.selectedCounts == this.entryLength
        },
        sortedIndices() {
            if (!this.clusters) return this.clusters

            let copiedArrs = structuredClone(this.clusters)

            for (let key in copiedArrs) {
                copiedArrs[key].sort(this.comparator)
            }

            return copiedArrs
        },
        comparator() {
            let comp = () => {}
            switch (this.sortKey) {
                case 'idf':
                    comp = (a, b) => {
                        return this.sortOrder * (this.entry.alignments[a][0].idfscore - this.entry.alignments[b][0].idfscore)
                    }
                    break;

                case 'target':
                    comp = (a, b) => {
                        return this.sortOrder * (this.entry.alignments[a][0].target.localeCompare(this.entry.alignments[b][0].target))
                    }
                    break;

                case 'desc':
                    comp = (a, b) => {
                        return this.sortOrder * (this.entry.alignments[a][0].description.localeCompare(this.entry.alignments[b][0].description))
                    }
                    break;

                case 'tax':
                    comp = (a, b) => {
                        return this.sortOrder * (this.entry.alignments[a][0].taxName.localeCompare(this.entry.alignments[b][0].taxName))
                    }
                    break;


                case 'rmsd':
                    comp = (a, b) => {
                        return this.sortOrder * (this.entry.alignments[a][0].rmsd - this.entry.alignments[b][0].rmsd)
                    }
                    break;

                case 'node':
                    comp = (a, b) => {
                        return this.sortOrder * (this.entry.alignments[a][0].nodecount - this.entry.alignments[b][0].nodecount)
                    }
                    break;
            
                default:
                    break;
            }
            return comp
        },
        headTop() {
            return this.onlyOne ? '92px' : '140px'
        },
        colheadTop() {
            let addend = !this.onlyOne ? 140 : 92
            let breakpointAddend = this.$vuetify.breakpoint.xsOnly ? 176 : this.$vuetify.breakpoint.mdAndDown ? 124 : 0
            return String(180 + addend + breakpointAddend) + 'px'
        },
        isTaxAvailable() {
            return !(!this.filteredHitsTaxIds || this.filteredHitsTaxIds.length == 0)
        },
        isGapFilterAvailable() {
            return !(!this.gapFilter || this.gapFilter == '')
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
    },
    methods: {
        log(a) {
            console.log(a)
            return a
        },
        updateVisibility() {
            if (!this.entry) return
 
            let el = undefined
            let id = ''
            if (!this.isTaxAvailable && !this.isGapFilterAvailable) {
                this.visibilityTable = Array(this.entryLength).fill(true)
                for (let i = 0; i < this.entryLength; i++) {
                    id = this.entryidx + "#" + String(i)
                    el = document.getElementById(id)
                    if (el) {
                        el.classList.toggle('invisible', false)
                    }
                }
            } else {
                for (let i = 0; i < this.entryLength; i++) {
                    let target = this.isGroupVisible(this.entry.alignments[i]) 
                        && this.isItemVisible(this.entry.alignments[i][0])
                    this.visibilityTable[i] = target
                    id = this.entryidx + "#" + String(i)
                    el = document.getElementById(id)
                    if (el) {
                        el.classList.toggle('invisible', !target)
                    }
                }
            }

            const visibility = Object.keys(this.clusters).reduce((acc, key) => {
                acc[key] = false;
                return acc;
            }, {});
            for (const key in this.clusters) {
                if (this.clusters[key].length == this.entryLength) continue

                for (const idx of this.clusters[key]) {
                    if (this.visibilityTable[idx]) {
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
                        if (this.visibilityTable[i] && this.selectedStates[i] != value) {
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
                        if (this.visibilityTable[i] && this.selectedStates[i] != true) {
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
        isGroupVisible(group) {
            if (!this.filteredHitsTaxIds || this.filteredHitsTaxIds.length === 0) {
                return true;
            }
            let taxFiltered = group.filter(item => this.filteredHitsTaxIds.includes(Number(item.taxId)));
            return taxFiltered.length > 0;
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

                if (!this.multipleSelectionEnabled && this.anySelected) {
                    this.$emit('toggleSelection', this.toggleSourceIdx, false)
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
                if (this.visibilityTable[targetIdx] && this.selectedStates[targetIdx] != value) {
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
            for (let i = 0; i < this.entryLength; i++) {
                value = this.selectedStates[i]
                id = this.entryidx + "#" + String(i)
                let el = document.getElementById(id)
                if (el) {
                    el.classList.toggle('selected', value ? true : false)
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
                switch (key) {
                    case 'target':
                    case 'desc':
                    case 'tax':
                    case 'rmsd':
                        this.sortOrder = 1
                        break
                    case 'idf':
                    case 'node':
                        this.sortOrder = -1
                        break
                    default:
                        break;
                }
            }
            this.toggleSourceKey = ""
            this.toggleSourceIdx = -1
            this.toggleTargetValue = true
            this.$nextTick(() => {
                setTimeout(() => {
                    this.reflectSelectionState()
                }, 0)
            })
        }
    }
}
</script>

<style lang="scss" scoped>
.hide {
    display: none;
}

.db {
    border-left: 5px solid black;
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
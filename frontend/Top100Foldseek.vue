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
                <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                    <div style="width: 24px; display: inline-block;"
                    ></div>
                    <span>Top 100</span>
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
                    <v-menu v-show="$vuetify.breakpoint.smAndDown" bottom left>
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
                                <v-list-item v-if="isComplex" @click.stop="changeSortMode('qtm')">
                                    <v-list-item-title>Query TM-score</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'qtm' ? '1' : 0}">
                                            {{$MDI.Check}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item v-if="isComplex" @click.stop="changeSortMode('ttm')">
                                    <v-list-item-title>Target TM-score</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'ttm' ? '1' : 0}">
                                            {{$MDI.Check}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('prob')">
                                    <v-list-item-title>Probability</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'prob' ? '1' : 0}">
                                            {{$MDI.Check}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('seqId')">
                                    <v-list-item-title>Sequence Id.</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'seqId' ? '1' : 0}">
                                            {{$MDI.Check}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('eval')">
                                    <v-list-item-title>{{ this.mode == 'tmalign' ? 'TM-score' : this.mode == 'lolalign' ? 'LOL-score' : 'E-Value' }}</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'eval' ? '1' : 0}">
                                            {{$MDI.Check}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('score')">
                                    <v-list-item-title>Score</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'score' ? '1' : 0}">
                                            {{$MDI.Check}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                            </v-list-item-group>
                        </v-list>
                    </v-menu>
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
                <col style="width: 6%;" />
                <col style="width: 6%;" />
                <col style="width: 6%;" />
                <template v-if="tableMode == 0">
                    <col style="min-width: 20%;" />
                </template>
                <template v-else>
                    <col style="width: 4%;" />
                    <col style="width: 8%;" />
                    <col style="width: 8%;" />
                </template>
                <col style="width: 6%;" />
            </colgroup>
            <thead style="position: sticky; z-index: 99997 !important;" class="sticky-thead"
                :style="{'top': colheadTop, 
                'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
                <tr v-if="isComplex">
                    <th colspan="1"></th>
                    <th colspan="2" style="text-align:center; width:10%; border-right: 1px solid #333; border-bottom: 1px solid #333;">Complex</th>
                    <th :colspan="6 + hasDescription + hasTaxonomy + ((tableMode == 1) ? 2 : 0)" style="text-align:center; border-bottom: 1px solid #333;">Chain</th>
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
                            @click="changeSortMode('qtm')" title="Click to sort by Query TM-score">qTM</th>
                        <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'ttm', 'sort-down': this.sortOrder < 0}"
                            @click="changeSortMode('ttm')" title="Click to sort by Target TM-score" style="border-right: 1px solid #333; ">tTM</th>
                    </template>
                    <th :class="[`wide-${3 - hasDescription - hasTaxonomy}`]">
                        <template v-if="isComplex">
                            Chain pairing
                        </template>
                        <template v-else>
                            Target
                        </template>
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
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'prob', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('prob')" title="Click to sort by probability">Prob.</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'seqId', 'sort-down': this.sortOrder < 0}"
                        @click="changeSortMode('seqId')" title="Click to sort by sequence identity">Seq. Id.</th>
                    <th class="thin sort-criterion" :class="{'sort-selected':this.sortKey == 'eval', 'sort-down': this.sortOrder < 0, 'default-down': mode == 'lolalign' || mode == 'tmalign'}"
                        @click="changeSortMode('eval')" :title="'Click to sort by '+ scoreColumnName">{{ scoreColumnName }}</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'score', 'sort-down': this.sortOrder < 0}"
                        v-show="tableMode == 1" @click="changeSortMode('score')" title="Click to sort by score">Score</th>
                    <th v-show="tableMode == 1">Query Pos.</th>
                    <th v-show="tableMode == 1">Target Pos.</th>
                    <th v-show="tableMode == 0">
                        Position in query
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
                        <td class="thin" data-label="Query TM-score" :rowspan="hits.results[dbIdx].alignments[groupidx].length">{{ item.complexqtm.toFixed(2) }}</td>
                        <td class="thin" data-label="Target TM-score" :rowspan="hits.results[dbIdx].alignments[groupidx].length"
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
                    <td class="thin" data-label="Probability">{{ item.prob }}</td>
                    <td class="thin" data-label="Sequence Identity">{{ item.seqId }}</td>
                    <td class="thin" :data-label="scoreColumnName">{{ item.eval }}</td>
                    <td class="thin" v-show="tableMode == 1" data-label="Score">{{ item.score }}</td>
                    <td v-show="tableMode == 1" data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                    <td v-show="tableMode == 1" data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                    <td class="graphical" data-label="Position" v-show="tableMode == 0">
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

export default {
    name: 'Top100Foldseek',
    components: {Ruler},
    data() {
        return {
            origIndices: [],
            cachedSortedIndices: {},
            sortKey: 'score',
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
    },
    methods: {
        changeSortMode(key) {
            if (key == this.sortKey) return
            
            this.sortKey = key
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
                select_all_button.classList.toggle('all-selected', this.entryLength == count)
            }
            this.selectedTopEntries = count
        },
        emitForwardDropdown(event, href) {
            this.$emit('forwardDropdown', event, href)
        },
    },
    created() {
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
    computed: {
        entryLength() {
            return this.sortedIndices.length
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
        sortMenuValue() {
            const offset = (this.isComplex ? 2 : 0) 
            switch (this.sortKey) {
                case 'qtm': {
                    return 0
                }
                case 'ttm': {
                    return 1
                }
                case 'prob': {
                    return 0 + offset
                }
                case 'seqId': {
                    return 1 + offset
                }
                case 'eval': {
                    return 2 + offset
                }
                case 'score': {
                    return 3 + offset
                }
                default: {
                    return 3 + offset
                }
            }
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
        sortOrder() {
            if (this.sortKey == 'eval' && (this.mode != 'tmalign' && this.mode != 'lolalign')) return 1
            else return -1
        },
        sortedIndices() {
            // returns sorted indices, calculating on-the-fly
            if (this.cachedSortedIndices[this.sortKey]) {
                return this.cachedSortedIndices[this.sortKey]
            }
            
            let copiedArr = [...this.origIndices]
            let sliced = copiedArr.sort(this.comparator).slice(0, 100)
            this.cachedSortedIndices[this.sortKey] = sliced
            
            return sliced
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
            padding-bottom: 0.5em;
            // min-height: 48px;
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
}
</style>
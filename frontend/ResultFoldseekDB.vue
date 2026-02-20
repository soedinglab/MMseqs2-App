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
                <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                    <div style="width: 24px; display: inline-block;"
                        v-if="!$vuetify.breakpoint.smAndDown"
                    ></div>
                    <v-icon @click="isCollapsed = !isCollapsed"
                        v-if="$vuetify.breakpoint.smAndDown"
                        style="transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);"
                        :style="{'transform': isCollapsed ? 'rotate(-90deg)' : ''}"
                        :title="isCollapsed ? 'Show actions' : 'Hide actions'"
                    >
                        {{ $MDI.ChevronDown }}
                    </v-icon>
                    <span style="text-transform: uppercase;">{{ entry.db }}</span> <small>{{entryLength > 1 ? entryLength.toString() + " hits" : entryLength > 0 ? "1 hit" : "no hit" }}</small>
                </h2>

                <div
                    style="display: flex; justify-content: center; align-items: center;" :style="{'width' : $vuetify.breakpoint.smAndDown ? '100%' : ''}"
                    v-if="!$vuetify.breakpoint.smAndDown || !isCollapsed"
                >
                    <div style="display: flex; justify-content: center; align-items: center;"
                    :style="{'width': $vuetify.breakpoint.smAndDown ? '100%' : '', 'flex-direction': $vuetify.breakpoint.smAndDown ? 'column' : 'row'}">
                        <!-- Button to toggle Sankey Diagram visibility -->
                        <v-btn v-if="hasEntries && entry.hasTaxonomy && !isComplex" @click="toggleSankeyVisibility(entry.db)" :class="{ 'mr-2': $vuetify.breakpoint.mdAndUp , 'mb-2': $vuetify.breakpoint.smAndDown}" large>
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
                                :color="entry.color"
                                :value="sortMenuValue"
                                >
                                <v-list-item v-if="isComplex" @click.stop="changeSortMode('qtm')">
                                    <v-list-item-title>Query TM-score</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'qtm' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item v-if="isComplex" @click.stop="changeSortMode('ttm')">
                                    <v-list-item-title>Target TM-score</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'ttm' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('target')">
                                    <v-list-item-title>Target</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'target' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item v-if="entry.hasDescription" @click.stop="changeSortMode('desc')">
                                    <v-list-item-title>Description</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'desc' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item v-if="entry.hasTaxonomy" @click.stop="changeSortMode('tax')">
                                    <v-list-item-title>Scientific Name</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'tax' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('prob')">
                                    <v-list-item-title>Probability</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'prob' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('seqId')">
                                    <v-list-item-title>Sequence Id.</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'seqId' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('eval')">
                                    <v-list-item-title>{{ this.mode == 'tmalign' ? 'TM-score' : this.mode == 'lolalign' ? 'LOL-score' : 'E-Value' }}</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'eval' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                                <v-list-item @click.stop="changeSortMode('score')">
                                    <v-list-item-title>Score</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == 'score' ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp}}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                            </v-list-item-group>
                        </v-list>
                    </v-menu>
                </div>
            </v-flex>
        </v-sheet>
        <v-flex v-if="hasEntries && entry.hasTaxonomy && isSankeyVisible[entry.db]" class="mb-2">
            <SankeyDiagram :rawData="entry.taxonomyreports[0]" :db="entry.db" :currentSelectedNodeId="localSelectedTaxId" :currentSelectedDb="selectedDb" @selectTaxon="handleSankeySelect"></SankeyDiagram>
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
                    <th :colspan="6 +  entry.hasDescription + entry.hasTaxonomy + ((tableMode == 1) ? 2 : 0)" style="text-align:center; border-bottom: 1px solid #333;">Chain</th>
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
                            @click="changeSortMode('qtm')" title="Click to sort by Query TM-score">qTM</th>
                        <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'ttm', 'sort-down': this.sortOrder < 0}"
                            @click="changeSortMode('ttm')" title="Click to sort by Target TM-score" style="border-right: 1px solid #333; ">tTM</th>
                    </template>
                    <th :class="[`wide-${3 - entry.hasDescription - entry.hasTaxonomy}`, {'sort-selected': this.sortKey == 'target', 'sort-down': this.sortOrder < 0}]" 
                        class="sort-criterion" title="Click to sort by target name" @click="changeSortMode('target')">
                        <template v-if="isComplex">
                            Chain pairing
                        </template>
                        <template v-else>
                            Target
                        </template>
                    </th>
                    <th v-if="entry.hasDescription" class="sort-criterion" :class="{'sort-selected':this.sortKey == 'desc', 'sort-down': this.sortOrder < 0}"
                    @click="changeSortMode('desc')" title="Click to sort by description">
                        Description
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                    </th>
                    <th v-if="entry.hasTaxonomy"  :class="{'sort-selected':this.sortKey == 'tax', 'sort-down': this.sortOrder < 0}" 
                        class="sort-criterion" @click="changeSortMode('tax')" title="Click to sort by scientific name">Scientific Name</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'prob', 'sort-down': this.sortOrder < 0}" 
                        @click="changeSortMode('prob')" title="Click to sort by probability">Prob.</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected':this.sortKey == 'seqId', 'sort-down': this.sortOrder < 0}"
                        @click="changeSortMode('seqId')" title="Click to sort by sequence identity">Seq. Id.</th>
                    <th class="thin sort-criterion" :class="{'sort-selected':this.sortKey == 'eval', 'sort-down': this.sortOrder < 0, 'default-down': mode == 'lolalign' || mode == 'tmalign'}"
                        @click="changeSortMode('eval')" :title="'Click to sort by '+ scoreColumnName">{{ scoreColumnName }}</th> <!-- TODO fixme!! -->
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
                <template v-for="(groupidx, sortIdx) in sortedIndices" >
                <tr v-for="(item, index) in entry.alignments[groupidx]" :class="['hit', { 'active' : item.active }]"
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
                        <td class="thin" data-label="Query TM-score" :rowspan="entry.alignments[groupidx].length">{{ entry.alignments[groupidx][0].complexqtm.toFixed(2) }}</td>
                        <td class="thin" data-label="Target TM-score" :rowspan="entry.alignments[groupidx].length">{{ entry.alignments[groupidx][0].complexttm.toFixed(2) }}</td>
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
                    <td class="thin" data-label="Probability">{{ item.prob }}</td>
                    <td class="thin" data-label="Sequence Identity">{{ item.seqId }}</td>
                    <td class="thin" :data-label="scoreColumnName">{{ item.eval }}</td>
                    <td class="thin" v-show="tableMode == 1" data-label="Score">{{ item.score }}</td>
                    <td v-show="tableMode == 1" data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                    <td v-show="tableMode == 1" data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                    <td class="graphical" data-label="Position" v-show="tableMode == 0">
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
                <tr aria-hidden="true" v-if="isComplex" style="height: 15px" :key="`spacer-${groupidx}`" ></tr>
                </template>
            </tbody>
        </table>
    </div>
</template>

<script>
import Ruler from './Ruler.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import { group } from 'd3';

export default {
    name: 'ResultFoldseekDB',
    mixins: [ ResultSankeyMixin ],
    components: {Ruler},
    data() {
        return {
            toggleTargetValue: true,
            toggleSourceIdx: -1,
            visibilityTable: [],
            selectedDb: "",
            sortKey: 'prob',
            sortOrder: -1,
            isCollapsed: false,
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
            type: Object,
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
    },
    watch: {
        filteredHitsTaxIds: {
            handler(n, o) {
                // this.log(n)
                this.toggleSourceIdx = -1
                let id = ''
                let el = undefined
                if (!n || n.length == 0) {
                    // reset visibility table
                    if (this.visibilityTable) {
                        for (let i = 0; i < this.entryLength; i++) {
                            this.visibilityTable[i] = true
                            id = this.entryidx + "#" + String(i)
                            el = document.getElementById(id)
                            if (el) {
                                el.classList.toggle('invisible', false)
                            }
                        }
                    }
                } else {
                    for (let i = 0; i < this.entryLength; i++) {
                        let target = this.isGroupVisible(this.entry.alignments[i])
                        this.visibilityTable[i] = target
                        id = this.entryidx + '#' + String(i)
                        el = document.getElementById(id)
                        if (el) {
                            el.classList.toggle('invisible', !target)
                        }
                    }
                }
            },
            immediate: false,
            deep: true,
        },
        toggleSourceDb(n, o) {
            if (n != this.db) {
                this.toggleSourceIdx = -1
            }
        },
        entry(n, o) {
            if (n && this.visibilityTable.length == 0) {
                this.visibilityTable = Array(this.entryLength).fill(true)
            }
        }
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
        comparator() {
            let comp = () => {}
            switch (this.sortKey) {
                case 'prob':
                    comp = (a, b) => {
                        let a_max = Math.max(...this.entry.alignments[a].map(e => e.prob))
                        let b_max = Math.max(...this.entry.alignments[b].map(e => e.prob))
                        return this.sortOrder * (a_max - b_max)
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

                case 'seqId':
                    comp = (a, b) => {
                        let a_max = Math.max(...this.entry.alignments[a].map(e => e.seqId))
                        let b_max = Math.max(...this.entry.alignments[b].map(e => e.seqId))
                        return this.sortOrder * (a_max - b_max)
                    }
                    break;
                
                case 'score':
                    comp = (a, b) => {
                        let a_max = Math.max(...this.entry.alignments[a].map(e => e.score))
                        let b_max = Math.max(...this.entry.alignments[b].map(e => e.score))
                        return this.sortOrder * (a_max - b_max)
                    }
                    break;

                case 'eval':
                    // TODO: need to handle tm align and lol align cases, too!
                    comp = (a, b) => {
                        let a_max = Math.max(...this.entry.alignments[a].map(e => e.eval))
                        let b_max = Math.max(...this.entry.alignments[b].map(e => e.eval))
                        return this.sortOrder * (a_max - b_max)
                    }
                    break;

                case 'qtm':
                    comp = (a, b) => {
                        let a_max = Math.max(...this.entry.alignments[a].map(e => e.complexqtm))
                        let b_max = Math.max(...this.entry.alignments[b].map(e => e.complexqtm))
                        return this.sortOrder * (a_max - b_max)
                    }
                    break;

                case 'ttm':
                    comp = (a, b) => {
                        let a_max = Math.max(...this.entry.alignments[a].map(e => e.complexttm))
                        let b_max = Math.max(...this.entry.alignments[b].map(e => e.complexttm))
                        return this.sortOrder * (a_max - b_max)
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
        headHeight() {
            const auxHeight = this.$vuetify.breakpoint.smAndDown && !this.isCollapsed ? 108 : 0
            const padding = this.$vuetify.breakpoint.smAndDown ? 0 : 16
            const taxHeight = this.$vuetify.breakpoint.smAndDown ? 
                this.entry.hasTaxonomy 
                && !this.isComplex ? 0 : -52 : 0
            return String(auxHeight + 64 + padding + taxHeight) + 'px'
        },
        colheadTop() {
            let addend = !this.onlyOne ? 48 : 0
            let breakpointAddend = this.$vuetify.breakpoint.smAndDown ? 108 : 0
            return String(172 + addend + breakpointAddend) + 'px'
        },
        sortMenuValue() {
            const offset = (this.entry.hasDescription ? 1 : 0) 
                + (this.entry.hasTaxonomy ? 1 : 0)
                + (this.isComplex ? 2 : 0)
            switch (this.sortKey) {
                case 'qtm': {
                    return 0
                }
                case 'ttm': {
                    return 1
                }
                case 'target': {
                    return this.isComplex ? 2 : 0
                }
                case 'desc': {
                    return this.isComplex ? 3 : 1
                }
                case 'tax': {
                    return offset
                }
                case 'prob': {
                    return 1 + offset
                }
                case 'seqId': {
                    return 2 + offset
                }
                case 'eval': {
                    return 3 + offset
                }
                case 'score': {
                    return 4 + offset
                }
                default: {
                    return 1 + offset
                }
            }
        }
    },
    methods: {
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
            for (let i in this.sortedIndices) {
                if (delta >= deltaUpperbound) {
                    break
                }
                if (this.visibilityTable[i] && this.selectedStates[i] != value) {
                    arr.push(i)
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
        isGroupVisible(group) {
            if (!this.filteredHitsTaxIds || this.filteredHitsTaxIds.length === 0) {
                return true;
            }
            let taxFiltered = group.filter(item => this.filteredHitsTaxIds.includes(Number(item.taxId)));
            return taxFiltered.length > 0;
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
                        this.sortOrder = 1
                        break
                    case 'prob':
                    case 'seqId':
                    case 'score':
                    case 'qtm':
                    case 'ttm':
                        this.sortOrder = -1
                        break
                    case 'eval':
                        if (this.mode == 'lolalign' || this.mode == 'tmalign') {
                            this.sortOrder = -1
                        } else {
                            this.sortOrder = 1
                        }
                        break
                    default:
                        break;
                }
            }
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
.db {
    border-left: 5px solid black;
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
}
</style>
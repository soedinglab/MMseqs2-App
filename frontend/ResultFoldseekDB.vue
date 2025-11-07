<template>
    <div>
        <v-sheet style="position: sticky; top: 140px; z-index: 99997 !important; padding-bottom: 16px;" 
            :db="entryidx" :class="`result-entry-${entryidx}`" :style="{'height': $vuetify.breakpoint.smAndDown ? '188px' : '80px'}">
            <v-flex class="d-flex" :style="{ 'flex-direction' : $vuetify.breakpoint.smAndDown ? 'column' : null, 'align-items': 'center'}">
            <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                <div style="width: 32px; display: inline-block;"></div>
                <span style="text-transform: uppercase;">{{ entry.db }}</span> <small>{{entryLength > 1 ? entryLength.toString() + " hits" : entryLength > 0 ? "1 hit" : "no hit" }}</small>
            </h2>

            <!-- Button to toggle Sankey Diagram visibility -->
            <v-btn v-if="hasEntries && entry.hasTaxonomy && !isComplex" @click="toggleSankeyVisibility(entry.db)" :class="{ 'mr-2': $vuetify.breakpoint.mdAndUp , 'mb-2': $vuetify.breakpoint.smAndDown}" large>
            <!-- TODO: later, isSankeyVisible should be modified as bool, not an object
              after ResultFoldDisco also is refactored as well. 
            -->
                {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
            </v-btn>
            <v-btn-toggle v-if="hasEntries" mandatory :value="tableMode" @input="switchTableMode" :class="{'mb-2': $vuetify.breakpoint.smAndDown}">
                <v-btn>
                    Graphical
                </v-btn>
                
                <v-btn>
                    Numeric
                </v-btn>
            </v-btn-toggle>
        </v-flex>
        </v-sheet>
        <v-flex v-if="hasEntries && entry.hasTaxonomy && isSankeyVisible[entry.db]" class="mb-2">
            <SankeyDiagram :rawData="entry.taxonomyreports[0]" :db="entry.db" :currentSelectedNodeId="localSelectedTaxId" :currentSelectedDb="selectedDb" @selectTaxon="handleSankeySelect"></SankeyDiagram>
        </v-flex>
        <v-sheet v-if="!hasEntries"><div class="text-h5">No hits found...</div></v-sheet>
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
                :style="{'top': $vuetify.breakpoint.smAndDown ? '328px' : '220px', 
                'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
                <tr v-if="isComplex">
                    <th colspan="1"></th>
                    <th colspan="2" style="text-align:center; width:10%; border-right: 1px solid #333; border-bottom: 1px solid #333;">Complex</th>
                    <th :colspan="6 +  entry.hasDescription + entry.hasTaxonomy + ((tableMode == 1) ? 2 : 0)" style="text-align:center; border-bottom: 1px solid #333;">Chain</th>
                </tr>
                <tr>
                    <th class="thin select-all-th" style="position: relative">
                        <!-- Replaced this checkbox too, for the colored undeterminate state -->
                        <div class="v-input--selection-controls__input select-all" style="user-select: none; 
                            -webkit-user-select: none; cursor: pointer;" @click.stop="toggleDbEntries($event)"
                            title="click to select all the entries" :class="{'any-selected': anySelected, 'all-selected': selectAllStatus}">
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
                        <th class="thin">qTM</th>
                        <th class="thin" style="border-right: 1px solid #333; ">tTM</th>
                    </template>
                    <th :class="'wide-' + (3 - entry.hasDescription - entry.hasTaxonomy)">
                        <template v-if="isComplex">
                            Chain pairing
                        </template>
                        <template v-else>
                            Target
                        </template>
                    </th>
                    <th v-if="entry.hasDescription">
                        Description
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>Triple click to select whole cell (for very long identifiers)</span>
                        </v-tooltip>
                    </th>
                    <th v-if="entry.hasTaxonomy">Scientific Name</th>
                    <th class="thin">Prob.</th>
                    <th class="thin">Seq. Id.</th>
                    <th class="thin">{{ scoreColumnName }}</th>
                    <th class="thin" v-show="tableMode == 1">Score</th>
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
                <template v-for="(group, groupidx) in entry.alignments" >
                <tr v-for="(item, index) in group" :class="['hit', { 'active' : item.active , 'selected' : selectedStates[groupidx]}]" v-if="visibilityTable[groupidx]"
                    @click.stop="$vuetify.breakpoint.width <= 960 ? onCheckboxClick(groupidx, $event) : () => {}">
                    <td v-if="index == 0" :rowspan="group.length" class="entry-checkbox">
                        <!-- performance issue with thousands of v-checkboxes, hardcode the simple checkbox instead -->
                        <div class="v-input--selection-controls__input select-all" 
                        style="user-select: none; -webkit-user-select: none; cursor: pointer;" 
                        @click.stop="onCheckboxClick(groupidx, $event)"
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
                        <td class="thin" data-label="Query TM-score" :rowspan="group.length">{{ group[0].complexqtm.toFixed(2) }}</td>
                        <td class="thin" data-label="Target TM-score" :rowspan="group.length">{{ group[0].complexttm.toFixed(2) }}</td>
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
                            @click.stop="emitForwardDown($event, item.href)"
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
                            :title="item.taxName">
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
                    <td class="alignment-action" :rowspan="isComplex ? group.length : 1" v-if="index == 0">
                        <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                        <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                            <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                        </v-btn> -->
                        <button 
                            @click.stop="showAlignment(group, $event)"
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
                                    <path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path>
                                </svg>
                                </span>
                            </span>
                        </button>
                    </td>
                </tr>
                <tr aria-hidden="true" v-if="isComplex" style="height: 15px"></tr>
                </template>
            </tbody>
        </table>
    </div>
</template>

<script>
import Ruler from './Ruler.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';

export default {
    name: 'ResultFoldseekDB',
    mixins: [ ResultSankeyMixin ],
    components: {Ruler},
    data() {
        return {
            toggleTargetValue: true,
            toggleSourceIdx: -1,
            visibilityTable: [],
            selectedDb: ""
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
            default: null
        },
        closeAlignment: {
            type: Function,
            default: () => {}
        },
    },
    watch: {
        filteredHitsTaxIds: {
            handler(n, o) {
                // this.log(n)
                this.toggleSourceIdx = -1
                if (!n || n.length == 0) {
                    // reset visibility table
                    if (this.visibilityTable) {
                        for (let i = 0; i < this.entryLength; i++) {
                            if (!this.visibilityTable[i]) {
                                this.$set(this.visibilityTable, i, true)
                            }
                        }
                    }
                } else {
                    for (let i = 0; i < this.entryLength; i++) {
                        let target = this.isGroupVisible(this.entry.alignments[i])
                        if (this.visibilityTable[i] != target) {
                            this.$set(this.visibilityTable, i, target)
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
        // toggleSourceIdx(n, o) {
        //     this.log(n)
        // },
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
        isComplex() {
            return this.entry?.alignments?.[0]?.[0]?.complexqtm != null
        },
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
            for (let i = 0; i < this.entryLength; i++) {
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
        emitForwardDropDown(event, href) {
            this.$emit('forwardDropDown', event, href)
        },
        showAlignment(group, event) {
            this.$emit('showAlignment', group, event)
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

            let value = !this.selectedStates[idx]

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
                this.$emit('toggleSelection', idx, value)
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
                if (this.visibilityTable[i] && this.selectedStates[i] != value) {
                    delta += deltaUnit
                    arr.push(i)
                }
            }

            if (delta != 0) {
                this.$emit('bulkToggle', arr, value)
            }
        },
    }
}
</script>

<style lang="scss" scoped>
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

thead.sticky-thead th {
    position: relative;
}

 thead.sticky-thead th::before {
    content: "";
    width: 100%;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.12);
    position: absolute;
    height: 1px;
    display: block;
    z-index: inherit;
}
.theme--dark thead.sticky-thead th::before {
    background-color: rgba(255, 255, 255, 0.12);
}

tr.hit:not(.selected) .entry-checkbox path.checked {
    opacity: 0;
}

tr.hit.selected .entry-checkbox path.unchecked{
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
}

tr.hit.selected .entry-checkbox svg, .select-all.any-selected svg {
    fill: var(--active-color);
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

        tr.hit.selected {
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
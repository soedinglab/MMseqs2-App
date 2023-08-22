<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <template v-if="!hits || !hits.query">
                        <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
                        <small class="ticket">{{ ticket }}</small>
                    </template>
                    <template v-else>
                        <span  class="hidden-sm-and-down">Results:&nbsp;</span>
                        <small class="ticket">{{ hits.query.header }}</small>
                    </template>
                </template>

                <div slot="desc" v-if="resultState == 'PENDING'">
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
                <div slot="desc" v-else-if="resultState == 'EMPTY'">
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
                <div slot="desc" v-else-if="resultState != 'RESULT'">
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

                <template slot="content" v-if="hits && hits.results">
                    <v-tabs
                        :color="selectedDatabases > 0 ? hits.results[selectedDatabases - 1].color : null"
                        center-active
                        grow
                        v-model="selectedDatabases"
                        style="margin-bottom: 2em"
                        show-arrows
                        @change="closeAlignment()"
                        v-if="hits.results.length > 1"
                    >
                        <v-tab>All databases</v-tab>
                        <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db }} ({{ entry.alignments ? entry.alignments.length : 0 }})</v-tab>
                    </v-tabs>
                    <div v-for="(entry, index) in hits.results" :key="entry.db" v-if="selectedDatabases == 0 || (index + 1) == selectedDatabases">
                    <v-flex class="d-flex" :style="{ 'flex-direction' : $vuetify.breakpoint.xsOnly ? 'column' : null }">
                        <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;"><span style="text-transform: uppercase;">{{ entry.db }}</span> <small>{{ entry.alignments ? entry.alignments.length : 0 }} hits</small></h2>
                        <v-btn-toggle mandatory v-model="tableMode" class="ml-auto">
                            <v-btn>
                                Graphical
                            </v-btn>
                    
                            <v-btn>
                                Numeric
                            </v-btn>
                        </v-btn-toggle>
                    </v-flex>

                    <table class="v-table result-table" style="position:relativ; margin-bottom: 3em;">
                        <thead>
                            <tr>
                                <th :class="'wide-' + (3 - entry.hasDescription - entry.hasTaxonomy)">Target</th>
                                <th class="wide-1" v-if="entry.hasDescription">
                                    Description
                                    <v-tooltip open-delay="300" top>
                                        <template v-slot:activator="{ on }">
                                            <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                                        </template>
                                        <span>Triple click to select whole cell (for very long identifiers)</span>
                                    </v-tooltip>
                                </th>
                                <th v-if="entry.hasTaxonomy"  class="wide-1">Scientific Name</th>
                                <th class="thin">Prob.</th>
                                <th class="thin">Seq. Id.</th>
                                <th class="thin">{{ $APP == 'foldseek' && mode == 'tmalign' ? 'TM-score' : 'E-Value' }}</th>
                                <th v-if="tableMode == 1" class="thin">Score</th>
                                <th v-if="tableMode == 1">Query Pos.</th>
                                <th v-if="tableMode == 1">Target Pos.</th>
                                <th v-if="tableMode == 0">
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
                            <tr v-for="(item, index) in entry.alignments" :key="item.target + index" :class="['hit', { 'active' : item.active }]">
                                <td class="long db" data-label="Target" :style="'border-color: ' + entry.color">
                                    <a :id="item.id" class="anchor" style="position: absolute; top: 0"></a>
                                    <a :href="item.href" target="_blank" rel="noopener" :title="item.target">{{item.target}}</a>
                                </td>
                                <td class="long" data-label="Description" v-if="entry.hasDescription">
                                    <span :title="item.description">{{ item.description }}</span>
                                </td>
                                <td v-if="entry.hasTaxonomy" data-label="Taxonomy" class="long"><a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" target="_blank" rel="noopener" :title="item.taxName">{{ item.taxName }}</a></td>
                                <td class="thin" data-label="Probability">{{ item.prob }}</td>
                                <td class="thin" data-label="Sequence Identity">{{ item.seqId }}</td>
                                <td class="thin" :data-label="$APP == 'foldseek' && mode == 'tmalign' ? 'TM-score' : 'E-Value'">{{ item.eval }}</td>
                                <td class="thin" v-if="tableMode == 1" data-label="Score">{{ item.score }}</td>
                                <td class="thin" v-if="tableMode == 1" data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                                <td class="thin" v-if="tableMode == 1" data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                                <td class="graphical" data-label="Position" v-if="tableMode == 0">
                                    <Ruler :length="item.qLen" :start="item.qStartPos" :end="item.qEndPos" :color="item.color" :label="index == 0"></Ruler>
                                </td>
                                <td class="alignment-action thin">
                                    <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                                    <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                                        <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                                    </v-btn> -->
                                    <button 
                                        @click="showAlignment(item, $event)"
                                        type="button"
                                        class="v-btn v-btn--icon v-btn--round v-btn--text v-size--default"
                                        :class="{ 
                                                    'v-btn--outlined' : alignment && item.target == alignment.target,
                                                    'theme--dark' : $vuetify.theme.dark
                                                }"
                                        >
                                        <span class="v-btn__content"><span aria-hidden="true" class="v-icon notranslate theme--dark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg"><path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path></svg></span></span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </template>
                </panel>
            </v-flex>
        </v-layout>
        <portal>
                <panel v-if="alignment != null" class="alignment" :style="'top: ' + alnBoxOffset + 'px'">
                    <AlignmentPanel
                        slot="content"
                        :alignment="alignment"
                        :lineLen="fluidLineLen"
                    />
                </panel>
            </portal>
    </v-container>
</template>

<script>
import Panel from './Panel.vue';
import AlignmentPanel from './AlignmentPanel.vue';
import Ruler from './Ruler.vue';

import { debounce } from './lib/debounce';

function getAbsOffsetTop($el) {
    var sum = 0;
    while ($el) {
        sum += $el.offsetTop;
        $el = $el.offsetParent;
    }
    return sum;
}

export default {
    name: 'result',
    components: { Panel, AlignmentPanel, Ruler },
    data() {
        return {
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0
        }
    },
    props: {
        ticket: "",
        error: "",
        mode: "",
        hits: null,
        tableMode: 0
    },
    created() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
    },
    computed: {
        fluidLineLen() {
            if (this.$vuetify.breakpoint.xsOnly) {
                return 30;
            } else if (this.$vuetify.breakpoint.smAndDown) {
                return 40;
            } else {
                return 80;
            }
        },
        filteredResults() {
            if (!this.hits) {
                return [];
            }
            if (this.selectedDatabases === 0) {
                return this.hits.results;
            }
            return [this.hits.results[this.selectedDatabases - 1]];
        },
        resultState() {
            if (this.hits == null && this.error == "") {
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
        }
    },
    methods: {
        showAlignment(item, event) {
            if (this.alignment == item) {
                this.closeAlignment();
            } else {
                this.alignment = item;
                this.activeTarget = event.target.closest('.hit');
                this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
            }
        },
        closeAlignment() {
            this.alignment = null;
            this.activeTarget = null;
        },
        handleAlignmentBoxResize: debounce(function() {
            if (this.activeTarget != null) {
                this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
            }
        }, 32, false)
    }
};
</script>

<style lang="scss">
@font-face {
font-family: InconsolataClustal;
src: url(assets/InconsolataClustal2.woff2),
     url(assets/InconsolataClustal2.woff);
}

.hide {
    display: none;
}

.db {
    border-left: 5px solid black;
}

@media print, screen and (max-width: 599px) {
small.ticket {
    display: inline-block;
    line-height: 0.9;
}
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

    td, th {
        padding: 0 6px;
        text-align: left;
    }

    .hit.active {
        background: #f9f9f9;
    }

    tbody:hover td[rowspan], tbody tr:hover {
        background: #eee;
    }

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

        tbody:hover td[rowspan], tbody tr:hover {
            background: #333;
        }
    }
}

@media print, screen and (min-width: 961px) {
    .result-table {
        table-layout: fixed;
        border-collapse: collapse;
        width: 100%;
        th.wide-1 {
            width: 15%;
        }
        th.wide-2 {
            width: 30%;
        }

        th.wide-3 {
            width: 45%;
        }
        th.thin {
            width: 6.5% !important;
            white-space: nowrap;
        }
        td.thin {
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

        thead {
            display: none;
        }

        tfoot th {
            border: 0;
            display: inherit;
        }

        tr {
            box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1);
            max-width: 100%;
            position: relative;
            display: block;
            padding: 0.5em;
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

        tr:not(.detail):not(.is-empty):not(.table-footer) td {
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

.alignment {
    position:absolute;
    left:4px;
    right:4px;
    z-index: 999;

    .residues {
        font-family: InconsolataClustal, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
        white-space: pre;
    }

    .theme--dark & {
        .residues {
            color: #fff;
        }
    }
}

.clear-button {
    font: 14px sans-serif;
    cursor: pointer;
}


</style>
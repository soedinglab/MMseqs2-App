<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <template v-if="!hits">
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

                <template slot="content" v-if="hits">
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

import colorScale from './lib/ColorScale';
import { rgb2hsl } from './lib/ColorSpace';
import { debounce } from './lib/debounce';

function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
}

function clamp(a,b,c) {
    return Math.max(b,Math.min(c,a));
}

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
            ticket: "",
            error: "",
            mode: "",
            entry: 0,
            hits: null,
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0,
            tableMode: 0,
        };
    },
    created() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
    },
    mounted() {
        this.fetchData();
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
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
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
        }, 32, false),
        tryLinkTargetToDB(target, db) {
            var res = db.toLowerCase();
            if (res.startsWith("pfam")) {
                return 'https://pfam.xfam.org/family/' + target;
            } else if (res.startsWith("pdb")) {
                return 'https://www.rcsb.org/pdb/explore.do?structureId=' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '').split('_')[0];
            } else if (res.startsWith("uniclust") || res.startsWith("uniprot") || res.startsWith("sprot") || res.startsWith("swissprot")) {
                return 'https://www.uniprot.org/uniprot/' + target;
            } else if (res.startsWith("eggnog_")) {
                return 'http://eggnogdb.embl.de/#/app/results?target_nogs=' + target;
            } else if (res.startsWith("cdd")) {
                return 'https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=' + target;
            }

            if (__APP__ == "foldseek") {
                if (target.startsWith("AF-")) {
                    return 'https://www.alphafold.ebi.ac.uk/entry/' + target.replaceAll(/-F[0-9]+-model_v[0-9]+(\.(cif|pdb))?(\.gz)?(_[A-Z0-9]+)?$/g, '');
                } else if (target.startsWith("GMGC")) {
                    return 'https://gmgc.embl.de/search.cgi?search_id=' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '')
                } else if (target.startsWith("MGYP")) {
                    return 'https://esmatlas.com/explore/detail/' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '')
                }

                if (res.startsWith("cath")) {
                    if (target.startsWith('af_')) {
                        const cath = target.substring(target.lastIndexOf('_') + 1);
                        return "https://www.cathdb.info/version/latest/superfamily/" + cath;
                    } else {
                        return "https://www.cathdb.info/version/latest/domain/"+ target;
                    }
                }
            }

            return null;
        },
        tryFixTargetName(target, db) {
            var res = db.toLowerCase();
            if (__APP__ == "foldseek") {
                if (target.startsWith("AF-")) {
                    return target.replaceAll(/\.(cif|pdb)(\.gz)?(_[A-Z0-9]+)?$/g, '');
                } else if (res.startsWith("pdb") || res.startsWith("gmgc") || res.startsWith("mgyp") || res.startsWith("mgnify")) {
                    return target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '');
                }

                if (res.startsWith("cath")) {
                    if (target.startsWith('af_')) {
                        const match = target.match(/^af_([A-Z0-9]+)_(\d+)_(\d+)_(\d+\.\d+\.\d+\.\d+)$/);
                        if (match && match.length == 5) {
                            return match[4] + ' '  + match[1] + ' ' + match[2] + '-' + match[3];
                        }
                    }
                }
            }
            return target;
        },
        fetchData(entry) {
            this.ticket = this.$route.params.ticket;
            this.entry = this.$route.params.entry;
            this.alignment = null;
            this.$axios.get("api/result/" + this.ticket + '/' + this.entry)
                .then((response) => {
                    this.error = "";
                    const data = response.data;
                    if ("mode" in data) {
                        this.mode = data.mode;
                    }
                    if (data.alignments == null || data.alignments.length > 0) {
                        var color = colorScale();
                        var empty = 0;
                        var total = 0;
                        for (var i in data.results) {
                            var result = data.results[i];
                            result.hasDescription = false;
                            result.hasTaxonomy = false;
                            var db = result.db;
                            result.color = color(db);
                            var colorHsl = rgb2hsl(result.color);
                            if (result.alignments == null) {
                                empty++;
                            }
                            total++;
                            let max = {
                                score: Number.MIN_VALUE,
                                // eval: Number.MIN_VALUE,
                                // prob: Number.MIN_VALUE,
                                // seqId: Number.MIN_VALUE,
                                // qStartPos: Number.MIN_VALUE,
                                // qEndPos: Number.MIN_VALUE,
                                // qLen: Number.MIN_VALUE,
                                // dbStartPos: Number.MIN_VALUE,
                                // dbEndPos: Number.MIN_VALUE,
                                // dbLen: Number.MIN_VALUE,
                            }
                            let min = {
                                score: Number.MAX_VALUE,
                                // eval: Number.MAX_VALUE,
                                // prob: Number.MAX_VALUE,
                                // seqId: Number.MAX_VALUE,
                                // qStartPos: Number.MAX_VALUE,
                                // qEndPos: Number.MAX_VALUE,
                                // qLen: Number.MAX_VALUE,
                                // dbStartPos: Number.MAX_VALUE,
                                // dbEndPos: Number.MAX_VALUE,
                                // dbLen: Number.MAX_VALUE,
                            }
                            for (var j in result.alignments) {
                                let item = result.alignments[j];
                                for (const key in min) {
                                    min[key] = item[key] < min[key] ? item[key] : min[key];
                                    max[key] = item[key] > max[key] ? item[key] : max[key];
                                }
                            }
                            // result.min = min;
                            // result.max = max;
                            for (var j in result.alignments) {
                                var item = result.alignments[j];
                                let split = item.target.split(' ');
                                item.target = split[0];
                                item.description = split.slice(1).join(' ');
                                if (item.description.length > 1) {
                                    result.hasDescription = true;
                                }
                                item.href = this.tryLinkTargetToDB(item.target, db);
                                item.target = this.tryFixTargetName(item.target, db);
                                item.id = 'result-' + i + '-' + j;
                                item.active = false;
                                if (__APP__ != "foldseek" || this.mode != "tmalign") {
                                    item.eval = item.eval.toExponential(2);
                                }
                                if (__APP__ == "foldseek") {
                                    item.prob = item.prob.toFixed(2);
                                    if (this.mode == "tmalign") {
                                        item.eval = item.eval.toFixed(3);
                                    }
                                }
                                if ("taxId" in item) {
                                    result.hasTaxonomy = true;
                                }
                                let r = lerp(min.score/max.score, 1, item.score/max.score);
                                const luminosity = clamp(colorHsl[2] * Math.pow(0.55, -(1 - r)), 0.1, 0.9);
                                item.color = `hsl(${colorHsl[0]}, ${colorHsl[1]*100}%, ${luminosity*100}%)`
                            }
                        }
                        if (total != 0 && empty/total == 1) {
                            this.hits = { results: [] };
                        } else {
                            this.hits = data;
                        }
                    } else {
                        this.error = "Failed";
                        this.hits = [];
                    }
                }, () => {
                    this.error = "Failed";
                    this.hits = [];
                });
        }
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

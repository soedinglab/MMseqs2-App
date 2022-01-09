<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <span class="hidden-sm-and-down">Results for Job:&nbsp;</span><small class="ticket">{{ ticket }}</small>
                </template>

                <template slot="toolbar-extra">
                    <v-toolbar-items>
                        <v-btn class="hide" ref="reset" dark @click="resetZoom" aria-hidden="true">Reset Zoom</v-btn>
                    </v-toolbar-items>
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

                <div slot="content" v-if="resultState == 'RESULT'" ref="hitsParent" style="position:relative;">
                    <div style="position:absolute;top:0;left:0;right:0;bottom:0;">
                        <div class="hits" ref="hits"></div>
                    </div>
                </div>
            </panel>
            </v-flex>
            <v-flex xs12 v-if="hits">
                <panel>
                    <table class="v-table result-table" slot="content" style="position:relative">
                        <thead>
                            <tr>
                                <th class="wide-1">Database</th>
                                <th class="wide-2">
                                    Target
                                    <v-tooltip open-delay="300" top>
                                        <template v-slot:activator="{ on }">
                                            <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                                        </template>
                                        <span>Tripple click to select whole cell (for very long identifiers)</span>
                                    </v-tooltip>
                                </th>
                                <th v-if="taxonomy"  class="wide-1">Scientific Name</th>
                                <th class="thin">Seq. Id.</th>
                                <th class="thin">Score</th>
                                <th>{{ $APP == 'foldseek' && mode == 'tmalign' ? 'TM-score' : 'E-Value' }}</th>
                                <th>Query Pos.</th>
                                <th>Target Pos.</th>
                                <th class="alignment-action">Alignment</th>
                            </tr>
                        </thead>
                        <tbody v-for="entry in hits.results" :key="entry.db">
                            <tr v-for="(item, index) in entry.alignments" :key="item.target + index" :class="['hit', { 'active' : item.active }]">
                                <td data-label="Database" class="db" v-if="index == 0" :rowspan="entry.alignments.length" :style="'border-color: ' + entry.color">{{ entry.db }}</td>
                                <td class="long" data-label="Target">
                                    <a :id="item.id" class="anchor"></a>
                                    <a :href="item.href" target="_blank" rel="noopener">{{item.target}}</a>
                                </td>
                                <td v-if="taxonomy" data-label="Taxonomy" class="long"><a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" target="_blank" rel="noopener" :title="item.taxName">{{ item.taxName }}</a></td>
                                <td data-label="Sequence Identity">{{ item.seqId }}</td>
                                <td data-label="Score">{{ item.score }}</td>
                                <td :data-label="$APP == 'foldseek' && mode == 'tmalign' ? 'TM-score' : 'E-Value'">{{ item.eval }}</td>
                                <td data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                                <td data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                                <td class="alignment-action">
                                    <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                                        <v-icon>{{ $MDI.NotificationClearAll }}</v-icon>
                                    </v-btn>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </panel>
                <panel v-if="alignment != null" class="alignment monospace" :style="'top: ' + alnBoxOffset + 'px'">
                    <div class="alignment-wrapper1" slot="content">
                        <div class="alignment-wrapper2">
                        <span v-for="i in Math.max(1, Math.ceil(alignment.alnLength / lineLen))" :key="i">
<span class="line">
Q&nbsp;{{padNumber(alignment.qStartPos + (i-1)*lineLen, (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;<span class="residues">{{alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)}}</span>
<br>
{{'&nbsp;'.repeat(3+(Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length)}}<span class="residues">{{formatAlnDiff(alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen), alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen))}}</span>
<br>
T&nbsp;{{padNumber(alignment.dbStartPos + (i-1)*lineLen, (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;<span class="residues">{{alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)}}</span>
</span><br>
                        </span>
                        </div>
                    </div>
                </panel>
            </v-flex>
        </v-layout>
    </v-container>
</template>

<script>

import Panel from './Panel.vue';

require('./lib/d3/d3');

import feature from './lib/feature-viewer/feature-viewer.js';
import colorScale from './lib/ColorScale';

function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
}

function clamp(a,b,c) {
    return Math.max(b,Math.min(c,a));
}

function mapPosToSeq(seq, targetPos) {
    var counter = 0;
    var sequencePos = -1;
    for (var i = 0; i < seq.length; i++) {
        if (seq[i] != '-') {
            sequencePos++;
        }
        if (sequencePos == targetPos) {
            break;
        }
        counter++;
    }

    return counter;
}

// cat blosum62.out  | grep -v '^#' | awk 'NR == 1 { for (i = 1; i <= NF; i++) { r[i] = $i; } next; } { col = $1; for (i = 2; i <= NF; i++) { print col,r[i-1],$i; } }' | awk '$3 > 0 && $1 != $2 { printf "\""$1""$2"\",";}'
const blosum62Sim = [ "AG","AS","DE","DN","ED","EK","EQ","FL","FM","FW","FY","GA","HN","HQ","HY","IL","IM","IV","KE","KQ","KR","LF","LI","LM","LV","MF","MI","ML","MV","ND","NH","NQ","NS","QE","QH","QK","QN","QR","RK","RQ","SA","SN","ST","TS","VI","VL","VM","WF","WY","YF","YH","YW"];

var m = null;

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
    components: { Panel },
    data() {
        return {
            ticket: "",
            error: "",
            mode: "",
            entry: 0,
            hits: null,
            alignment: null,
            taxonomy: false,
            alnBoxOffset: 0,
            lineLen: 80,
        };
    },
    created() {
        this.$root.$on('navigation-resize', this.updateWindow);
    },
    beforeDestroy() {
        this.$root.$off('navigation-resize', this.updateWindow);
        this.remove();
    },
    mounted() {
        this.fetchData();
    },
    updated() {
        if (this.$refs.hits) {
            this.setData(this.hits);
        }
    },
    computed: {
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
            
            if (from.hash != to.hash) {
                this.updateActive(to.hash);
            }
        }
    },
    methods: {
        updateWindow() {
            if (m != null) {
                m.updateWindowDebounced();
            }
        },
        padNumber(nr, n, str){
            return Array(n-String(nr).length+1).join(str||'0')+nr;
        },
        formatAlnDiff(seq1, seq2) {
            if (seq1.length != seq2.length) {
                return "";
            }

            var res = ""
            for (var i = 0; i < seq1.length; i++) {
                if (seq1[i] == seq2[i]) {
                    res += seq1[i];
                } else if (blosum62Sim.indexOf(seq1[i] + seq2[i]) != -1) {
                    res += '+';
                } else {
                    res += ' ';
                }
            }
            return res;
        },
        showAlignment(item, event) {
            if (this.alignment == item) {
                this.alignment = null;
            } else {
                this.alignment = item;
            }
            var $el = event.target.closest('.hit');
            // FIXME: dont hardcode navigation bar height (48px)
            this.alnBoxOffset = getAbsOffsetTop($el) + $el.offsetHeight - 48;
        },
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

            if (__APP__ == "foldseek" && target.startsWith("AF-")) {
                return 'https://www.alphafold.ebi.ac.uk/entry/' + target.replaceAll(/-F1-model_v[0-9]+\.(cif|pdb)(\.gz)?(_[A-Z0-9]+)?$/g, '');
            }

            return null;
        },
        tryFixTargetName(target, db) {
            var res = db.toLowerCase();
            if (__APP__ == "foldseek") {
                if (target.startsWith("AF-")) {
                    return target.replaceAll(/\.(cif|pdb)(\.gz)?(_[A-Z0-9]+)?$/g, '');
                } else if (res.startsWith("pdb")) {
                    return target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '');
                }
            }
            return target;
        },
        fetchData(entry) {
            this.remove();
            this.ticket = this.$route.params.ticket;
            this.entry = this.$route.params.entry;
            this.alignment = null;
            this.taxonomy = false;
            this.$http.get("api/result/" + this.ticket + '/' + this.entry)
                .then((response) => {
                    this.error = "";
                    response.json().then((data) => {
                        if ("mode" in data) {
                            this.mode = data.mode;
                        }
                        if (data.alignments == null || data.alignments.length > 0) {
                            var color = colorScale();
                            var empty = 0;
                            var total = 0;
                            for (var i in data.results) {
                                var db = data.results[i].db;
                                data.results[i].color = color(db); 
                                if (data.results[i].alignments == null) {
                                    empty++;
                                }
                                total++;
                                for (var j in data.results[i].alignments) {
                                    var item = data.results[i].alignments[j];
                                    item.href = this.tryLinkTargetToDB(item.target, db);
                                    item.target = this.tryFixTargetName(item.target, db);
                                    item.id = 'result-' + i + '-' + j;
                                    item.active = false;
                                    if (__APP__ != "foldseek" || this.mode != "tmalign") {
                                        item.eval = item.eval.toExponential(3);
                                    }
                                    if ("taxId" in item) {
                                        this.taxonomy = true;
                                    }
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
                    });
                }, () => {
                    this.error = "Failed";
                    this.hits = [];
                });
        },
        remove() {
            if (m != null) {
                m.clearInstance();
                m = null;
            }
        },
        resetZoom() {
            if (m) {
                m.resetAll();
            }
        },
        updateActive(hash) {
            if (typeof (hash) === "undefined" || hash[0] !== '#') {
                return;
            }

            if (hash.startsWith('#result') == false) {
                return;
            }

            var splits = hash.split('-', 3);
            var db = splits[1] | 0;
            var alignment = splits[2] | 0;
            for (var i = 0; i < this.hits.results[db].alignments.length; ++i) {
                if (i == splits[2]) {
                    this.hits.results[db].alignments[i].active = true;
                } else {
                    this.hits.results[db].alignments[i].active = false;
                }
            }
        },
        setData(data) {
            // cannot change reactive elements in here, or setData gets called repeatedly 
            this.remove();
            m = new feature(data.query.header, data.query.sequence, this.$refs.hits, {
                showAxis: true,
                showSequence: true,
                brushActive: true,
                zoomMax: 10,
                onZoom: (ev) => {
                    var $classes = this.$refs.reset.$el.classList;
                    if (ev.zoom > 1) { $classes.remove('hide'); } else { $classes.add('hide'); } 
                },
                onHeightChanged: (newHeight) => {
                    this.$refs.hitsParent.style.minHeight = newHeight + "px";
                }
            });

            var fixSafariSvgLink = function(d, event) {
                if (typeof (d.href) !== "undefined" && d.href.startsWith('#result')) {
                    window.location.hash = d.href;
                }
            }

            var results = data.results;
            for (var res in results) {
                var color = results[res].color;
                var alignments = results[res].alignments;

                var features = [];
                var cnt = 0;

                var maxScore = 0;
                var minScore = Number.MAX_VALUE;
                for (var i in alignments) {
                    var score = Number.parseFloat(alignments[i]["eval"]);
                    if (__APP__ == "foldseek" && this.mode == "tmalign") {
                        score = Math.pow(10, -(10 * score));
                    }
                    if (score >= maxScore) {
                        maxScore = score;
                    }

                    if (score <= minScore) {
                        minScore = score;
                    }
                }

                for (var i in alignments) {
                    var score = Number.parseFloat(alignments[i]["eval"]);
                    if (__APP__ == "foldseek" && this.mode == "tmalign") {
                        score = Math.pow(10, -(10 * score));
                    }
                    var colorHsl = d3.rgb(color).hsl();
                    var r = lerp(minScore/maxScore, 1, score/maxScore);
                    colorHsl.l = clamp(colorHsl.l * Math.pow(0.65, -r), 0.1, 0.9);

                    var reverse = false;
                    var start = alignments[i]["qStartPos"];
                    var end = alignments[i]["qEndPos"]
                    if (start > end) {
                        start = [end, end = start][0];
                        reverse = true;
                    }

                    var prefix = __APP__ == "foldseek" && this.mode == "tmalign" ? "TM" : "E";
                    var f = {
                        "x": mapPosToSeq(data.query.sequence, start),
                        "y": mapPosToSeq(data.query.sequence, end),
                        "description": alignments[i]["target"] + " (" + prefix + ": " + alignments[i]["eval"] + ")",
                        "id": cnt,
                        "color": colorHsl.rgb(),
                        "href": '#' + alignments[i]["id"],
                        "reverse": reverse,
                        "callback" : fixSafariSvgLink
                    }
                    features.push(f);
                    cnt++;
                }

                m.addFeature({
                    data: features,
                    name: results[res].db,
                    className: "test6",
                    color: results[res].color,
                    type: "rect",
                    filter: "type2",
                    shouldSort: false
                });
            }
            m.finishRender();
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
    vertical-align: top;
    line-height: 3.5;
    position: relative;
    background-clip: padding-box;
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
            width: 22% !important;
        }
        th.thin {
            width: 7% !important;
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
        .long {
            word-break: break-word;
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
            margin: 0.25em;
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
            width: auto;
            justify-content: flex-end;
            text-align: right;
            border-bottom: 1px solid #eee;
            // align-items: center;
            white-space: nowrap;
        }
        tr:not(.detail):not(.is-empty):not(.table-footer) td:before {
            content: attr(data-label);
            font-weight: 600;
            margin-right: auto;
            padding-right: 0.5em;
            text-align: left;
            width: 100%;
            word-break: keep-all;
        }
    }
}

.alignment {
    position:absolute;
    left:4px;
    right:0;

    .residues {
        font-family: InconsolataClustal, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
        white-space: pre;
    }

    .alignment-wrapper1 {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .alignment-wrapper2 {
        display:inline-block;
        overflow-x:scroll;
        .line {
            display: inline-block;
            margin-bottom: 0.5em;
            white-space: nowrap;
        }
    }

    .theme--dark & {
        .residues {
            color: #fff;
        }
    }
}

// a:focus {
//     outline:0 !important;
// }

.point {
    fill: #2f225d;
    stroke: #afa2dc;
}

.selected {
    fill: #afa2dc;
    stroke: #2f225d;
}

.clear-button {
    font: 14px sans-serif;
    cursor: pointer;
}

.hits svg {
    font-size: 10px;

    .axis path,
    .axis line {
        fill: none;
        stroke: #000;
        shape-rendering: crispEdges;
    }

    .axis {
        font: 10px sans-serif;
    }

    .yaxis {
        background-color:green;
    }

    path {
        stroke:black;
        fill: transparent;
    }

    .brush .extent{
        stroke: #fff;
        fill-opacity: .125;
        shape-rendering: crispEdges;
    }
}

.theme--dark .hits {
    .axis path, .axis line {
        stroke: #fff;
    }

    path {
        stroke:#fff;
    }

    text {
        fill:#fff;
    }

    text.yaxis {
        fill:#000;
    }

    .brush .extent {
        fill-opacity: .5;
    }
}

</style>

<template>
    <v-container grid-list-md fluid>
        <v-layout row wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <span class="hidden-sm-and-down">Results for Job:&nbsp;</span><small>{{ ticket }}</small>
                </template>

                <template slot="toolbar-extra">
                    <v-toolbar-items>
                        <v-btn class="hide" ref="reset" dark @click="resetZoom" aria-hidden="true">Reset Zoom</v-btn>
                    </v-toolbar-items>
                </template>

                <div slot="desc" v-if="resultState == 'PENDING'">
                    <v-container fill-height grid-list-md>
                        <v-layout row justify-center>
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
                        <v-layout row justify-center>
                            <v-flex xs4>
                                <img style="max-width:100%" src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
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
                        <v-layout row justify-center>
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
                    <table class="table" slot="content" style="position:relative">
                        <thead>
                            <tr>
                                <th>Database</th>
                                <th>Target</th>
                                <th>Sequence Id.</th>
                                <th>Score</th>
                                <th>E-Value</th>
                                <th>Query Pos.</th>
                                <th>Target Pos.</th>
                                <th>Alignment</th>
                            </tr>
                        </thead>
                        <tbody v-for="entry in hits.results" :key="entry.db">
                            <tr class="hit" v-for="(item, index) in entry.alignments" :key="item.target">
                                <td data-label="Database" class="db" v-if="index == 0" :rowspan="entry.alignments.length" :style="'border-color: ' + entry.color">{{ entry.db }}</td>
                                <td data-label="Target">
                                    <a :href="item.href" target="_blank">{{item.target}}</a>
                                </td>
                                <td data-label="Sequence Identity">{{ item.seqId }}</td>
                                <td data-label="Score">{{ item.score }}</td>
                                <td data-label="E-Value">{{ item.eval }}</td>
                                <td data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                                <td data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                                <td>
                                    <v-btn @click="showAlignment(item, $event)" flat :outline="alignment && item.target == alignment.target" icon>
                                        <v-icon>clear_all</v-icon>
                                    </v-btn>
                                </td>
                            </tr>
                        </tbody>
                        <panel v-if="alignment != null" class="alignment" :style="'top: ' + alnBoxOffset + 'px'">
                            <div class="alignment-wrapper1" slot="content">
                                <div class="alignment-wrapper2">
                                <span v-for="i in Math.max(1, (alignment.alnLength / lineLen)|0)" :key="i">
<span class="line">
Q&nbsp;{{padNumber((i-1)*lineLen, (alignment.alnLength+"").length, '&nbsp;')}}&nbsp;<span class="residues">{{alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)}}</span>
<br>
T&nbsp;{{padNumber((i-1)*lineLen, (alignment.alnLength+"").length, '&nbsp;')}}&nbsp;<span class="residues">{{alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)}}</span>
</span><br>
                                </span>
                                </div>
                            </div>
                        </panel>
                    </table>
                </panel>
            </v-flex>
        </v-layout>
    </v-container>
</template>

<script>

import Queries from './Queries.vue'
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

var m = null;

export default {
    name: 'result',
    components: { Queries, Panel },
    data() {
        return {
            ticket: "",
            error: "",
            entry: 0,
            hits: null,
            alignment: null,
            alnBoxOffset: 0,
            lineLen: 80,
        };
    },
    beforeDestroy() {
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
        '$route': 'fetchData'
    },
    methods: {
        padNumber(nr, n, str){
            return Array(n-String(nr).length+1).join(str||'0')+nr;
        },
        showAlignment(item, event) {
            if (this.alignment == item) {
                this.alignment = null;
            } else {
                this.alignment = item;
            }
            var $el = event.target.closest('.hit');
            this.alnBoxOffset = $el.offsetTop + $el.offsetHeight + 1;
        },
        tryLinkTargetToDB(target, db) {
            var res = db.toLowerCase();
            if (res.startsWith("pfam")) {
                return 'https://pfam.xfam.org/family/' + target;
            } else if (res.startsWith("pdb")) {
                return 'https://www.rcsb.org/pdb/explore.do?structureId=' + target.split('_')[0];
            } else if (res.startsWith("uniclust") || res.startsWith("uniprot") || res.startsWith("sprot") || res.startsWith("swissprot")) {
                return 'https://www.uniprot.org/uniprot/' + target;
            } else if (res.startsWith("eggnog_")) {
                return 'http://eggnogdb.embl.de/#/app/results?target_nogs=' + target;
            }
            return null;
        },
        fetchData(entry) {
            this.ticket = this.$route.params.ticket;
            this.entry = this.$route.params.entry;

            this.$http.get("api/result/" + this.ticket + '/' + this.entry)
                .then((response) => {
                    this.error = "";
                    response.json().then((data) => {
                        if (data.alignments == null || data.alignments.length > 0) {
                            var color = colorScale();
                            for (var i in data.results) {
                                var db = data.results[i].db;
                                data.results[i].color = color(db);
                                for (var j in data.results[i].alignments) {
                                    var item = data.results[i].alignments[j];
                                    item.href = this.tryLinkTargetToDB(item.target, db);
                                }
                            }
                            this.hits = data;
                        } else {
                            this.error = "Failed";
                        }
                    });
                }, () => {
                    this.error = "Failed";
                });
        },
        remove() {
            if (m != null) {
                m.off();
                m.clearInstance();
                m = null;
            }
        },
        resetZoom() {
            if (m) {
                m.resetAll();
            }
        },
        setData(data) {
            // cannot change reactive elements in here, or setData gets called repeatedly 
            this.remove();
            m = new feature(data.query.header, data.query.sequence, this.$refs.hits, {
                showAxis: true,
                showSequence: true,
                brushActive: true,
                zoomMax: 10
            });

            m.on('feature-viewer-zoom-altered', (ev) => {
                var $classes = this.$refs.reset.$el.classList;
                if (ev.zoom > 1) { $classes.remove('hide'); } else { $classes.add('hide'); } 
            });

            m.on('feature-viewer-height-altered', (ev) => {
                this.$refs.hitsParent.style.minHeight = ev.newHeight + "px";
            });

            var results = data.results;
            for (var res in results) {
                var color = results[res].color;
                var alignments = results[res].alignments;

                var features = []
                var cnt = 0;

                var maxScore = 0;
                var minScore = Number.MAX_VALUE;
                for (var i in alignments) {
                    var score = alignments[i]["eval"];
                    if (score >= maxScore) {
                        maxScore = score;
                    }

                    if (score <= minScore) {
                        minScore = score;
                    }
                }

                for (var i in alignments) {
                    var score = alignments[i]["eval"];
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

                    var f = {
                        "x": mapPosToSeq(data.query.sequence, start),
                        "y": mapPosToSeq(data.query.sequence, end),
                        "description": alignments[i]["target"] + " (E: " + alignments[i]["eval"] + ")",
                        "id": cnt,
                        "color": colorHsl.rgb(),
                        "href": alignments[i]["href"],
                        "reverse": reverse
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
        }
    }
};
</script>

<style>
@font-face {
font-family: InconsolataClustal;
src: url(assets/InconsolataClustal2.woff2),
     url(assets/InconsolataClustal2.eot),
     url(assets/InconsolataClustal2.woff);
}

.hide {
    display: none;
}

.db {
    border-left: 5px solid black;
    vertical-align: top;
    line-height: 3.5;
}

a:not([href]) {
    color: #333;
}

a:not([href]):hover {
    text-decoration: none;
}

td, th {
    padding: 0 6px;
    text-align: left;
}

@media screen and (max-width: 960px) {
.hits {
    min-width: 300px;
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
}
tr:not(.detail):not(.is-empty):not(.table-footer) td:before {
content: attr(data-label);
font-weight: 600;
margin-right: auto;
padding-right: 0.5em;
text-align: left;
}

}

.alignment {
position:absolute;
left:4px;
right:0;
font-family: 'Courier New', Courier, monospace;
}

.alignment .residues {
font-family: InconsolataClustal, 'Courier New', Courier, monospace;
}

.alignment-wrapper1 {
display: flex;
justify-content: center;
align-items: center;
}

.alignment-wrapper2 {
display:inline-block;
overflow-x:scroll;
}

.alignment-wrapper2 .line {
    display: inline-block;
    margin-bottom: 0.5em;
    white-space: nowrap;
}

.variant{
    stroke:rgba(0,255,154,0.6);
    stroke-width:1px;
}

a:focus {
    outline:0 !important;
}

.brush .extent{
    stroke: #fff;
    fill-opacity: .125;
    shape-rendering: crispEdges;
}


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

.axis path,
.axis line {
    fill: none;
    stroke: #000;
    shape-rendering: crispEdges;
}

.axis {
    font: 10px sans-serif;
}
.d3-tip {
    line-height: 1;
    font-weight: bold;
    padding: 12px;
/*    background: rgba(0, 0, 0, 0.8);*/
    background: #eee;
/*    color: #fff;*/
    color: black;
    border-radius: 2px;
}

.tooltip2:after {
    box-sizing: border-box;
    display: inline;
    font-size: 10px;
    line-height: 1;
    color: #eee;
    content: "\25BC";
    position: absolute;
    text-align: left;
    margin: -1px 0 0 0;
    top: 98%;
    left: 10px;
}

.tooltip2:before {
    box-sizing: border-box;
    display: inline;
    font-size: 10px;
    line-height: 1;
    color: rgba(0, 0, 0, 0.6);
    content: "\25BC";
    position: absolute;
    text-align: left;
    margin: -1px 0 0 0;
    top: 99%;
    left: 10px;
}
.tooltip3:after {
    box-sizing: border-box;
    display: inline;
    font-size: 10px;
    line-height: 1;
    color: #eee;
    content: "\25BC";
    position: absolute;
    text-align: right;
    margin: -1px 0 0 0;
    top: 98%;
    right: 10px;
}
.tooltip3:before {
    box-sizing: border-box;
    display: inline;
    font-size: 10px;
    line-height: 1;
    color: rgba(0, 0, 0, 0.6);
    content: "\25BC";
    position: absolute;
    text-align: right;
    margin: -1px 0 0 0;
    top: 99%;
    right: 10px;
}

.yaxis{
    background-color:green;
}

.header-help .state{
    min-width:26px;
    display:inline-block;
}

.header-help:hover{
    cursor: pointer;
    text-decoration: none;
}

.popover-title{
    text-align: center;
}

.hits svg {
    font-size: 10px;
}

.hits svg path {
    stroke:black;
    fill: transparent;
}
</style>

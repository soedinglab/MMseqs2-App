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
                <table class="table" slot="content">
                        <thead>
                            <tr>
                                <th>Database</th>
                                <th>Target</th>
                                <th>Sequence Id.</th>
                                <th>Score</th>
                                <th>E-Value</th>
                                <th>Query Pos.</th>
                                <th>Target Pos.</th>
                            </tr>
                        </thead>
                        <tbody v-for="entry in hits.results" :key="entry.db">
                            <tr v-for="(item, index) in entry.alignments" :key="index">
                                <td data-label="Database" class="db" v-if="index == 0" :rowspan="entry.alignments.length" :style="'border-color: ' + entry.color">{{ entry.db }}</td>
                                <td data-label="Target">
                                    <a :href="item.href" target="_blank">{{item.target}}</a>
                                </td>
                                <td data-label="Sequence Identity">{{ item.seqId }}</td>
                                <td data-label="Score">{{ item.score }}</td>
                                <td data-label="E-Value">{{ item.eval }}</td>
                                <td data-label="Query Pos">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                                <td data-label="Target Pos.">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                            </tr>
                        </tbody>
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

            var hasResult = this.hits.results.length > 0;
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
        tryLinkTargetToDB(target, db) {
            if (db.startsWith("pfam_")) {
                return 'https://pfam.xfam.org/family/' + target;
            } else if (db.startsWith("pdb")) {
                return 'https://www.rcsb.org/pdb/explore.do?structureId=' + target.split('_')[0];
            } else if (db.startsWith("uniclust") || db.startsWith("uniprot")) {
                return 'https://www.uniprot.org/uniprot/' + target;
            } else if (db.startsWith("eggnog_")) {
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
                
                    var f = {
                        "x": mapPosToSeq(data.query.sequence, alignments[i]["qStartPos"]),
                        "y": mapPosToSeq(data.query.sequence, alignments[i]["qEndPos"]),
                        "description": alignments[i]["target"] + " (e-value: " + alignments[i]["eval"] + ")",
                        "id": cnt,
                        "color": colorHsl.rgb(),
                        "href": alignments[i]["href"]
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
.hide {
    display: none;
}

.db {
    border-left: 5px solid black;
}

a:not([href]) {
    color: #333;
}

a:not([href]):hover {
    text-decoration: none;
}

td, th {
    padding: 0 6px;
}

@media screen and (max-width: 960px) {
.hits {
    max-width: 533px;
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

/*Creates a small triangle extender for the tooltip - left*/
.tooltip2:after {
    box-sizing: border-box;
    display: inline;
    font-size: 10px;
    line-height: 1;
/*    color: rgba(0, 0, 0, 0.8);*/
    color: #eee;
    content: "\25BC";
    position: absolute;
    text-align: left;
    margin: -1px 0 0 0;
    top: 98%;
    left: 10px;
}
/*Creates a small triangle extender for the tooltip - left */
.tooltip2:before {
    box-sizing: border-box;
    display: inline;
    font-size: 10px;
    line-height: 1;
    color: rgba(0, 0, 0, 0.6);
/*    color: #333;*/
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
/*    color: rgba(0, 0, 0, 0.8);*/
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
/*    color: #eee;*/
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
/*
.header-help{
    color: #C50063;
    color: #108D9F;
    border-color:#0F8292;
}*/
.header-help .state{
    min-width:26px;
    display:inline-block;
}

.header-help:hover{
/*    color: #98004C;*/
/*    color: #0F8292;*/
    cursor: pointer;
    text-decoration: none;
}
/*
.header-help:focus{
color: #0F8292;
}
*/
.popover-title{
    text-align: center;
/*    background-color: rgba(197, 0, 99, 0.1);*/
}

.db {
    vertical-align: top;
    line-height: 3.5;
}
</style>

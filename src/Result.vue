<template>
    <v-container grid-list-md fluid full-height>
        <v-layout row>
            <v-flex xs12>
<panel>
	<template slot="header">
		Results for Job:&nbsp;<small>{{ ticket }}</small>
	</template>

	<template slot="toolbar-extra">
		<v-toolbar-side-icon class="hidden-md-and-up"></v-toolbar-side-icon>
		<v-toolbar-items class="hidden-sm-and-down">
			<v-btn v-if="zoom" dark @click="resetZoom" aria-hidden="true">Reset Zoom</v-btn>
		</v-toolbar-items>
        </v-toolbar>
		<!-- <popover effect="fade" placement="bottom" content="The target hits are shown here.">
			<button class="btn btn-default help" role="button">
				<span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span>
			</button>
		</popover> -->
	</template>

	<v-btn slot="extrabutton" flat rel="external noopener" target="_blank" href="https://mmseqs.com">adsasdsd MMseqs2</v-btn>

	<div slot="desc" v-if="resultState == 'PENDING'">
		<!-- <grid-loader class="loader" color="#000000"></grid-loader> -->
	</div>
	<div slot="desc" v-else-if="resultState == 'EMPTY'">
		No hits found! Start a <v-btn to="/">New Search</v-btn>?
	</div>
	<div slot="desc" v-else-if="resultState != 'RESULT'">
		Error! Start a <v-btn to="/">New Search</v-btn>?
	</div>

	<div slot="content" v-if="resultState == 'RESULT'">
        <div ref="hits"></div>

		<table class="table">
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
					<td class="db" v-if="index == 0" :rowspan="entry.alignments.length" :style="'border-color: ' + entry.color">{{ entry.db }}</id>
					<td>
						<a :href="item.href" target="_blank">{{item.target}}</a>
					</td>
					<td>{{ item.seqId }}</td>
					<td>{{ item.score }}</td>
					<td>{{ item.eval }}</td>
					<td>{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
					<td>{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
				</tr>
			</tbody>
		</table>
	</div>
</panel>
</v-flex>
</v-layout>
</v-container>
</template>

<script>

import Queries from './Queries.vue'
import colorScale from './ColorScale';
import Panel from './Panel.vue';

import feature from './lib/feature-viewer/feature-viewer.js';

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

export default {
	name: 'result',
	components: { Queries, Panel },
	data() {
		return {
			ticket: "",
			error: "",
			entry: 0,
			hits: null,
			zoom: false,
            m: null,
		};
	},
	beforeDestroy() {
        this.remove();
    },
	created() {
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

			return "EMPTY";
		}
	},
	watch: {
		'$route': 'fetchData'
	},
	methods: {
		tryLinkTargetToDB(target, db) {
			if (db.startsWith("pfam_")) {
				return 'http://pfam.xfam.org/family/' + target;
			} else if (db.startsWith("pdb")) {
				return 'http://www.rcsb.org/pdb/explore.do?structureId=' + target.split('_')[0];
			} else if (db.startsWith("uniclust")) {
				return 'http://www.uniprot.org/uniprot/' + target;
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
            if (this.m != null) {
                this.m.off();
                this.m.clearInstance();
                this.m = null;
            }
        },
        resetZoom() {
            if (this.m) {
                this.m.resetZoom();
                this.zoom = false;
            }
        },
        setData(data) {
            this.remove();
            this.m = new feature(data.query.header, data.query.sequence, this.$refs.hits, {
                showAxis: true,
                showSequence: true,
                brushActive: true,
                zoomMax: 10
            });

            this.m.on('feature-viewer-zoom-altered', () => this.zoom = true);

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
                    // console.log(colorHsl.l);
                
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

                this.m.addFeature({
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
    width: 100%;
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
    width: 100%;
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
    width: 100%;
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
    width: 100%;
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

.header-help{
/*    color: #C50063;*/
/*
    color: #108D9F;
    border-color:#0F8292;
*/
}
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

.header-help:focus{
/*    color: #0F8292;*/
}

.popover-title{
    text-align: center;
/*    background-color: rgba(197, 0, 99, 0.1);*/
}
</style>

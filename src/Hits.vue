<template>
    <div class="panel panel-default hits">
        <div class="panel-heading">
            <h2 class="panel-title pull-left">Hit Visualization</h2>
    
            <div class="btn-toolbar" role="toolbar" aria-label="toolbar">
                <div class="btn-group pull-right">
                    <popover effect="fade" placement="bottom" content="The target hits are shown here.">
                        <button class="btn btn-default help" role="button">
                            <span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span>
                        </button>
                    </popover>
                </div>
                <div class="btn-group pull-right">
                    <button v-if="zoom" @click="resetZoom" class="btn btn-default" aria-hidden="true">Reset</button>
                </div>
            </div>
        </div>
    
        <div class="panel-body" style="padding:0">
            <div ref="hits"></div>
        </div>
    </div>
</template>

<script>

import Popover from 'vue-strap/Popover.vue';
import Dropdown from 'vue-strap/Dropdown.vue';

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
    props: ['ticket'],
    components: { Dropdown, Popover },
    data() {
        return {
            zoom: false,
            m: null,
        };
    },
    mounted() {

    },
    beforeDestroy() {
        this.remove();
    },
    destroyed() {
        
    },
    methods: {
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

            this.$refs.hits.addEventListener('feature-viewer-zoom-altered', function() {
                console.log('zoom');
            });

            this.m.on('feature-viewer-zoom-altered', () => this.zoom = true )

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
}
</script>

<<style>
.variant{
    stroke:rgba(0,255,154,0.6);
    stroke-width:1px;
}

a:focus {
    outline:0 !important;
}

.active {
    z-index: 1;
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

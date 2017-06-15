<template>
    <div class="panel panel-default msa">
        <div class="panel-heading">
            <h2 class="panel-title pull-left">Hit Visualization</h2>
    
            <div class="btn-toolbar"
                 role="toolbar"
                 aria-label="toolbar">
    
                <div class="btn-group pull-right">
    
                    <popover effect="fade"
                             placement="bottom"
                             content="The MSA shows a filtered alignment of your target hits.">
                        <button class="btn btn-default help"
                                role="button"><span class="glyphicon glyphicon-question-sign"
                                  aria-hidden="true"></span></button>
                    </popover>
                </div>
                <div class="btn-group pull-right">
    
                    <button v-if="selection && !plaintext"
                            @click="clear"
                            class="btn btn-default"
                            aria-hidden="true">Clear Selection</button>
    
                    <div v-if="showplaintext">
                    <button v-if="plaintext"
                            class="btn btn-default"
                            @click="showFancy">Show Fancy</button>
                    <button v-else
                            class="btn btn-default"
                            @click="showPlain">Show Plain</button>
                    </div>

                    <div v-if="showoverview">
                    <button v-if="overview"
                            v-show="!plaintext"
                            class="btn btn-default"
                            @click="hideOverview">Hide Overview</button>
                    <button v-else
                            v-show="!plaintext"
                            class="btn btn-default"
                            @click="showOverview">Show Overview</button>
                    </div>

                    <div v-if="showexport">
                    <dropdown text="Export">
                        <ul slot="dropdown-menu"
                            class="dropdown-menu pull-right">
                            <li><a v-if="msaDownloadUrl"
                                   :download="'msa-' + ticket + '.fasta'"
                                   :href="msaDownloadUrl">Download MSA</a></li>
                            <li><a @click="exportSelection"
                                   v-if="selection && !plaintext"
                                   href="#">Export Selection</a></li>
                        </ul>
                    </dropdown>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="panel-body"
             style="padding:5px 2px">
            <pre v-show="plaintext">{{ msa }}</pre>
            <div v-show="!plaintext"
                 ref="msa">
            </div>
        </div>
    </div>
</template>

<script>
import Dropdown from '../node_modules/vue-strap/src/Dropdown.vue';
import Popover from '../node_modules/vue-strap/src/Popover.vue';
import msa from 'msa';

function mapPosToSeq(seq, targetPos) {
    var counter = 0;
    var sequencePos = -1;
    for (var i = 0; i < seq.length; i++) {
        if(seq[i] != '-') {
            sequencePos++;
        }
        if(sequencePos == targetPos) {
            break;
        }
        counter++;
    }

    return counter;
}

function colors(s) {
  return s.match(/.{6}/g).map(function(x) {
    return "#" + x;
  });
}
const schemeColor20 = colors("1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5");

var index = [];
var idx = 1;
function scaleColor20(d) {
    var key = d + "";
    var i = index[key];
    if (!i) {
      i = index[key] = idx++;
    }
    return schemeColor20[(i - 1) % schemeColor20.length];
}

var fasta = msa.io.fasta;
export default {
    props: ['msa', 'ticket'],
    components: { Dropdown, Popover },
    data() {
        return {
            showplaintext: false,
            showoverview: false,
            showexport: false,
            selection: false,
            plaintext: false,
            overview: false,
            m: {}
        };
    },
    computed: {
        queryFasta() {
            return "> " + this.msa.query.header + this.msa.query.sequence;
        },
        msaDownloadUrl() {
            var blob = new Blob([this.queryFasta], { type: 'application/octet-binary' });
            return URL.createObjectURL(blob);
        }
    },
    mounted() {
        var seqs = fasta.parse(this.queryFasta);
        this.m = new msa({
            el: this.$refs.msa,
            conf: {
                hasRef: true
            },
            vis: {
                seqlogo: false,
                labelId: false
            },
            seqs: seqs
        });
        this.m.render();
        this.m.g.selcol.on("add reset change", () => {
            this.selection = this.m.g.selcol.length
        });

        window.addEventListener('resize', this.resize);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.resize)
    },
    watch: {
        msa() {
            var seqs = fasta.parse(this.queryFasta);
            this.m.seqs.reset(seqs);

            var Feature = msa.model.feature;
            var features = [];
            var cnt = 0;
            var results = this.msa.results;
            for (var res in results) {
                var db = this.msa.results[res].db;
                var alignments = this.msa.results[res].alignments;
                for (var i in alignments) {
                    console.log(alignments[i])
                    var f = {
                        "xStart" : mapPosToSeq(this.msa.query.sequence, alignments[i]["dbStartPos"]) - 1,
                        "xEnd"   : mapPosToSeq(this.msa.query.sequence, alignments[i]["dbEndPos"]) - 1,
                        "text"   : alignments[i]["target"] + " (" + alignments[i]["dbStartPos"] + "-" + alignments[i]["dbEndPos"]  + ", E-Value: " + alignments[i]["eval"] +  ")",
                        "row"    : cnt,
                        "type"   : "",
                    }
                    var feature = new Feature(f);
                    feature.set('fillColor', scaleColor20(db));
                    features.push(feature);
                    cnt++;
                }
            }

            index = [];
            idx = 1;
    
            if (features.length > 0) {
                var col = new msa.model.featurecol(features);
                this.m.seqs.at(0).set("features", col);
                this.m.seqs.at(0).set("height", col.getCurrentHeight() + 1);
            }
        },
    },
    destroyed() {
        msa.$(this.$refs.msa).off().empty();
    },
    methods: {
        // hack, msa doesn't update after in the multiquery case and is too wide
        fixWidth() {
            this.m.g.zoomer.set('alignmentWidth', 'auto');
        },
        clear() {
            this.m.g.selcol.reset();
        },
        exportSelection() {
            var suffix = '';
            for (var i = 0; i < this.m.g.selcol.length; ++i) {
                var seqId = this.m.g.selcol.at(i).attributes.seqId;
                suffix = suffix + "-" + this.m.seqs.at(seqId).attributes.name;
            }

            msa.utils.exporter.saveSelection(this.m, this.ticket + suffix + ".fasta");
        },
        showOverview() {
            this.overview = true;
            this.m.g.vis.set('overviewbox', true);
            // setTimeout(function () {
            //     $('.biojs_msa_overviewbox').wrap('<div class="biojs_msa_overviewbox_wrapper" />')
            // }, 100);
        },
        hideOverview() {
            this.overview = false;
            this.m.g.vis.set('overviewbox', false);
        },
        showNames() {
            this.names = true;
            // var seqClone = JSON.parse(JSON.stringify(seqs));
            // var originalScheme = m.g.colorscheme.get("scheme");
            // if (namesShown) {
            //     m.g.vis.set("seqlogo", false);
            //     m.g.colorscheme.set("scheme", "fail");
            //     for (var i = 0; i < seqs.length; ++i) {
            //         seqClone[i].seq = seqs[i].pName;
            //     }
            //     m.seqs.reset(seqClone);
            // } else {
            //     m.g.vis.set("seqlogo", true);
            //     m.g.colorscheme.set("scheme", originalScheme);
            //     for (var i = 0; i < m.seqs.length; ++i) {
            //         seqClone[i].seq = seqs[i].seq;
            //     }
            //     m.seqs.reset(seqClone);
            // }
        },
        hideNames() {
            this.names = false;
        },
        showFancy() {
            this.plaintext = false;
        },
        showPlain() {
            this.plaintext = true;
        },
        resize() {
            var width = parseInt(window.getComputedStyle(this.$refs.msa).width);
            var residues = this.m.seqs.at(0).get("seq").length;
            if (residues / 2 > width && residues <= width) {
                this.m.g.zoomer.set("boxRectWidth", 1);
                this.m.g.zoomer.set("boxRectHeight", 1);
            } else if (residues > width) {
                var ratio = width / residues;
                this.m.g.zoomer.set("boxRectWidth", ratio);
                this.m.g.zoomer.set("boxRectHeight", ratio);
            }
        }
    }
}
</script>

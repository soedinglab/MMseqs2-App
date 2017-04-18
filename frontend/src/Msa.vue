<template>
    <div class="panel panel-default msa">
        <div class="panel-heading">
            <h2 class="panel-title pull-left">Multiple Sequence Alignment</h2>
    
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
    
                    <button v-if="plaintext"
                            class="btn btn-default"
                            @click="showFancy">Show Fancy</button>
                    <button v-else
                            class="btn btn-default"
                            @click="showPlain">Show Plain</button>
    
                    <button v-if="overview"
                            v-show="!plaintext"
                            class="btn btn-default"
                            @click="hideOverview">Hide Overview</button>
                    <button v-else
                            v-show="!plaintext"
                            class="btn btn-default"
                            @click="showOverview">Show Overview</button>
    
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

var fasta = msa.io.fasta;
export default {
    props: ['msa', 'ticket'],
    components: { Dropdown, Popover },
    data() {
        return {
            selection: false,
            plaintext: false,
            overview: false,
            m: {}
        };
    },
    computed: {
        msaDownloadUrl() {
            var blob = new Blob([this.msa], { type: 'application/octet-binary' });
            return URL.createObjectURL(blob);
        }
    },
    mounted() {
        var seqs = fasta.parse(this.msa);
        this.m = new msa({
            el: this.$refs.msa,
            conf: {
                hasRef: true
            },
            vis: {
                seqlogo: true,
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
        msa(msa) {
            var seqs = fasta.parse(this.msa);
            this.m.seqs.reset(seqs);
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

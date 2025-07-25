<template>
    <v-container grid-list-md fluid pa-2>
        <v-layout wrap>
            <v-flex xs12>
            <panel>
                <template slot="header">
                    <template v-if="!$LOCAL && (!hits || !hits.query)">
                        <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
                        <small class="ticket">{{ ticket }}</small>
                    </template>
                    <template v-else-if="hits">
                        <span  class="hidden-sm-and-down">Results:&nbsp;</span>
                        <small class="ticket">{{ hits.query.header }}</small>
                    </template>
                </template>

                <div slot="desc" v-if="!$LOCAL && resultState == 'PENDING'">
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
                <div slot="desc" v-else-if="!$LOCAL && resultState == 'EMPTY'">
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
                <div slot="desc" v-else-if="!$LOCAL && resultState != 'RESULT'">
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

                <template slot="content" v-if="resultState == 'RESULT' && hits && hits.results">
                    <!-- hack to get a menu that can be used from outside the list -->
                    <!-- we don't want to make potentially thousands of menus -->
                    <v-menu offset-y ref="menuwrapper" absolute style="z-index: 99999 !important;">
                        <template v-slot:activator="{ on: activation, attrs: attrs }">
                            <div style="display: none">{{ menuActivator = activation }}</div>
                        </template>
                        <v-list>
                            <v-list-item two-line
                                v-for="(item, index) in menuItems"
                                :key="index"
                                :href="item.href"
                                target="_blank"
                                rel="noopener"
                                >
                                <v-list-item-content>
                                    <v-list-item-title>{{ item.label }}</v-list-item-title>
                                    <v-list-item-subtitle>
                                        {{ item.accession }}
                                    </v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                    <v-tabs
                        :color="selectedDatabases > 0 ? hits.results[selectedDatabases - 1].color : null"
                        center-active
                        grow
                        v-model="selectedDatabases"
                        style="margin-bottom: 2em"
                        show-arrows
                        @change="handleChangeDatabase()"
                        v-if="hits.results.length > 1"
                    >
                        <v-tab>All databases</v-tab>
                        <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db.replaceAll(/_folddisco$/g, '') }} ({{ entry.alignments ? Object.values(entry.alignments).length : 0 }})</v-tab>
                    </v-tabs>
                    <div v-for="(entry, index) in hits.results" :key="entry.db" v-if="selectedDatabases == 0 || (index + 1) == selectedDatabases">
                    <v-flex
                        class="d-flex"
                        :style="{
                            'flex-direction' : $vuetify.breakpoint.xsOnly ? 'column' : 'row',
                            'align-items': 'center',
                            'flex': '0',
                            'white-space': 'nowrap',
                        }">
                        <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                            <span style="text-transform: uppercase;">{{ entry.db.replaceAll(/_folddisco$/g, '') }}</span> <small>{{ entry.alignments ? Object.values(entry.alignments).length : 0 }} hits</small>
                        </h2>
                        <v-btn v-if="entry.hasTaxonomy" @click="toggleSankeyVisibility(entry.db)" large>
                            {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
                        </v-btn>
                    </v-flex>

                    <v-flex class="d-flex flex-row" style="gap: 24px">
                        <div style="flex-basis: 100%;">
                            <h3>Filter</h3>
                            <motif-filter
                                :items="dbGaps[entry.db]"
                                :value="gapFilter[entry.db] ? gapFilter[entry.db] : ''"
                                @input="$set(gapFilter, entry.db, $event)"
                                @click:clear="$set(gapFilter, entry.db, '')"
                                :queryresidues="entry.queryresidues"
                                :color="entry.color"
                            >
                            </motif-filter>
                        </div>
                        <div style="flex-basis: 100%;">
                            <h3>Cluster</h3>
                            <folddisco-hit-cluster :hits="entry" v-on:cluster="$set(clusters, entry.db, $event)"></folddisco-hit-cluster>
                        </div>
                    </v-flex>
                    <v-flex v-if="entry.hasTaxonomy && isSankeyVisible[entry.db]">
                        <SankeyDiagram :rawData="entry.taxonomyreports[0]" :db="entry.db" :currentSelectedNodeId="localSelectedTaxId" :currentSelectedDb="selectedDb" @selectTaxon="handleSankeySelect"></SankeyDiagram>
                    </v-flex>

                    <table class="v-table result-table" style="position:relativ; margin-bottom: 3em;">
                        <colgroup>
                            <col style="width: 20%;" /> <!-- target -->
                            <col v-if="entry.hasDescription" style="width: 30%;" /> 
                            <col v-if="entry.hasTaxonomy" style="width: 20%;" />
                            <col style="width: 10%;" /> <!-- idf-score --> 
                            <col style="width: 10%;" /> <!-- RMSD --> 
                            <col style="width: 6.5%;" /> <!-- nodecount -->
                            <col style="width: 20%;" /> <!-- Matched residues --> 
                            <!-- <col style="width: 20%;" /> Interresidue --> 
                            <col style="width: 6.5%;" /> <!-- action -->
                        </colgroup>
                        <thead>
                            <tr>
                                <th :class="'wide-' + (3 - entry.hasDescription - entry.hasTaxonomy)">
                                    Target
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
                                <th class="thin">idf-score</th>
                                <th class="thin">RMSD</th>
                                <th class="thin">Nodes</th>
                                <th>
                                    Matched residues
                                    <v-tooltip open-delay="300" top>
                                        <template v-slot:activator="{ on }">
                                            <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                                        </template>
                                        <span>The position of the aligned motif residues in the target</span>
                                    </v-tooltip>
                                </th>
                                <!-- <th>Interresidue Dist</th> -->
                                <th class="alignment-action thin">Structure</th>
                            </tr>
                        </thead>
                        <tbody v-for="(clu, key) in clusters[entry.db]">
                            {{ void(clusterShown = false) }}
                            <template v-for="(group, groupidx) in clu.map(x => entry.alignments[x])">
                            <template v-for="(item, index) in group" v-if="isGroupVisible(group) && isItemVisible(entry.db, item)">
                            <tr v-if="Object.keys(clu).length != Object.keys(entry.alignments).length && clusterShown == false">
                                <td colspan="6"><strong>Cluster: {{ key == -1 ? "Noise" : key }}</strong></td>
                            </tr>
                            {{ void(clusterShown = true) }}
                            <tr :class="['hit', { 'active' : item.active }]">
                                <td class="db long" data-label="Target" :style="{ 'border-color' : entry.color }">
                                    <a :id="item.id" class="anchor" style="position: absolute; top: 0"></a>
                                    <!-- <template v-if="isComplex">
                                        {{ item.query.lastIndexOf('_') != -1 ? item.query.substring(item.query.lastIndexOf('_')+1) : '' }} ➔ 
                                    </template> -->
                                    <a style="text-decoration: underline; color: #2196f3;" v-if="Array.isArray(item.href)" @click="forwardDropdown($event, item.href)"rel="noopener" :title="item.target">{{item.targetname}}</a>
                                    <a v-else :href="item.href" target="_blank" rel="noopener" :title="item.target">{{item.targetname}}</a>
                                </td>
                                <td class="long" data-label="Description" v-if="entry.hasDescription">
                                    <span :title="item.description">{{ item.description }}</span>
                                </td>
                                <td class="long" v-if="entry.hasTaxonomy" data-label="Taxonomy">
                                    <a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" target="_blank" rel="noopener" :title="item.taxName">{{ item.taxName }}</a>
                                </td>
                                <td class="thin" data-label="idf-score">{{ item.idfscore }}</td>
                                <td class="thin" data-label="RMSD">{{ item.rmsd }}</td>
                                <td class="thin" data-label="Node count">{{ item.nodecount }}</td>
                                <td data-label="Matched residues">
                                    <span class="matched-residues-text" :title="item.targetresidues">{{ item.targetresidues }}</span>
                                </td> 
                                <!-- <td data-label="Matched residues">
                                    <span class="matched-residues-text" :title="item.interresiduedist">{{ item.interresiduedist }}</span>
                                </td> -->
                                <td class="alignment-action thin" :rowspan="1">
                                    <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                                    <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                                        <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                                    </v-btn> -->
                                    <button 
                                        @click="showAlignment(item, entry.db, $event)"
                                        type="button"
                                        class="v-btn v-btn--icon v-btn--round v-btn--text v-size--default"
                                        :class="{ 
                                                    'v-btn--outlined' : alignment && item.target == alignment.target,
                                                    'theme--dark' : $vuetify.theme.dark
                                                }"
                                        >
                                        <span class="v-btn__content"><span aria-hidden="true" class="v-icon notranslate theme--dark">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg"><path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path></svg>
                                        </span></span>
                                    </button>
                                </td>
                            </tr>
                            <!-- <tr aria-hidden="true" v-if="isComplex" style="height: 15px"></tr> -->
                            </template>
                            </template>
                        </tbody>
                    </table>
                    </div>
                </template>
                </panel>
            </v-flex>
        </v-layout>
        <portal>
            <panel v-if="alignment != null && targetPdb != null" class="alignment" :style="'top: ' + alnBoxOffset + 'px;'">
                <StructureViewerMotif
                    slot="content"
                    :key="`ap-${alignment.dbkey}`"
                    :alignment="alignment"
                    :queryPdb="queryPdb"
                    :targetPdb="targetPdb"
                    :lineLen="fluidLineLen"
                />
            </panel>
        </portal>
    </v-container>
</template>

<script>
import { download, parseResultsFoldDisco, dateTime } from './Utilities.js';
import ResultMixin from './ResultMixin.vue';
import Panel from './Panel.vue';
// import AlignmentPanel from './AlignmentPanel.vue';
import StructureViewerMotif from './StructureViewerMotif.vue';
// import Ruler from './Ruler.vue';
// import makeZip from './lib/zip.js'
// import SankeyDiagram from './SankeyDiagram.vue';
import { debounce } from './lib/debounce.js';
// import { thresholdScott } from 'd3';
import FolddiscoHitCluster from './FolddiscoHitCluster.vue';
import MotifFilter from './MotifFilter.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';

function getAbsOffsetTop($el) {
    var sum = 0;
    while ($el) {
        sum += $el.offsetTop;
        $el = $el.offsetParent;
    }
    return sum;
}


export default {
    name: 'ResultFoldDisco',
    tool: 'folddisco',
    components: { Panel, StructureViewerMotif, FolddiscoHitCluster, MotifFilter },
    // components: { ResultView },
    mixins: [ ResultMixin, ResultSankeyMixin ],
    data() {
        return {
            ticket: "",
            error: "",
            hits: null,
            queryPdb: null,
            targetPdb: null,
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0,
            selectedDb: null,
            menuActivator: null,
            menuItems: [],
            queryResidues: null,
            gapFilter: {},
            clusters: {},
            selectedTaxId: null,
        }
    },
    created() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
    },
    computed: {
        // mode() {
        //     return this.hits?.mode ?? "";
        // },
        fluidLineLen() {
            if (this.$vuetify.breakpoint.xsOnly) {
                return 30;
            } else if (this.$vuetify.breakpoint.smAndDown) {
                return 45;
            } else if (this.$vuetify.breakpoint.mdAndDown) {
                return 60;
            } else {
                return 80;
            }
        },
        resultState() {
            if (this.error != "") {
                return "ERROR";
            }
            if (this.hits == null) {
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
        },
        dbGaps() {
            if (!this.hits) {
                return {};
            }
            let dbGaps = {};
            for (let dbs of this.hits.results) {
                let uniqueGaps = new Set();
                for (let hit of Object.keys(dbs.alignments)) {
                    uniqueGaps.add(dbs.alignments[hit][0].gaps);
                }
                dbGaps[dbs.db] = [...uniqueGaps, ''];
            }
            return dbGaps;
        },
    },
    mounted() {
        this.$root.$on('downloadJSON', () => {
            let data;
            if (this.ticket.startsWith('user-')) {
                data = this.$root.userData;
                download(data, `${`Foldseek_${dateTime()}.json`}`)
            } else {
                this.fetchAllData();
            }
        })
        if (this.hits) {
            return;
        }
        this.fetchData();
    },
    destroyed () {
        this.$root.$off('downloadJSON');
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
        },
        hits: function() {
            this.setColorScheme();
        },
    },
    methods: {
        log(args) {
            console.log(args);
            return args;
        },
        showAlignment(item, db, event) {
            if (this.alignment === item) {
                this.closeAlignment();
            } else {
                this.alignment = null;
                this.targetPdb = null;
                this.$nextTick(async () => {
                    item.db = db;
                    this.alignment = item;
                    this.targetPdb = await this.getTargetPdb(item, db);
                    this.activeTarget = event.target.closest('.alignment-action');
                    this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
                });
            }
        },
        async getTargetPdb(item, db) {
            let target = item.dbkey;
            if (db.startsWith("pdb100")) {
                target = item.target;
            }
            try {
                const re = "api/result/folddisco/" + this.$route.params.ticket + '?database=' + db +'&id=' + target;
                const request = await this.$axios.get(re);
                return request.data;
            } catch (e) {
                // throw new Error("Failed to get target structure: " + e.message);
                alert("Error: Failed to get target structure" + e.message);
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
        forwardDropdown(event, items) {
            if (this.menuActivator) {
                this.menuItems = items;
                this.menuActivator.click(event);
            }
        },
        handleChangeDatabase() {
            this.closeAlignment();
            this.localSelectedTaxId = null;
            this.filteredHitsTaxIds = [];
        },
        isGroupVisible(group) {
            if (!this.filteredHitsTaxIds || this.filteredHitsTaxIds.length === 0) {
                return true;
            }
            let taxFiltered = group.filter(item => this.filteredHitsTaxIds.includes(Number(item.taxId)));
            return taxFiltered.length > 0;
        },
        isItemVisible(db, item) {
            if (!(db in this.gapFilter)) {
                return true;
            }
            if (this.gapFilter[db] == null) {
                return true;
            }
            return this.gapFilter[db] == '' || item.gaps == this.gapFilter[db];
        },
        resetProperties() {
            this.ticket = this.$route.params.ticket;
            this.error = "";
            this.hits = null;
            this.queryPdb = null;
            this.selectedDatabases = 0;
            // this.tableMode = 0;
            // this.selectedTaxId = 0;
            // this.$nextTick(() => {
            //     this.selectedTaxId = null;
            // });
        },
        async fetchData() {
            this.resetProperties();
            try {
                let hits;
                if (this.ticket.startsWith('user-')) {
                    let localData = this.$root.userData;
                    hits = localData[this.$route.params.entry];
                } else {
                    // const response = await this.$axios.get("api/result/folddisco/" + this.ticket); //Rachel: recover
                    const response = await this.$axios.get("api/result/folddisco/" + this.ticket, {
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    });
                    const data = response.data;
                    
                    if (data.alignments == null || data.alignments.length > 0) {
                        hits = parseResultsFoldDisco(data);
                    } else {
                        throw new Error("No hits found");
                    }
                }
                this.hits = hits;
            } catch {
                this.error = "Failed";
                this.hits = null;
            }

            try {
                const response = await this.$axios.get(`api/result/${this.ticket}/query`);
                // let query = {};
                // query.pdb = response.data;
                const query = response.data;
                this.queryPdb = query
            } catch {
                this.error = "Query not available"
                this.queryPdb = null;
            }
        },
    },
};
</script>


<style lang="scss" scoped>
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

    // tbody:hover td[rowspan], tbody tr:hover {
    //     background: #eee;
    // }

    .alignment-action {
        text-align: center;
        word-wrap: normal;
    }
}

.matched-residues-text {
    display: inline-block;
    max-width: 100%;
    overflow: scroll;
    scrollbar-width: none;
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

    .matched-residues-text {
        white-space: normal;
        word-break: break-all;
        max-width: none;
    }
}

.alignment {
    position:absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12) !important;

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
</style>

<style scoped>
>>> .v-input__append-inner {
    align-self: center !important;
}
</style>
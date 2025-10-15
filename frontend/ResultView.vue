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
                                    <v-list-item-title>{{ item .label }}</v-list-item-title>
                                    <v-list-item-subtitle>
                                        {{ item.accession }}
                                    </v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                    
                    <v-sheet style="position:sticky; padding-bottom: 2em; top: 64px; z-index: 99999 !important;" class="sticky-tabs">
                        
                        <v-tabs
                        :color="selectedDatabases > 0 ? hits.results[selectedDatabases - 1].color : null"
                        center-active
                        grow
                        v-model="selectedDatabases"
                        show-arrows
                        @change="handleChangeDatabase()"
                        v-if="hits.results.length > 1"
                        >
                        <v-tab>All databases</v-tab>
                        <v-tab v-for="entry in hits.results" :key="entry.db">{{ entry.db }} ({{ entry.alignments ? Object.values(entry.alignments).length : 0 }})</v-tab>
                    </v-tabs>
                    </v-sheet>
                    <div v-for="(entry, entryidx) in hits.results" :key="entry.db" v-if="selectedDatabases == 0 || (entryidx + 1) == selectedDatabases" >
                    <v-sheet :style="{'position': 'sticky', 'top': '140px', 'z-index': '99997 !important'}" class="sticky-title">
                        <v-flex class="d-flex" :style="{ 'flex-direction' : $vuetify.breakpoint.xsOnly ? 'column' : null, 'align-items': 'center'}">
                        <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                            <template v-if="selectedDatabases == 0"><v-icon style="margin-right: 8px;" class="collapse-icon" :class="{ collapsed: isCollapsed[entry.db]}" @click="toggleCollapse(entry.db)">{{ $MDI.ChevronRight }}</v-icon></template>
                            <template v-else><div style="width: 32px; display: inline-block;"></div></template>
                            <span style="text-transform: uppercase;">{{ entry.db }}</span> <small>{{ entry.alignments ? Object.values(entry.alignments).length : 0 }} hits</small>
                        </h2>

                        <!-- Button to toggle Sankey Diagram visibility -->
                        <v-btn v-if="entry.hasTaxonomy && !isComplex" @click="toggleSankeyVisibility(entry.db)" class="mr-2" large>
                            {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
                        </v-btn>
                        
                        <v-btn-toggle mandatory v-model="tableMode" >
                            <v-btn>
                                Graphical
                            </v-btn>
                    
                            <v-btn>
                                Numeric
                            </v-btn>
                        </v-btn-toggle>
                    </v-flex>
                    <v-divider></v-divider>
                    </v-sheet>
                    <div style="height: 16px; width: 100%;"></div>
                    <v-flex v-if="entry.hasTaxonomy && isSankeyVisible[entry.db]" class="mb-2">
                        <SankeyDiagram :rawData="entry.taxonomyreports[0]" :db="entry.db" :currentSelectedNodeId="localSelectedTaxId" :currentSelectedDb="selectedDb" @selectTaxon="handleSankeySelect"></SankeyDiagram>
                    </v-flex>
                    <table class="v-table result-table" style="position:relative; margin-bottom: 3em;" v-if="selectedDatabases != 0 || !isCollapsed[entry.db]" :style="{'--active-color': entry.color}">
                        <colgroup>
                            <col style="width: 36px;">
                            <template v-if="isComplex">
                                <col style="width: 6.5%;" />
                                <col style="width: 6.5%;" />
                            </template>
                            <col style="min-width: 10%;" />
                            <col v-if="entry.hasDescription" style="min-width: 25%;" />
                            <col v-if="entry.hasTaxonomy" style="min-width: 15%;" />
                            <col style="width: 6%;" />
                            <col style="width: 6%;" />
                            <col style="width: 6%;" />
                            <template v-if="tableMode == 0">
                                <col style="min-width: 20%;" />
                            </template>
                            <template v-else>
                                <col style="width: 4%;" />
                                <col style="width: 8%;" />
                                <col style="width: 8%;" />
                            </template>
                            <col style="width: 6%;" />
                        </colgroup>
                        <thead>
                            <tr v-if="isComplex">
                                <th colspan="1"></th>
                                <th colspan="2" style="text-align:center; width:10%; border-right: 1px solid #333; border-bottom: 1px solid #333;">Complex</th>
                                <th :colspan="6 +  entry.hasDescription + entry.hasTaxonomy + ((tableMode == 1) ? 2 : 0)" style="text-align:center; border-bottom: 1px solid #333;">Chain</th>
                            </tr>
                            <tr>
                                <th class="thin select-all-th" style="position: relative" :class="{ 'selected':selectAllStatus[entry.db] }">
                                    <v-tooltip top open-delay="300">
                                        <template v-slot:activator="{ on }">
                                            <v-simple-checkbox :color="entry.color" v-on="on" class="select-all-checkbox"
                                                :ripple="false" v-model="selectAllStatus[entry.db]" 
                                                @input="toggleDbEntries(entry.db, $event)" 
                                                style="user-select: none; -webkit-user-select: none;" >
                                            </v-simple-checkbox>
                                            <v-icon style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
                                            class="select-all-help"
                                            >{{ $MDI.HelpCircleOutline }}</v-icon>
                                        </template>
                                        <span><b>Select a single entry</b>: <br>
                                                &nbsp;&nbsp;&nbsp;&nbsp;Click the <i>index number</i> in this column <br>
                                                <b>Multiple selection</b>: Shift-click <br>
                                                <b>Select all</b>: Click <i>this button</i></span>
                                    </v-tooltip>
                                </th>
                                <template v-if="isComplex">
                                    <!-- <th class="thin">ID</th> -->
                                    <th class="thin">qTM</th>
                                    <th class="thin" style="border-right: 1px solid #333; ">tTM</th>
                                </template>
                                <th :class="'wide-' + (3 - entry.hasDescription - entry.hasTaxonomy)">
                                    <template v-if="isComplex">
                                        Chain pairing
                                    </template>
                                    <template v-else>
                                        Target
                                    </template>
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
                                <th class="thin">Prob.</th>
                                <th class="thin">Seq. Id.</th>
                                <th class="thin">{{ scoreColumnName }}</th>
                                <th class="thin" v-show="tableMode == 1">Score</th>
                                <th v-show="tableMode == 1">Query Pos.</th>
                                <th v-show="tableMode == 1">Target Pos.</th>
                                <th v-show="tableMode == 0">
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
                            <template v-for="(group, groupidx) in entry.alignments" >
                            <tr v-for="(item, index) in group" :class="['hit', { 'active' : item.active , 'selected' : selectedEntries[entry.db][groupidx]}]" v-if="isGroupVisible(group)"
                                @click.stop="$vuetify.breakpoint.width <= 960 ? onCheckboxClick(entry.db, groupidx, $event) : () => {}">
                                <td v-if="index == 0" :rowspan="group.length" class="entry-checkbox">
                                    <!-- performance issue with thousands of v-checkboxes, hardcode the simple checkbox instead -->
                                    <!-- <v-simple-checkbox :value="selectedEntries[entry.db][groupidx]" :color="entry.color" style="user-select: none; -webkit-user-select: none;" 
                                    :ripple="false" @click.stop="onCheckboxClick(entry.db, groupidx, $event)"></v-simple-checkbox> -->
                                    <div class="v-input--selection-controls__input" style="user-select: none; -webkit-user-select: none; cursor: pointer;" @click.stop="onCheckboxClick(entry.db, groupidx, $event)"
                                    :data-label="Number( groupidx )+1">
                                        <span aria-hidden="true" class="v-icon notranslate" :class="{'theme--light': !$vuetify.theme.dark, 'theme--dark': $vuetify.theme.dark}">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                        <path class="unchecked" d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z">
                                        </path>
                                        <path class="checked" d="M10,17L5,12L6.41,10.58L10,14.17L17.59,6.58L19,8M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3Z"></path>
                                        </svg>
                                        </span>
                                    </div>
                                </td>
                                <template v-if="index == 0 && isComplex">
                                    <td class="thin" data-label="Query TM-score" :rowspan="group.length">{{ group[0].complexqtm.toFixed(2) }}</td>
                                    <td class="thin" data-label="Target TM-score" :rowspan="group.length">{{ group[0].complexttm.toFixed(2) }}</td>
                                </template>
                                <td class="db long" data-label="Target" :style="{ 'border-width' : isComplex ? '5px' : null, 'border-color' : entry.color }">
                                    <a :id="item.id" class="anchor" style="position: absolute; top: 0"></a>
                                    <template v-if="isComplex">
                                        {{ item.query.lastIndexOf('_') != -1 ? item.query.substring(item.query.lastIndexOf('_')+1) : '' }} ➔ 
                                    </template>
                                    <a style="text-decoration: underline; color: #2196f3;" v-if="Array.isArray(item.href)" @click="forwardDropdown($event, item.href)"rel="noopener" :title="item.target">{{item.target}}</a>
                                    <a v-else :href="item.href" target="_blank" rel="noopener" :title="item.target">{{item.target}}</a>
                                </td>
                                <td class="long" data-label="Description" v-if="entry.hasDescription">
                                    <span :title="item.description">{{ item.description }}</span>
                                </td>
                                <td class="long" v-if="entry.hasTaxonomy" data-label="Taxonomy"><a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId" target="_blank" rel="noopener" :title="item.taxName">{{ item.taxName }}</a></td>
                                <td class="thin" data-label="Probability">{{ item.prob }}</td>
                                <td class="thin" data-label="Sequence Identity">{{ item.seqId }}</td>
                                <td class="thin" :data-label="scoreColumnName">{{ item.eval }}</td>
                                <td class="thin" v-show="tableMode == 1" data-label="Score">{{ item.score }}</td>
                                <td v-show="tableMode == 1" data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                                <td v-show="tableMode == 1" data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                                <td class="graphical" data-label="Position" v-show="tableMode == 0">
                                    <Ruler :length="item.qLen" :start="item.qStartPos" :end="item.qEndPos" :color="item.color" :label="index == 0"></Ruler>
                                </td>
                                <td class="alignment-action" :rowspan="isComplex ? group.length : 1" v-if="index == 0">
                                    <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                                    <!-- <v-btn @click="showAlignment(item, $event)" text :outlined="alignment && item.target == alignment.target" icon>
                                        <v-icon v-once>{{ $MDI.NotificationClearAll }}</v-icon>
                                    </v-btn> -->
                                    <button 
                                        @click.stop="showAlignment(group, entry.db, $event)"
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
                            <tr aria-hidden="true" v-if="isComplex" style="height: 15px"></tr>
                            </template>
                        </tbody>
                    </table>
                    </div>
                </template>
                </panel>
                <!-- For displaying number of selected entries and buttons to switch -->
                <v-fade-transition>
                    <v-sheet color="transparent" :style="{'position': 'fixed', 'width': $vuetify.breakpoint.smAndDown ? '80%' : '40%', 
                    'left': 'calc(50% - ' + ($vuetify.breakpoint.smAndDown ? '40%' : '20%') + ')',
                    'bottom': '16px', 'z-index': 99998, 'align-items': 'center', 'justify-content': 'space-between', 'opacity': loading ? 0.4 : 1}" 
                    class="d-flex pa-2" v-if="selectedCounts > 0" >
                    <v-chip label close color="primary" class="elevation-8" @click:close="clearAllEntries" ><span v-html="selectionBannerContent"></span></v-chip>
                    <v-flex shrink>
                    <template v-if="selectedCounts == 1">
                        <v-tooltip top :color="errorFoldseekBtn ? 'error': 'primary'" :value="errorFoldseekBtn">
                            <template v-slot:activator="{on, attrs}">
                                <v-btn :color="errorFoldseekBtn ? 'error': 'primary'" v-bind="attrs" v-on="on" fab class="mr-3 elevation-8" large :loading="loading" @click="sendToFoldseek"><v-icon>{{isSelectionComplex ?  $MDI.Multimer : $MDI.Monomer}}</v-icon></v-btn>
                            </template> 
                            <span>{{ toFoldseekContent }}</span>
                        </v-tooltip>
                        <v-tooltip top :color="errorFoldDiscoBtn ? 'error' : 'secondary'" :value="errorFoldDiscoBtn">
                            <template v-slot:activator="{on, attrs}">
                                <v-btn v-bind="attrs" v-on="on" fab class="elevation-8 fold-disco-btn" :class="{'btn-disabled':isSelectionUnableToFetch}" :color="errorFoldDiscoBtn ? 'error' : 'secondary'" large 
                                :loading="loading" @click="isSelectionUnableToFetch ? () => {} : sendToFoldDisco()"><v-icon>{{$MDI.Motif}}</v-icon></v-btn>
                            </template>
                            <span v-html="toFoldDiscoContent"></span>
                        </v-tooltip>
                    </template>
                    <template v-else>
                        <v-tooltip top :color="errorFoldMasonBtn ? 'error' : 'primary'" :value="errorFoldMasonBtn">
                            <template v-slot:activator="{on, attrs}">
                                <v-btn v-bind="attrs" v-on="on" fab class="elevation-8" :color="errorFoldMasonBtn ? 'error' : 'primary'" large :loading="loading" @click="sendToFoldMason"><v-icon>{{$MDI.Wall}}</v-icon></v-btn>
                            </template>
                            <span>{{ toFoldMasonContent }}</span>
                        </v-tooltip>
                    </template>
                    </v-flex>
                    </v-sheet>
                </v-fade-transition>
            </v-flex>
        </v-layout>
        <portal>
            <panel v-if="alignment != null" class="alignment" :style="{ 'top': alnBoxOffset + 'px',  
            width: $vuetify.breakpoint.smAndDown ? 'calc(100% - 16px)' : 'calc(100% - 32px)', 
            right: $vuetify.breakpoint.smAndDown ? '8px' : '16px'}" ref="alignment_panel" v-click-outside="closeAlignment">
                <template slot="desc">
                    <v-btn icon @click="closeAlignment" style="display: block; margin-left: auto;">
                    <v-icon>
                        {{ $MDI.CloseCircleOutline }}
                    </v-icon>
                </v-btn></template>
                <AlignmentPanel
                    slot="content"
                    :key="alignment ? `ap-${alignment.id}` : 'ap-'"
                    :alignments="alignment"
                    :lineLen="fluidLineLen"
                    :hits="hits"
                />
            </panel>
            <v-dialog v-model="loading" persistent width="480px">
                <v-card :loading="loading">
                    <template slot="progress">
                        <v-progress-linear indeterminate color="primary"></v-progress-linear>
                    </template>
                    <v-card-title>Please Wait...!</v-card-title>
                    <v-card-text>
                        We're processing your request. It may take upto a minute...
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="primary" @click="cancelJob" text>Cancel</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </portal>
    </v-container>
</template>

<script>
import Panel from './Panel.vue';
import AlignmentPanel from './AlignmentPanel.vue';
import Ruler from './Ruler.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';
import { mockPDB, mergePdbs} from './Utilities';
import { pulchra } from 'pulchra-wasm';
import { BlobDatabase } from './lib/BlobDatabase';
import { StorageWrapper } from './lib/HistoryMixin';

import { debounce } from './lib/debounce';

const localDb = BlobDatabase()

function getAbsOffsetTop($el) {
    var sum = 0;
    while ($el) {
        sum += $el.offsetTop;
        $el = $el.offsetParent;
    }
    return sum;
}

const getChainName = (name) => {
    if (/_v[0-9]+$/.test(name) || /^AF-\W+-/.test(name)) {
        return 'A';
    }

    let pos = name.lastIndexOf('_');
    if (pos != -1) {
        let match = name.substring(pos + 1);
        return match.length >= 1 && isNaN(Number(match[0])) ? match[0] : 'A';
    }
    // fallback
    return 'A';
}


const getAccession = (name) => {
    if (/^AF-\w+-/.test(name)) {
        name = name.split('-')[1]
    }
    
    if (/_v[0-9]+$/.test(name)) {
        return name;
    }
    
    if (/_unrelaxed_rank_/.test(name)) {
        let pos = name.indexOf('_unrelaxed_rank_');
        return pos != -1 ? name.substring(0, pos) : name;
    }

    let pos = name.lastIndexOf('_');
    return pos != -1 ? name.substring(0, pos) : name;
}

const fetchStructureFileURL = async (accession, db, signal=null) => {
    const fetchWithURL = async (url, retry) => {
        const response = await fetch(url, {signal})
        if (signal?.aborted) { 
            throw new DOMException('Aborted', 'AbortError') 
        }
        if (!response.ok) {
            if (retry) { 
                return await fetchWithURL(url.replace(/\.pdb$/, ".cif"), false) 
            }
            else { 
                throw new DOMException('Failed to fetch', 'FetchError') 
            }
        } return await response.text()
    }

    if (!db || !accession) { 
        throw new DOMException('Invalid entry', 'FetchError') 
    }
    if (signal?.aborted) { 
        throw new DOMException('Aborted', 'AbortError') 
    }

    try {
        if (db == "BFVD") {
            const url = `https://bfvd.steineggerlab.workers.dev/pdb/${accession}.pdb`
            return await fetchWithURL(url, false)
        } else if (db.startsWith('afdb')) {
            // First attempt pdb, then cif.
            const url = `https://alphafold.ebi.ac.uk/files/${accession}.pdb`
            return await fetchWithURL(url, true)
        } else if (db.includes('esm')) {
            const url = `https://api.esmatlas.com/fetchPredictedStructure/${ accession }.pdb`
            return await fetchWithURL(url, false)
        } else if (db.startsWith('pdb')) {
            // First attempt pdb, then cif.
            // PDB accepts only the first 4 characters as accession.
            const url = `https://files.rcsb.org/download/${accession.substring(0, 4).toUpperCase()}.pdb`
            return await fetchWithURL(url, true)
        } else { 
            throw new DOMException('Not supported DB', 'FetchError') 
        }
    } catch (error) {
        throw error
    }
}

export default {
    name: 'ResultView',
    mixins: [ ResultSankeyMixin ],
    components: { Panel, AlignmentPanel, Ruler },
    data() {
        return {
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0,
            selectedDb: null,
            selectedEntries: {},
            selectAllStatus: {},
            selectedCounts: 0,
            tableMode: 0,
            menuActivator: null,
            menuItems: [],
            loading: false,
            cancelCtl: null,
            toggleTargetValue: false,
            toggleSourceIdx: -1,
            toggleSourceDb: "",
            isCollapsed: null,
            dbToIdx: null,
            errorFoldseekBtn: false,
            errorFoldMasonBtn: false,
            errorFoldDiscoBtn: false,
        }
    },
    props: {
        ticket: "",
        error: "",
        hits: null,
        selectedTaxId: null,
    },
    mounted() {
        window.addEventListener("resize", this.handleAlignmentBoxResize, { passive: true });
        // window.addEventListener("click", this.handleClickOutside)
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.handleAlignmentBoxResize);
        // window.removeEventListener("click", this.handleClickOutside)
    },
    watch: {
        hits: {
            handler(n, o) {
                if (n && n.results) {
                    const obj = Object.fromEntries(
                        n.results.map(e => [e.db, Array(Object.keys(e.alignments).length).fill(false)])
                    )
                    const obj2 = Object.fromEntries(
                        n.results.map(e => [e.db, false])
                    )
                    const obj3 = Object.fromEntries(
                        n.results.map((e, i) => [e.db, i])
                    )
                    this.selectedEntries = obj
                    this.selectAllStatus = obj2
                    this.isCollapsed = Object.fromEntries(
                        n.results.map(e => [e.db, false])
                    )
                    this.dbToIdx = obj3
                }
            },
            immediate: false,
            deep: true,
        },
        selectedCounts() {
            this.errorFoldDiscoBtn=false
            this.errorFoldMasonBtn=false
            this.errorFoldseekBtn=false
        }
    },
    computed: {
        mode() {
            return this.hits?.mode ?? "";
        },
        isComplex() {
            if (this.hits?.results?.[0]?.alignments?.[0]?.[0]?.complexqtm != null) {
                return true;
            }
            return false;
        },
        isSelectionComplex() {
            if (this.selectedCounts != 1 || !this.isComplex) { 
                return false 
            }

            const selection = this.getSingleSelectionInfo();
            if (selection.idx == -1) { 
                return false 
            }

            if (this.hits.results[this.dbToIdx?.[selection.db]]?.alignments?.[selection.idx]?.length > 1) { 
                return true 
            } else { 
                return false 
            }
        },
        isSelectionUnableToFetch() {
            if (this.selectedCounts != 1) { 
                return false 
            }
            const selection = this.getSingleSelectionInfo();
            if (selection.idx == -1) { 
                return false 
            }

            const banList = ['bfmd', 'cath50', 'gmgcl_id']
            return banList.includes(selection.db)
        },
        fluidLineLen() {
            if (this.$vuetify.breakpoint.xsOnly) {
                return 30;
            } else if (this.$vuetify.breakpoint.smAndDown) {
                return 60;
            } else if (this.$vuetify.breakpoint.mdAndDown) {
                return 45;
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
        scoreColumnName() {
            if (__APP__ == 'foldseek') {
                switch (this.mode) {
                    case 'tmalign':
                        return 'TM-score';
                    case 'lolalign':
                        return 'LoL-score';
                }
            }
            return 'E-Value';
        },
        selectionBannerContent() {
            if (this.selectedCounts == 0) { 
                return 'No selection' 
            } else if (this.selectedCounts > 1) {
                return this.selectedCounts + " entries" + " selected"
            } else {
                const selection = this.getSingleSelectionInfo()
                if (selection.idx == -1) { 
                    return '' 
                }

                let str = (this.hits.results[this.dbToIdx?.[selection.db]]?.alignments?.[selection.idx]?.[0]?.target)
                if (!str) { 
                    return '' 
                }
                if (str.length >= 15) {
                    str = '<span title="' + str + '">'  + str.slice(0, 12) + '...' + '</span>&nbsp;'
                }
                return str + " selected"
            }
        },
        toFoldseekContent() {
            if (this.errorFoldseekBtn) { 
                return 'Failed to load the structure file' 
            } else { 
                return 'Send to Foldseek' + (this.isSelectionComplex ? ' Multimer' : "") 
            }
        },
        toFoldMasonContent() {
            if (this.errorFoldMasonBtn) { 
                return 'Failed to load the structure file' 
            } else { 
                return 'Send to FoldMason' 
            }
        },
        toFoldDiscoContent() {
            if (this.errorFoldDiscoBtn) { 
                return 'Failed to load the structure file' 
            } else if (this.isSelectionUnableToFetch) { 
                return 'This feature is not available<br>for the selected DB' 
            } else { 
                return 'Send to FoldDisco' 
            }
        },
        remarkStr() {
            let str = 'Imported from '
            let t = this.ticket
            if (t.length > 55) {
                t = t.slice(52) + '...'
            }
            return (str + t).padEnd(69, ' ') + '\n'
        }
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
                this.$nextTick(() => {
                    item.map(item => item.db = db);
                    this.alignment = item;
                    this.activeTarget = event.target.closest('.alignment-action');
                    this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
                });
            }
        },
        closeAlignment() {
            this.$nextTick(() => {
                this.alignment = null;
                this.activeTarget = null;
            })
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
        onCheckboxClick(db, idx, event) {
            if (!this.selectedEntries || !this.selectedEntries[db]) { 
                return 
            }

            let value = !this.selectedEntries[db][idx]

            const needRangedToggle = event.shiftKey && (this.toggleSourceDb == db) && (this.toggleSourceIdx != idx)

            if (!needRangedToggle) {
                // simple click. just toggle it.
                this.toggleSourceDb = db
                this.toggleSourceIdx = idx
                this.toggleTargetValue = value
                this.$set(this.selectedEntries[db], idx, value)
                this.selectedCounts += value ? 1 : -1
            } else {
                const startIdx = Math.min(this.toggleSourceIdx, idx)
                const endIdx = Math.max(this.toggleSourceIdx, idx) + 1
                this.handleRangedToggle(db, startIdx, endIdx, this.toggleTargetValue)
            }
        },
        handleRangedToggle(db, startIdx, endIdx, value) {
            if (!this.selectedEntries || !this.selectedEntries[db]) {
                return
            }

            let delta = 0
            const src = this.selectedEntries[db]
            // FIXME: If already inside the range?
            const next = src.map((v, i) => {
                if (i >= startIdx && i < endIdx) { 
                    return value; 
                } else { 
                    return v 
                }})

            const deltaUnit = value ? 1 : -1
            
            for (let i = startIdx; i < endIdx; i++) {
                if (src[i] != value ) {
                    delta += deltaUnit
                }
            }
            this.selectedCounts += delta
            this.$set(this.selectedEntries, db, next)
        },
        clearAllEntries() {
            if (!this.selectedEntries || this.loading) {
                return
            }
            this.selectedCounts = 0
            const next = {};
            const nextSelectAll = {};
            for (const [db, arr] of Object.entries(this.selectedEntries)) {
                next[db] = arr.map(() => false);
                nextSelectAll[db] = false
            }
            this.selectedEntries = next;
            this.selectAllStatus = nextSelectAll;
        },
        toggleDbEntries(db, value) {
            if (!this.selectedEntries || !this.selectedEntries[db]) {
                return
            }
            let delta = 0;
            const src = this.selectedEntries[db]
            const next = src.map(()=>value)
            const deltaUnit = value ? 1 : -1

            for (let i = 0; i < src.length; i++) {
                if (src[i] != value ) {
                    delta += deltaUnit
                }
            }
            this.selectedCounts += delta
            this.selectAllStatus[db] = value
            this.$set(this.selectedEntries, db, next)
        },
        getSingleSelectionInfo() {
            const info = {}
            let db;
            let idx;

            for (const [key, arr] of Object.entries(this.selectedEntries)) {
                db = key
                idx = arr.indexOf(true);
                if (idx != -1) {
                    break;
                }
            }
            info.db = db
            info.idx = idx
            // If there is no selection, then idx would be -1
            return info
        },
        getMultipleSelectionInfo() {
            const arr = []
            
            for (const [db, a] of Object.entries(this.selectedEntries)) {
                arr.push(
                    ...a.map((v, idx) => (v ? {db, idx} : null))
                    .filter(Boolean)
                )
            }

            return arr
        },
        async getMockPdb(info /* info: {db, idx} */, signal) {
            if (signal?.aborted) { 
                throw new DOMException('Aborted', 'AbortError')
            }

            let {db, idx} = info
            if (idx == -1) {
                return;
            }

            const ticket = this.$route.params.ticket;
            let response

            try {
                response = await this.$axios.get("api/result/" 
                    + ticket + '/' + this.$route.params.entry 
                    + '?format=brief&index=' + idx 
                    + '&database=' + db, {signal});
            } catch (error) {
                if (signal?.aborted) { 
                    throw new  DOMException('Aborted', 'AbortError')
                } else { 
                    throw new DOMException('Failed to fetch', 'FetchError') 
                }
            }

            let dataArr = response.data;
            const arr = []
            const name = getAccession(dataArr[0].target)

            for (let data of dataArr) {
                if (signal?.aborted) { 
                    throw new DOMException('Aborted', 'AbortError') 
                }

                const chain = getChainName(data.target)
                const tCa = data.tCa
                const tSeq = data.tSeq
                const pdb = mockPDB(tCa, tSeq, chain)
                // const mock = mockPDB(tCa, tSeq, chain)
                // const pdb = await pulchra(mock)
                arr.push({pdb, chain})
            }
            let out = ""
            if (arr.length > 1) {
                out = mergePdbs(arr)
            } else {
                out = arr[0].pdb
            }
            return { pdb: this.prependRemark(out, name, db), isMultimer: arr.length > 1, name: name}
        },
        async sendToFoldseek() {
            if (this.loading) {
                return
            }

            this.loading = true
            this.errorFoldseekBtn = false
            let info = this.getSingleSelectionInfo()
            if (info.idx < 0) {
                console.log("Error in sendToFoldseek: no entry selected")
                this.loading = false
                return
            }

            let result
            this.cancelCtl = new AbortController()
            try {
                const signal = this.cancelCtl.signal
                result = await this.getMockPdb(info, signal)
            } catch (error) {
                if (error?.name == "AbortError") {
                    console.log("Job canceled")
                }  else {
                    console.error(error.message)
                    this.errorFoldseekBtn = true
                }
                this.cancelCtl = null
                this.loading = false
                return
            }

            const pdb = result.pdb;
            const isMultimer = result.isMultimer;
            this.cancelCtl = null
            this.loading = false
            if (isMultimer) {
                await localDb.setItem('multimer.query', pdb)
                this.$router.push({name: "multimer"})
            } else {
                await localDb.setItem('query', pdb)
                this.$router.push({name: "search"})
            }
        },
        async sendToFoldMason() {
            if (this.loading) return

            const BATCH_SIZE = 256
            const CHUNK_SIZE = 128

            const inBatches = async (items, k, fn, signal) => {
                const out = [];
                for (let p = 0; p < items.length; p += k) {
                    if (signal?.aborted) { 
                        throw new DOMException('Aborted', 'AbortError') 
                    }
                    
                    const chunk = items.slice(p, p + k);
                    const settled = await Promise.allSettled(chunk.map(x => fn(x, signal)));
                    out.push(...settled);
                }
                return out;
            }
            
            const saveAsChunk = async (v /* v: Array[{text, name}] */, chunk_size, signal) => {
                if (signal?.aborted) throw new  DOMException('Aborted', 'AbortError')
                const SEP = '\0'
                const PREFIX = "msa.query."

                let texts = v.map(o => o.text)
                let names = v.map(o => o.name).join(SEP)
                let idx = 0;
                
                for (let i = 0; i < texts.length; i += chunk_size) {
                    const UPPER = Math.min(i + chunk_size, texts.length)
                    const key = PREFIX + "chunk:" + idx++
                    const value = texts.slice(i, UPPER).join(SEP)
                    await localDb.setItem(key, new Blob([ value ], {type: "text/plain"}))
                }

                await localDb.setItem(PREFIX + "names", names)
                await localDb.setItem(PREFIX + "size", idx)
            }

            this.errorFoldMasonBtn = false
            this.loading = true
            this.cancelCtl = new AbortController();
            try {
                const signal = this.cancelCtl.signal
                const settled = await inBatches(this.getMultipleSelectionInfo(), BATCH_SIZE, async (i, s) => await this.getMockPdb(i, s), signal)
                const values = settled.filter(r => r.status == "fulfilled").map(r => {
                    return {text: r.value?.pdb, name: r.value?.name};
                })
                await saveAsChunk(values, CHUNK_SIZE, signal)
                this.$router.push({name:'foldmason'})
            } catch (e) {
                if (e?.name == 'AbortError') {
                    console.log("Job canceled")
                } else {
                    this.errorFoldMasonBtn = true
                    console.error(e)
                }
            } finally {
                this.loading = false
                this.cancelCtl = null
            }
        },
        async sendToFoldDisco() {
            if (this.loading) { 
                return 
            }
            
            this.errorFoldDiscoBtn = false
            this.loading = true
            const selection = this.getSingleSelectionInfo()
            if (selection.idx == -1 || !this.dbToIdx) {
                this.loading = false
                return
            }

            this.cancelCtl = new AbortController();
            const target = this.hits.results[this.dbToIdx?.[selection.db]]?.alignments?.[selection.idx]?.[0]?.target
            let targetPdb
            try {
                const signal = this.cancelCtl.signal
                targetPdb = await fetchStructureFileURL(target, selection.db, signal)
            } catch (error) {
                if (error?.name == 'AbortError') {
                    console.log('Job canceled')
                } else {
                    this.errorFoldDiscoBtn = true
                    console.error(error)
                }
                this.loading = false
                return
            }
            this.loading = false
            this.cancelCtl = null
            if (!targetPdb) {
                return
            }
            const storage = new StorageWrapper('folddisco')
            const accession = getAccession(target)

            await localDb.setItem('folddisco.query', this.prependRemark(targetPdb, accession, selection.db))
            storage.removeItem('motif')
            this.$router.push({name: "folddisco"})
        },
        cancelJob() {
            this.cancelCtl?.abort()
        },
        toggleCollapse(db) {
            let orig = this.isCollapsed[db]
            this.$set(this.isCollapsed, db, !orig)
        },
        prependRemark(structure, accession, db) {
            let is_cif = false
            if (structure[0] == '#' || structure.startsWith('data_')) {
                is_cif = true
            }
            
            let prefix = is_cif ? '# ' : 'REMARK  99 '
            let firstline = prefix + 'Accession: ' + accession + ', DB: ' + db
            if (!is_cif && firstline.length > 79) {
                firstline = firstline.slice(76) + '... '
            }

            firstline = firstline.padEnd(80, ' ') + '\n' + prefix + this.remarkStr
            return firstline + structure
        }
    }
};
</script>

<style lang="scss">
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

    tbody {
        counter-reset: row;
    }

    tbody tr.hit {
        counter-increment: row;
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

.sticky-tabs::before {
    content: "";
    width: 100%;
    position: absolute;
    top: -16px;
    background-color: inherit;
    display: block;
    height: 16px;
    z-index: inherit;
} 

.collapse-icon:not(.collapsed) {
    transform: rotate(90deg);
}

.collapse-icon {
    cursor: pointer;
}

tr.hit:not(.selected) .entry-checkbox path.checked {
    opacity: 0;
}

tr.hit.selected .entry-checkbox path.unchecked {
    opacity: 0;
}

tr.hit .entry-checkbox svg {
    transition: opacity 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

tr.hit.selected .entry-checkbox svg {
    fill: var(--active-color);
}

.fold-disco-btn.btn-disabled {
    background-color: rgba(0,0,0,.12) !important;
    color: rgba(0,0,0,.24) !important;
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
        tr.hit:not(.selected) .entry-checkbox div:not(:hover) svg {
            opacity: 0;
        }

        tr.hit:not(.selected) .entry-checkbox div:hover svg {
            opacity: 1;
        }
        tr.hit:not(.selected) .entry-checkbox div::before {
            content: attr(data-label);
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translateY(-50%) translateX(-50%);
            transition: opacity 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
            font-weight: 700;
            line-height: 1.2;
            text-align: center;
            opacity: 0.6;
            font-size: 0.7em;
        }
        tr.hit:not(.selected) .entry-checkbox div:hover::before {
            opacity: 0;
        }

        th.select-all-th:not(.selected):not(:hover) .select-all-checkbox {
            opacity: 0;
        }

        th.select-all-th:not(.selected):hover .select-all-checkbox {
            opacity: 1;
        }

        th.select-all-th:not(.selected):not(:hover) .select-all-help {
            display: block;
        }
        th.select-all-th:not(.selected):hover .select-all-help {
            display: none;
        }
        th.select-all-th.selected .select-all-help {
            display: none;
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
        
        td.entry-checkbox {
            display: none;
        }

        thead {
            display: none;
        }
        tfoot th {
            border: 0;
            display: inherit;
        }
        tr.hit {
            box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1);
            max-width: 100%;
            position: relative;
            display: block;
            padding: 2em;
            cursor: pointer;
        }

        tr.hit.selected {
            outline: 4px solid color-mix(in srgb, var(--active-color) 60%, transparent);
            outline-offset: -2px;
        }

        tr:not(.hit) {
            position: relative
        }

        tr:not(.hit)::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 1px;
            background-color: #cfcfcf;
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
        tr:not(.detail):not(.is-empty):not(.table-footer) td:not(.entry-checkbox) {
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
    z-index: 999;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2),0 6px 10px 0 rgba(0,0,0,.14),0 1px 18px 0 rgba(0,0,0,.12) !important;
}

</style>
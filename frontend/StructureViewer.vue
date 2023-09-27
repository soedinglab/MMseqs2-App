<template>
<div class="structure-panel" v-if="'tCa' in alignment">
    <StructureViewerTooltip attach=".structure-panel" />
    <div class="structure-wrapper" ref="structurepanel">
        <table v-if="tmAlignResults" class="tmscore-panel" v-bind="tmPanelBindings">
            <tr>
                <td class="left-cell">TM-Score:</td>
                <td class="right-cell">{{ tmAlignResults.tmScore }}</td>
            </tr>
            <tr>
                <td class="left-cell">RMSD:</td>
                <td class="right-cell">{{ tmAlignResults.rmsd  }}</td>
            </tr>
        </table>
        <StructureViewerToolbar
            :isFullscreen="isFullscreen"
            :showQuery="showQuery"
            :showTarget="showTarget"
            :showArrows="showArrows"
            @makeImage="handleMakeImage"
            @makePDB="handleMakePDB"
            @resetView="handleResetView"
            @toggleFullscreen="handleToggleFullscreen"
            @toggleTarget="handleToggleTarget"
            @toggleQuery="handleToggleQuery"
            @toggleArrows="handleToggleArrows"
            @toggleSpin="handleToggleSpin"
        />
        <div class="structure-viewer" ref="viewport" />
    </div>
</div>
</template>

<script>
import StructureViewerTooltip from './StructureViewerTooltip.vue';
import StructureViewerToolbar from './StructureViewerToolbar.vue';
import StructureViewerMixin from './StructureViewerMixin.vue';
import { mockPDB, makeSubPDB, transformStructure  } from './Utilities.js';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

import Panel from './Panel.vue';
import { Shape, Selection, download, ColormakerRegistry, PdbWriter } from 'ngl';

// Create NGL arrows from array of ([X, Y, Z], [X, Y, Z]) pairs
function createArrows(matches) {
    const shape = new Shape('shape');
    for (let i = 0; i < matches.length; i++) {
        const [a, b] = matches[i];
        shape.addArrow(a, b, [0, 1, 1], 0.4);
    }
    return shape;
}

// Get XYZ coordinates of CA of a given residue
const xyz = (structure, resIndex) => {
    var rp = structure.getResidueProxy();
    var ap = structure.getAtomProxy();
    rp.index = resIndex;
    ap.index = rp.getAtomIndexByName('CA');
    return [ap.x, ap.y, ap.z];
}

// Map 1-based indices in a selection to residue index/resno
const makeChainMap = (structure, sele) => {
    let map = new Map()
    let idx = 1;
    structure.eachResidue(rp => {
        map.set(idx++, { index: rp.index, resno: rp.resno });
    }, new Selection(sele));
    return map
}

export default {
    name: "StructureViewer",
    components: {
        Panel,
        StructureViewerTooltip,
        StructureViewerToolbar,
    },
    mixins: [
        StructureViewerMixin,
    ],
    data: () => ({
        qChainResMap: null,
        qMatches: [],
        queryChain: '',
        queryRepr: null,
        selection: null,
        showArrows: false,
        showQuery: 0,
        showTarget: 'aligned',
        tMatches: [],
        targetRepr: null,
        tmAlignResults: null,
    }),
    props: {
        alignment: { type: Object },
        queryFile: { type: String },
        queryAlignedColor: { type: String, default: "#1E88E5" },
        queryUnalignedColor: { type: String, default: "#A5CFF5" },
        targetAlignedColor: { type: String, default: "#FFC107" },
        targetUnalignedColor: { type: String, default: "#FFE699" },
        qRepr: { type: String, default: "cartoon" },
        tRepr: { type: String, default: "cartoon" },
        queryMap: { type: Array, default: null },
        targetMap: { type: Array, default: null },
        hits: { type: Object }
    },
    methods: {
        // Parses two alignment strings, and saves matching residues
        // Each match contains the index of the residue in the structure and a callback
        // function to retrieve the residue's CA XYZ coordinates to allow retrieval
        // before and after superposition (with updated coords)
        saveMatchingResidues(aln1, aln2, str1, str2) {
            if (aln1.length !== aln2.length) return
            this.qMatches = []
            this.tMatches = []
            for (let i = 0; i < aln1.length; i++) {
                if (aln1[i] === '-' || aln2[i] === '-') {
                    continue;
                }
                // Make sure this residue actually exists in NGL structure representation
                // e.g. d1b0ba starts with X, reported in alignment but removed by Pulchra
                let qIdx = this.qChainResMap.get(this.queryMap[i]);
                if (qIdx === undefined) {
                    continue;
                }
                // Must be 0-based for xyz()
                let tIdx = this.targetMap[i] - 1;
                this.qMatches.push({ index: qIdx.index, xyz: () => xyz(str1, qIdx.index) })
                this.tMatches.push({ index: tIdx, xyz: () => xyz(str2, tIdx) })
            }
        },
        handleToggleArrows() {
            if (!this.stage) return;
            this.showArrows = !this.showArrows;
        },
        handleToggleQuery() {
            if (!this.stage) return;
            if (__LOCAL__) {
                this.showQuery = (this.showQuery === 0) ? 1 : 0;
            } else {
                this.showQuery = (this.showQuery === 2) ? 0 : this.showQuery + 1;
            }
        },
        handleToggleTarget() {
            if (!this.stage) return;
            this.showTarget = this.showTarget === 'aligned' ? 'full' : 'aligned';
        },
        setSelectionByRange(start, end) {
            if (!this.targetRepr) return
            this.targetRepr.setSelection(`${start}-${end}`)
            this.stage.autoView(100)
        },
        setSelectionData(start, end) {
            this.selection = [start, end]
        },
        setSelection(val) {
            if (val === 'full') this.setSelectionData(1, this.alignment.dbLen)
            else this.setSelectionData(this.alignment.dbStartPos, this.alignment.dbEndPos)
        },
        setQuerySelection() {
            if (!this.queryRepr) return;
            this.queryRepr.setSelection(this.querySele)
            this.stage.autoView(100)
        },
        renderArrows() {
            // Update arrow shape on shape update
            if (!this.stage) return
            if (this.arrowShape) this.arrowShape.dispose()
            let matches = new Array()
            for (let i = 0; i < this.tMatches.length; i++) {
                let qMatch = this.qMatches[i]
                let tMatch = this.tMatches[i]
                if (this.selection && !(tMatch.index >= this.selection[0] - 1 && tMatch.index < this.selection[1]))
                    continue
                matches.push([qMatch.xyz(), tMatch.xyz()])
            }
            this.arrowShape = this.stage.addComponentFromObject(createArrows(matches))
            this.arrowShape.addRepresentation('buffer')
            this.arrowShape.setVisibility(this.showArrows)
        },
        makeImage() {
            if (!this.stage) return
            let accession = null;
            if (this.queryRepr) {
                const qIndex = this.hits.query.header.indexOf(' ');
                accession = qIndex === -1 ? this.hits.query.header : this.hits.query.header.substring(0, qIndex);
            }
            this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            this.stage.makeImage({
                trim: true,
                factor: (this.isFullscreen) ? 1 : 8,
                antialias: true,
                transparent: true,
            }).then((blob) => {
                this.stage.viewer.setLight(undefined, undefined, undefined, this.$vuetify.theme.dark ? 0.4 : 0.2)
                download(blob, (accession ? (qAccession + '-') : '') + this.alignment.target + ".png")
            })
        },
        makePdb() {
            if (!this.stage) return
            let qPDB, tPDB, result;
            let accession = null;
            if (this.queryRepr) {
                qPDB = new PdbWriter(this.queryRepr.repr.structure, { renumberSerial: false }).getData()
                qPDB = qPDB.split('\n').filter(line => line.startsWith('ATOM')).join('\n')
                const qIndex = this.hits.query.header.indexOf(' ');
                accession = qIndex === -1 ? this.hits.query.header : this.hits.query.header.substring(0, qIndex);
            }
            if (this.targetRepr) {
                tPDB = new PdbWriter(this.targetRepr.repr.structure, { renumberSerial: false }).getData()
                tPDB = tPDB.split('\n').filter(line => line.startsWith('ATOM')).join('\n')
            }
            if (!qPDB && !tPDB) return

            if (qPDB && tPDB) {
                result =
`TITLE     ${accession} - ${this.alignment.target}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com
REMARK     Please cite:
REMARK       https://doi.org/10.1101/2022.02.07.479398
REMARK     Warning: Non C-alpha atoms might have been re-generated by PULCHRA,
REMARK              if they are not present in the original PDB file.
MODEL        1
${qPDB}
ENDMDL
MODEL        2
${tPDB}
ENDMDL
END
`
            } else {
                result =
`TITLE     ${this.alignment.target}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com
REMARK     Please cite:
REMARK       https://doi.org/10.1101/2022.02.07.479398
REMARK     Warning: Non C-alpha atoms were re-generated by PULCHRA.
MODEL        1
${tPDB}
ENDMDL
END
`
            }
            download(new Blob([result], { type: 'text/plain' }), (accession ? (accession + '-') : '') + this.alignment.target + ".pdb")
        }
    },
    watch: {
        'showTarget': function(val, _) {
            this.setSelection(val)
        },
        'showArrows': function(val, _) {
            if (!this.stage || !this.arrowShape) return
            this.arrowShape.setVisibility(val)
        },
        'selection': function([start, end]) {
            this.setSelectionByRange(start, end)
            this.renderArrows()
        },
        'showQuery': function() {
            if (!this.stage) return
            this.setQuerySelection()
        },
    },
    computed: {
        queryChainId: function() {
            return (this.queryChain) ? this.queryChain.charCodeAt(0) - 'A'.charCodeAt(0) : 'A'
        },
        queryChainSele: function() {
            return (this.queryChain) ? `(:${this.queryChain.toUpperCase()} OR :${this.queryChain.toLowerCase()})` : '';
        },
        querySubSele: function() {
            if (!this.qChainResMap) {
                return '';
            }
            let start = this.qChainResMap.get(this.alignment.qStartPos);
            let end   = this.qChainResMap.get(this.alignment.qEndPos);
            let sele  = `${start.resno}-${end.resno}`;
            if (this.queryChain) {
                sele = `${sele} AND ${this.queryChainSele}`;
            }
            return sele
        },
        querySele: function() {
            if (this.showQuery == 0)
                return this.querySubSele;
            if (this.showQuery == 1)
                return this.queryChainSele;
            return ''
        },
        targetSele: function() {
            if (!this.selection) return ''
            return `${this.selection[0]}-${this.selection[1]}`;
        },
        tmPanelBindings: function() {
            return (this.isFullscreen) ? { 'style': 'margin-top: 10px; font-size: 2em; line-height: 2em' } : {  }
        },
    },
    beforeMount() {
        let qChain = this.hits.query.header.match(/_([A-Z]+?)/m)
        if (qChain) this.queryChain = qChain[1] //.replace('_', '')
    },
    async mounted() {
        if (typeof(this.alignment.tCa) == "undefined")
            return;

        const targetPdb = await pulchra(mockPDB(this.alignment.tCa, this.alignment.tSeq));
        const target = await this.stage.loadFile(new Blob([targetPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
        this.targetSchemeId = ColormakerRegistry.addSelectionScheme([
            [this.targetAlignedColor, `${this.alignment.dbStartPos}-${this.alignment.dbEndPos}`],
            [this.targetUnalignedColor, "*"]
        ], "_targetScheme")

        // Download from server --> full input PDB from /result/query endpoint, saved with JSON.stringify
        //                local --> qCa string
        // Tickets prefixed with 'user-' only occur on user uploaded files
        let queryPdb = "";
        let hasQuery = true;
        if (this.$LOCAL) {
            if (this.hits.query.hasOwnProperty('pdb')) {
                queryPdb = JSON.parse(this.hits.query.pdb);
            } else {
                queryPdb = await pulchra(mockPDB(this.hits.query.qCa, this.hits.query.sequence))
            }
        } else if (this.$route.params.ticket.startsWith('user')) {
            // Check for special 'user' ticket for when users have uploaded JSON
            if (this.hits.query.hasOwnProperty('pdb')) {
                queryPdb = JSON.parse(this.hits.query.pdb);
            } else {
                const localData = this.$root.userData[this.$route.params.entry];
                queryPdb = await pulchra(mockPDB(localData.query.qCa, localData.query.sequence));
            }
        } else {
            try {
                const request = await this.$axios.get("api/result/" + this.$route.params.ticket + '/query');
                queryPdb = request.data;
            } catch (e) {
                // console.log(e);
                queryPdb = "";
                hasQuery = false;
            }
        }

        if (hasQuery) {
            let data = '';
            for (let line of queryPdb.split('\n')) {
                let numCols = Math.max(0, 80 - line.length);
                let newLine = line + ' '.repeat(numCols) + '\n';
                data += newLine
            }
            queryPdb = data;

            let query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
            if (query && query.structure.getAtomProxy().isCg()) {
                queryPdb = await pulchra(queryPdb);
                query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
            }

            // Map 1-based indices to residue index/resno; only need for query structure
            // Use queryChainSele to make all selections based on actual query chain
            this.qChainResMap = makeChainMap(query.structure, this.queryChainSele)
            this.saveMatchingResidues(this.alignment.qAln, this.alignment.dbAln, query.structure, target.structure)

            // Generate colorschemes for query/target based on alignment
            this.querySchemeId = ColormakerRegistry.addSelectionScheme([
                [this.queryAlignedColor, this.querySubSele],
                [this.queryUnalignedColor, "*"],
            ], "_queryScheme")

            // Generate subsetted PDBs for TM-align
            let qSubPdb = makeSubPDB(query.structure, this.querySubSele)
            let tSubPdb = makeSubPDB(target.structure, `${this.alignment.dbStartPos}-${this.alignment.dbEndPos}`)
            let alnFasta = `>target\n${this.alignment.dbAln}\n\n>query\n${this.alignment.qAln}`

            // Re-align target to query using TM-align for better superposition
            // Target 1st since TM-align generates superposition matrix for 1st structure
            tmalign(tSubPdb, qSubPdb, alnFasta).then(out => {
                this.tmAlignResults = parseTMOutput(out.output)
                let { t, u } = parseTMMatrix(out.matrix)
                transformStructure(target.structure, t, u)
                this.queryRepr = query.addRepresentation(this.qRepr, {color: this.querySchemeId})
                this.targetRepr = target.addRepresentation(this.tRepr, {color: this.targetSchemeId})
            }).then(() => {
                this.setSelection(this.showTarget)
                this.setQuerySelection()
                this.stage.autoView()
            })
        } else {
            this.targetRepr = target.addRepresentation(this.tRepr, {color: this.targetSchemeId})
            this.setSelection(this.showTarget)
            this.setQuerySelection()
            this.stage.autoView()
        }
    },
}
</script>

<style scoped>
.structure-wrapper {
    width: 400px;
    height: 300px;
    margin: 0 auto;
}
</style>

<style>
.theme--dark .structure-wrapper .v-tooltip__content {
    background: rgba(97, 97, 97, 0.3);
}
/* @media only screen and (max-width: 600px) {
    .structure-wrapper {
        width: 300px;
    }
} */
.structure-viewer {
    width: 100%;
    height: 100%;
}
.structure-viewer canvas {
    border-radius: 2px;
}
.structure-panel {
    position: relative;
}
.toolbar-panel {
    display: inline-flex;
    flex-direction: row;
    position: absolute;
    justify-content: center;
    width: 100%;
    bottom: 0;
    z-index: 1;
    left: 0;
}
.tmscore-panel {
    position: absolute;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    font-family: monospace;
    color: rgb(31, 119, 180);
}
.left-cell {
    text-align: right;
    width: 50%;
}
.right-cell {
    text-align: left;
    width: 50%;
    padding-left: 0.3em;
}
</style>
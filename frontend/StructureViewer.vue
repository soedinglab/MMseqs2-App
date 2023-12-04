<template>
<div class="structure-panel" v-if="alignments.length > 0 && 'tCa' in alignments[0]">
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
        <div class="structure-viewer" ref="viewport"></div>
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
    data() {
        return {
            qChainResMap: null,
            qMatches: [],
            queryChain: '',
            queryReps: [],
            selection: null,
            showArrows: false,
            showQuery: 0,
            showTarget: 'aligned',
            tMatches: [],
            targetReps: [],
            tmAlignResults: null,
            queryMap: this.queryMaps[0],
            targetMap: this.targetMaps[0],
        }
    },
    props: {
        alignments: { type: Array },
        queryFile: { type: String },
        queryAlignedColor: { type: String, default: "#1E88E5" },
        queryUnalignedColor: { type: String, default: "#A5CFF5" },
        targetAlignedColor: { type: String, default: "#FFC107" },
        targetUnalignedColor: { type: String, default: "#FFE699" },
        qRepr: { type: String, default: "cartoon" },
        tRepr: { type: String, default: "cartoon" },
        queryMaps: { type: Array, default: null },
        targetMaps: { type: Array, default: null },
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
            if (this.targetReps.length == 0) return
            this.targetReps[0].setSelection(`${start}-${end}`)
            this.stage.autoView(100)
        },
        setSelectionData(start, end) {
            this.selection = [start, end]
        },
        setSelection(val) {
            if (val === 'full') {
                this.setSelectionData(1, this.alignments[0].dbLen)
            } else {
                this.setSelectionData(this.alignments[0].dbStartPos, this.alignments[0].dbEndPos)
            }
        },
        setQuerySelection() {
            if (this.queryReps.length == 0) return;
            this.queryReps[0].setSelection(this.querySele)
            this.stage.autoView(100)
        },
        renderArrows() {
            // Update arrow shape on shape update
            if (!this.stage) return
            if (this.arrowShape) {
                this.arrowShape.dispose()
            }
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
        async handleMakeImage() {
            if (!this.stage) {
                return;
            }
            let title = [];
            for (let alignment of this.alignments) {
                if (this.queryReps.length > 0) {
                    title.push(alignment.query + "-" + alignment.target);
                } else {
                    title.push(alignment.target);
                }
            };
            this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            const blob = await this.stage.makeImage({
                trim: true,
                factor: (this.isFullscreen) ? 1 : 8,
                antialias: true,
                transparent: true,
            })
            this.stage.viewer.setLight(undefined, undefined, undefined, this.$vuetify.theme.dark ? 0.4 : 0.2)
            download(blob, (title.join("_") + ".pdb"))
        },
        handleMakePDB() {
            if (!this.stage) {
                return;
            }

            let qPDB = null;
            if (this.queryReps.length > 0) {
                qPDB = "";
                for (let i = 0; i < this.queryReps.length; i++) {
                    let curr = new PdbWriter(this.queryReps[i].repr.structure, { renumberSerial: false }).getData()
                    curr = curr.split('\n').filter(line => line.startsWith('ATOM')).join('\n') + '\n';
                    qPDB += curr;
                }
            }

            let tPDB = null;
            if (this.targetReps.length > 0) {
                tPDB = "";
                for (let i = 0; i < this.targetReps.length; i++) {
                    let curr = new PdbWriter(this.targetReps[i].repr.structure, { renumberSerial: false }).getData()
                    curr = curr.split('\n').filter(line => line.startsWith('ATOM')).join('\n') + '\n';
                    tPDB += curr;
                }
            }

            if (!qPDB && !tPDB) {
                return;
            }

            let title = [];
            for (let alignment of this.alignments) {
                if (qPDB) {
                    title.push(alignment.query + "-" + alignment.target);
                } else {
                    title.push(alignment.target);
                }
            };

            let result = null;
            if (qPDB && tPDB) {
                result =
`TITLE     ${title.join(" ")}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com
REMARK     Please cite:
REMARK       https://doi.org/10.1101/2022.02.07.479398
REMARK     Warning: Non C-alpha atoms might have been re-generated by PULCHRA,
REMARK              if they are not present in the original PDB file.
MODEL        1
${qPDB}ENDMDL
MODEL        2
${tPDB}ENDMDL
END
`
            } else {
                result =
`TITLE     ${title.join(" ")}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com
REMARK     Please cite:
REMARK       https://doi.org/10.1101/2022.02.07.479398
REMARK     Warning: Non C-alpha atoms were re-generated by PULCHRA.
MODEL        1
${tPDB}ENDMDL
END
`
            }
            download(new Blob([result], { type: 'text/plain' }), (title.join("_") + ".pdb"));
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
            let start = this.qChainResMap.get(this.alignments[0].qStartPos);
            let end   = this.qChainResMap.get(this.alignments[0].qEndPos);
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
        // console.log(this.hits)
        // const accession = this.hits.queries[0].header.split(/(\s+)/)[0];
        // const qChain = accession.match(/_([A-Z]+?)/m)
        // if (qChain) this.queryChain = qChain[1] //.replace('_', '')
    },
    async mounted() {
        if (typeof(this.alignments[0].tCa) == "undefined")
            return;

        // Download from server --> full input PDB from /result/query endpoint, saved with JSON.stringify
        //                local --> qCa string
        // Tickets prefixed with 'user-' only occur on user uploaded files
        let queryPdb = "";
        let hasQuery = true;
        if (this.$LOCAL) {
            if (this.hits.queries[0].hasOwnProperty('pdb')) {
                queryPdb = JSON.parse(this.hits.queries[0].pdb);
            } else {
                queryPdb = mockPDB(this.hits.queries[0].qCa, this.hits.queries[0].sequence, 'A');
            }
        } else if (this.$route.params.ticket.startsWith('user')) {
            // Check for special 'user' ticket for when users have uploaded JSON
            if (this.hits.queries[0].hasOwnProperty('pdb')) {
                queryPdb = JSON.parse(this.hits.queries[0].pdb);
            } else {
                const localData = this.$root.userData[this.$route.params.entry];
                queryPdb = mockPDB(localData.queries[0].qCa, localData.queries[0].sequence, 'A');
            }
        } else {
            try {
                const request = await this.$axios.get("api/result/" + this.$route.params.ticket + '/query');
                queryPdb = request.data;
            } catch (e) {
                queryPdb = "";
                hasQuery = false;
            }
        }

        const targets = [];
        let renumber = 0;
        for (let alignment of this.alignments) {
            const chainPos = alignment.target.lastIndexOf('_');
            const chain = chainPos != -1 ? alignment.target.substring(chainPos + 1) : 'A';
            const mock = mockPDB(alignment.tCa, alignment.tSeq, chain);
            const targetPdb = await pulchra(mock);
            const target = await this.stage.loadFile(new Blob([targetPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
            target.structure.eachChain(c => {
                c.chainname = chain;
            });
            target.structure.eachAtom(a => {
                a.serial = renumber++;
            });
            targets.push(target);
        }
        if (ColormakerRegistry.hasScheme("_targetScheme")) {
            ColormakerRegistry.removeScheme("_targetScheme")
        }
        this.targetSchemeId = ColormakerRegistry.addSelectionScheme([
            [this.targetAlignedColor, `${this.alignments[0].dbStartPos}-${this.alignments[0].dbEndPos}`],
            [this.targetUnalignedColor, "*"]
        ], "_targetScheme")

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
                this.stage.removeComponent(query);
                query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
            }

            // Map 1-based indices to residue index/resno; only need for query structure
            // Use queryChainSele to make all selections based on actual query chain
            this.qChainResMap = makeChainMap(query.structure, this.queryChainSele)
            this.saveMatchingResidues(this.alignments[0].qAln, this.alignments[0].dbAln, query.structure, targets[0].structure)

            // Generate colorschemes for query/target based on alignment
            this.querySchemeId = ColormakerRegistry.addSelectionScheme([
                [this.queryAlignedColor, this.querySubSele],
                [this.queryUnalignedColor, "*"],
            ], "_queryScheme")

            // Re-align target to query using TM-align for better superposition
            // Target 1st since TM-align generates superposition matrix for 1st structure
            if (this.alignments[0].hasOwnProperty("complexu") && this.alignments[0].hasOwnProperty("complext")) {
                this.queryReps = [ query.addRepresentation(this.qRepr, {color: this.querySchemeId}) ]
                const t = this.alignments[0].complext.split(',').map(x => parseFloat(x));
                let u = this.alignments[0].complexu.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];

                let reps = [];
                for (let i = 0; i < this.alignments.length; i++) {
                    transformStructure(targets[i].structure, t, u)
                    reps.push(targets[i].addRepresentation(this.tRepr, {color: this.targetSchemeId}))

                }
                this.queryReps = [ query.addRepresentation(this.qRepr, {color: this.querySchemeId}) ]
                this.targetReps = reps;
            } else {
                // Generate subsetted PDBs for TM-align
                let qSubPdb = makeSubPDB(query.structure, this.querySubSele)
                let tSubPdb = makeSubPDB(targets[0].structure, `${this.alignments[0].dbStartPos}-${this.alignments[0].dbEndPos}`)
                let alnFasta = `>target\n${this.alignments[0].dbAln}\n\n>query\n${this.alignments[0].qAln}`
                const tm = await tmalign(tSubPdb, qSubPdb, alnFasta);
                this.tmAlignResults = parseTMOutput(tm.output)
                let { t, u } = parseTMMatrix(tm.matrix)
                transformStructure(targets[0].structure, t, u)
                this.queryReps = [ query.addRepresentation(this.qRepr, {color: this.querySchemeId}) ]
                this.targetReps = [ targets[0].addRepresentation(this.tRepr, {color: this.targetSchemeId}) ]
            }
            this.setSelection(this.showTarget)
            this.setQuerySelection()
            this.stage.autoView()
        } else {
            this.targetReps = [ targets[0].addRepresentation(this.tRepr, {color: this.targetSchemeId}) ]
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
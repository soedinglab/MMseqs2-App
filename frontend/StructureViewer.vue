<template>
    <div class="structure-panel" v-if="'tCa' in alignment">
        <div class="structure-wrapper" ref="structurepanel">
            <div v-if="tmAlignResults" class="tmscore-panel" v-bind="tmPanelBindings">
                TM-Score: {{ tmAlignResults.tmScore }}
            </div>
            <div class="toolbar-panel">
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="makeImage()"
                    title="Save image"
                >
                    <span v-if="isFullscreen">Save image</span>
                    <v-icon v-bind="tbIconBindings">{{ $MDI.FileDownloadOutline }}</v-icon>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="toggleFullQuery()"
                    title="Toggle between the entire query structure and aligned region"
                >
                    <span v-if="isFullscreen">Toggle full query</span>
                    <v-icon v-bind="tbIconBindings" style='color: grey;' v-if="showFullQuery">{{ $MDI.Circle }}</v-icon>
                    <v-icon v-bind="tbIconBindings" style='color: grey;' v-else>{{ $MDI.CircleHalf }}</v-icon>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="toggleFullTarget()"
                    title="Toggle between the entire target structure and aligned region"
                >
                    <span v-if="isFullscreen">Toggle full target</span>
                    <v-icon v-bind="tbIconBindings" style='color: red;' v-if="showTarget == 'aligned'">{{ $MDI.CircleHalf }}</v-icon>
                    <v-icon v-bind="tbIconBindings" style='color: red;' v-else>{{ $MDI.Circle }}</v-icon>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="toggleArrows()"
                    title="Draw arrows between aligned residues"
                >
                    <span v-if="isFullscreen">Toggle arrows</span>
                    <v-icon v-bind="tbIconBindings" v-if="showArrows">{{ $MDI.ArrowRightCircle }}</v-icon>
                    <v-icon v-bind="tbIconBindings" v-else>{{ $MDI.ArrowRightCircleOutline }}</v-icon>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="resetView()"
                    :input-value="
                        selection != null
                            && ((selection[0] != alignment.dbStartPos || selection[1] != alignment.dbEndPos)
                            && (selection[0] != 1 || selection[1] != alignment.dbLen))"
                    title="Reset the view to the original position and zoom level"
                >
                    <span v-if="isFullscreen">Reset view</span>
                    <v-icon v-bind="tbIconBindings">{{ $MDI.Restore }}</v-icon>
                </v-btn>
                <v-btn v-bind="tbButtonBindings"
                    v-on:click="toggleFullscreen()"
                    title="Enter fullscreen mode - press ESC to exit"
                >
                    <span v-if="isFullscreen">Fullscreen</span>
                    <v-icon v-bind="tbIconBindings">{{ $MDI.Fullscreen }}</v-icon>
                </v-btn>
            </div>
            <div class="structure-viewer" ref="viewport" />
        </div>
    </div>
</template>

<script>
import { Shape, Stage, Selection, download } from 'ngl';
import Panel from './Panel.vue';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parse, parseMatrix } from 'tmalign-wasm';

// Create NGL arrows from array of ([X, Y, Z], [X, Y, Z]) pairs
function createArrows(matches) {
    const shape = new Shape('shape')
    for (let i = 0; i < matches.length; i++) {
        const [a, b] = matches[i]
        shape.addArrow(a, b, [0, 1, 1], 0.4)
    }
    return shape
}

const oneToThree = {
  "A":"ALA", "R":"ARG", "N":"ASN", "D":"ASP",
  "C":"CYS", "E":"GLU", "Q":"GLN", "G":"GLY",
  "H":"HIS", "I":"ILE", "L":"LEU", "K":"LYS",
  "M":"MET", "F":"PHE", "P":"PRO", "S":"SER",
  "T":"THR", "W":"TRP", "Y":"TYR", "V":"VAL",
  "U":"SEC", "O":"PHL", "X":"XAA"
};

/**
 * Create a mock PDB from Ca data
 * Follows the spacing spec from https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
 * Will have to change if/when swapping to fuller data
 */
function mockPDB(ca, seq) {
    const atoms = ca.split(',')
    const pdb = new Array()
    let j = 1
    for (let i = 0; i < atoms.length; i += 3, j++) {
        let [x, y, z] = atoms.slice(i, i + 3).map(element => parseFloat(element))
        pdb.push(
            'ATOM  '
            + j.toString().padStart(5)
            + '  CA  ' + oneToThree[seq != "" && (atoms.length/3) == seq.length ? seq[i/3] : 'A'] + ' A'
            + j.toString().padStart(4)
            + '    '
            + x.toString().padStart(8)
            + y.toString().padStart(8)
            + z.toString().padStart(8)
            + '  1.00  0.00           C  '
        )
    }
    return pdb.join('\n')
}

/**
 * Shift structure x, y, z coordinates by some offset
 * @param {StructureComponent} structure
 * @param {float} offset
 */
const offsetStructure = (structure, offset = 0.5) => {
	structure.structure.eachAtom(atom => {
		atom.x = atom.x + offset;	
		atom.y = atom.y + offset;	
		atom.z = atom.z + offset;	
	})
	return structure
}

/* ------ The rotation matrix to rotate Chain_1 to Chain_2 ------ */
/* m               t[m]        u[m][0]        u[m][1]        u[m][2] */
/* 0     161.2708425765   0.0663961888  -0.6777150909  -0.7323208325 */
/* 1     109.4205584665  -0.9559071424  -0.2536229340   0.1480437178 */
/* 2      29.1924015422  -0.2860648199   0.6902011757  -0.6646722921 */
/* Code for rotating Structure A from (x,y,z) to (X,Y,Z): */
/* for(i=0; i<L; i++) */
/* { */
/*    X[i] = t[0] + u[0][0]*x[i] + u[0][1]*y[i] + u[0][2]*z[i]; */
/*    Y[i] = t[1] + u[1][0]*x[i] + u[1][1]*y[i] + u[1][2]*z[i]; */
/*    Z[i] = t[2] + u[2][0]*x[i] + u[2][1]*y[i] + u[2][2]*z[i]; */
/* } */
const transformStructure = (structure, t, u) => {
    structure.eachAtom(atom => {
        const [x, y, z] = [atom.x, atom.y, atom.z]
        atom.x = t[0] + u[0][0] * x + u[0][1] * y + u[0][2] * z
        atom.y = t[1] + u[1][0] * x + u[1][1] * y + u[1][2] * z
        atom.z = t[2] + u[2][0] * x + u[2][1] * y + u[2][2] * z
    })
    return structure
}

// Get XYZ coordinates of CA of a given residue
const xyz = (structure, resIndex) => {
    var rp = structure.getResidueProxy()
    var ap = structure.getAtomProxy()
    rp.index = resIndex
    ap.index = rp.getAtomIndexByName('CA')
    return [ap.x, ap.y, ap.z]
}

// Given an NGL AtomProxy, return the corresponding PDB line
const atomToPDBRow = (ap) => {
    const { serial, atomname, resname, chainname, resno, inscode, x, y, z } = ap
    return `ATOM  ${serial.toString().padStart(5)}${atomname.padStart(4)}  ${resname.padStart(3)} ${chainname.padStart(1)}${resno.toString().padStart(4)} ${inscode.padStart(1)}  ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}`
}

// Map 1-based indices in a selection to residue index/resno
const makeChainMap = (structure, sele) => {
    let idx = 1
    let map = new Map()
    structure.eachResidue(rp => { map.set(idx++, { index: rp.index, resno: rp.resno }) }, new Selection(sele))
    return map
}

// Generate a subsetted PDB file from a structure and selection
const makeSubPDB = (structure, sele) => {
    let pdb = []
    structure.eachAtom(ap => { pdb.push(atomToPDBRow(ap)) }, new Selection(sele))
    return pdb.join('\n')
}

export default {
    components: { Panel },
    data: () => ({
        'showTarget': 'aligned',
        'showFullQuery': false,
        'showArrows': false,
        'selection': null,
        'queryChain': 'A',
        'qChainResMap': null,
        'isFullscreen': false,
        'tmAlignResults': null,
    }),
    props: {
        'alignment': Object,
        'queryFile': String,
        'qColour': { type: String, default: "white" },
        'tColour': { type: String, default: "red" },
        'qRepr': { type: String, default: "ribbon" },
        'tRepr': { type: String, default: "ribbon" },
        'bgColourLight': { type: String, default: "white" },
        'bgColourDark': { type: String, default: "#eee" },
        'queryMap': { type: Map, default: null },
        'targetMap': { type: Map, default: null },
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
                if (aln1[i] === '-' || aln2[i] === '-') continue
                let qIdx = this.qChainResMap.get(this.queryMap.get(i)).index
                let tIdx = this.targetMap.get(i) - 1
                this.qMatches.push({ index: qIdx, xyz: () => xyz(str1, qIdx) })
                this.tMatches.push({ index: tIdx, xyz: () => xyz(str2, tIdx) })
            }
        },
        handleResize() {
            if (!this.stage) return
            this.stage.handleResize()
        },
        toggleFullscreen() {
            if (!this.stage) return
            this.stage.toggleFullscreen(this.$refs.structurepanel)
        },
        resetView() {
            if (!this.stage) return
            this.setSelection(this.showTarget)
            this.stage.autoView(100)
        },
        toggleArrows() {
            if (!this.stage || !this.arrowShape) return
            this.showArrows = !this.showArrows
        },
        toggleFullQuery() {
            if (!this.stage) return
            this.showFullQuery = !this.showFullQuery
        },
        toggleFullTarget() {
            if (!this.stage) return
            this.showTarget = this.showTarget === 'aligned' ? 'full' : 'aligned'
        },
        setSelectionByRange(start, end) {
            if (!this.targetRepr) return
            this.targetRepr.setSelection(`${start}-${end}`)
        },
        setSelectionData(start, end) {
            this.selection = [start, end]
        },
        setSelection(val) {
            if (val === 'full') this.setSelectionData(1, this.alignment.dbLen)
            else this.setSelectionData(this.alignment.dbStartPos, this.alignment.dbEndPos)
        },
        setQuerySelection() {
            this.queryRepr.setSelection(this.queryChainSele)
            this.queryRepr.parent.autoView(this.queryChainSele)
        },
        // Update arrow shape on shape update
        renderArrows() {
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
            this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            this.stage.makeImage({
                trim: true,
                factor: (this.isFullscreen) ? 1 : 8,
                antialias: true,
                transparent: true,
            }).then((blob) => {
                this.stage.viewer.setLight(undefined, undefined, undefined, this.$vuetify.theme.dark ? 0.4 : 0.2)
                download(blob, this.$route.params.ticket + '-' + this.alignment.target + ".png")
            })
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
        'showFullQuery': function() {
            if (!this.stage) return
            this.setQuerySelection()
        },
        '$route': function() {}
    },
    computed: {
        queryChainId: function() { return this.queryChain.charCodeAt(0) - 'A'.charCodeAt(0) },
        queryChainSele: function() { return (this.showFullQuery) ? '' :
            `(:${this.queryChain.toUpperCase()} OR :${this.queryChain.toLowerCase()})` },
        querySubSele: function() {
            if (!this.queryChainSele || !this.qChainResMap) return ''
            let start = `${this.qChainResMap.get(this.alignment.qStartPos).resno}`
            let end = `${this.qChainResMap.get(this.alignment.qEndPos).resno}`
            return `${start}-${end} AND ${this.queryChainSele}`
        },
        tmPanelBindings: function() {
            return (this.isFullscreen) ? { 'style': 'margin-top: 10px; font-size: 2em;' } : {  }
        },
        tbIconBindings: function() {
            return (this.isFullscreen) ? { 'right': true } : {}
        },
        tbButtonBindings: function() {
            return (this.isFullscreen) ? {
                'large': true,
                'small': false,
                'style': 'margin-left: 5px; margin-bottom: 10px;',
            } : {
                'large': false,
                'small': true,
                'style': ''
            }
        }
    },
    beforeMount() {
        let qChain = this.alignment.query.match(/_([A-Z]+?)/gm)
        if (qChain) this.queryChain = qChain[0].replace('_', '')
    },
    mounted() {
        const bgColor = this.$vuetify.theme.dark ? this.bgColourDark : this.bgColourLight;
        const ambientIntensity = this.$vuetify.theme.dark ? 0.4 : 0.2;
        if (typeof(this.alignment.tCa) == "undefined")
            return;
        this.stage = new Stage(this.$refs.viewport, { backgroundColor: bgColor, ambientIntensity: ambientIntensity })

        Promise.all([
            this.$axios.get("api/result/" + this.$route.params.ticket + '/query'),
            pulchra(mockPDB(this.alignment.tCa, this.alignment.tSeq))
        ]).then(([qResponse, tPdb]) => {
            Promise.all([
                this.stage.loadFile(new Blob([qResponse.data], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true}),
                this.stage.loadFile(new Blob([tPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true}),
            ])
            .then(([query, target]) => {
                // fix query if its course-grained (i.e. non-complete backbone)
                // foldseek doesn't care about the oxygen, but NGL does
                if (query.structure.getAtomProxy().isCg()) {
                    return new Promise((resolve, reject) => {
                        pulchra(qResponse.data)
                        .then((queryPdb) => {
                            this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true})
                            .then((query) => { resolve([query, target]) })
                            .catch(reject)
                        }).catch(reject)
                    })
                } else {
                    return [query, target];
                }
            })
            .then(([query, target]) => {
                // Map 1-based indices to residue index/resno; only need for query structure
                this.qChainResMap = makeChainMap(query.structure, this.queryChainSele)
                this.saveMatchingResidues(this.alignment.qAln, this.alignment.dbAln, query.structure, target.structure)

                // Generate subsetted PDBs for TM-align
                let qSubPdb = makeSubPDB(query.structure, this.querySubSele)
                let tSubPdb = makeSubPDB(target.structure, `${this.alignment.dbStartPos}-${this.alignment.dbEndPos}`)
                let alnFasta = `>target\n${this.alignment.dbAln}\n\n>query\n${this.alignment.qAln}`

                // Re-align target to query using TM-align for better superposition
                // Target 1st since TM-align generates superposition matrix for 1st structure
                tmalign(tSubPdb, qSubPdb, alnFasta).then(out => {
                    this.tmAlignResults = parse(out.output)
                    let { t, u } = parseMatrix(out.matrix)
                    transformStructure(target.structure, t, u)
                    this.queryRepr = query.addRepresentation(this.qRepr, {color: this.qColour})
                    this.targetRepr = target.addRepresentation(
                        this.tRepr,
                        {color: this.tColour, colorScheme: 'uniform'}
                    )
                }).then(() => {
                    query.autoView()
                    this.setSelection(this.showTarget)
                    this.setQuerySelection()
                })
            })
        })
        window.addEventListener('resize', this.handleResize)
        this.stage.signals.fullscreenChanged.add((isFullscreen) => {
            if (isFullscreen) {
                this.stage.viewer.setBackground('#ffffff')
                this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
                this.isFullscreen = true
            } else {
                this.stage.viewer.setBackground(bgColor)
                this.stage.viewer.setLight(undefined, undefined, undefined, ambientIntensity)
                this.isFullscreen = false
            }
        })
    },
    beforeDestroy() {
        if (typeof(this.stage) == 'undefined')
            return
        this.stage.dispose() 
        window.removeEventListener('resize', this.handleResize)
    }
}
</script>

<style>
.structure-wrapper {
    width: 400px;
    height: 300px;
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
}
.tmscore-panel {
    position: absolute;
    text-align: center;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    font-family: monospace;
    color: rgb(31, 119, 180);
}
</style>

<template>
    <div class="structure-panel" v-if="'tCa' in alignment">
        <div class="structure-wrapper" ref="structurepanel">
            <v-tooltip open-delay="300" bottom attach=".structure-wrapper" background-color="transparent">
                <template v-slot:activator="{ on }">
                    <v-icon :light="isFullscreen" v-on="on" style="position: absolute; z-index: 999; right:0">{{ $MDI.HelpCircleOutline }}</v-icon>
                </template>
                <span>
                    <dl style="text-align: center;">
                        <dt>
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2" viewBox="0 0 32 32">
<title>Left click</title>
<path d="M25.6 5.8a5 5 0 0 0-5-4.8h-9.1a5 5 0 0 0-5.1 4.8v20.4a5 5 0 0 0 5 4.8h9.1a5 5 0 0 0 5.1-4.8V5.8Zm-1 9.5v10.9a4 4 0 0 1-4 3.8h-9.1a4 4 0 0 1-4-3.8V15.3h17ZM15.5 2v12.3h-8V5.8a4 4 0 0 1 4-3.8h4Zm1 0h4a4 4 0 0 1 4 3.8v8.5h-8V2Z"/>
<path id="left" d="M15.5 2v12.3h-8V5.8a4 4 0 0 1 4-3.8h4Z" style="fill:red"/>
<path id="middle-inactive" d="M14.6 4h2.8v8h-2.8z"/>
</svg>
                        </dt>
                        <dd>
                            Rotate
                        </dd>
                        <dt>
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2" viewBox="0 0 32 32">
<title>Right click</title>
<path d="M25.6 5.8a5 5 0 0 0-5-4.8h-9.1a5 5 0 0 0-5.1 4.8v20.4a5 5 0 0 0 5 4.8h9.1a5 5 0 0 0 5.1-4.8V5.8Zm-1 9.5v10.9a4 4 0 0 1-4 3.8h-9.1a4 4 0 0 1-4-3.8V15.3h17ZM15.5 2v12.3h-8V5.8a4 4 0 0 1 4-3.8h4Zm1 0h4a4 4 0 0 1 4 3.8v8.5h-8V2Z"/>
<path id="right" d="M16.5 2h4a4 4 0 0 1 4 3.8v8.5h-8V2Z" style="fill:red"/>
<path id="middle-inactive" d="M14.6 4h2.8v8h-2.8z"/>
</svg>
                        </dt>
                        <dd>
                            Pan
                        </dd>
                        <dt>
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2" viewBox="0 0 32 32">
<title>Scroll wheel</title>
<path d="M25.6 5.8a5 5 0 0 0-5-4.8h-9.1a5 5 0 0 0-5.1 4.8v20.4a5 5 0 0 0 5 4.8h9.1a5 5 0 0 0 5.1-4.8V5.8Zm-1 9.5v10.9a4 4 0 0 1-4 3.8h-9.1a4 4 0 0 1-4-3.8V15.3h17ZM15.5 2v12.3h-8V5.8a4 4 0 0 1 4-3.8h4Zm1 0h4a4 4 0 0 1 4 3.8v8.5h-8V2Z"/>
<path id="middle-active" d="M14.6 4h2.8v8h-2.8z" style="fill:red"/>
</svg>
                        </dt>
                        <dd>
                            Zoom
                        </dd>
                    </dl>
                </span>
            </v-tooltip>
            <div v-if="tmAlignResults" class="tmscore-panel" v-bind="tmPanelBindings">
                TM-Score: {{ tmAlignResults.tmScore }}
                <br>
                RMSD: {{ tmAlignResults.rmsd }}
            </div>
            <div class="toolbar-panel">
                <v-item-group class="v-btn-toggle" :light="isFullscreen">
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="makePdb()"
                    title="Save PDB"
                >
                    <v-icon v-bind="tbIconBindings">M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14Zm0 8v-.8c0-.7-.6-1.2-1.3-1.2h-2.4v6h2.4c.7 0 1.2-.5 1.2-1.2v-1c0-.4-.4-.8-.9-.8.5 0 1-.4 1-1Zm-9.7.5v-1c0-.8-.7-1.5-1.5-1.5H5.3v6h1.5v-2h1c.8 0 1.5-.7 1.5-1.5Zm5 2v-3c0-.8-.7-1.5-1.5-1.5h-2.5v6h2.5c.8 0 1.5-.7 1.5-1.5Zm3.4.3h-1.2v-1.2h1.2v1.2Zm-5.9-3.3v3h1v-3h-1Zm-5 0v1h1v-1h-1Zm11 .9h-1.3v-1.2h1.2v1.2Z</v-icon>
                    <span v-if="isFullscreen">&nbsp;Save PDB</span>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="makeImage()"
                    title="Save image"
                >
                    <v-icon v-bind="tbIconBindings">M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M9 11.5C9 12.3 8.3 13 7.5 13H6.5V15H5V9H7.5C8.3 9 9 9.7 9 10.5V11.5M14 15H12.5L11.5 12.5V15H10V9H11.5L12.5 11.5V9H14V15M19 10.5H16.5V13.5H17.5V12H19V13.7C19 14.4 18.5 15 17.7 15H16.4C15.6 15 15.1 14.3 15.1 13.7V10.4C15 9.7 15.5 9 16.3 9H17.6C18.4 9 18.9 9.7 18.9 10.3V10.5H19M6.5 10.5H7.5V11.5H6.5V10.5Z</v-icon>
                    <span v-if="isFullscreen">&nbsp;Save image</span>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="toggleFullQuery()"
                    title="Toggle between the entire query structure and aligned region"
                >
                    <v-icon v-bind="tbIconBindings" style='color: #1E88E5;' v-if="showFullQuery">{{ $MDI.Circle }}</v-icon>
                    <v-icon v-bind="tbIconBindings" style='color: #1E88E5;' v-else>{{ $MDI.CircleHalf }}</v-icon>
                    <span v-if="isFullscreen">&nbsp;Toggle full query</span>
              </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="toggleFullTarget()"
                    title="Toggle between the entire target structure and aligned region"
                >
                    <v-icon v-bind="tbIconBindings" style='color: #FFC107;' v-if="showTarget == 'aligned'">{{ $MDI.CircleHalf }}</v-icon>
                    <v-icon v-bind="tbIconBindings" style='color: #FFC107;' v-else>{{ $MDI.Circle }}</v-icon>
                    <span v-if="isFullscreen">&nbsp;Toggle full target</span>
                </v-btn>
                <v-btn
                    v-bind="tbButtonBindings"
                    v-on:click="toggleArrows()"
                    title="Draw arrows between aligned residues"
                >
                    <v-icon v-bind="tbIconBindings" v-if="showArrows">{{ $MDI.ArrowRightCircle }}</v-icon>
                    <v-icon v-bind="tbIconBindings" v-else>{{ $MDI.ArrowRightCircleOutline }}</v-icon>
                    <span v-if="isFullscreen">&nbsp;Toggle arrows</span>
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
                    <v-icon v-bind="tbIconBindings">{{ $MDI.Restore }}</v-icon>
                    <span v-if="isFullscreen">&nbsp;Reset view</span>
                </v-btn>
                <v-btn v-bind="tbButtonBindings"
                    v-on:click="toggleFullscreen()"
                    title="Enter fullscreen mode - press ESC to exit"
                >
                    <v-icon v-bind="tbIconBindings">{{ $MDI.Fullscreen }}</v-icon>
                    <span v-if="isFullscreen">&nbsp;Fullscreen</span>
                </v-btn>
                </v-item-group>
            </div>
            <div class="structure-viewer" ref="viewport" />
        </div>
    </div>
</template>

<script>
import { Shape, Stage, Selection, download, ColormakerRegistry, PdbWriter } from 'ngl';
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
        'queryChain': '',
        'qChainResMap': null,
        'isFullscreen': false,
        'tmAlignResults': null,
    }),
    props: {
        'alignment': Object,
        'queryFile': String,
        'qColor': { type: String, default: "white" },
        'tColor': { type: String, default: "red" },
        'queryAlignedColor': { type: String, default: "#1E88E5" },
        'queryUnalignedColor': { type: String, default: "#A5CFF5" },
        'targetAlignedColor': { type: String, default: "#FFC107" },
        'targetUnalignedColor': { type: String, default: "#FFE699" },
        'qRepr': { type: String, default: "cartoon" },
        'tRepr': { type: String, default: "cartoon" },
        'bgColorLight': { type: String, default: "white" },
        'bgColorDark': { type: String, default: "#eee" },
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
            this.queryRepr.setSelection(this.querySele)
            this.queryRepr.parent.autoView()
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
        },
        makePdb() {
            if (!this.stage) return
            if (!this.queryRepr) return
            if (!this.targetRepr) return
            let qPDB = new PdbWriter(this.queryRepr.repr.structure, { renumberSerial: false }).getData()
            let tPDB = new PdbWriter(this.targetRepr.repr.structure, { renumberSerial: false }).getData()
            qPDB = qPDB.split('\n').filter(line => line.startsWith('ATOM')).join('\n')
            tPDB = tPDB.split('\n').filter(line => line.startsWith('ATOM')).join('\n')
            let result =
`TITLE     ${this.$route.params.ticket} - ${this.alignment.target}
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
            download(new Blob([result], { type: 'text/plain' }), this.$route.params.ticket + '-' + this.alignment.target + ".pdb")
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
        queryChainSele: function() {
            return (this.queryChain) ? `(:${this.queryChain.toUpperCase()} OR :${this.queryChain.toLowerCase()})` : '';
        },
        querySubSele: function() {
            if (!this.qChainResMap) return ''
            let start = `${this.qChainResMap.get(this.alignment.qStartPos).resno}`
            let end = `${this.qChainResMap.get(this.alignment.qEndPos).resno}`
            let sele = `${start}-${end}`
            if (this.queryChain) sele = `${sele} AND ${this.queryChainSele}`
            return sele
        },
        querySele: function() {
            return (this.showFullQuery) ? '' : this.querySubSele;
        },
        targetSele: function() {
            if (!this.selection) return ''
            return `${this.selection[0]}-${this.selection[1]}`;
        },
        tmPanelBindings: function() {
            return (this.isFullscreen) ? { 'style': 'margin-top: 10px; font-size: 2em; line-height: 2em' } : {  }
        },
        tbIconBindings: function() {
            return (this.isFullscreen) ? { 'right': true } : {}
        },
        tbButtonBindings: function() {
            return (this.isFullscreen) ? {
                'small': false,
                'style': 'margin-bottom: 15px;',
            } : {
                'small': true,
                'style': ''
            }
        }
    },
    beforeMount() {
        let qChain = this.alignment.query.match(/_([A-Z]+?)/m)
        if (qChain) this.queryChain = qChain[0].replace('_', '')
    },
    mounted() {
        const bgColor = this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
        const ambientIntensity = this.$vuetify.theme.dark ? 0.4 : 0.2;
        if (typeof(this.alignment.tCa) == "undefined")
            return;
        this.stage = new Stage(this.$refs.viewport,
            {
                backgroundColor: bgColor,
                ambientIntensity: ambientIntensity,
                clipNear: -1000,
                clipFar: 1000,
                fogFar: 1000,
                fogNear: -1000,
                quality: 'high'
            })

        Promise.all([
            this.$axios.get("api/result/" + this.$route.params.ticket + '/query'),
            pulchra(mockPDB(this.alignment.tCa, this.alignment.tSeq))
        ]).then(([qResponse, tPdb]) => {
            // Sanitize PDB in case of lines with too few characters
            let data = '';
            for (let line of qResponse.data.split('\n')) {
                let numCols = Math.max(0, 80 - line.length);
                let newLine = line + ' '.repeat(numCols) + '\n';
                data += newLine
            }
            qResponse.data = data;
            return [qResponse, tPdb];
        }).then(([qResponse, tPdb]) => {
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

                // Generate colorschemes for query/target based on alignment
                this.querySchemeId = ColormakerRegistry.addSelectionScheme([
                    [this.queryAlignedColor, this.querySubSele],
                    [this.queryUnalignedColor, "*"],
                ], "_queryScheme")
                this.targetSchemeId = ColormakerRegistry.addSelectionScheme([
                    [this.targetAlignedColor, `${this.alignment.dbStartPos}-${this.alignment.dbEndPos}`],
                    [this.targetUnalignedColor, "*"]
                ], "_targetScheme")

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
                    this.queryRepr = query.addRepresentation(this.qRepr, {color: this.querySchemeId})
                    this.targetRepr = target.addRepresentation(this.tRepr, {color: this.targetSchemeId})
                }).then(() => {
                    this.setSelection(this.showTarget)
                    this.setQuerySelection()
                    this.stage.autoView()
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
    margin: 0 auto;
}

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
    text-align: center;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    font-family: monospace;
    color: rgb(31, 119, 180);
}
</style>

<template>
    <div class="structure-panel" v-if="'qCa' in alignment && 'tCa' in alignment">
        <div class="structure-wrapper">
            <div class="structure-viewer" ref="viewport" />
        </div>
        <v-toolbar-items class="toolbar">
            <v-btn v-if="showTarget == 'aligned'"
                v-on:click="showTarget = 'full'"
                title="Show only the aligned portion of the target structure"
            ><v-icon>{{ $MDI.CircleHalf }}</v-icon></v-btn>
            <v-btn v-else
                v-on:click="showTarget = 'aligned'"
                title="Show the entire target structure"
            ><v-icon>{{ $MDI.Circle }}</v-icon></v-btn>
                <v-btn
                v-on:click="toggleArrows()" :input-value="showArrows"
                title="Draw arrows between aligned residues"
            ><v-icon v-if="showArrows">{{ $MDI.ArrowRightCircle }}</v-icon>
                <v-icon v-else>{{ $MDI.ArrowRightCircleOutline }}</v-icon></v-btn>
            <v-btn
                v-on:click="resetView()"
                :input-value="
                    selection != null
                        && ((selection[0] != alignment.dbStartPos || selection[1] != alignment.dbEndPos) && (selection[0] != 1 || selection[1] != alignment.dbLen))"
                title="Reset the view to the original position and zoom level"
            ><v-icon>{{ $MDI.Restore }}</v-icon></v-btn>
            <v-btn
                v-on:click="toggleFullscreen()"
                title="Enter fullscreen mode - press ESC to exit"
            ><v-icon>{{ $MDI.Fullscreen }}</v-icon></v-btn>
        </v-toolbar-items>
    </div>
</template>

<script>
import { Shape, Stage, Superposition } from 'ngl';
import Panel from './Panel.vue';
import { pulchra } from 'pulchra-wasm';

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

export default {
    components: { Panel },
    data: () => ({
        'showTarget': 'aligned',
        'showArrows': false,
        'selection': null,
    }),
    props: {
        'alignment': Object,
        'query': String,
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
        superposeStructures(qStruc, tStruc) {
            let atoms1 = this.qMatches.flatMap(match => match.xyz())
            let atoms2 = this.tMatches.flatMap(match => match.xyz())
            var matrix = new Superposition(new Float32Array(atoms2), new Float32Array(atoms1))
            matrix.transform(tStruc)
            qStruc.refreshPosition()
        },
        // Parses two alignment strings, and saves matching residues
        // Each match contains the index of the residue in the structure and a callback
        // function to retrieve the residue's CA XYZ coordinates to allow retrieval
        // before and after superposition (with updated coords)
        saveMatchingResidues(aln1, aln2, str1, str2) {
            if (aln1.length !== aln2.length) return
            this.qMatches = []
            this.tMatches = []
            const xyz = (map, index, structure) => {
                var rp = structure.getResidueProxy()
                rp.index = map.get(index) - 1
                var ap = structure.getAtomProxy()
                ap.index = rp.getAtomIndexByName('CA')
                return [ap.x, ap.y, ap.z]
            }
            for (let i = 0; i < aln1.length; i++) {
                if (aln1[i] === '-' || aln2[i] === '-') continue
                this.qMatches.push({ index: this.queryMap.get(i) - 1, xyz: () => xyz(this.queryMap, i, str1) })
                this.tMatches.push({ index: this.targetMap.get(i) - 1, xyz: () => xyz(this.targetMap, i, str2) })
            }
        },
        handleResize() {
            if (!this.$refs.viewport) return
            this.$refs.viewport.handleResize()
        },
        toggleFullscreen() {
            if (!this.stage) return
            this.stage.toggleFullscreen()
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
    },
    mounted() {
        const bgColor = this.$vuetify.theme.dark ? this.bgColourDark : this.bgColourLight;
        const ambientIntensity = this.$vuetify.theme.dark ? 0.4 : 0.2;
        if (typeof(this.alignment.qCa) == "undefined" || typeof(this.alignment.tCa) == "undefined")
            return;
        this.stage = new Stage(this.$refs.viewport, { backgroundColor: bgColor, ambientIntensity: ambientIntensity })
        Promise.all([
            pulchra(mockPDB(this.alignment.qCa, this.query)),
            pulchra(mockPDB(this.alignment.tCa, ""))
            ]).then(([qPdb, tPdb]) => {
                Promise.all([
                    this.stage.loadFile(new Blob([qPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true}),
                    this.stage.loadFile(new Blob([tPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true})
                ]).then(([query, target]) => {
                    this.saveMatchingResidues(this.alignment.qAln, this.alignment.dbAln, query.structure, target.structure)
                    this.superposeStructures(query.structure, target.structure)
                    this.queryRepr = query.addRepresentation(this.qRepr, {color: this.qColour})
                    this.targetRepr = target.addRepresentation(
                        this.tRepr,
                        {color: this.tColour, colorScheme: 'uniform'}
                    )
                    this.setSelection(this.showTarget)
                    query.autoView()
                })
        })
        this.stage.signals.fullscreenChanged.add((isFullscreen) => {
            if (isFullscreen) {
                this.stage.viewer.setBackground('#ffffff')
                this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            } else {
                this.stage.viewer.setBackground(bgColor)
                this.stage.viewer.setLight(undefined, undefined, undefined, ambientIntensity)
            }
        })
    },
    beforeDestroy() {
        if (typeof(this.stage) == 'undefined')
            return
        this.stage.dispose() 
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
.structure-panel .toolbar {
    position: absolute;
    bottom: 0;
    right: 0;
}
</style>

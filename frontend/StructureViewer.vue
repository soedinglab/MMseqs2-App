<template>
    <div class="structure-panel" ref="panel">
        <div class="structure-wrapper">
            <div class="structure-viewer" ref="viewport" />
        </div>
        <div class="structure-buttons">
            <v-radio-group dense label="Target" mandatory max="1" v-model="showTarget">
                <template slot="label">
                    Target
                    <v-tooltip open-delay="300" top>
                        <template v-slot:activator="{ on }">
                            <v-icon v-on="on" style="font-size: 16px; ">{{ $MDI.HelpCircleOutline }}</v-icon>
                        </template>
                        <span>
                            Select 'Aligned' to show only the aligned portion of the<br>
                            target structure, or 'Full' to show the entire structure.
                        </span>
                    </v-tooltip>
                </template>
                <v-radio label="Aligned" value="aligned" style="font-size: 12px;"/>
                <v-radio label="Full" value="full" style="font-size: 12px!important;"/>
            </v-radio-group>

            <v-btn
                small
                v-on:click="toggleFullscreen()"
                style="margin-bottom: 0.5em;"
                title="Enter fullscreen mode - press ESC to exit"
            >Fullscreen</v-btn>
            <v-btn
                small
                v-on:click="resetView()"
                style="margin-bottom: 0.5em;"
                title="Resets the view to the original position and zoom level"
            >Reset View</v-btn>
            <v-btn
                small
                v-on:click="toggleArrows()"
                title="Draw arrows between aligned residues"
            >Arrows</v-btn>
        </div>
    </div>
</template>

<script>
import { Shape, Stage, superpose } from 'ngl';

// Create NGL arrows from array of ([X, Y, Z], [X, Y, Z]) pairs
function createArrows(matches) {
    const shape = new Shape('shape')
    for (let i = 0; i < matches.length; i++) {
        const [a, b] = matches[i]
        shape.addArrow(a, b, [0, 1, 1], 0.4)
    }
    return shape
}

/**
 * Create a mock PDB from Ca data
 * Follows the spacing spec from https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
 * Will have to change if/when swapping to fuller data
 */
function mockPDB(ca) {
    const atoms = ca.split(',')
    const pdb = new Array()
    let j = 1
    for (let i = 0; i < atoms.length; i += 3, j++) {
        let [x, y, z] = atoms.slice(i, i + 3).map(element => parseFloat(element))
        pdb.push(
            'ATOM  '
            + j.toString().padStart(5)
            + '  CA  ARG A'
            + j.toString().padStart(4)
            + '    '
            + x.toString().padStart(8)
            + y.toString().padStart(8)
            + z.toString().padStart(8)
            + '  1.00  0.00           C  '
        )
    }
    return new Blob([pdb.join('\n')], { type: 'text/plain' })
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
    data: () => ({
        'showTarget': 'aligned',
        'showArrows': false,
        'selection': null,
    }),
    props: {
        'alignment': Object,
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
        // Parse two strings and pair corresponding XYZ coordinates from two arrays if both
        // characters are not '-'
        parseAlns(aln1, aln2, qStruc, tStruc) {
            const matches = new Array()
            let qAtoms = qStruc.atomStore
            let tAtoms = tStruc.atomStore
            for (let i = 0; i < aln1.length; i++) {
                if (aln1[i] !== '-' && aln2[i] !== '-') {
                    let qPos = this.queryMap.get(i) - 1
                    let tPos = this.targetMap.get(i) - 1
                    // Don't grab any coordinates outside of the current selection
                    // NGL selections are 1-indexed, so subtract 1 from the selection start
                    if (this.selection && !(tPos >= this.selection[0] - 1 && tPos < this.selection[1]))
                        continue
                    let qXYZ = [qAtoms.x[qPos], qAtoms.y[qPos], qAtoms.z[qPos]]
                    let tXYZ = [tAtoms.x[tPos], tAtoms.y[tPos], tAtoms.z[tPos]]
                    matches.push([qXYZ, tXYZ])
                }
            }
            return matches
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
            let matches = this.parseAlns(
                this.alignment.qAln,
                this.alignment.dbAln,
                this.queryRepr.parent.structure,
                this.targetRepr.parent.structure,
            )
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
        this.stage = new Stage(this.$refs.viewport, { backgroundColor: this.$vuetify.theme.dark ? this.bgColourDark : this.bgColourLight })
        Promise.all([
            this.stage.loadFile(mockPDB(this.alignment.qCa), {ext: 'pdb', firstModelOnly: true}),
            this.stage.loadFile(mockPDB(this.alignment.tCa), {ext: 'pdb', firstModelOnly: true})
        ]).then(([query, target]) => {
            superpose(target.structure, query.structure, {align: true})
            this.queryRepr = query.addRepresentation(this.qRepr, {color: this.qColour})
            this.targetRepr = target.addRepresentation(
                this.tRepr,
                {color: this.tColour, colorScheme: 'uniform'}
            )
            this.setSelection(this.showTarget)
            query.autoView()
        })
    },
    beforeDestroy() {
        this.stage.dispose() 
    }
}
</script>

<style>
.structure-panel {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    flex: 0 0 auto;
}
.structure-buttons {
    display: flex;
    flex-direction: column;
    width: min-content;
}
.structure-wrapper {
    width: 350px;
    height: 300px;
    margin: .5em;
}
.structure-viewer {
    width: 100%;
    height: 100%;
}
.structure-viewer canvas {
    border-radius: 2px;
}
</style>

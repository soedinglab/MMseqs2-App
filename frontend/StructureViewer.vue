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
            :isSpinning="isSpinning"
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
import { mockPDB, makeSubPDB, transformStructure, makeMatrix4  } from './Utilities.js';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

import Panel from './Panel.vue';
import { Shape, Selection, download, ColormakerRegistry, PdbWriter, Color, concatStructures, StructureComponent } from 'ngl';

// Create NGL arrows from array of ([X, Y, Z], [X, Y, Z]) pairs
// Get XYZ coordinates of CA of a given residue
const xyz = (structure, resIndex) => {
    var rp = structure.getResidueProxy();
    var ap = structure.getAtomProxy();
    rp.index = resIndex;
    ap.index = rp.getAtomIndexByName('CA');
    return [ap.x, ap.y, ap.z];
}

// Save indices of matching columns in an alignment
const getMatchingColumns = (alignment) => {
    let cols_q = [];
    let cols_t = [];
    let id_q = alignment.qStartPos;
    let id_t = alignment.dbStartPos;
    for (let i = 0; i < alignment.qAln.length; i++) {
        if (alignment.qAln[i] === '-' || alignment.dbAln[i] === '-') {
            if (alignment.qAln[i] === '-') id_t++;
            else id_q++;
        } else {
            cols_q.push(id_q);
            cols_t.push(id_t);
            id_q++;
            id_t++;
        }
    }
    return [cols_q, cols_t]
}

// Get chain from structure name like Structure_A
const getChainName = (name) => {
    // HACK FIXME fix AF chain names
    if (/_v[0-9]+$/.test(name)) {
        return 'A';
    }
    let pos = name.lastIndexOf('_');
    return pos != -1 ? name.substring(pos + 1) : 'A';
}

const getAccession = (name) => {
    // HACK FIXME fix AF chain names
    if (/_v[0-9]+$/.test(name)) {
        return name;
    }
    let pos = name.lastIndexOf('_');
    return pos != -1 ? name.substring(0, pos) : name;
}

// Get coordinates of all atoms found in given selection
const getAtomXYZ = (structure, sele) => {
    const xyz = [];
    structure.eachAtom(ap => { xyz.push([ap.x, ap.y, ap.z]) }, sele); 
    return xyz;
}

const colorblindColors = ColormakerRegistry.addScheme(function() {
    let colors = [0x991999, 0x00BFBF, 0xE9967A, 0x009E73, 0xF0E442, 0x0072B2, 0xD55E00, 0xCC79A7];
    this.atomColor = function(atom) {
        return colors[atom.chainIndex % colors.length];
    }
}, "colorblindColors")
 

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
            selection: null,
            showArrows: false,
            showQuery: 0,
            showTarget: 0,
            tmAlignResults: null
        }
    },
    props: {
        alignments: { type: Array },
        highlights: { type: Array },
        queryFile: { type: String },
        queryAlignedColor: { type: String, default: "#1E88E5" },
        queryUnalignedColor: { type: String, default: "#A5CFF5" },
        targetAlignedColor: { type: String, default: "#FFC107" },
        targetUnalignedColor: { type: String, default: "#FFE699" },
        qRepr: { type: String, default: "cartoon" },
        tRepr: { type: String, default: "cartoon" },
        hits: { type: Object },
        autoViewTime: { type: Number, default: 100 }
    },
    methods: {
        // Create arrows connecting CA coordinates for query/target in match columns
        async drawArrows(str1, str2) {
            const shape = new Shape('arrows');
            await Promise.all(this.alignments.map(async (alignment) => {
                const chain_q = getChainName(alignment.query);
                const chain_t = getChainName(alignment.target);
                const [sele_q, sele_t] = getMatchingColumns(alignment).map(arr => arr.join(" or "));
                const str1_xyz = getAtomXYZ(str1, new Selection(`(${sele_q}) and :${chain_q}.CA`));
                const str2_xyz = getAtomXYZ(str2, new Selection(`(${sele_t}) and :${chain_t}.CA`));
                for (let i = 0; i < str1_xyz.length; i++) {
                    shape.addArrow(str1_xyz[i], str2_xyz[i], [0, 1, 1], 0.4);
                }
            }));
            let component = this.stage.addComponentFromObject(shape);
            component.addRepresentation('buffer');
            component.setVisibility(this.showArrows);
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
        handleResetView() {
            if (!this.stage) return;
            this.setQuerySelection();
        },
        handleToggleTarget() {
            if (!this.stage) return;
            if (__LOCAL__) {
                this.showTarget = (this.showTarget === 0) ? 1 : 0;
            } else {
                this.showTarget = (this.showTarget === 2) ? 0 : this.showTarget + 1; 
            }
        },
        clearSelection() {
            if (!this.alignments || !this.stage) return;
            let repr = this.stage.getRepresentationsByName("targetHighlight");
            repr.setSelection()
            repr.setVisibility(false)
        },
        setSelectionData(selection) {
            // FIXME tube/cartoon representation cannot visualise <3 residues
            //       https://github.com/nglviewer/ngl/issues/759
            //       use licorice representation for this case? or just +1 to make 3
            if (!this.alignments || !this.stage) return;
            let repr = this.stage.getRepresentationsByName("targetHighlight");
            repr.setSelection()
            if (selection.length === 0) {
                repr.setVisibility(false);
                return;
            }
            let seles = [];
            for (let [i, start, length] of selection) {
                let chain = getChainName(this.alignments[i].target);
                let end = start + length;
                seles.push(`${start}-${end}:${chain}`);
            } 
            let sele = seles.join(" or ");
            repr.setSelection(sele);
            repr.setVisibility(true);
        },
        setQuerySelection() {
            let repr = this.stage.getRepresentationsByName("queryStructure");
            if (!repr) return;
            let sele = this.querySele;
            repr.setSelection(sele);
            repr.list[0].parent.autoView(sele, this.autoViewTime);
            if (this.showQuery === 0) {
                this.stage.getRepresentationsByName("querySurface-1").setVisibility(false);
                this.stage.getRepresentationsByName("querySurface-2").setVisibility(false);
            } else if (this.showQuery === 1) {
                this.stage.getRepresentationsByName("querySurface-1").setVisibility(true);
                this.stage.getRepresentationsByName("querySurface-2").setVisibility(false);
            } else {
                this.stage.getRepresentationsByName("querySurface-1").setVisibility(true);
                this.stage.getRepresentationsByName("querySurface-2").setVisibility(true);
            }
        },
        setTargetSelection() {
            let repr = this.stage.getRepresentationsByName("targetStructure");
            if (!repr) return;
            let sele = this.targetSele;
            repr.setSelection(sele);
        },
        async handleMakeImage() {
            if (!this.stage)
                return;
            let hasQuery = this.stage.getRepresentationsByName("queryStructure").length > 0;
            let title = this.alignments.map(aln => hasQuery ? `${aln.query}-${aln.target}` : aln.target).join("_");
            this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            const blob = await this.stage.makeImage({
                trim: true,
                factor: (this.isFullscreen) ? 1 : 8,
                antialias: true,
                transparent: true,
            });
            this.stage.viewer.setLight(undefined, undefined, undefined, this.$vuetify.theme.dark ? 0.4 : 0.2)
            download(blob, `${title}.pdb`)
        },
        handleMakePDB() {
            if (!this.stage)
                return;
            const getPdbText = comp => {
                let pw = new PdbWriter(comp.structure, { renumberSerial: false });
                return pw.getData().split('\n').filter(line => line.startsWith('ATOM')).join('\n');
            }
            let qPDB = this.stage.getComponentsByName("queryStructure").list.map(getPdbText); 
            let tPDB = this.stage.getComponentsByName("targetStructure").list.map(getPdbText);
            if (!qPDB && !tPDB) 
                return;
            let title = this.alignments.map(aln => qPDB ? `${aln.query}-${aln.target}` : aln.target);
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
${qPDB.join('\n')}
ENDMDL
MODEL        2
${tPDB.join('\n')}
ENDMDL
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
${tPDB.join('\n')}
ENDMDL
END
`
            }
            download(new Blob([result], { type: 'text/plain' }), (title.join("_") + ".pdb"));
        }
    },
    watch: {
        'showArrows': function(val, _) {
            if (!this.stage) return
            this.stage.getComponentsByName("arrows").forEach(comp => { comp.setVisibility(val) });
        },
        'showQuery': function() {
            if (!this.stage) return;
            this.setQuerySelection();
        },
        'showTarget': function(val, _) {
            if (!this.stage) return;
            this.setTargetSelection();
        },
        'highlights': function(values) {
            if (!this.stage || !values) return;
            let selections = []
            values.forEach((value, i) => {
                if (!value) return;
                let [start, length] = value;
                selections.push([i, start, length]);
            })
            this.setSelectionData(selections)
        }
    },
    computed: {
        querySele: function() {
            if (this.alignments.length === 0 || this.showQuery == 2)
                return '';
            if (this.showQuery === 0)
                return this.alignments.map(a => `${a.qStartPos}-${a.qEndPos}:${getChainName(a.query)}`).join(" or ");
            if (this.showQuery === 1)
                return this.alignments.map(a => `:${getChainName(a.query)}`).join(" or ");
        },
        targetSele: function() {
            if (this.alignments.length === 0 || this.showTarget == 2)
                return '';
            if (this.showTarget === 0)
                return this.alignments.map(a => `${a.dbStartPos}-${a.dbEndPos}:${getChainName(a.target)}`).join(" or ");
            if (this.showTarget === 1)
                return this.alignments.map(a => `:${getChainName(a.target)}`).join(" or ");
        },
        tmPanelBindings: function() {
            return (this.isFullscreen) ? { 'style': 'margin-top: 10px; font-size: 2em; line-height: 2em' } : {  }
        },
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

        // Run PULCHRA per chain then concatenate Structure objects in first StructureComponent
        const targets = [];
        const selections_t = [];
        let renumber = 0;
        for (let alignment of this.alignments) {
            const chain = getChainName(alignment.target);
            const mock = mockPDB(alignment.tCa, alignment.tSeq, chain);
            const pdb = await pulchra(mock);
            const component = await this.stage.loadFile(new Blob([pdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
            component.structure.eachChain(c => { c.chainname = chain; });
            component.structure.eachAtom(a => { a.serial = renumber++; });
            targets.push(component);
            selections_t.push(`${alignment.dbStartPos}-${alignment.dbEndPos}:${chain}`);
        }
        const structure = concatStructures(getAccession(this.alignments[0].target), ...targets.map(t => t.structure));
        const target = this.stage.addComponentFromObject(structure, { name: "targetStructure" });
        
        target.addRepresentation('tube', {
            color: 0x11FFEE,
            side: 'front',
            opacity: 0.5,
            radius: 0.8,
            visible: false,
            name: 'targetHighlight'
        });

        if (ColormakerRegistry.hasScheme("_targetScheme")) {
            ColormakerRegistry.removeScheme("_targetScheme")
        }
        this.targetSchemeId = ColormakerRegistry.addSelectionScheme([
            [this.targetAlignedColor, selections_t.join(" or ")],
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

            let query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), { ext: 'pdb', firstModelOnly: true, name: 'queryStructure'});
            if (query && query.structure.getAtomProxy().isCg()) {
                queryPdb = await pulchra(queryPdb);
                this.stage.removeComponent(query);
                query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true, name: 'queryStructure'}); 
            }

            // Map 1-based indices to residue index/resno; only need for query structure
            // Use queryChainSele to make all selections based on actual query chain
            const selections_q = [];
            for (let alignment of this.alignments) {
                const chain = getChainName(alignment.query);

                selections_q.push(`${alignment.qStartPos}-${alignment.qEndPos} and :${chain}`);

                // Renumber to avoid residue gaps
                let renumber = 1;
                query.structure.eachResidue(function(rp) {
                    rp.resno = renumber++;
                }, new Selection(`:${chain}`))
            }
            if (ColormakerRegistry.hasScheme("_queryScheme")) {
                ColormakerRegistry.removeScheme("_queryScheme")
            }
            this.querySchemeId = ColormakerRegistry.addSelectionScheme([
                [this.queryAlignedColor, selections_q.join(" or ")],
                [this.queryUnalignedColor, "*"],
            ], "_queryScheme")

            // Re-align target to query using TM-align for better superposition
            // Target 1st since TM-align generates superposition matrix for 1st structure
            if (this.alignments[0].hasOwnProperty("complexu") && this.alignments[0].hasOwnProperty("complext")) {
                const t = this.alignments[0].complext.split(',').map(x => parseFloat(x));
                let u = this.alignments[0].complexu.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];
                // Can't use setTransform since we need the actual transformed coordinates for arrows
                transformStructure(target.structure, t, u);
                query.addRepresentation(this.qRepr, { color: this.querySchemeId, smoothSheet: true, name: "queryStructure"});
                target.addRepresentation(this.tRepr, { color: this.targetSchemeId, smoothSheet: true, name: "targetStructure" });

                // Make three separate surface representations based on query toggle state:
                //   0: Aligned regions of aligned chains
                //   1: Unaligned regions of aligned chains (shown with 0)
                //   2: Full structure (all chains; shown with 0 and 1)
                // Then toggle visibility when showQuery is changed by the user.
                const surfaceSele0 = [];
                const surfaceSele1 = [];
                const surfaceSele2 = [];
                for (let alignment of this.alignments) {
                    let chain = getChainName(alignment.query);
                    surfaceSele0.push(`${alignment.qStartPos}-${alignment.qEndPos}:${chain}`);
                    surfaceSele1.push(`(not ${alignment.qStartPos}-${alignment.qEndPos} and :${chain})`);
                    surfaceSele2.push(`:${chain}`);
                }
                const surfaceParams = {
                    color: colorblindColors,
                    opacity: 0.1,
                    opaqueBack: false,
                    useWorker: false
                }
                query.addRepresentation("surface", { sele: surfaceSele0.join(" or "), name: "querySurface-0", ...surfaceParams });
                query.addRepresentation("surface", { sele: surfaceSele1.join(" or "), name: "querySurface-1", visible: false, ...surfaceParams });
                query.addRepresentation("surface", { sele: `not (${surfaceSele2.join(" or ")})`, name: "querySurface-2", visible: false, ...surfaceParams });
            } else {
                // Generate subsetted PDBs for TM-align
                let qSubPdb = makeSubPDB(query.structure, this.querySele);
                let tSubPdb = makeSubPDB(target.structure, this.targetSele);
                let alnFasta = `>target\n${this.alignments[0].dbAln}\n\n>query\n${this.alignments[0].qAln}`
                const tm = await tmalign(tSubPdb, qSubPdb, alnFasta);
                this.tmAlignResults = parseTMOutput(tm.output)
                let { t, u } = parseTMMatrix(tm.matrix)
                transformStructure(target.structure, t, u)
                query.addRepresentation(this.qRepr, {color: this.querySchemeId, name: "queryStructure"});
                target.addRepresentation(this.tRepr, {color: this.targetSchemeId, name: "targetStructure"});
            }
            await this.drawArrows(query.structure, target.structure)
            this.setQuerySelection();
            this.setTargetSelection();
            query.autoView(this.querySele, this.autoViewTime)
        } else {
            target.addRepresentation(this.tRepr, {color: this.targetSchemeId, name: "targetStructure"})
            this.setQuerySelection()
            this.setTargetSelection();
            this.stage.autoView(this.autoViewTime)
        }
        
    },
}
</script>

<style scoped>
.structure-wrapper {
    width: 500px;
    height: 400px;
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
<template>
    <div class="structure-panel">
        <StructureViewerTooltip attach=".structure-panel" />
        <div class="structure-wrapper" ref="structurepanel">
            <table class="tmscore-panel" v-bind="tmPanelBindings">
            <tr>
                <td class="left-cell">idf-score:</td>
                <td class="right-cell">{{ alignment.idfscore }}</td>
            </tr>
            <tr>
                <td class="left-cell">RMSD:</td>
                <td class="right-cell">{{ alignment.rmsd  }}</td>
            </tr>
            </table>
            <StructureViewerToolbar
                :isFullscreen="isFullscreen"
                :isSpinning="isSpinning"
                :showTarget="showTarget"
                :showQuery="showQuery"
                :disableArrowButton="true"
                @makeImage="handleMakeImage"
                @makePDB="handleMakePDB"
                @resetView="handleResetView"
                @toggleFullscreen="handleToggleFullscreen"
                @toggleQuery="handleToggleQuery"
                @toggleTarget="handleToggleTarget"
                @toggleSpin="handleToggleSpin"
                style="position: absolute; bottom: 8px;"
            />
            <div class="structure-viewer" ref="viewport"></div>
        </div>
    </div>
</template>

<script>
// import Alignment from './Alignment.vue'
import StructureViewerMixin from './StructureViewerMixin.vue';
// import { pulchra } from 'pulchra-wasm';
// import StructureViewer from './StructureViewer.vue';
import StructureViewerToolbar from './StructureViewerToolbar.vue';
import StructureViewerTooltip from './StructureViewerTooltip.vue';
import { getPdbText, makePositionMap, transformStructure } from './Utilities.js'
import {Stage, Shape, Selection, download, ColormakerRegistry, PdbWriter, Color, concatStructures, StructureComponent } from 'ngl'

const processPdb = (rawpdb) => {
    let outpdb = '';
    let data = '';
    let ext = 'pdb';
    outpdb = rawpdb.trimStart();
    if (data[0] == "#" || data.startsWith("data_")) {
        ext = 'cif';
        // NGL doesn't like AF3's _chem_comp entries
        outpdb = outpdb.replaceAll("_chem_comp.", "_chem_comp_SKIP_HACK.");
        // RACHEL: Do ATOM selection
    } else {
        for (let line of outpdb.split('\n')) {
            if (line.startsWith("ATOM")) {
                let numCols = Math.max(0, 80 - line.length);
                let newLine = line + ' '.repeat(numCols) + '\n';
                data += newLine
            }
        }
        outpdb = data;
    }
    return [data, ext]
}

export default {
    name: "StructureViewerMotif",
    components: {
        StructureViewerToolbar,
        StructureViewerTooltip,
    },
    mixins: [
        StructureViewerMixin
    ],
    data: () => ({
        // selection: null,
        showQuery: 0,
        showTarget: 0,
    }),
    props: {
        alignment: { type: Object, required: true, },
        lineLen: { type: Number, required: true, },
        queryPdb: {type: String, required: true, },

        strRepr: { type: String, default: "cartoon" },
        motifRepr: {type: String, default: "licorice"},
        qClr: {type: String, default: "white"},
        tClr: {type: String, default: "#f7b3a6"},
        qmClr: {type: String, default: "#717171"},
        tmClr: {type: String, default: "#e94b8a"},
        bgColorLight: {type: String, default: "white"},
        bgColorDark: {type: String, default: "#1E1E1E"},
        autoViewTime: { type: Number, default: 100 },
    },
    computed: {
        // hasSelection() {
        //     return !this.structureHighlights.some(e => e !== null);
        // }
        bgColor() {
            return this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
        },
        tmPanelBindings: function() {
            return (this.isFullscreen) ? { 'style': 'margin-top: 10px; font-size: 2em; line-height: 2em' } : {  }
        },
        // querySele: function() { // TODO
        //     if (this.alignment === 0 || this.showQuery == 2) {
        //         return '';
        //     }
        //     if (this.showQuery === 0) {
        //     }
        //     if (this.showQuery === 1 ) {
        //     }
        // },
        // targetSele: function() { // TODO
        //     if (this.alignment === 0 || this.showTarget === 2) {
        //         return '';
        //     }
        //     if (this.showTarget === 0) {
        //         // this.stage.getRepresentationsByName("targetStructure").setSelection(sele);
        //         this.stage.getRepresentationsByName("targetStructure").setVisibility(true);
        //     }
        //     if (this.showTarget === 1 ) {
        //     }

        // },
        stageParameters: function() {
            return {
                log: 'folddisco',
                backgroundColor: this.bgColor,
                transparent: true,
                clipNear: -1000,
                clipFar: 1000,
                fogFar: 1000,
                fogNear: -1000,
            }
        },
    },
    methods: {
        handleResetView() {
            if (!this.stage) return;
            this.setQuerySelection();
        },
        async handleMakeImage() {
            if (!this.stage)
                return;
            const wasSpinning = this.isSpinning;
            this.isSpinning = false;
            let title = this.alignment.target.replace(/\.(pdb|cif)$/, '');
            this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            const blob = await this.stage.makeImage({
                trim: true,
                factor: (this.isFullscreen) ? 1 : 8,
                antialias: true,
                transparent: true,
            });
            this.stage.viewer.setLight(undefined, undefined, undefined, this.$vuetify.theme.dark ? 0.4 : 0.2)
            download(blob, `folddisco-${title}.png`)
            this.isSpinning = wasSpinning;   
        },
        handleMakePDB() {
            if (!this.stage)
                return;
            let qPDB = this.stage.getComponentsByName("queryStructure").list.map(getPdbText); 
            let tPDB = this.stage.getComponentsByName("targetStructure").list.map(getPdbText);
            if (!qPDB && !tPDB) 
                return;
            let title = `folddisco-${this.alignment.target.replace(/\.(pdb|cif)$/, '')}`;
            let result = null;
            if (qPDB && tPDB) {
                result =
`TITLE     ${title}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com/folddisco
REMARK     Please cite:
REMARK       TODO
REMARK     Warning: Target structure has been decompressed by Foldcomp
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
REMARK       https://search.foldseek.com/folddisco
REMARK     Please cite:
REMARK       TODO
REMARK     Warning: Non C-alpha atoms were re-generated by PULCHRA.
MODEL        1
${tPDB.join('\n')}
ENDMDL
END
`
            }
            download(new Blob([result], { type: 'text/plain' }), (title + ".pdb"));
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

            if (__LOCAL__) {
                this.showTarget = (this.showTarget === 0) ? 1 : 0;
            } else {
                this.showTarget = (this.showTarget === 2) ? 0 : this.showTarget + 1;
            }            
        },
        setQuerySelection() {
            if (this.alignment.length === 0 || this.showQuery === 2) {
                return
            }
            // let motif = this.stage.getRepresentationsByName("queryMatched");
            if (this.showQuery === 0 ) {
                this.stage.getRepresentationsByName("queryStructure").setVisibility(false);
                this.stage.getRepresentationsByName("queryMatched").setVisibility(true);
            } else if (this.showQuery === 1) {
                this.stage.getRepresentationsByName("queryStructure").setVisibility(true);
                this.stage.getRepresentationsByName("queryMatched").setVisibility(true);
            }
            
            // let repr = this.stage.getRepresentationsByName("queryStructure");
            // if (!repr) return;
            // let sele = this.querySele;
            // repr.list[0].parent.autoView(sele, this.autoViewTime); // TODO
        },
        setTargetSelection() {
            if (this.alignment.length === 0 || this.showTarget === 2) {
                return
            }
            if (this.showTarget === 0 ) {
                this.stage.getRepresentationsByName("targetStructure").setVisibility(false);
                this.stage.getRepresentationsByName("targetMatched").setVisibility(true);
            } else if (this.showTarget === 1) {
                this.stage.getRepresentationsByName("targetStructure").setVisibility(true);
                this.stage.getRepresentationsByName("targetMatched").setVisibility(true);
            }
            // let repr = this.stage.getRepresentationsByName("targetStructure");
            // if (!repr) return;
            // let sele = this.targetSele;
            // repr.setSelection(sele); // TODO
        },
    },
    watch: {
        'showQuery': function() {
            if (!this.stage) return;
            this.setQuerySelection();
        },
        'showTarget': function() {
            if (!this.stage) return;
            this.setTargetSelection();
        },
    },
    // beforeMount() {
    //     // this.updateMaps() // What does this do?
    //     // this.setEmptyHighlight();
    //     // this.setEmptyStructureHighlight();
    // },
    async mounted() {
        if (typeof(this.alignment.tCa) == "undefined" || typeof(this.queryPdb) == "undefined")
            return;

        try {
            const ticket = this.$route.params.ticket;
            const match = this.alignment;
            const re = "api/result/folddisco/" + ticket + '?database=' + match.db +'&id=' + match.target;
            const request = await this.$axios.get(re);
            targetPdb = request.data;
        } catch (e) {
            // throw e
            alert("Error: " + (e.response?.data || e.message || "Unknown"));
            return
        }
        let [queryPdb, qext] = processPdb(this.queryPdb);
        let [targetPdb, text] = processPdb(targetPdb);
        const query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), { ext: qext, firstModelOnly: true, name: 'queryStructure'});
        const target = await this.stage.loadFile(new Blob([targetPdb], { type: 'text/plain' }), { ext: text, firstModelOnly: true, name: 'targetStructure'});

        const t = this.alignment.tmat.split(',').map(x => parseFloat(x));
        let u = this.alignment.umat.split(',').map(x => parseFloat(x));
        u = [
            [u[0], u[1], u[2]],
            [u[3], u[4], u[5]],
            [u[6], u[7], u[8]],
        ];
        transformStructure(query.structure, t, u);
        
        const matchedResidues = new Set(this.alignment.targetresidues.split(','));
        const selectedTarget = [];
        target.structure.eachResidue(r => {
            const chain = r.chainname;
            const resno = r.resno;
            const key = `${chain}${resno}`;
            if (matchedResidues.has(key)) {
                selectedTarget.push(`${resno}:${chain}`)
            } 
        });

        this.querySchemeId = ColormakerRegistry.addSelectionScheme([ // TODO: change sele
            [this.qmClr, "*"],
            [this.qClr, "*"]
        ], "_queryScheme")

        this.targetSchemeId = ColormakerRegistry.addSelectionScheme([
            [this.tmClr, selectedTarget.join(" or ")],
            [this.tClr, "*"]
        ], "_targetScheme")

        query.addRepresentation(this.strRepr, {color: this.querySchemeId, name: "queryStructure"})
        target.addRepresentation(this.strRepr, {color: this.targetSchemeId, smoothSheet: true, name: "targetStructure"})
        query.addRepresentation(this.motifRepr, {sele: "all", color: this.qmClr, name: "queryMatched"}) // TODO: change sele
        target.addRepresentation(this.motifRepr, {sele: selectedTarget.join(" or "), color: this.tmClr, name: "targetMatched"})
        // query.addRepresentation(this.qRepr, {color: 'blue', name: "queryUnmatched"})

        this.setQuerySelection();
        this.setTargetSelection();
        // query.autoView(this.querySele, this.autoViewTime);
        // this.stage.autoView();
    }
}
</script>

<style scoped>

.structure-panel {
    width: 100%;
    height: 100%;
    position: relative;
}
.structure-wrapper {
    width: 500px;
    height: 400px;
    margin: 0 auto;
}

.structure-viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
    padding: 0;
}

.structure-viewer canvas {
    border-radius: 2px;
}

/* @media screen and (max-width: 960px) {
    .structure-panel  {
        display: flex;
    }
    .structure-panel {
        flex-direction: column-reverse;
    }
    .structure-wrapper {
        padding-bottom: 1em;
    }
    .structure-wrapper {
        align-self: center;
    }
}

@media screen and (min-width: 961px) {
    .structure-wrapper {
        padding-left: 2em;
    }
} */

</style>

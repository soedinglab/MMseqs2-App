<template>
<div class="structure-panel">
    <StructureViewerTooltip attach=".structure-panel" />
    <div class="structure-wrapper" ref="structurepanel">
        <StructureViewerToolbar
            :isFullscreen="isFullscreen"
            :isSpinning="isSpinning"
            @makeImage="handleMakeImage"
            @makePDB="handleMakePDB"
            @resetView="handleResetView"
            @toggleFullscreen="handleToggleFullscreen"
            @toggleSpin="handleToggleSpin"
            disableArrowButton
            disableQueryButton
            disableTargetButton
            style="position: absolute; bottom: 8px;"
        />
        <div class="structure-viewer" ref="viewport" />
    </div>
</div>
</template>

<script>
import StructureViewerTooltip from './StructureViewerTooltip.vue';
import StructureViewerToolbar from './StructureViewerToolbar.vue';
import StructureViewerMixin from './StructureViewerMixin.vue';
import { mockPDB, makeSubPDB, makeMatrix4, interpolateMatrices, animateMatrix  } from './Utilities.js';
import { download, PdbWriter, Matrix4, Quaternion, Vector3 } from 'ngl';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

// Mock alignment object from two (MSA-derived) aligned strings
function mockAlignment(one, two) {
    let res = { backtrace: "", qAln: "", dbAln: "" };
    let started = false; // flag for first Match column in backtrace
    let m = 0;           // index in msa
    let qr = 0;          // index in seq
    let tr = 0;
    let qBuffer = "";
    let tBuffer = "";
    while (m < one.length) {
        const qc = one[m];
        const tc = two[m];
        if (qc === '-' && tc === '-') {
            // Skip gap columns
        } else if (qc === '-') {
            if (started) {
                res.backtrace += 'D';               
                qBuffer += qc;
                tBuffer += tc;
            }
            ++tr;
        } else if (tc === '-') {
            if (started) {
                res.backtrace += 'I';
                qBuffer += qc;
                tBuffer += tc;
            }
            ++qr;
        } else {
            if (started) {
                res.qAln += qBuffer;
                res.dbAln += tBuffer;
                qBuffer = "";
                tBuffer = "";
            } else {
                started = true;
                res.qStartPos = qr;
                res.dbStartPos = tr;
            }
            res.backtrace += 'M';
            qBuffer += qc;
            tBuffer += tc;
            res.qEndPos = qr;
            res.dbEndPos = tr;
            ++qr;
            ++tr;
        }
        ++m;
    }
    res.qStartPos++;
    res.dbStartPos++;
    res.qSeq  = one.replace(/-/g, '');
    res.tSeq  = two.replace(/-/g, '');
    return res;
}

function generateSelections(newValues, oldValues, refIndex) {
    const update = [];
    const remove = [];
    const add    = [];
    const reference = {};
    const oldValuesSet = new Set(oldValues);
    newValues.forEach((newValue, index) => {
        if (index === refIndex) {
            reference.item = newValue;
            if (oldValuesSet.has(newValue)) {
                reference.status = 'update';
                oldValuesSet.delete(newValue);
            } else {
                reference.status = 'new';
            }
            return;
        }
        if (oldValuesSet.has(newValue)) {
            update.push(newValue);
            oldValuesSet.delete(newValue);
        } else {
            add.push(newValue);
        }
    });
    remove.push(...oldValuesSet);
    return { update, remove, add, reference };
}

export default {
    name: "StructureViewerMSA",
    components: {
        StructureViewerToolbar,
        StructureViewerTooltip,
    },
    mixins: [
        StructureViewerMixin,
    ],
    data: () => ({
        structures: [],  // { name, aa, 3di (ss), ca, NGL structure, alignment, map }
        curReferenceIndex: 0,
        oldReference: ""
    }),
    props: {
        entries: { type: Array },
        reference: { type: Number },
        bgColorLight: { type: String, default: "white" },
        bgColorDark: { type: String, default: "#1E1E1E" },
        representationStyle: { type: String, default: "cartoon" },
        referenceStyleParameters: {
            type: Object,
            default: () => ({ color: '#1E88E5', opacity: 1.0 })
        },
        regularStyleParameters: {
            type: Object,
            default: () => ({ color: '#FFC107', opacity: 0.5, side: 'front' })
        },
    },
    methods: {
        resetView() {
            if (!this.stage) return;
            if (this.structures.length > 0) {
                this.structures[this.curReferenceIndex].structure.autoView(this.transitionDuration);
            } else {
                this.stage.autoView(this.transitionDuration);
            }
        },
        makePDB() {
            if (!this.stage) return
            let PDB;
            let result = `\
TITLE     Superposed structures from Foldmason alignment
REMARK    This file was generated by the FoldMason webserver:
REMARK      https://mason.foldseek.com
REMARK    Please cite:
REMARK      <insert citation>
REMARK    Warning: Non C-alpha atoms may have been re-generated by PULCHRA
REMARK             if they are not present in the original PDB file.
`;
            this.structures.forEach((structure, index) => {
                PDB = new PdbWriter(structure.structure.structure, { renumberSerial: false }).getData(); 
                PDB = PDB.split('\n').filter(line => line.startsWith("ATOM")).join('\n');
                result += `\
MODEL     ${index}
REMARK    Name: ${structure.name}
${PDB}
ENDMDL
`;
            });
            result += "END";
            download(new Blob([result], { type: 'text/plain' }), "foldmason.pdb")
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
                download(blob, "foldmason.png")
            })
        },
        async tmAlignToReference(index) {
            if (index === this.curReferenceIndex) {
                return;
            }
            const reference = this.structures[this.curReferenceIndex].structure;
            const alignment = mockAlignment(this.structures[this.curReferenceIndex].aa, this.structures[index].aa);
            const alnFasta = `>target\n${alignment.dbAln}\n\n>query\n${alignment.qAln}`;
            const structure = this.structures[index].structure;
            const [queryPDB, targetPDB] = await Promise.all([
                makeSubPDB(reference.structure, alignment ? `${alignment.qStartPos}-${alignment.qEndPos}` : ''),
                makeSubPDB(structure.structure, alignment ? `${alignment.dbStartPos}-${alignment.dbEndPos}` : '')
            ]);
            const { output, matrix } = await tmalign(targetPDB, queryPDB, alnFasta);
            const { t, u }  = parseTMMatrix(matrix);
            const tmResults = parseTMOutput(output);
            return Promise.resolve({
                matrix: makeMatrix4(t, u),
                tmResults: tmResults,
                alignment: alignment,
            });
        },
        async addStructureToStage(data) {
            const { name, aa, ca } = data;
            const index = this.structures.push({...data}) - 1;
            const pdb = await pulchra(mockPDB(ca, aa.replace(/-/g, ''), 'A'));
            const structure = await this.stage.loadFile(
                new Blob([pdb], { type: 'text/plain' }),
                {ext: 'pdb', firstModelOnly: true, name: name }
            );
            this.structures[index].index = index;
            this.structures[index].structure = structure;
            return index;
        },
        async shiftStructure({ structure }, index, shiftValue) {
            const { x, y, z } = structure.position;
            const offset = index * shiftValue;
            structure.setPosition({x: x + offset, y: y + offset, z: z + offset })
            this.stage.viewer.requestRender()
        },
        async explode(shiftValue) {
            if (!this.stage) return;
            this.structures.forEach((structure, index) => this.shiftStructure(structure, index, shiftValue));
            this.stage.autoView();
        },
        async updateEntries(newValues, oldValues) {
            if (!this.stage)
                return;
            const { update, remove, add, reference } = generateSelections(newValues, oldValues, this.reference);
            const isReferenceEmpty = Object.keys(reference).length === 0;
            const isNewReference = isReferenceEmpty || reference.status === 'new';  //reference.item.name !== this.oldReference;
            this.oldReference = isReferenceEmpty ? "" : reference.item.name;

            // Always deal with the reference structure first
            if (!isReferenceEmpty && isNewReference) {
                let idx;
                if (reference.status === "update") {
                    idx = this.structures.findIndex(item => item.name === reference.item.name);
                    this.structures[idx].representation.setParameters(this.referenceStyleParameters);
                    this.structures[idx].structure.setTransform(new Matrix4());
                } else {
                    idx = await this.addStructureToStage(reference.item);
                    this.structures[idx].representation = this.structures[idx].structure.addRepresentation(
                        this.representationStyle,
                        this.referenceStyleParameters
                    );
                }
                this.structures[idx].structure.autoView();
                this.curReferenceIndex = idx;
            }

            await Promise.all(
                update.map(async (item) => {
                    const index = this.structures.findIndex(structure => item.name === structure.name);
                    if (index === -1) {
                        return;
                    }
                    if (isNewReference) {
                        const entry = this.structures[index];
                        entry.representation.setVisibility(false);
                        const { matrix, tmResults, alignment } = await this.tmAlignToReference(index);
                        entry.tmResults = tmResults;
                        entry.alignment = alignment;                
                        entry.representation.setParameters(this.regularStyleParameters);
                        entry.structure.setTransform(matrix);
                        entry.representation.setVisibility(true);
                        // animateMatrix(this.structures[index].structure, matrix, 1000);
                    }
                })
            );

            await Promise.all(
                remove.map(async (item) => {
                    this.stage
                        .getComponentsByName(item.name)
                        .forEach(item => this.stage.removeComponent(item));
                    const index = this.structures.findIndex(structure => item.name === structure.name);
                    this.structures.splice(index, 1);
                })
            );

            await Promise.all(
                add.map(async (item) => {
                    const index = await this.addStructureToStage(item);
                    const { matrix, tmResults, alignment } = await this.tmAlignToReference(index);
                    const entry = this.structures[index];
                    entry.tmResults = tmResults;
                    entry.alignment = alignment;
                    entry.representation = entry.structure.addRepresentation(
                        this.representationStyle,
                        this.regularStyleParameters
                    );
                    entry.structure.setTransform(matrix);
                })
            );
        },
    },
    watch: {
        '$vuetify.theme.dark': function() {
            this.stage.viewer.setBackground(this.bgColor);
        },
        entries: function(newV, oldV) {
            this.updateEntries(newV, oldV);
        },
    },
    computed: {
        bgColor() {
            return this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
        },
        ambientIntensity() {
            this.$vuetify.theme.dark ? 0.4 : 0.2;
        },
    },
}
</script>

<style scoped>
.structure-panel {
    width: 100%;
    height: 100%;
    position: relative;
}
.structure-viewer {
    width: 100%;
    height: 100%;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    top: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
}
</style>
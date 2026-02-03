<template>
<div class="structure-panel">
    <StructureViewerTooltip attach=".structure-panel" />
    <div class="structure-wrapper" ref="structurepanel" @mouseleave="clearTimer" @mousedown="isMouseDown = true" @mouseup="isMouseDown = false">
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
        <div class="structure-viewer" ref="viewport"></div>
        <div ref="previewTooltip"
            v-show="previewIndex >= 0"
            style="position: absolute; 
                bottom: 48px; 
                left: 8px; 
                padding: 8px; 
                font-size: 12px;
                background-color: rgba(0, 0, 0, 0.4);
                color: white
                " 
            v-html="refRes"
        >
        </div>
    </div>
</div>
</template>

<script>
import StructureViewerTooltip from './StructureViewerTooltip.vue';
import StructureViewerToolbar from './StructureViewerToolbar.vue';
import StructureViewerMixin from './StructureViewerMixin.vue';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import { mockPDB, makeSubPDB, makeMatrix4, getResidueIndices, oneToThree } from './Utilities.js';
import { download, PdbWriter, Matrix4, Quaternion, Vector3, concatStructures, ColormakerRegistry, Selection } from 'ngl';
import { pulchra } from 'pulchra-wasm';

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


function getMaskedPositions(seq, mask) {
    const result = [];
    let resno = 0;
    for (let i = 0; i < seq.length; i++) {
        if (seq[i] !== '-') {
            if (mask[i] === 0) {
                result.push(resno);
            }
            resno++;
        }
    }
    return result;
}

function getAlignmentPos(seq, residueIndex) {
    let resno = -1;
    for (let i = 0; i < seq.length; i++) {
        if (seq[i] !== '-') {
            resno++;
        }
        if (resno == residueIndex) {
            return i;
        }
    }
    return -1;
}

function getResidueIndex(seq, alignmentPos) {
    if (seq[alignmentPos] == '-') return -1

    let residueIndex = -1;
    for (let i = 0; i <= alignmentPos && i < seq.length; i++) {
        if (seq[i] !== '-') {
            residueIndex++;
        }
    }
    return residueIndex;
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
        curReferenceIndex: -1,  // index in ALL sequences, not just visualised subset - used as key,
        schemeId: null, // NGL colorscheme,
        selectedColumn: -1,
        ticking: false,
        hoverTimer: null,
        pendingColumn: -1,
        registeredColumn: -1,
        isMouseDown: false,
        previewIndex: -1,
    }),
    props: {
        entries: { type: Array, required: true },
        selection: { type: Array, required: true, default: [0, 1] },
        mask: { type: Array, required: true },
        reference: { type: Number, required: true },
        bgColorLight: { type: String, default: "white" },
        bgColorDark: { type: String, default: "#1E1E1E" },
        representationStyle: { type: String, default: "cartoon" },
        referenceStyleParameters: {
            type: Object,
            default: () => ({ color: 0x1E88E5, opacity: 1.0 })
        },
        regularStyleParameters: {
            type: Object,
            default: () => ({ color: 0xFFC107, opacity: 0.5, side: 'front' })
        },
        selectedColumns: {
            type: Array
        },
        previewColumn: { type: Number, required: false, default: -1}
    },
    mounted() {
        this.updateEntries(this.selection, []);
        this.stage.setParameters({
            hoverTimeout: 100,
        })

        this.stage.signals.clicked.add((pickingProxy) => {
            if (!pickingProxy) {
                // this.selectedColumn = -1;
                // this.$emit('columnSelected', -1);
                // this.$nextTick(() => {
                //     setTimeout(() => {
                //         this.updateMask()
                //     }, 0)
                // })
                return;
            }

            let atom = pickingProxy.atom;
            if (!atom) {
                // this.selectedColumn = -1;
                // this.updateMask()
                // this.$emit('columnSelected', -1);
                return;
            }
            let index = parseInt(atom.structure.name.replace("key-", ""));
            let alnPos = getAlignmentPos(this.entries[index].aa, atom.resno-1);
            // console.log(atom.residueIndex, alnPos);
            // this.selectedColumn = alnPos;
            // this.$emit('columnSelected', alnPos);
            if (this.selectedColumns.includes(alnPos)) {
                this.$emit('removeHighlight', alnPos)
            } else {
                this.$emit('addHighlight', alnPos)
            }
            // this.$nextTick(() => {
            //     setTimeout(() => {
            //         this.updateMask()
            //     }, 0)
            // })
        });

        this.stage.signals.hovered.add((pickingProxy) => {
            if (this.isMouseDown || !pickingProxy || !pickingProxy.atom) {
                this.clearTimer()
                return;
            }
            const atom = pickingProxy.atom
            let index = parseInt(atom.structure.name.replace("key-", ""));
            let alnPos = getAlignmentPos(this.entries[index].aa, atom.resno-1);

            if (alnPos < 0) {
                this.clearTimer()
            } else {
                this.pendingColumn = alnPos

                if (!this.ticking) {
                    this.ticking = true
                    window.requestAnimationFrame(() => {
                        this.togglePreview(index)
                        this.ticking = false
                    })
                }
            }
        })
    },
    methods: {
        resetView() {
            if (!this.stage) return;
            if (this.selection.length > 0) {
                this.getComponentByIndex(this.reference).autoView(this.transitionDuration);
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
REMARK      https://search.foldseek.com/foldmason
REMARK    Please cite:
REMARK      https://doi.org/10.1101/2024.08.01.606130
REMARK    Warning: Non C-alpha atoms may have been re-generated by PULCHRA
REMARK             if they are not present in the original PDB file.
`;
            this.stage.eachComponent(comp => {
                let clone = concatStructures("clone", comp.structure)
                let matrix = new Matrix4();
                matrix.fromArray(comp.transform.elements);
                clone.eachAtom(ap => {
                    let position = new Vector3(ap.x, ap.y, ap.z);
                    position.applyMatrix4(matrix);
                    ap.x = position.x;
                    ap.y = position.y;
                    ap.z = position.z;
                });
                PDB = new PdbWriter(clone, { renumberSerial: false }).getData();
                PDB = PDB.split('\n').filter(line => line.startsWith("ATOM")).join('\n');
                let index = parseInt(comp.structure.name.replace("key-", "")); 
                let name = this.entries[index].name;
                let remark = `REMARK    Name: ${name}`;
                if (index !== this.reference) {
                    const m = matrix.elements.map(e => e.toFixed(6).padStart(12));
                    remark += `
REMARK    Rotation matrix (u)
REMARK    ${m[0]} ${m[4]} ${m[8]}
REMARK    ${m[1]} ${m[5]} ${m[9]}
REMARK    ${m[2]} ${m[6]} ${m[10]}
REMARK    Translation matrix (t)
REMARK    ${m[12]} ${m[13]} ${m[14]}`;
                }
                result += `\
MODEL     ${index}
${remark}
${PDB}
ENDMDL
`;
            }, "structure")
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
        getComponentByIndex(index) {
            if (!this.stage) return;
            const compList = this.stage.getComponentsByName(`key-${index}`);
            if (compList.list.length === 0) return -1;
            return compList.list[0];
        },
        async tmAlignToReference(index) {
            if (index === this.reference) {
                return;
            }
            const refData = this.entries[this.reference];
            const newData = this.entries[index];
            const refComp = this.getComponentByIndex(this.reference);
            const newComp = this.getComponentByIndex(index);
            const aln = mockAlignment(refData.aa, newData.aa);
            const fasta = `>target\n${aln.dbAln}\n\n>query\n${aln.qAln}`;
            const [queryPDB, targetPDB] = await Promise.all([
                makeSubPDB(refComp.structure, aln ? `${aln.qStartPos}-${aln.qEndPos}` : ''),
                makeSubPDB(newComp.structure, aln ? `${aln.dbStartPos}-${aln.dbEndPos}` : '')
            ]);
            if (!__LOCAL__) {
                const worker = new Worker(new URL("TMAlignWorker.js", import.meta.url));
                return new Promise((resolve, reject) => {
                    worker.onmessage = function (e) {
                        const { t, u, tmResults } = e.data;
                        resolve({
                            matrix: makeMatrix4(t, u),
                            tmResults: tmResults
                        }); 
                        worker.terminate();
                    }
                    worker.onerror = function (e) {
                        reject(e);
                        worker.terminate();
                    }
                    worker.postMessage({ refPDB: targetPDB, newPDB: queryPDB, alnFasta: fasta });
                });
            }
            const { output, matrix } = await tmalign(targetPDB, queryPDB, fasta);
            const { t, u }  = parseTMMatrix(matrix);
            const tmResults = parseTMOutput(output);
            return Promise.resolve({
                matrix: makeMatrix4(t, u),
                tmResults: tmResults,
                alignment: aln
            });
        },
        async addStructureToStage(index, aa, ca) {
            const mock = mockPDB(ca, aa.replace(/-/g, ''), 'A');
            const pdb  = await pulchra(mock);
            const blob = new Blob([pdb], { type: 'text/plain' })
            return this.stage.loadFile(blob, { ext: 'pdb', firstModelOnly: true, name: `key-${index}` });
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
            if (!this.stage) {
                return;
            }

            // custom color scheme to hightlight gappy columns and reference/targets
            if (this.schemeId == null) {
                let that = this;
                this.schemeId = ColormakerRegistry.addScheme(function(params) {
                    let index = parseInt(params.structure.name.replace("key-", ""));
                    let color = that.regularStyleParameters.color;
                    if (index === that.reference) {
                        color = that.referenceStyleParameters.color;
                    }
                    let seq = that.entries[index].aa
                    let residueMask = getMaskedPositions(seq, that.mask);
                    // let highlightedIndex = getResidueIndex(seq, that.selectedColumn);
                    let hightlightedIndices = getResidueIndices(seq, that.selectedColumns);
                    // let previewIndex = getResidueIndex(seq, that.previewColumn)

                    this.atomColor = (atom) => {
                        if (hightlightedIndices.includes(atom.residueIndex)) {
                            return that.highLightColor;
                        }
                        // if (highlightedIndex == atom.residueIndex) {
                        //     // return 0x00E676;
                        //     return that.highLightColor
                        // }

                        // if (previewIndex == atom.residueIndex) {
                        //     return that.previewColor
                        // }
                        
                        if (residueMask.includes(atom.residueIndex)) {
                            return 0x666666;
                        }
                        return color;
                    };
                });
            }

            // Selections - structures to update/remove/add
            const newSet = new Set(newValues);
            const oldSet = new Set(oldValues);
            
            if (newSet.size === 0) {
                this.stage.removeAllComponents();
                return;
            }

            const update = [];
            const remove = [];
            const add    = [];

            for (const value of oldSet) {
                if (value === this.reference) continue;
                if (newSet.has(value)) {
                    update.push(value);
                } else {
                    remove.push(value);
                }
            }
            for (const value of newSet) {
                if (value === this.reference || oldSet.has(value)) continue;
                add.push(value);
            }

            // Changed status of reference
            const isDiffReference = this.reference !== this.curReferenceIndex;
            const isNewReference  = !oldSet.has(this.reference);
            const referenceChanged = isDiffReference || isNewReference;

            this.curReferenceIndex = this.reference;

            // Update the reference
            // If reference already exists, just change the colour and reset its transform
            // Otherwise add as new structure to the NGL Stage
            if (referenceChanged) {
                let data = this.entries[this.reference];
                let ref;
                if (isNewReference) {
                    ref = await this.addStructureToStage(this.reference, data.aa, data.ca);
                    ref.addRepresentation(this.representationStyle, {...this.referenceStyleParameters, color: this.schemeId });
                } else {
                    ref = this.getComponentByIndex(this.reference);
                    ref.reprList[0].setVisibility(false);
                    ref.reprList[0].setParameters({...this.referenceStyleParameters, color: this.schemeId })
                    ref.setTransform(new Matrix4());
                    ref.reprList[0].setVisibility(true);
                }
                ref.autoView();
            }

            await Promise.all(
                add.map(async (idx) => {
                    const data = this.entries[idx];
                    const structure = await this.addStructureToStage(idx, data.aa, data.ca);
                    const { matrix } = await this.tmAlignToReference(idx);
                    structure.setTransform(matrix);
                    structure.addRepresentation(this.representationStyle, {...this.regularStyleParameters, color: this.schemeId });
                })
            );

            await Promise.all(
                remove.map(async (idx) => { 
                    const structure = this.getComponentByIndex(idx);
                    this.stage.removeComponent(structure);
                })
            );
            
            if (!referenceChanged) {
                return;
            }

            await Promise.all(
                update.map(async (idx) => {
                    const structure = this.getComponentByIndex(idx); 
                    if (!structure || structure.reprList.length === 0) return;
                    const [ representation ] = structure.reprList;
                    representation.setVisibility(false);
                    const { matrix } = await this.tmAlignToReference(idx);
                    representation.setParameters(this.regularStyleParameters)
                    structure.setTransform(matrix);
                    representation.setVisibility(true);
                })
            );
            this.updateMask();
            this.clearTimer()
        },
        async updateMask() {
            this.stage.eachRepresentation((repr) => {
                repr.build();
            });
        },
        async updateAllHighlights() {
            if (!this.stage) return

            let getHighlightedResno = (index) => {
                let seq = this.entries[index].aa
                return getResidueIndices(seq, this.selectedColumns).map(i => i+1)
            }

            
            let that = this
            this.stage.eachComponent(function(comp) {
                if (comp.type !== 'structure') return
                
                let reprList = comp.reprList
                reprList.find(r => r.name === 'cartoon')?.build()
                return
                
                // As our mockPDB doesn't contain any sidechain atoms,
                // the licorice representation is useless
                const index = parseInt(comp.structure.name.replace("key-", ""));
                let hightlightedIndices = getHighlightedResno(index)
                let highlightSele = hightlightedIndices.length > 0 ? hightlightedIndices.join(" or ") : "none"
                let highlightRepr = reprList.find(r => r.name === 'highlight-repr')
                
                if (highlightRepr) {
                    highlightRepr.setSelection(highlightSele).build()
                } else {
                    comp.addRepresentation('licorice', {
                        name: 'highlight-repr',
                        sele: highlightSele,
                        colorValue: that.highLightColor,
                        opacity: 0.5,
                        scale: 3.0,
                    }).build()
                }
            })
        },
        async updateAllPreview() {
            if (!this.stage) return

            let getPreviewResno = (index) => {
                let seq = this.entries[index].aa
                return getResidueIndex(seq, this.previewColumn) + 1;
            }
            
            let that = this
            this.stage.eachComponent(function(comp) {
                if (comp.type !== 'structure') return

                let reprList = comp.reprList
                // reprList.find(r => r.name === 'cartoon')?.build()
                // return

                // As our mockPDB doesn't contain any sidechain atoms,
                // the licorice representation is useless
                
                const index = parseInt(comp.structure.name.replace("key-", ""));

                let previewIndex = getPreviewResno(index)
                let previewSele = previewIndex > 0 ? String(previewIndex) : "none"
                let previewRepr = reprList.find(r => r.name === 'preview-repr')
                
                if (previewRepr) {
                    previewRepr.setSelection(previewSele).build()
                } else {
                    comp.addRepresentation('hyperball', {
                        name: 'preview-repr',
                        sele: previewSele,
                        color: that.highLightColor,
                        opacity: 0.4,
                        radius: 1.8,
                        side: 'double',
                    }).build()
                }
            })
        },
        async moveView(alnPos) {
            if (alnPos < 0 || this.reference < 0) {
                return
            }
            let comp = this.getComponentByIndex(this.reference)
            let resIdx = getResidueIndex(this.entries[this.reference].aa, alnPos)
            if (resIdx < 0) {
                return
            }
            const range = 8
            let sele = String(resIdx + 1 - range) + "-" + (resIdx - 1 + range)
            comp.autoView(sele, 200)
        },
        setTimer(idx, structIdx) {
            this.registeredColumn = idx;
            this.hoverTimer = setTimeout(() => {
                this.previewIndex = structIdx
                this.$emit('changePreview', idx, true)
                this.registeredColumn = -1
            }, 900)
        },
        clearTimer() {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer)
                this.hoverTimer = null
            }
            this.previewIndex = -1
            this.$emit('changePreview', -1, true)
        },
        togglePreview(index) {
            if (this.previewColumn == this.pendingColumn
                || this.pendingColumn == this.registeredColumn
            ) return
            
            this.clearTimer()
            this.setTimer(this.pendingColumn, index)
        },
    },
    watch: {
        '$vuetify.theme.dark': function() {
            this.stage.viewer.setBackground(this.bgColor);
        },
        selection: function(newV, oldV) {
            this.updateEntries(newV, oldV);
        },
        mask: function(newM, oldM) {
            this.updateMask();
        }
    },
    computed: {
        bgColor() {
            return this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
        },
        ambientIntensity() {
            this.$vuetify.theme.dark ? 0.4 : 0.2;
        },
        stageParameters: function() {
            return {
                log: 'none',
                backgroundColor: this.bgColor,
                transparent: true,
                ambientIntensity: this.ambientIntensity,
                clipNear: -1000,
                clipFar: 1000,
                fogFar: 1000,
                fogNear: -1000,
                quality: 'high',
                tooltip: false,
            }
        },
        highLightColor() {
            return 0xec3f5f
        },
        refRes() {
            if (this.previewColumn < 0 
                || this.previewIndex < 0) return ""
            
            const targetObj = this.entries[this.previewIndex]
            const name = targetObj.name?.length > 12 
                ? targetObj.name.slice(0, 9) + '...' 
                : targetObj.name
            const targetSeq = targetObj.aa
            const AA = oneToThree[targetSeq[this.previewColumn]]
            const formatted = AA.charAt(0) + AA.toLowerCase().slice(1, 3)
            const resNo = getResidueIndex(targetSeq, this.previewColumn) + 1
            return '<span>'+ name + ':&nbsp;</span><strong class="mono">' 
                + formatted + String(resNo) +'</strong>'
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
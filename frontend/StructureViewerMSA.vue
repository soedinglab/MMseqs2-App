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
        <div ref="previewTooltip" class="mono"
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
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Color } from "molstar/lib/mol-util/color";
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import { 
    mockPDB, 
    makeMat4,
    oneToThree, 
    decodeMultimer, 
    storeChains, 
    revertChainInfo, 
    splitMultimer, 
    mergeMultimer,
    toMolstarColor,
    mapRangesToAuth,
    buildChainExpression,
    getSelectionLoci,
    extractAtomLines,
    transformPdb,
    makeSubPdbFromRanges,
    concatenatePdbs,
    buildSerialResidueMap,
} from './Utilities.js';
import { pulchra } from 'pulchra-wasm';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra.js';

const DEFAULT_REFERENCE_COLOR = 0x1e88e5;
const DEFAULT_REGULAR_COLOR = 0xffc107;
const DEFAULT_MASK_COLOR = 0x666666;
const DEFAULT_HIGHLIGHT_COLOR = 0x11ffee
const PREVIEW_OPACITY = 0.3
const OVERPAINT_TAG = "MSA_OVERPAINT"
const PREVIEW_TAG = "MSA_PREVIEW"
const TRANSFORM_TAG = "MSA_TRANSFORM"

/**
 * 
 * @param {Map<string, string[]>} serialMap 
 * @return {Map<string, int>} Map, mapping `resno` to `serialIdx`. It overwrites duplicated `resno`
 */
const buildSerialIndexMap = (serialMap) => {
    const map = new Map();
    if (!serialMap) return map;
    serialMap.forEach((resno, idx) => {
        if (!map.has(resno)) {
            map.set(resno, idx);
        }
    });
    return map;
};

/**
 * @param {int[]} positions
 * @return {{start: int, end: int}[]} `ranges`: merged multiple positions into `resno` range
 */
const positionsToRanges = (positions) => {
    if (!positions || positions.length === 0) return [];
    const sorted = Array.from(new Set(positions)).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = start;
    for (let i = 1; i < sorted.length; i += 1) {
        const pos = sorted[i];
        if (pos === end + 1) {
            end = pos;
            continue;
        }
        ranges.push({ start: start + 1, end: end + 1 });
        start = pos;
        end = pos;
    }
    ranges.push({ start: start + 1, end: end + 1 });
    return ranges;
};

const positionsToChainwiseRanges = (positions, chains, offsets) => {
    if (!positions || positions.length == 0) return {}
    const sorted = [...positions].sort((a, b) => a - b)
    const result = {}
    let currentChain = chains[sorted[0]]
    let start = sorted[0] - offsets[currentChain]
    let end = start

    for (let i = 1; i < sorted.length; i += 1) {
        const pos = sorted[i]
        const chain = chains[pos]
        const idx = pos - offsets[chain]

        if (!result[currentChain]) {
            result[currentChain] = []
        }
        
        if (chain != currentChain) {
            result[currentChain].push({start: start + 1, end: end + 1})
            currentChain = chain
            start = end = idx
            continue
        }

        if (idx == end + 1) {
            end += 1
            continue
        }
        
        result[currentChain].push({start: start + 1, end: end + 1})
        start = end = idx
    }
    result[currentChain].push({start: start + 1, end: end + 1})
    
    return result
}


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
    let resi = -1;
    for (let i = 0; i < seq.length; i++) {
        if (seq[i] !== '-') {
            resi++;
        }
        if (resi == residueIndex) {
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
        curReferenceIndex: -1,  // index in ALL sequences, not just visualised subset - used as key,
        selectedColumn: -1,
        ticking: false,
        hoverTimer: null,
        pendingColumn: -1,
        registeredColumn: -1,
        isMouseDown: false,
        previewIndex: -1,
        // For test...
        structureItems: [],
        structureIndexByStructure: new Map(),
        renderToken: 0,
        overlayToken: 0,
        clickUnsub: null,
        pdbCache: new Map()
    }),
    props: {
        entries: { type: Array, required: true },
        selection: { type: Array, required: true, default: [0, 1] },
        mask: { type: Array, required: true },
        reference: { type: Number, required: true },
        bgColorLight: { type: String, default: "white" },
        bgColorDark: { type: String, default: "#1E1E1E" },
        representationStyle: { type: String, default: "cartoon" },
        previewStyle: {type: String, default: 'ball-and-stick'},
        referenceStyleParameters: {
            type: Object,
            default: () => ({ color: 0x1E88E5, opacity: 1.0 })
        },
        regularStyleParameters: {
            type: Object,
            default: () => ({ color: 0xFFC107, opacity: 0.5, side: 'front' })
        },
        selectedColumns: {
            type: Array, default: () => [],
        },
        previewColumn: { type: Number, required: false, default: -1}
    },
    async mounted() {
        await this.stageReady;
        await this.updateEntries(this.selection, [])
        this.subscribeClicks();

        /*
        // TODO: 
        // Find out the way to implement hover-related things
        // in molstar. It seems there are ways to subscribe some sort of
        // hover event listener... maybe.

        this.stage.signals.hovered.add((pickingProxy) => {
            if (this.isMouseDown || !pickingProxy || !pickingProxy.atom) {
                this.clearTimer()
                return;
            }
            const atom = pickingProxy.atom
            let index = parseInt(atom.structure.name.replace("key-", ""));
            let entry = this.entries[index]
            let alnPos = getAlignmentPos(entry.aa, atom.residueIndex);

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
        */
    },
    beforeDestroy() {
        if (this.clickUnsub) {
            this.clickUnsub()
            this.clickUnsub = null
        }
    },
    methods: {
        resetView() {
            if (!this.stager) return
            this.focusReference() 
        },
        makePDB() {
            if (!this.structureItems.length) return;
            let result = `\
TITLE     Superposed structures from Foldmason alignment
REMARK    This file was generated by the FoldMason webserver:
REMARK      https://search.foldseek.com/foldmason
REMARK    Please cite:
REMARK      https://doi.org/10.1101/2024.08.01.606130
REMARK    Warning: Non C-alpha atoms may have been re-generated by PULCHRA
REMARK             if they are not present in the original PDB file.
`;
            for (const item of this.structureItems) {
                const entry = this.entries[item.index];
                const PDB = extractAtomLines(item.pdb).join('\n');
                const name = entry?.name || `key-${item.index}`;
                const remark = `REMARK    Name: ${name}`;
                result += `\
MODEL     ${item.index}
${remark}
${PDB}
ENDMDL
`;
            }
            result += "END";
            downloadBlob(new Blob([result], { type: 'text/plain' }), "foldmason.pdb")
        },
        async makeImage() {
            if (!this.stage) return;
            const wasSpinning = this.isSpinning;
            this.isSpinning = false;
            const blob = await this.stage.makeImage();
            if (blob) {
                downloadBlob(blob, "foldmason.png");
            }
            this.isSpinning = wasSpinning;
        },
        subscribeClicks() {
            if (this.clickUnsub) {
                this.clickUnsub();
            }
            this.clickUnsub = this.stage.onClick((event) => this.handleStructureClick(event));
        },
        handleStructureClick(event) {
            const loci = event?.current?.loci || event?.current;
            if (!StructureElement.Loci.is(loci)) {
                return;
            }
            const location = StructureElement.Loci.getFirstLocation(loci);
            if (!location) {
                return;
            }
            const structure = location.structure;
            const index = this.structureIndexByStructure.get(structure);
            if (index === undefined) {
                return;
            }
            const chainId = StructureProperties.chain.auth_asym_id(location);
            const resno = StructureProperties.residue.auth_seq_id(location);
            const item = this.structureItems.find(entry => entry.index === index);
            const serialIndex = item ? this.getSerialIndex(item, chainId, resno) : null;
            if (!Number.isFinite(serialIndex)) {
                return;
            }
            const entry = this.entries[index]
            const alnPos = getAlignmentPos(entry.aa, serialIndex + entry.offsets[chainId]);
            if (this.selectedColumns.includes(alnPos)) {
                this.$emit('removeHighlight', alnPos)
            } else {
                this.$emit('addHighlight', alnPos)
            }
            this.renderOverlays(updateHighlight = true);
        },
        focusReference() {
            if (!this.stage) return;
            const refItem = this.structureItems.find(item => item.index === this.reference) || this.structureItems[0];
            if (!refItem) return;
            const loci = getSelectionLoci(MS.struct.generator.all(), refItem.structureRef);
            this.stage.focusLoci(loci, this.transitionDuration);
        },
        getChains(item) {
            if (item.chainIds && item.chainIds.size > 0) {
                return Array.from(item.chainIds.values())
            }
            return ['A']
        },
        getChainMap(item, chain) {
            if (!item.serialMap || item.serialMap.size === 0) return null;
            let chainMap = item.serialMap.get(chain);
            if (!chainMap && item.serialMap.size === 1) {
                chainMap = Array.from(item.serialMap.values())[0];
            }
            return chainMap || null;
        },
        getSerialIndex(item, chain, resno) {
            if (!item.serialIndexByChain || item.serialIndexByChain.size === 0) return null;
            let chainMap = item.serialIndexByChain.get(chain);
            if (!chainMap && item.serialIndexByChain.size === 1) {
                chainMap = Array.from(item.serialIndexByChain.values())[0];
            }
            if (!chainMap) return null;
            const value = chainMap.get(resno);
            return Number.isFinite(value) ? value : null;
        },
        buildMaskExpression(entry, item) {
            if (!this.mask || this.mask.length === 0) return MS.struct.generator.empty();
            const positions = getMaskedPositions(entry.aa, this.mask);
            if (!positions.length) return MS.struct.generator.empty();
            const chains = this.getChains(item)
            const ranges = positionsToChainwiseRanges(positions, entry.chains, entry.offsets)
            
            const exps = []
            const chainIdAvailable = item.chainIds && item.chainIds.size > 0

            for (let chain of chains) {
                const chainMap = this.getChainMap(item, chain)
                const mappedRanges = mapRangesToAuth(ranges[chain], chainMap);
                if (!mappedRanges || !mappedRanges.length) continue

                const useChain = chainIdAvailable && item.chainIds.has(chain)
                exps.push(buildChainExpression(chain, mappedRanges, useChain))
            }
            
            return exps.length == 0 ? MS.struct.generator.empty()
                : exps.length == 1 ? exps[0]
                : MS.struct.combinator.merge(exps)
        },
        buildColumnsExpression(entry, item, columns) {
            if (!Array.isArray(columns) || columns.length === 0) return MS.struct.generator.empty();

            const residueIndices = Array.from(new Set(columns
                .map(col => getResidueIndex(entry.aa, Number(col)))
                .filter(resIdx => Number.isFinite(resIdx) && resIdx >= 0)))
                .sort((a, b) => a - b);
            if (residueIndices.length === 0) return MS.struct.generator.empty();
            
            const chains = this.getChains(item)
            const ranges = positionsToChainwiseRanges(residueIndices, entry.chains, entry.offsets);
            
            const exps = []
            const chainIdAvailable = item.chainIds && item.chainIds.size > 0
            
            for (let chain of chains) {
                const chainMap = this.getChainMap(item, chain)
                const mappedRanges = mapRangesToAuth(ranges[chain], chainMap);
                if (!mappedRanges || !mappedRanges.length) continue

                const useChain = chainIdAvailable && item.chainIds.has(chain)
                exps.push(buildChainExpression(chain, mappedRanges, useChain))
            }
            
            return exps.length == 0 ? MS.struct.generator.empty() 
                : exps.length == 1 ? exps[0]
                : MS.struct.combinator.merge(exps)
        },
        buildHighlightExpression(entry, item) {
            if (this.selectedColumns.length > 0) {
                return this.buildColumnsExpression(entry, item, this.selectedColumns);
            } else return MS.struct.generator.empty()
        },
        buildPreviewExpression(entry, item) {
            if (!Number.isFinite(this.previewColumn) || this.previewColumn < 0) return MS.struct.generator.empty();
            
            const residueIndex = getResidueIndex(entry.aa, this.previewColumn)
            if (!Number.isFinite(residueIndex) || residueIndex < 0) return MS.struct.generator.empty()

            const chain = entry.chains[residueIndex]
            const processed = residueIndex - entry.offsets[chain]
            const range = {start: processed + 1, end: processed + 1}
            const chainMap = this.getChainMap(item, chain)
            const mappedRanges = mapRangesToAuth([range], chainMap)
            if (!mappedRanges || !mappedRanges.length) return MS.struct.generator.empty()
            const useChain = item.chainIds && item.chainIds.size > 0 && item.chainIds.has(chain)
            return buildChainExpression(chain, mappedRanges, useChain)
        },
        async buildEntryPdb(index, entry) {
            if (this.pdbCache.has(index)) {
                return this.pdbCache.get(index);
            }
            const seq = entry.aa ? entry.aa.replace(/-/g, '') : '';
            const mock = mockPDB(entry.ca, seq, 'A');
            let pdb = mock;
            let raw = mock;
            try {
                if (entry.suffix) {
                    const decoded = decodeMultimer(mock, entry.suffix)
                    const chains = storeChains(decoded)
                    const splitted = splitMultimer(decoded)
                    const arr = []
                    const forRaw = []

                    for (const split of splitted) {
                        const tmp = await pulchra(split)
                        arr.push(tmp)
                        forRaw.push({pdb: tmp, chain: ""})
                    }
                    pdb = mergeMultimer(arr)
                    raw = concatenatePdbs(forRaw)
                    pdb = revertChainInfo(pdb, chains)
                    
                } else {
                    pdb = await pulchra(mock);
                    raw = pdb
                }
            } catch (error) {
                console.warn('pulchra failed for entry', entry?.name || index, error);
            }
            const result = {pdb: pdb, raw: raw}
            this.pdbCache.set(index, result);
            return result;
        },
        async alignEntryToReference(refEntry, refPdbRaw, entry, entryPdbBundle /* { pdb, raw } */) {
            const aln = mockAlignment(refEntry.aa, entry.aa);
            if (!Number.isFinite(aln.qStartPos) || !Number.isFinite(aln.dbStartPos)) {
                return entryPdbBundle.pdb;
            }
            const qRanges = new Map([['A', [{ start: aln.qStartPos, end: aln.qEndPos }]]]);
            const tRanges = new Map([['A', [{ start: aln.dbStartPos, end: aln.dbEndPos }]]]);
            const qSubPdb = makeSubPdbFromRanges(refPdbRaw, qRanges);
            const tSubPdb = makeSubPdbFromRanges(entryPdbBundle.raw, tRanges);
            const alnFasta = `>target\n${aln.dbAln}\n\n>query\n${aln.qAln}`;
            try {
                const tm = await tmalign(tSubPdb, qSubPdb, alnFasta);
                const { t, u } = parseTMMatrix(tm.matrix);
                parseTMOutput(tm.output);
                return transformPdb(entryPdbBundle.pdb, t, u);
            } catch (error) {
                console.warn('tmalign-wasm failed for entry', entry?.name || '', error);
            }
            return entryPdbBundle.pdb
        },
        
        async getAlignedMatrix(refEntry, refPdbRaw, entry, entryPdbRaw) {
            const aln = mockAlignment(refEntry.aa, entry.aa);
            if (!Number.isFinite(aln.qStartPos) || !Number.isFinite(aln.dbStartPos)) {
                return Mat4.identity()
            }
            const qRanges = new Map([['A', [{ start: aln.qStartPos, end: aln.qEndPos }]]]);
            const tRanges = new Map([['A', [{ start: aln.dbStartPos, end: aln.dbEndPos }]]]);
            const qSubPdb = makeSubPdbFromRanges(refPdbRaw, qRanges);
            const tSubPdb = makeSubPdbFromRanges(entryPdbRaw, tRanges);
            const alnFasta = `>target\n${aln.dbAln}\n\n>query\n${aln.qAln}`;
            try {
                const tm = await tmalign(tSubPdb, qSubPdb, alnFasta);
                const { t, u } = parseTMMatrix(tm.matrix);
                parseTMOutput(tm.output);
                return makeMat4(t, u);
            } catch (error) {
                console.warn('tmalign-wasm failed for entry', entry?.name || '', error);
            }
            return Mat4.identity()
        },
        async addStructureItem(index, pdbBundle, isReference, matrix=null) {
            if (!this.stage) return null;
            const pdb = pdbBundle.pdb
            const structureRef = await this.stage.loadStructure({ data: pdb, format: 'pdb', label: `key-${index}` });
            if (!structureRef) return null;
            await this.stage.updateTransformMatrix(structureRef, matrix, TRANSFORM_TAG)
            const serialMap = buildSerialResidueMap(pdb);
            const serialIndexByChain = new Map();
            serialMap.forEach((values, chain) => {
                serialIndexByChain.set(chain, buildSerialIndexMap(values));
            });
            const chainIds = new Set(storeChains(pdb));
            const baseComponent = await this.stage.createComponentStatic(structureRef, 'all');
            
            let reprRef = undefined
            let previewRef = undefined
            
            if (baseComponent) {
                reprRef = await this.stage.addRepresentation(
                    baseComponent,
                    this.getProp(false, isReference),
                );

                previewRef = await this.stage.addRepresentation(
                    baseComponent,
                    this.getProp(true),
                )
                
                // Initially hide preview representation.
                await this.stage.getUpdate()
                .to(previewRef)
                .apply(
                    StateTransforms.Representation.TransparencyStructureRepresentation3DFromScript,
                    {
                        layers: [
                            {
                                script: { language: 'pymol', expression: 'select all'},
                                value: 1.0,
                            }
                        ]
                    }, {
                        tags: [PREVIEW_TAG]
                    }
                ).commit()
                
            }
            const item = {
                index,
                pdb: pdbBundle,
                structureRef,
                reprRef,
                previewRef,
                chainIds,
                serialMap,
                serialIndexByChain,
                baseComponent,
                highlightExpr: null,
                maskExpr: null,
            };
            this.structureItems.push(item);
            const structure = structureRef?.cell?.obj?.data;
            if (structure) {
                this.structureIndexByStructure.set(structure, index);
            }
            return item;
        },
        async renderOverlays(updateMask=false, updateHighlight=false, updatePreview=false) {
            if (!this.stage || !this.stageReady) return;
            const token = ++this.overlayToken;
            await this.stageReady;
            if (token !== this.overlayToken) return;

            const update = this.stage.getUpdate()
            if (!update) return

            const transparencyResetLayer = {
                script: { language: 'mol-script', expression: MS.struct.generator.all() },
                value: 1.0,
            }

            for (const item of this.structureItems) {
                const entry = this.entries[item.index];
                if (!entry) continue;

                if (updateMask || updateHighlight) {
                    const layers = []
                    let script = ""
                    
                    // Render highlights
                    if (updateHighlight) {
                        script = this.buildHighlightExpression(entry, item);
                    } else {
                        script = item.highlightExpr
                    }

                    if (script) {
                        layers.push({
                            script: { language: 'mol-script', expression: script },
                            color: Color(DEFAULT_HIGHLIGHT_COLOR),
                            clear: false,
                        })
                    }

                    script = ""

                    // Render mask
                    if (updateMask) {
                        script = this.buildMaskExpression(entry, item);
                    } else {
                        script = item.maskExpr
                    }

                    if (script) {
                        layers.push({
                            script: { language: 'mol-script', expression: script },
                            color: Color(DEFAULT_MASK_COLOR),
                            clear: false,
                        })
                    }

                    if (layers.length > 0) {
                        const nodes = this.stage.getNodes(item.reprRef, OVERPAINT_TAG)
                        if (nodes.length > 0) {
                            update.to(nodes[0].transform.ref).update({
                                layers
                            })
                        } else {
                            update.to(item.reprRef).apply(
                                StateTransforms.Representation.OverpaintStructureRepresentation3DFromScript,
                                { layers },
                                { tags: [OVERPAINT_TAG] },
                            )
                        }
                    } else {
                        const nodes = this.stage.getNodes(item.reprRef, OVERPAINT_TAG)
                        if (nodes.length > 0) {
                            update.delete(nodes[0].transform.ref)
                        }
                    }
                }

                // Render preview
                if (updatePreview) {
                    const layers = []
                    layers.push(transparencyResetLayer)
                    
                    const previewExpr = this.buildPreviewExpression(entry, item);

                    if (previewExpr) {
                        layers.push({
                            script: { language: 'mol-script', expression: previewExpr },
                            value: 0.0,
                            // clear: true
                        })
                    }

                    const nodes = this.stage.getNodes(item.previewRef, PREVIEW_TAG)
                    if (nodes.length > 0) {
                        update.to(nodes[0].transform.ref).update({
                            layers
                        })
                    } else {
                        // ERROR There must be exactly one node for this tag...!
                    }
                }
            }
            await update.commit()
        },
        getProp(isPreview = false, isReference = false) {
            const reprRegular = {
                type: this.representationStyle,
                typeParams: {alpha: this.regularStyleParameters.opacity},
                color: 'uniform',
                colorParams: {value: toMolstarColor(
                    this.regularStyleParameters.color,
                    DEFAULT_REGULAR_COLOR
                )},
            }
            const reprReference = {
                type: this.representationStyle,
                typeParams: {alpha: this.referenceStyleParameters.opacity},
                color: 'uniform',
                colorParams: {value: toMolstarColor(
                    this.referenceStyleParameters.color,
                    DEFAULT_REFERENCE_COLOR
                )},
            }
            const previewReference = {
                type: this.previewStyle,
                typeParams: {alpha: PREVIEW_OPACITY},
                color: 'uniform',
                colorParams: {value: Color(0xec3f5f)},
            }
            
            return isPreview ? previewReference : 
                isReference ? reprReference : 
                reprRegular
        },
        async updateAllHighlights() {
            await this.renderOverlays(updateHighlight = true);
        },
        async updateAllPreview() {
            await this.renderOverlays(updatePreview = true);
        },
        // async updateAllPreview() {
        //     if (!this.stage) return

        //     let getPreviewSelection = (index) => {
        //         let entry = this.entries[index]
        //         let seq = entry.aa
        //         let resno = getResidueIndex(seq, this.previewColumn) + 1;

        //         if (resno < 1) {
        //             return "none"
        //         }
                
        //         let chain = entry.chains[resno]
        //         let processed = resno - entry.offsets[chain]
        //         return String(processed) + ' and :' + chain
        //     }
            
        //     let that = this
        //     this.stage.eachComponent(function(comp) {
        //         if (comp.type !== 'structure') return

        //         let reprList = comp.reprList
        //         // reprList.find(r => r.name === 'cartoon')?.build()
        //         // return

        //         // As our mockPDB doesn't contain any sidechain atoms,
        //         // the licorice representation is useless
                
        //         const index = parseInt(comp.structure.name.replace("key-", ""));

        //         let previewSele = getPreviewSelection(index)
        //         let previewRepr = reprList.find(r => r.name === 'preview-repr')
                
        //         if (previewRepr) {
        //             previewRepr.setSelection(previewSele).build()
        //         } else {
        //             comp.addRepresentation('hyperball', {
        //                 name: 'preview-repr',
        //                 sele: previewSele,
        //                 color: that.highLightColor,
        //                 opacity: 0.4,
        //                 radius: 1.8,
        //                 side: 'double',
        //             }).build()
        //         }
        //     })
        // },
        moveView(idx) {
            if (!Number.isFinite(Number(idx)) || !this.stage) return;
            const refItem = this.structureItems.find(item => item.index === this.reference) || this.structureItems[0];
            if (!refItem) return;
            const entry = this.entries[refItem.index];
            if (!entry) return;
            
            let intIdx = Number(idx)
            const chain = entry.chains[intIdx]
            const processed = intIdx - entry.offsets[chain]
            const range = {start: processed + 1, end: processed + 1}
            const chainMap = this.getChainMap(refItem, chain)
            const mappedRanges = mapRangesToAuth([range], chainMap)
            if (!mappedRanges || !mappedRanges.length) return null
            const useChain = refItem.chainIds && refItem.chainIds.size > 0 && refItem.chainIds.has(chain)
            const expr = buildChainExpression(chain, mappedRanges, useChain)

            if (!expr) {
                this.focusReference();
                return;
            }
            const loci = getSelectionLoci(expr, refItem.structureRef);
            if (!loci) {
                this.focusReference();
                return;
            }
            this.stage.focusLoci(loci, this.transitionDuration);
        },
        // Deprecated!
        async rebuildStructures(focus = true) {
            // FIXME make it to update only on the changes!
            // FIXME make it use mol* Mat4 state...!

            if (!this.stage || !this.stageReady) return;
            const token = ++this.renderToken;
            await this.stageReady;
            if (token !== this.renderToken) return;

            await this.stage.clear();
            this.structureItems = [];
            this.structureIndexByStructure = new Map();

            const indices = [];
            if (Number.isInteger(this.reference)) {
                indices.push(this.reference);
            }
            if (Array.isArray(this.selection)) {
                for (const idx of this.selection) {
                    if (idx !== this.reference) {
                        indices.push(idx);
                    }
                }
            }

            if (indices.length === 0) return;
            const refEntry = this.entries[this.reference];
            if (!refEntry) return;

            const refPdbBundle = await this.buildEntryPdb(this.reference, refEntry);
            const refPdb = refPdbBundle.pdb
            await this.addStructureItem(this.reference, refPdb, true);

            for (const idx of indices) {
                if (idx === this.reference) continue;
                const entry = this.entries[idx];
                if (!entry) continue;
                const entryPdbBundle = await this.buildEntryPdb(idx, entry);
                const alignedPdb = await this.alignEntryToReference(refEntry, refPdbBundle.raw, entry, entryPdbBundle);
                await this.addStructureItem(idx, alignedPdb, false);
            }

            await this.renderOverlays(updateMask = true, updateHighlight = true, updatePreview = true);

            if (focus) {
                this.focusReference();
            }
        },
        async updateEntries(newValues, oldValue) {
            if (!this.stage || !this.stageReady) return
            const token = ++this.renderToken
            await this.stageReady
            if (token !== this.renderToken) return

            const newSet = new Set(newValues)
            const oldSet = new Set(oldValue)
            if (newSet.size == 0) {
                await this.stage.removeAllComponents()
                this.structureItems = []
                this.structureIndexByStructure = new Map()
                return
            }
            
            const toUpdate = [];
            const remove = [];
            const add    = [];

            for (const value of oldSet) {
                if (value === this.reference) continue;
                if (newSet.has(value)) {
                    toUpdate.push(value);
                } else {
                    remove.push(value);
                }
            }
            for (const value of newSet) {
                if (value === this.reference || oldSet.has(value)) continue;
                add.push(value);
            }
            
            // Check the status of reference
            const isReferenceDiff = this.reference !== this.curReferenceIndex
            const isNewReference = !oldSet.has(this.reference)
            const isReferenceChanged = isReferenceDiff || isNewReference

            
            // Update the reference
            if (isReferenceChanged) {
                const oldItem = this.structureItems.find(e => e.index == this.curReferenceIndex)
                if (oldItem && isReferenceDiff) {
                    // Change color and alpha for previous reference representation
                    const ref = oldItem.reprRef
                    const params = this.getProp()
                    const color = params.colorParams.value
                    const alpha = params.typeParams.alpha
                    await this.stage.updateRepresentationStyle(ref, color, alpha)
                }
                const newRef = this.structureItems.find(e => e.index == this.reference)
                if (isNewReference || !newRef) {
                    // build new reference representation
                    const refEntry = this.entries[this.reference]
                    const refPdbBundle = await this.buildEntryPdb(this.reference, refEntry)
                    await this.addStructureItem(this.reference, refPdbBundle, true)
                } else {
                    // Simply change color and alpha for previous regular representation
                    const reprRef = newRef.reprRef
                    const params = this.getProp(false, true)
                    const color = params.colorParams.value
                    const alpha = params.typeParams.alpha
                    await this.stage.updateRepresentationStyle(reprRef, color, alpha)
                    const structRef = newRef.structureRef
                    // initialize transform
                    await this.stage.updateTransformMatrix(structRef, tag=TRANSFORM_TAG)
                }
            }
            this.curReferenceIndex = this.reference
            
            const refEntry = this.entries[this.reference]
            const refPdbBundle = this.structureItems.find(e => e.index == this.reference)
            
            await Promise.all(
                add.map(async (idx) => {
                    const entry = this.entries[idx]
                    if (!entry) return
                    const entryPdbBundle = await this.buildEntryPdb(idx, entry)
                    const matrix = await this.getAlignedMatrix(refEntry, refPdbBundle.raw, entry, entryPdbBundle.raw)
                    await this.addStructureItem(idx, entryPdbBundle, false, matrix)
                })
            )
            
            {
                const update = this.stage.getUpdate()
                remove.map((idx) => {
                    const index = this.structureItems.findIndex(e => e.index == idx)
                    if (index == -1) return
                    
                    const structRef = this.structureItems[index].structureRef
                    const structure = structRef?.cell?.obj?.data
                    this.structureIndexByStructure.delete(structure)
                    this.structureItems.splice(index)
                    update.delete(structRef.ref)
                })
                await update.commit()
            }

            if (!isReferenceChanged) {
                return
            }

            await Promise.all(
                toUpdate.map(async (idx) => {
                    const item = this.structureItems.find(e => e.index == idx)
                    if (!item) return

                    const pdb = item.pdb
                    const matrix = await this.getAlignedMatrix(refEntry, refPdbBundle.raw, this.entries[idx], pdb.raw)
                    const structRef = item.structureRef
                    await this.stage.updateTransformMatrix(structRef, matrix, TRANSFORM_TAG)
                })
            )
            
            await this.renderOverlays(true, true, true)
            this.focusReference()
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
            this.stage.setBackground(this.bgColor);
        },
        selection: function(newV, oldV) {
            this.updateEntries(newV, oldV)
        },
        mask: function(newM, oldM) {
            if (oldM?.length == 0 || !newM.every((v, i) => v === oldM[i])) {
                this.renderOverlays(updateMask = true);
            }
        },
        selectedColumns: {
            deep: true,
            handler() {
                this.renderOverlays(updateHighlight = true);
            },
        },
        previewColumn: function() {
            this.renderOverlays(updatePreview = true);
        },
    },
    computed: {
        bgColor() {
            return this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
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
            let resNo = getResidueIndex(targetSeq, this.previewColumn) + 1
            const isMultimer = !targetObj.suffix ? false : true
            let chain = targetObj.chains[resNo]
            resNo = isMultimer ? resNo - targetObj.offsets[chain] : resNo
            chain = isMultimer ? chain + ':' : ""
            
            return '<span>'+ name + ':&nbsp;</span><strong>' 
                + chain
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
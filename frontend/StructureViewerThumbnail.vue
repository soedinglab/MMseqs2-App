<template>
<div>
    <div ref="offscreenContainer" class="offscreen-container">
        <div ref="viewport" class="offscreen-viewport" :style="{ width: thumbWidth + 'px', height: thumbHeight + 'px' }"></div>
    </div>
    <div ref="interactiveContainer"></div>
</div>
</template>

<script>
// import { Stage, Selection, ColormakerRegistry, concatStructures, download, } from 'ngl';
import { MolstarStage } from './lib/molstar-stage.js';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder.js';
import { makeMat4, toMolstarColor, buildChainExpression, getSelectionLoci, transformPdb,
    getChainName, getAccession, mockPDB, storeChains, revertChainInfo, isCg, mergePdbs, splitAlphaNum, 
    superposeWithAlignment} from './Utilities.js';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

const TRANSFORM_TAG = 'THUMBNAIL_TRANSFORM'

const processPdb = (rawpdb) => {
    let outpdb = '';
    let data = '';
    let ext = 'pdb';
    outpdb = rawpdb.trimStart();
    if (outpdb[0] == "#" || outpdb.startsWith("data_")) {
        ext = 'mmcif';
    } else {
        for (let line of outpdb.split('\n')) {
            let numCols = Math.max(0, 80 - line.length);
            let newLine = line + ' '.repeat(numCols) + '\n';
            data += newLine
        }
        outpdb = data;
    }
    return [outpdb, ext]
}

const getMotif = (motif) => {
    const motifList = new Set(motif.split(','));
    const motifSele = [];
    for (let m of motifList) {
        const chain = m[0];
        const resno = m.slice(1);
        motifSele.push(`${resno}:${chain}`);
    }

    return motifSele.join(" or ");
}

const buildMotifExpression = (motif) => {
    if (!motif || typeof motif !== 'string') {
        return MS.struct.generator.empty()
    }
    
    const byChain = new Map()
    motif.split(',').forEach(token => {
        const part = token.trim()
        if (!part) return
        const core = part.split(":")[0]
        const [chain, pos] = splitAlphaNum(core)
        const resno = Number.parseInt(pos, 10)
        if (!chain || !Number.isFinite(resno)) return
        const range = {
            start: resno,
            end: resno,
        }
        if (!byChain.has(chain)) byChain.set(chain, new Set())
        byChain.get(chain).add(range)
    })
    
    const exprs = []
    byChain.forEach((rangeSet, chain) => {
        exprs.push(buildChainExpression(chain, [...rangeSet]))
    })
    return exprs.length == 1
        ? exprs[0]
        : MS.struct.combinator.merge(exprs)
}

export default {
    name: "StructureViewerThumbnail",
    data() {
        return {
            stage: null,
            isRendering: false,
            currentQueueIndex: 0,
            activeId: null,
            cachedQueryStructureRef: null,
            cachedTargetStructureRefs: {},
            cachedQueryPdb: null,
            cachedTargetPdbs: {},
            activeComponentRefs: [],
            destroyed: false,
            isSpinning: false,
            queuePaused: false,
            activeTargetEl: null,
            pulchraFailed: false,
            renderingToken: 0,
        }
    },
    props: {
        thumbnailQueue: { type: Array, default: () => [] },
        activeAlignment: { type: Object, default: null },
        hits: { type: Object },
        thumbWidth: { type: Number, default: 286 },
        thumbHeight: { type: Number, default: 240 },
        mode: {type: Number, default: 0}, /* 0: Foldseek; 1: Foldseek Multimer; 2: Folddisco */
    },
    methods: {
        bgColor() {
            return this.$vuetify.theme.dark ? '#1E1E1E' : 'white';
        },

        async initStage() {
            this.stage = new MolstarStage(this.$refs.viewport, {
                backgroundColor: this.bgColor(),
            })
            await this.stage.init()
        },

        async getQueryPdb() {
            if (this.cachedQueryPdb !== null) return this.cachedQueryPdb;

            let queryPdb = "";
            if (this.$LOCAL) {
                if (this.hits.queries[0].hasOwnProperty('pdb')) {
                    queryPdb = JSON.parse(this.hits.queries[0].pdb);
                } else {
                    queryPdb = mockPDB(this.hits.queries[0].qCa, this.hits.queries[0].sequence, 'A');
                }
            } else if (this.$route.params.ticket.startsWith('user-')) {
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
                }
            }
            
            const trimmed = queryPdb.trimStart()
            const format = trimmed.startsWith('#') || trimmed.startsWith('data_') ? 'mmcif' : 'pdb';

            if (format == 'pdb' && isCg(trimmed)) {
                const chains = storeChains(queryPdb)               
                queryPdb = await pulchra(queryPdb)
                queryPdb = revertChainInfo(queryPdb, chains)
            }

            this.cachedQueryPdb = { data: queryPdb, format: format, label: 'query'};
            return this.cachedQueryPdb;
        },

        async buildTargetStructure(alignments, db) {
            if (this.cachedTargetStructureRefs[db]) {
                return this.cachedTargetStructureRefs[db]
            } else if (this.cachedTargetPdbs[db]) {
                this.cachedTargetStructureRefs[db] = 
                    await this.stage.loadStructure(this.cachedTargetPdbs[db])
                return this.cachedTargetStructureRefs[db]
            }

            if (this.mode < 2) {
                const targets = [];
                let renumber = 0;
                let lastIdx = null;
                let remoteData = null;
                let i = 0;

                const chains = []
                const pdbs = []
                for (let alignment of alignments) {
                    const chain = getChainName(alignment.target)
                    let tSeq = alignment.tSeq;
                    let tCa = alignment.tCa;

                    if (Number.isInteger(alignment.tCa) && Number.isInteger(alignment.tSeq)) {
                        const idx = alignment.tCa;
                        if (idx != lastIdx) {
                            const ticket = this.$route.params.ticket;
                            const entry = this.$route.params.entry;
                            const response = await this.$axios.get(
                                "api/result/" + ticket + '/' + entry + '?format=brief&index=' + idx + '&database=' + db
                            );
                            remoteData = response.data;
                            lastIdx = idx;
                        }
                        tSeq = remoteData[i].tSeq;
                        tCa = remoteData[i].tCa;
                        i++;
                    }

                    if (!tCa) return null;

                    const mock = mockPDB(tCa, tSeq, chain);
                    let pdb;
                    try {
                        pdb = await pulchra(mock);
                    } catch (e) {
                        pdb = mock;
                        this.pulchraFailed = true;
                    }
                    pdbs.push({ pdb, chain })
                }
                
                const merged = mergePdbs(pdbs)
                const mergedBundle = { data: merged, format: 'pdb', label: 'target' }
                this.cachedTargetPdbs[db] = mergedBundle
                try {
                    this.cachedTargetStructureRefs[db] =
                        await this.stage.loadStructure(mergedBundle)
                } catch (e) {
                    delete this.cachedTargetPdbs[db]
                    throw e
                }
                return this.cachedTargetStructureRefs[db]

            } else {
                let item = alignments[0]
                if (!item) {
                   return null
                }

                let target = item.dbkey
                if (db.startsWith('pdb')) {
                    target = item.target
                }

                const re = "api/result/folddisco/" + this.$route.params.ticket + '?database=' + db +'&id=' + target;
                const request = await this.$axios.get(re, {
                    headers: {
                        'Accept': 'text/plain',
                    },
                    transformResponse: [(d) => d],
                });
                let [ targetPdb, ext ] = processPdb(request.data)
                const targetBundle = { data: targetPdb, format: ext, label: 'target' }
                this.cachedTargetPdbs[db] = targetBundle
                try {
                    this.cachedTargetStructureRefs[db] =
                        await this.stage.loadStructure(targetBundle)
                } catch (e) {
                    delete this.cachedTargetPdbs[db]
                    throw e
                }
                return this.cachedTargetStructureRefs[db]
            }
        },

        async loadQueryStructure(queryPdb) {
            if (!this.stage || !queryPdb) return null;
            if (this.cachedQueryStructureRef) return this.cachedQueryStructureRef

            this.cachedQueryStructureRef = await this.stage.loadStructure(queryPdb)

            return this.cachedQueryStructureRef;
        },

        async superposeStructures(queryStrucRef, targetStructRef, alignments) {
            if (!queryStrucRef || !targetStructRef) return;

            let t, u, matrix;
            matrix = null
            if (alignments[0].hasOwnProperty("complexu") && alignments[0].hasOwnProperty("complext")) {
                t = alignments[0].complext.split(',').map(x => parseFloat(x));
                u = alignments[0].complexu.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];
            } else if (alignments[0].hasOwnProperty("tmat") && alignments[0].hasOwnProperty("umat")) {
                t = alignments[0].tmat.split(',').map(x => parseFloat(x));
                u = alignments[0].umat.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];
            } else {
                matrix = superposeWithAlignment(
                    queryStrucRef,
                    targetStructRef,
                    alignments
                )
            }
            matrix = matrix ? matrix : makeMat4(t, u)
            if (this.destroyed || !this.stage) return null

            await this.stage.updateTransformMatrix(targetStructRef, matrix, TRANSFORM_TAG)
        },

        async addRepresentations(queryStructRef, targetStructRef, alignments) {
            const token = this.renderingToken + 1
            this.renderingToken = token

            let expr_q = this.mode < 2
                ? alignments.map(
                    a => buildChainExpression(getChainName(a.query), 
                        [ {start: a.qStartPos, end: a.qEndPos} ]
                    )
                )
                : buildMotifExpression(alignments[0].queryresidues)
            let expr_t = this.mode < 2
                ? alignments.map(
                    a => buildChainExpression(getChainName(a.target),
                        [ {start: a.dbStartPos, end: a.dbEndPos} ]
                    )
                )
                : buildMotifExpression(alignments[0].targetresidues)
            expr_q = Array.isArray(expr_q) 
                ? expr_q.length > 1 
                ? MS.struct.combinator.merge(expr_q) 
                : expr_q[0]
                : expr_q
            expr_t = Array.isArray(expr_t) 
                ? expr_t.length > 1 
                ? MS.struct.combinator.merge(expr_t) 
                : expr_t[0]
                : expr_t
            if (this.destroyed || !this.stage) return null

            // // DIAGNOSTIC: check chain/range match for query
            // if (queryStructRef && this.mode < 2) {
            //     const a0 = alignments[0]
            //     const chainGuess = getChainName(a0.query)
            //     console.log('[thumb] query field:', a0.query,
            //         '→ chain guess:', chainGuess,
            //         '| range:', a0.qStartPos, '-', a0.qEndPos)

            //     // Try chain-only (no range) to isolate which dimension fails
            //     const chainOnlyExpr = buildChainExpression(chainGuess, [], true)
            //     const chainOnlyComp = await this.stage.createComponentFromExpression(
            //         queryStructRef, chainOnlyExpr, `diag_chain_${token}`)
            //     console.log('[thumb] chain-only hit:', chainOnlyComp ? 'YES' : 'NO (wrong chain ID)')
            //     if (chainOnlyComp) await this.stage.remove(chainOnlyComp)

            //     // Try all-atoms to verify structure ref is still live
            //     const allComp = await this.stage.createComponentStatic(queryStructRef, 'all')
            //     console.log('[thumb] all-atoms hit:', allComp ? 'YES' : 'NO (stale ref?)')
            //     if (allComp) await this.stage.remove(allComp)
            // }

            const queryComp = await this.stage.createComponentFromExpression
                (queryStructRef, expr_q, `aligned_query_${token}`)
            const targetComp = await this.stage.createComponentFromExpression
                (targetStructRef, expr_t, `aligned_target_${token}`)
            
            this.activeComponentRefs.push(queryComp, targetComp)

            if (this.renderingToken !== token) return

            const repr = this.mode < 2 
                ? ( this.pulchraFailed ? 'backbone' : 'cartoon' ) 
                : 'ball-and-stick'
            
            const surfaceRepr = this.mode == 1 && !this.pulchraFailed
                ? 'molecular-surface'
                : null
            
            const queryClr = toMolstarColor('#1E88E5', 0x1e88e5)
            const targetClr = toMolstarColor('#FFC107', 0xffc107)

            if (this.destroyed || !this.stage) return null
            
            debugger
            if (queryComp) {
                await this.stage.addRepresentation(
                    queryComp,
                    {
                        type: repr,
                        color: 'uniform',
                        colorParams: {value: queryClr}
                    },
                )
                if (surfaceRepr) {
                    await this.stage.addRepresentation(
                        queryComp,
                        {
                            type: surfaceRepr,
                            color: 'uniform',
                            colorParams: {value: queryClr},
                            typeParams: {alpha: 0.12},
                        },
                    )
                }
            }
            if (targetComp) {
                await this.stage.addRepresentation(
                    targetComp,
                    {
                        type: repr,
                        color: 'uniform',
                        colorParams: {value: targetClr}
                    },
                )
                if (surfaceRepr) {
                    await this.stage.addRepresentation(
                        targetComp,
                        {
                            type: surfaceRepr,
                            color: 'uniform',
                            colorParams: {value: targetClr},
                            typeParams: {alpha: 0.12},
                        },
                    )
                }
            }
            if (queryComp) {
                const qLoci = getSelectionLoci(expr_q, queryStructRef)
                this.stage.focusLoci(qLoci)
            } else {
                this.stage.focusLoci(null)
            }
        },

        async captureThumbnail(id) {
            if (this.destroyed || !this.stage) return;
            await this.stage.waitDraw()

            const canvas = document.getElementById(id+'-thumbnail-canvas');
            const molstarCanvas = this.stage.canvas
            let result = false
            if (canvas) {
                canvas.width = this.thumbWidth
                canvas.height = this.thumbHeight
                const ctx = canvas.getContext('2d')
                ctx.clearRect(0, 0, this.thumbWidth, this.thumbHeight)
                ctx.imageSmoothingQuality = 'high'
                ctx.imageSmoothingEnabled = true
                ctx.drawImage(molstarCanvas, 0, 0, this.thumbWidth, this.thumbHeight)
                result = true
            }

            this.$emit('thumbnail-ready', { id, result });
        },

        async clearStage() {
            const stage = this.stage
            if (!stage) return;
            this.pulchraFailed = false;
            const refs = this.activeComponentRefs.splice(0)
            for (const ref of refs) {
                await stage.remove(ref)
            }
        },

        async activateViewer(id, alignments, targetEl) {
            if (this.activeId === id) return;
            await this.clearStage();
            this.queuePaused = true;
            this.activeId = id;
            this.activeTargetEl = targetEl;

            // Move canvas into the card's viewer slot
            const viewportEl = this.$refs.viewport
            targetEl.appendChild(viewportEl);
            viewportEl.style.width = '100%';
            viewportEl.style.height = '100%';
            this.stage.handleResize();

            try {
                const queryPdb = await this.getQueryPdb();
                if (this.destroyed || !this.stage) return;

                let queryStructRef = null;
                if (queryPdb) {
                    queryStructRef = await this.loadQueryStructure(queryPdb);
                    if (this.destroyed || !this.stage) return;
                }

                const targetStructRef = await this.buildTargetStructure(alignments, id);
                if (this.destroyed || !this.stage || !targetStructRef) return;

                if (queryStructRef) {
                    await this.superposeStructures(queryStructRef, targetStructRef, alignments);
                    if (this.destroyed || !this.stage) return;
                }

                this.addRepresentations(queryStructRef, targetStructRef, alignments);

                this.isSpinning = true;
                this.stage.setSpin(true);
                this.stage.canvas.addEventListener('mousedown', this.handleMouseDown);
            } catch (e) {
                console.warn('Interactive viewer failed for', id, e);
            }

            this.$emit('viewer-ready');
        },

        async deactivateViewer() {
            if (this.activeId === null) return;
            await this.clearStage();
            this.stage.setSpin(false);
            this.isSpinning = false;
            this.stage.canvas.removeEventListener('mousedown', this.handleMouseDown);

            // Move canvas back to offscreen container
            const viewportEl = this.$refs.viewport
            this.$refs.offscreenContainer.appendChild(viewportEl);
            viewportEl.style.width = this.thumbWidth + 'px';
            viewportEl.style.height = this.thumbHeight + 'px';
            this.stage.handleResize();

            this.activeId = null;
            this.activeTargetEl = null;
            this.queuePaused = false;
            this.processQueue();
        },

        async switchViewer(id, alignments, newTargetEl) {
            await this.clearStage();
            this.stage.setSpin(false);
            this.isSpinning = false;
            this.stage.canvas.removeEventListener('mousedown', this.handleMouseDown);

            // Move canvas to new target
            const viewportEl = this.$refs.viewport;
            newTargetEl.appendChild(viewportEl);
            this.stage.handleResize();
            this.activeId = id;
            this.activeTargetEl = newTargetEl;

            try {
                const queryPdb = await this.getQueryPdb();
                if (this.destroyed || !this.stage) return;

                let queryStructRef = null;
                if (queryPdb) {
                    queryStructRef = await this.loadQueryStructure(queryPdb);
                    if (this.destroyed || !this.stage) return;
                }

                const targetStructRef = await this.buildTargetStructure(alignments, id);
                if (this.destroyed || !this.stage || !targetStructRef) return;

                if (queryStructRef) {
                    await this.superposeStructures(queryStructRef, targetStructRef, alignments);
                    if (this.destroyed || !this.stage) return;
                }

                this.addRepresentations(queryStructRef, targetStructRef, alignments);

                this.isSpinning = true;
                this.stage.setSpin(true);
                this.stage.canvas.addEventListener('mousedown', this.handleMouseDown);
            } catch (e) {
                console.warn('Switch viewer failed for', id, e);
            }

            this.$emit('viewer-ready');
        },

        handleMouseDown() {
            this.isSpinning = false;
            this.stage.setSpin(false);
        },

        handleToggleSpin() {
            if (!this.stage) return;
            this.isSpinning = !this.isSpinning;
            this.stage.setSpin(this.isSpinning);
        },

        handleResetView() {
            if (!this.stage) return;
            this.stage.focusLoci(null, 100);
        },

        async processQueue() {
            if (this.queuePaused 
                || this.isRendering 
                || this.thumbnailQueue.length === 0 
                || this.currentQueueIndex >= this.thumbnailQueue.length
            ) {
                return;
            }

            this.isRendering = true;
            const item = this.thumbnailQueue[this.currentQueueIndex];

            try {
                if (this.destroyed || !this.stage) return;

                // Skip items without tCa data
                if (!item.alignments 
                    || item.alignments.length === 0 
                    || typeof item.alignments[0].tCa === 'undefined'
                ) {
                    this.currentQueueIndex++;
                    this.isRendering = false;
                    this.$nextTick(() => this.processQueue());
                    return;
                }

                const queryPdb = await this.getQueryPdb();
                if (this.destroyed || !this.stage) return;

                const hasQuery = !!queryPdb;
                let queryStructRef = null;
                if (hasQuery) {
                    queryStructRef = await this.loadQueryStructure(queryPdb);
                    if (this.destroyed || !this.stage) return;
                }

                const targetStructRef = await this.buildTargetStructure(item.alignments, item.db);
                if (this.destroyed || !this.stage || !targetStructRef) {
                    await this.clearStage();
                    this.currentQueueIndex++;
                    this.isRendering = false;
                    this.$nextTick(() => this.processQueue());
                    return;
                }

                if (queryStructRef) {
                    await this.superposeStructures(queryStructRef, targetStructRef, item.alignments);
                    if (this.destroyed || !this.stage) return;
                }

                await this.addRepresentations(queryStructRef, targetStructRef, item.alignments);

                await this.captureThumbnail(item.id);
                await this.clearStage();
            } catch (e) {
                console.warn('Thumbnail generation failed for', item.id, e);
                await this.clearStage();
            }

            this.currentQueueIndex++;
            this.isRendering = false;

            if (!this.destroyed) {
                this.$nextTick(() => this.processQueue());
            }
        },
    },
    watch: {
        thumbnailQueue: {
            handler(newQueue, oldQueue) {
                if (!oldQueue || newQueue.length > oldQueue.length) {
                    this.processQueue();
                }
            },
            deep: true,
        },
    },
    async mounted() {
        await this.initStage();
        this.processQueue();
    },
    beforeDestroy() {
        this.destroyed = true;
        if (this.stage) {
            this.stage.dispose();
            this.stage = null;
        }
    },
}
</script>

<style>
.offscreen-container {
    position: absolute;
    left: -9999px;
    top: -9999px;
    overflow: hidden;
    pointer-events: none;
}

.offscreen-viewport {
    overflow: hidden;
}
</style>

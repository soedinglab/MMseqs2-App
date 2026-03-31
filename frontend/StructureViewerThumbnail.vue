<template>
<div>
    <div ref="offscreenContainer" class="offscreen-container">
        <div ref="viewport" class="offscreen-viewport" :style="{ width: thumbWidth + 'px', height: thumbHeight + 'px' }"></div>
    </div>
    <div ref="interactiveContainer"></div>
</div>
</template>

<script>
import { Stage, Selection, ColormakerRegistry, concatStructures, download, } from 'ngl';
import { mockPDB, makeSubPDB, transformStructure, storeChains, revertChainInfo, wrapLog, recoverLog } from './Utilities.js';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

const getChainName = (name) => {
    if (/_v[0-9]+$/.test(name)) return 'A';
    let pos = name.lastIndexOf('_');
    if (pos != -1) {
        let match = name.substring(pos + 1);
        return match.length >= 1 ? match[0] : 'A';
    }
    return 'A';
};

const getAccession = (name) => {
    if (/_v[0-9]+$/.test(name)) return name;
    let pos = name.lastIndexOf('_');
    return pos != -1 ? name.substring(0, pos) : name;
};

const processPdb = (rawpdb) => {
    let outpdb = '';
    let data = '';
    let ext = 'pdb';
    outpdb = rawpdb.trimStart();
    if (outpdb[0] == "#" || outpdb.startsWith("data_")) {
        ext = 'cif';
        // NGL doesn't like AF3's _chem_comp entries
        outpdb = outpdb.replaceAll("_chem_comp.", "_chem_comp_SKIP_HACK.");
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

export default {
    name: "StructureViewerThumbnail",
    data() {
        return {
            stage: null,
            isRendering: false,
            currentQueueIndex: 0,
            activeId: null,
            cachedQueryPdb: null,
            destroyed: false,
            schemeCounter: 0,
            isSpinning: false,
            queuePaused: false,
            activeTargetEl: null,
            pulchraFailed: false,
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

        initStage() {
            this.stage = new Stage(this.$refs.viewport, {
                log: false,
                backgroundColor: this.bgColor(),
                transparent: true,
                quality: 'low',
                sampleLevel: 3,
                clipNear: -1000,
                clipFar: 1000,
                fogFar: 1000,
                fogNear: -1000,
                tooltip: false,
            });
            this.stage.setSize(this.thumbWidth, this.thumbHeight);
            this.stage.handleResize()

            // To ignore "STAGE LOG ..." things.
            wrapLog()
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

            this.cachedQueryPdb = queryPdb;
            return queryPdb;
        },

        async buildTargetStructure(alignments, db) {
            if (this.mode < 2) {
                const targets = [];
                let renumber = 0;
                let lastIdx = null;
                let remoteData = null;
                let i = 0;

                for (let alignment of alignments) {
                    const chain = getChainName(alignment.target);
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
                    if (this.destroyed || !this.stage) return null;

                    const component = await this.stage.loadFile(
                        new Blob([pdb], { type: 'text/plain' }),
                        { ext: 'pdb', firstModelOnly: true }
                    );
                    component.structure.eachChain(c => { c.chainname = chain; });
                    component.structure.eachAtom(a => { a.serial = renumber++; });
                    targets.push(component);
                }

                if (targets.length === 0) return null;

                const structure = concatStructures(
                    getAccession(alignments[0].target),
                    ...targets.map(t => t.structure)
                );
                return this.stage.addComponentFromObject(structure);
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
                return await this.stage.loadFile(new Blob([targetPdb], {type: 'text/plain'}), { ext: ext, firstModelOnly: true, name: 'targetStructure'})
            }
        },

        async loadQueryStructure(rawQueryPdb) {
            if (!rawQueryPdb) return null;

            let [ queryPdb, ext ] = processPdb(rawQueryPdb)

            let query = await this.stage.loadFile(
                new Blob([queryPdb], { type: 'text/plain' }),
                { ext: ext, firstModelOnly: true }
            );
            if (this.destroyed || !this.stage) return null;

            if (query && query.structure.getAtomProxy().isCg()) {
                try {
                    let pdbText = queryPdb;
                    if (ext == "cif") {
                        const { PdbWriter } = await import('ngl');
                        let pw = new PdbWriter(query.structure, { renumberSerial: false });
                        pdbText = pw.getData().split('\n').filter(line => line.startsWith('ATOM')).join('\n');
                    }
                    const chains = storeChains(pdbText);
                    let pulchraResult = await pulchra(pdbText);
                    pulchraResult = revertChainInfo(pulchraResult, chains);
                    if (this.destroyed || !this.stage) return null;
                    this.stage.removeComponent(query);
                    query = await this.stage.loadFile(
                        new Blob([pulchraResult], { type: 'text/plain' }),
                        { ext: 'pdb', firstModelOnly: true }
                    );
                } catch (e) {
                    // Keep original CA-only query
                }
            }

            return query;
        },

        async superposeStructures(queryComp, targetComp, alignments) {
            if (!queryComp || !targetComp) return;

            if (alignments[0].hasOwnProperty("complexu") && alignments[0].hasOwnProperty("complext")) {
                const t = alignments[0].complext.split(',').map(x => parseFloat(x));
                let u = alignments[0].complexu.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];
                transformStructure(targetComp.structure, t, u);
            } else if (alignments[0].hasOwnProperty("tmat") && alignments[0].hasOwnProperty("umat")) {
                const t = alignments[0].tmat.split(',').map(x => parseFloat(x));
                let u = alignments[0].umat.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];
                transformStructure(targetComp.structure, t, u);
            } else {
                const querySele = alignments.map(
                    a => `${a.qStartPos}-${a.qEndPos}:${getChainName(a.query)}`
                ).join(" or ");
                const targetSele = alignments.map(
                    a => `${a.dbStartPos}-${a.dbEndPos}:${getChainName(a.target)}`
                ).join(" or ");

                let qSubPdb = makeSubPDB(queryComp.structure, querySele);
                let tSubPdb = makeSubPDB(targetComp.structure, targetSele);
                let alnFasta = `>target\n${alignments[0].dbAln}\n\n>query\n${alignments[0].qAln}`;

                const tm = await tmalign(tSubPdb, qSubPdb, alnFasta);
                if (this.destroyed || !this.stage) return;
                let { t, u } = parseTMMatrix(tm.matrix);
                transformStructure(targetComp.structure, t, u);
            }
        },

        addRepresentations(queryComp, targetComp, alignments) {
            const id = this.schemeCounter++;

            let selections_q = this.mode < 2 
                ? alignments.map(
                    a => `${a.qStartPos}-${a.qEndPos}:${getChainName(a.query)}`
                ).join(" or ")
                : getMotif(alignments[0].queryresidues)
            let selections_t = this.mode < 2
                ? alignments.map(
                    a => `${a.dbStartPos}-${a.dbEndPos}:${getChainName(a.target)}`
                ).join(" or ")
                : getMotif(alignments[0].targetresidues)

            const qSchemeName = `_thumbQuery_${id}`;
            const tSchemeName = `_thumbTarget_${id}`;

            if (ColormakerRegistry.hasScheme(qSchemeName)) {
                ColormakerRegistry.removeScheme(qSchemeName);
            }
            if (ColormakerRegistry.hasScheme(tSchemeName)) {
                ColormakerRegistry.removeScheme(tSchemeName);
            }

            const querySchemeId = ColormakerRegistry.addSelectionScheme([
                ["#1E88E5", selections_q],
                ["#A5CFF5", "*"],
            ], qSchemeName);

            const targetSchemeId = ColormakerRegistry.addSelectionScheme([
                ["#FFC107", selections_t],
                ["#FFE699", "*"],
            ], tSchemeName);

            const repr = this.mode < 2 
                ? ( this.pulchraFailed ? 'backbone' : 'cartoon' ) 
                : 'licorice'

            if (queryComp) {
                queryComp.addRepresentation(repr, {
                    sele: this.mode < 2 ? "" : selections_q,
                    color: querySchemeId,
                    smoothSheet: true,
                });
                queryComp.autoView(selections_q, 0);
            }

            targetComp.addRepresentation(repr, {
                sele: this.mode < 2 ? "" : selections_t,
                color: targetSchemeId,
                smoothSheet: true,
            });
        },

        async captureThumbnail(id) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (this.destroyed || !this.stage) return;

            const canvas = document.getElementById(id+'-thumbnail-canvas');
            const nglCanvas = this.$refs.viewport.querySelector('canvas')
            let result = false
            if (canvas) {

                canvas.width = this.thumbWidth
                canvas.height = this.thumbHeight
                const ctx = canvas.getContext('2d')
                ctx.clearRect(0, 0, this.thumbWidth, this.thumbHeight)
                ctx.imageSmoothingQuality = 'high'
                ctx.imageSmoothingEnabled = true
                ctx.drawImage(nglCanvas, 0, 0, this.thumbWidth, this.thumbHeight)
                result = true

            }

            this.$emit('thumbnail-ready', { id, result });
        },

        clearStage() {
            if (!this.stage) return;
            this.stage.removeAllComponents();
            this.pulchraFailed = false;
        },

        async activateViewer(id, alignments, targetEl) {
            if (this.activeId === id) return;
            this.clearStage();
            this.queuePaused = true;
            this.activeId = id;
            this.activeTargetEl = targetEl;

            // Move canvas into the card's viewer slot
            const viewportEl = this.$refs.viewport;
            targetEl.appendChild(viewportEl);
            this.stage.setParameters({ quality: 'high', backgroundColor: this.bgColor() });
            viewportEl.style.width = '100%';
            viewportEl.style.height = '100%';
            this.stage.handleResize();

            try {
                const queryPdb = await this.getQueryPdb();
                if (this.destroyed || !this.stage) return;

                let queryComp = null;
                if (queryPdb) {
                    queryComp = await this.loadQueryStructure(queryPdb);
                    if (this.destroyed || !this.stage) return;
                }

                const targetComp = await this.buildTargetStructure(alignments, id);
                if (this.destroyed || !this.stage || !targetComp) return;

                if (queryComp) {
                    await this.superposeStructures(queryComp, targetComp, alignments);
                    if (this.destroyed || !this.stage) return;
                }

                this.addRepresentations(queryComp, targetComp, alignments);

                if (queryComp) {
                    const querySele = this.mode < 2 
                        ? alignments.map(
                            a => `${a.qStartPos}-${a.qEndPos}:${getChainName(a.query)}`
                        ).join(" or ") 
                        : getMotif(alignments[0].queryresidues)
                    queryComp.autoView(querySele, 0);
                } else {
                    this.stage.autoView(0);
                }

                this.isSpinning = true;
                this.stage.setSpin(true);
                this.stage.viewer.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
            } catch (e) {
                console.warn('Interactive viewer failed for', id, e);
            }

            this.$emit('viewer-ready');
        },

        deactivateViewer() {
            if (this.activeId === null) return;
            this.clearStage();
            this.stage.setSpin(false);
            this.isSpinning = false;
            this.stage.viewer.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);

            // Move canvas back to offscreen container
            const viewportEl = this.$refs.viewport;
            this.$refs.offscreenContainer.appendChild(viewportEl);
            viewportEl.style.width = this.thumbWidth + 'px';
            viewportEl.style.height = this.thumbHeight + 'px';
            this.stage.setParameters({ quality: 'low', backgroundColor: this.bgColor() });
            this.stage.handleResize();

            this.activeId = null;
            this.activeTargetEl = null;
            this.queuePaused = false;
            this.processQueue();
        },

        async switchViewer(id, alignments, newTargetEl) {
            this.clearStage();
            this.stage.setSpin(false);
            this.isSpinning = false;
            this.stage.viewer.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);

            // Move canvas to new target
            const viewportEl = this.$refs.viewport;
            newTargetEl.appendChild(viewportEl);
            this.stage.handleResize();
            this.activeId = id;
            this.activeTargetEl = newTargetEl;

            try {
                const queryPdb = await this.getQueryPdb();
                if (this.destroyed || !this.stage) return;

                let queryComp = null;
                if (queryPdb) {
                    queryComp = await this.loadQueryStructure(queryPdb);
                    if (this.destroyed || !this.stage) return;
                }

                const targetComp = await this.buildTargetStructure(alignments, id);
                if (this.destroyed || !this.stage || !targetComp) return;

                if (queryComp) {
                    await this.superposeStructures(queryComp, targetComp, alignments);
                    if (this.destroyed || !this.stage) return;
                }

                this.addRepresentations(queryComp, targetComp, alignments);

                if (queryComp) {
                    const querySele = this.mode < 2 
                        ? alignments.map(
                            a => `${a.qStartPos}-${a.qEndPos}:${getChainName(a.query)}`
                        ).join(" or ") 
                        : getMotif(alignments[0].queryresidues)
                    queryComp.autoView(querySele, 0);
                } else {
                    this.stage.autoView(0);
                }

                this.isSpinning = true;
                this.stage.setSpin(true);
                this.stage.viewer.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
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
            this.stage.autoView(100);
        },

        async processQueue() {
            if (this.queuePaused || this.isRendering || this.thumbnailQueue.length === 0 || this.currentQueueIndex >= this.thumbnailQueue.length) {
                return;
            }

            this.isRendering = true;
            const item = this.thumbnailQueue[this.currentQueueIndex];

            try {
                if (this.destroyed || !this.stage) return;

                // Skip items without tCa data
                if (!item.alignments || item.alignments.length === 0 || typeof item.alignments[0].tCa === 'undefined') {
                    this.currentQueueIndex++;
                    this.isRendering = false;
                    this.$nextTick(() => this.processQueue());
                    return;
                }

                const queryPdb = await this.getQueryPdb();
                if (this.destroyed || !this.stage) return;

                const hasQuery = !!queryPdb;
                let queryComp = null;
                if (hasQuery) {
                    queryComp = await this.loadQueryStructure(queryPdb);
                    if (this.destroyed || !this.stage) return;
                }

                const targetComp = await this.buildTargetStructure(item.alignments, item.db);
                if (this.destroyed || !this.stage || !targetComp) {
                    this.clearStage();
                    this.currentQueueIndex++;
                    this.isRendering = false;
                    this.$nextTick(() => this.processQueue());
                    return;
                }

                if (queryComp) {
                    await this.superposeStructures(queryComp, targetComp, item.alignments);
                    if (this.destroyed || !this.stage) return;
                }

                this.addRepresentations(queryComp, targetComp, item.alignments);

                if (queryComp) {
                    const querySele = this.mode < 2 
                        ? item.alignments.map(
                            a => `${a.qStartPos}-${a.qEndPos}:${getChainName(a.query)}`
                        ).join(" or ")
                        : getMotif(item.alignments[0].queryresidues)
                    queryComp.autoView(querySele, 0);
                } else {
                    this.stage.autoView(0);
                }

                await this.captureThumbnail(item.id);
                this.clearStage();
            } catch (e) {
                console.warn('Thumbnail generation failed for', item.id, e);
                this.clearStage();
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
    mounted() {
        this.initStage();
        this.processQueue();
    },
    beforeDestroy() {
        this.destroyed = true;
        if (this.stage) {
            this.stage.dispose();
            this.stage = null;
        }
        recoverLog()
    },
}
</script>

<style scoped>
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

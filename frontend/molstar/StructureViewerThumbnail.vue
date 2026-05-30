<template>
<div>
    <div ref="offscreenContainer" class="offscreen-container">
        <div ref="viewport" class="thumbnail-viewport" :style="viewportStyle">
            <canvas ref="canvas" class="thumbnail-canvas" aria-hidden="true"></canvas>
        </div>
    </div>
</div>
</template>

<script>
import { Color } from 'molstar/lib/mol-util/color';
import { Task } from 'molstar/lib/mol-task';
import { canvasToBlob } from 'molstar/lib/mol-canvas3d/util';
import { foldseekResult } from './foldseekResult.js';
import { folddiscoResult } from './folddiscoResult.js';
import { prepareFoldseekStructureInput } from './foldseekData.js';
import { applyViewerCanvasProps, createMolstarPlugin, setCanvasSpin } from './viewerHelpers.js';

export default {
    name: "StructureViewerThumbnail",
    data() {
        return {
            plugin: null,
            sceneState: {},
            isRendering: false,
            currentQueueIndex: 0,
            activeId: null,
            destroyed: false,
            isSpinning: false,
            queuePaused: false,
            queueScheduled: false,
            activeTargetEl: null,
            operationQueue: Promise.resolve(),
        };
    },
    props: {
        thumbnailQueue: { type: Array, default: () => [] },
        activeAlignment: { type: Object, default: null },
        hits: { type: Object },
        thumbWidth: { type: Number, default: 286 },
        thumbHeight: { type: Number, default: 240 },
        mode: { type: Number, default: 0 },
        searchType: { type: String, default: "" },
        queryPdb: { type: String, default: "" },
    },
    computed: {
        viewportStyle() {
            return {
                width: `${this.thumbWidth}px`,
                height: `${this.thumbHeight}px`,
            };
        },
        structureMode() {
            if (this.searchType === 'interfacesearch') return 'interface';
            if (this.mode === 1) return 'multimer';
            return 'alignment';
        },
    },
    methods: {
        bgColor() {
            return this.$vuetify.theme.dark ? '#1E1E1E' : 'white';
        },

        async initPlugin() {
            this.plugin = createMolstarPlugin();
            await this.plugin.init();
            await this.$nextTick();

            const ok = await this.plugin.initViewerAsync(this.$refs.canvas, this.$refs.viewport);
            if (ok === false) {
                throw new Error('Mol* thumbnail viewer initialization failed');
            }

            applyViewerCanvasProps(this.plugin, {
                renderer: {
                    backgroundColor: Color(this.$vuetify.theme.dark ? 0x1e1e1e : 0xffffff),
                },
            });
            this.resizeTo(this.thumbWidth, this.thumbHeight);
        },

        resizeTo(width, height) {
            const viewport = this.$refs.viewport;
            const canvas = this.$refs.canvas;
            if (!viewport || !canvas) return;
            viewport.style.width = typeof width === 'number' ? `${width}px` : width;
            viewport.style.height = typeof height === 'number' ? `${height}px` : height;
            if (typeof width === 'number') canvas.width = Math.max(1, Math.floor(width));
            if (typeof height === 'number') canvas.height = Math.max(1, Math.floor(height));
            this.plugin?.canvas3d?.handleResize();
        },

        alignmentsForItem(item) {
            return (item.alignments || []).map(alignment => ({
                ...alignment,
                db: alignment.db || item.db,
            }));
        },

        async prepareInput(item) {
            if (this.mode === 2) {
                return this.prepareFolddiscoInput(item);
            }
            const alignments = this.alignmentsForItem(item);
            return prepareFoldseekStructureInput({
                alignments,
                hits: this.hits,
                axios: this.$axios,
                route: this.$route,
                root: this.$root,
                isLocal: this.$LOCAL,
                structureMode: this.structureMode,
                interfaceCutoff: 10,
            });
        },

        async prepareFolddiscoInput(item) {
            const alignment = this.alignmentsForItem(item)[0];
            if (!alignment || !this.queryPdb) return null;
            const targetPdb = await this.fetchFolddiscoTargetPdb(alignment, item.db);
            if (!targetPdb) return null;
            return {
                alignment,
                queryPdb: this.queryPdb,
                targetPdb,
                showQuery: 0,
                showTarget: 0,
            };
        },

        async fetchFolddiscoTargetPdb(alignment, db) {
            const target = db?.startsWith('pdb') ? alignment.target : alignment.dbkey;
            if (!target) return null;
            const url = `api/result/folddisco/${this.$route.params.ticket}?database=${db}&id=${target}`;
            const response = await this.$axios.get(url, {
                transformResponse: [(data) => data],
            });
            return response.data;
        },

        sceneInput(input) {
            return {
                ...input,
                showQuery: this.mode === 2 ? input.showQuery : 1,
                showTarget: this.mode === 2 ? input.showTarget : 1,
                showArrows: false,
                queryAlpha: 0.9,
                targetAlpha: 0.7,
                highlightSelections: [],
                hoverSelection: null,
                focusSelection: null,
            };
        },

        async renderItem(item) {
            if (!item?.alignments?.length || !this.plugin) return false;
            await this.plugin.clear();
            this.sceneState = {};

            const input = await this.prepareInput(item);
            if (!input || (!input.query && !input.target && (!input.queryPdb || !input.targetPdb))) return false;

            const scene = this.mode === 2 ? folddiscoResult : foldseekResult;
            await scene.update(this.plugin, this.sceneState, this.sceneInput(input));
            this.resetCamera();
            await this.drawFrame();
            return true;
        },

        async captureThumbnail() {
            if (!this.plugin?.helpers?.viewportScreenshot) return null;
            await this.drawFrame();

            const screenshot = this.plugin.helpers.viewportScreenshot;
            const previousValues = screenshot.values;
            const previousCropParams = screenshot.cropParams;

            screenshot.behaviors.values.next({
                ...previousValues,
                transparent: true,
                format: { name: 'png', params: {} },
                resolution: {
                    name: 'custom',
                    params: {
                        width: this.thumbWidth * 2,
                        height: this.thumbHeight * 2,
                    },
                },
                axes: { name: 'off', params: {} },
            });
            screenshot.behaviors.cropParams.next({
                auto: false,
                relativePadding: 0,
            });
            screenshot.resetCrop();

            try {
                return await this.plugin.runTask(Task.create('Generate Thumbnail', async (ctx) => {
                    await screenshot.draw(ctx);
                    return canvasToBlob(screenshot.canvas, 'image/png');
                }));
            } finally {
                screenshot.behaviors.values.next(previousValues);
                screenshot.behaviors.cropParams.next(previousCropParams);
                screenshot.resetCrop();
            }
        },

        resetCamera() {
            this.plugin?.canvas3d?.requestCameraReset({ durationMs: 0 });
            this.plugin?.canvas3d?.commit(true);
        },

        async drawFrame() {
            this.plugin?.canvas3d?.commit(true);
            await new Promise(resolve => requestAnimationFrame(resolve));
            this.plugin?.canvas3d?.commit(true);
            await new Promise(resolve => requestAnimationFrame(resolve));
        },

        async clearPlugin() {
            if (!this.plugin) return;
            await this.plugin.clear();
            this.sceneState = {};
        },

        canProcessQueue() {
            return !this.destroyed
                && !this.queuePaused
                && !document.hidden
                && (this.mode !== 2 || Boolean(this.queryPdb));
        },

        scheduleProcessQueue() {
            if (this.queueScheduled || this.destroyed) return;
            this.queueScheduled = true;

            const schedule = window.requestIdleCallback || ((callback) => setTimeout(callback, 250));
            schedule(() => {
                this.queueScheduled = false;
                this.processQueue();
            }, { timeout: 2000 });
        },

        handlePageActivityChange() {
            if (this.canProcessQueue()) {
                this.scheduleProcessQueue();
            }
        },

        async activateViewer(id, alignments, targetEl) {
            if (this.activeId === id || !this.plugin) return;
            this.operationQueue = this.operationQueue
                .catch(() => {})
                .then(() => this.mountActiveViewer(id, alignments, targetEl, 'Interactive Mol* viewer failed for'));
            await this.operationQueue;
        },

        async switchViewer(id, alignments, newTargetEl) {
            if (!this.plugin) return;
            this.operationQueue = this.operationQueue
                .catch(() => {})
                .then(async () => {
                    this.setSpin(false);
                    this.isSpinning = false;
                    this.$refs.canvas.removeEventListener('pointerdown', this.handlePointerInteraction);
                    await this.mountActiveViewer(id, alignments, newTargetEl, 'Switch Mol* viewer failed for');
                });
            await this.operationQueue;
        },

        async mountActiveViewer(id, alignments, targetEl, errorPrefix) {
            if (!this.plugin || this.destroyed) return;
            this.queuePaused = true;
            this.activeId = id;
            this.activeTargetEl = targetEl;
            targetEl.appendChild(this.$refs.viewport);
            this.resizeTo('100%', '100%');

            try {
                const rendered = await this.renderItem({ id, db: id, alignments });
                if (!rendered || this.destroyed || !this.plugin) {
                    await this.restoreOffscreenViewer(id);
                    return;
                }
                this.setActiveSpin(true);
                this.$refs.canvas.addEventListener('pointerdown', this.handlePointerInteraction, { passive: true });
                this.$emit('viewer-ready');
            } catch (e) {
                console.warn(errorPrefix, id, e);
                await this.restoreOffscreenViewer(id);
            }
        },

        async restoreOffscreenViewer(id) {
            if (this.activeId !== id) return;
            this.setSpin(false);
            this.isSpinning = false;
            this.$refs.canvas.removeEventListener('pointerdown', this.handlePointerInteraction);
            await this.clearPlugin();
            this.$refs.offscreenContainer.appendChild(this.$refs.viewport);
            this.resizeTo(this.thumbWidth, this.thumbHeight);
            this.activeId = null;
            this.activeTargetEl = null;
            this.queuePaused = false;
            this.$emit('spin-change', false);
            this.scheduleProcessQueue();
        },

        deactivateViewer() {
            if (this.activeId === null || !this.plugin) return;
            this.operationQueue = this.operationQueue
                .catch(() => {})
                .then(() => this.deactivateViewerAsync());
        },

        async deactivateViewerAsync() {
            this.setSpin(false);
            this.isSpinning = false;
            this.$refs.canvas.removeEventListener('pointerdown', this.handlePointerInteraction);
            await this.clearPlugin();

            this.$refs.offscreenContainer.appendChild(this.$refs.viewport);
            this.resizeTo(this.thumbWidth, this.thumbHeight);

            this.activeId = null;
            this.activeTargetEl = null;
            this.queuePaused = false;
            this.scheduleProcessQueue();
        },

        handlePointerInteraction() {
            if (this.isSpinning) {
                this.setActiveSpin(false);
            }
        },

        setActiveSpin(enabled) {
            this.isSpinning = enabled;
            this.setSpin(enabled);
            this.$emit('spin-change', enabled);
        },

        setSpin(enabled) {
            setCanvasSpin(this.plugin, enabled);
        },

        handleToggleSpin() {
            if (!this.plugin) return;
            this.setActiveSpin(!this.isSpinning);
        },

        handleResetView() {
            this.plugin?.managers?.camera?.reset();
        },

        async processQueue() {
            if (!this.canProcessQueue() || this.isRendering || this.thumbnailQueue.length === 0 || this.currentQueueIndex >= this.thumbnailQueue.length) {
                return;
            }

            this.operationQueue = this.operationQueue
                .catch(() => {})
                .then(() => this.processQueueItem());
            await this.operationQueue;
        },

        async processQueueItem() {
            if (!this.canProcessQueue() || this.isRendering || this.thumbnailQueue.length === 0 || this.currentQueueIndex >= this.thumbnailQueue.length) {
                return;
            }

            this.isRendering = true;
            const item = this.thumbnailQueue[this.currentQueueIndex];

            try {
                const rendered = await this.renderItem(item);
                if (!this.canProcessQueue()) {
                    await this.clearPlugin();
                    this.isRendering = false;
                    return;
                }
                if (rendered) {
                    const blob = await this.captureThumbnail();
                    this.$emit('thumbnail-ready', { id: item.id, blob });
                }
                await this.clearPlugin();
            } catch (e) {
                console.warn('Mol* thumbnail generation failed for', item.id, e);
                await this.clearPlugin();
            }

            this.currentQueueIndex++;
            this.isRendering = false;

            if (!this.destroyed) {
                this.$nextTick(() => this.scheduleProcessQueue());
            }
        },
    },
    watch: {
        thumbnailQueue: {
            handler(newQueue, oldQueue) {
                if (!oldQueue || newQueue.length > oldQueue.length) {
                    this.scheduleProcessQueue();
                }
            },
            deep: true,
        },
        queryPdb() {
            if (this.mode === 2) {
                this.scheduleProcessQueue();
            }
        },
    },
    async mounted() {
        await this.initPlugin();
        document.addEventListener('visibilitychange', this.handlePageActivityChange);
        window.addEventListener('focus', this.handlePageActivityChange);
        window.addEventListener('blur', this.handlePageActivityChange);
        this.scheduleProcessQueue();
    },
    async beforeDestroy() {
        this.destroyed = true;
        document.removeEventListener('visibilitychange', this.handlePageActivityChange);
        window.removeEventListener('focus', this.handlePageActivityChange);
        window.removeEventListener('blur', this.handlePageActivityChange);
        this.$refs.canvas?.removeEventListener('pointerdown', this.handlePointerInteraction);
        try {
            await this.operationQueue;
            await this.clearPlugin();
        } catch (e) {
            // Teardown should continue if an in-flight thumbnail render failed.
        }
        const plugin = this.plugin;
        this.plugin = null;
        plugin?.dispose?.({ doNotForceWebGLContextLoss: true });
    },
};
</script>

<style scoped>
.offscreen-container {
    position: absolute;
    left: -9999px;
    top: -9999px;
    overflow: hidden;
    pointer-events: none;
}

.thumbnail-viewport {
    position: relative;
    overflow: hidden;
    line-height: 0;
}

.thumbnail-canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
}
</style>

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
import { foldseekResult } from './foldseekResult.js';
import { folddiscoResult } from './folddiscoResult.js';
import { createStructurePlugin, setCanvasSpin } from './plugin.js';
import { prepareThumbnailInput, thumbnailSceneInput } from './thumbnailInput.js';
import { captureThumbnailPng, renderThumbnailScene, resetThumbnailCamera } from './thumbnailRenderer.js';

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
            operationQueue: Promise.resolve(),
        };
    },
    props: {
        thumbnailQueue: { type: Array, default: () => [] },
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
        async initPlugin() {
            await this.$nextTick();

            this.plugin = await createStructurePlugin(this.$refs.canvas, this.$refs.viewport, {
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

        async prepareInput(item) {
            return prepareThumbnailInput({
                mode: this.mode,
                structureMode: this.structureMode,
                queryPdb: this.queryPdb,
                hits: this.hits,
                axios: this.$axios,
                route: this.$route,
                root: this.$root,
                isLocal: this.$LOCAL,
            }, item);
        },

        async renderItem(item) {
            if (!item?.alignments?.length || !this.plugin) return false;
            await this.plugin.clear();
            this.sceneState = {};

            const input = await this.prepareInput(item);
            if (!input || (!input.query && !input.target && (!input.queryPdb || !input.targetPdb))) return false;

            const scene = this.mode === 2 ? folddiscoResult : foldseekResult;
            await renderThumbnailScene(this.plugin, scene, this.sceneState, thumbnailSceneInput(input, this.mode));
            return true;
        },

        async captureThumbnail() {
            return captureThumbnailPng(this.plugin, this.thumbWidth, this.thumbHeight);
        },

        resetCamera() {
            resetThumbnailCamera(this.plugin);
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
            this.enqueueOperation(() => this.mountActiveViewer(id, alignments, targetEl, 'Interactive Mol* viewer failed for'));
            await this.operationQueue;
        },

        async switchViewer(id, alignments, newTargetEl) {
            if (!this.plugin) return;
            this.enqueueOperation(async () => {
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
            this.queuePaused = false;
            this.$emit('spin-change', false);
            this.scheduleProcessQueue();
        },

        deactivateViewer() {
            if (this.activeId === null || !this.plugin) return;
            this.enqueueOperation(() => this.deactivateViewerAsync());
        },

        async deactivateViewerAsync() {
            this.setSpin(false);
            this.isSpinning = false;
            this.$refs.canvas.removeEventListener('pointerdown', this.handlePointerInteraction);
            await this.clearPlugin();

            this.$refs.offscreenContainer.appendChild(this.$refs.viewport);
            this.resizeTo(this.thumbWidth, this.thumbHeight);

            this.activeId = null;
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

            this.enqueueOperation(() => this.processQueueItem());
            await this.operationQueue;
        },

        enqueueOperation(operation) {
            this.operationQueue = this.operationQueue
                .catch(() => {})
                .then(operation);
            return this.operationQueue;
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
                if (newQueue !== oldQueue) {
                    this.currentQueueIndex = 0;
                }
                if (!oldQueue || newQueue !== oldQueue || newQueue.length > oldQueue.length) {
                    this.scheduleProcessQueue();
                }
            },
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

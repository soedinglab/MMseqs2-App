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
import { prepareFoldseekStructureInput } from './foldseekData.js';
import { captureViewportPng, createStructurePlugin, drawStableFrame, setCanvasSpin } from './molstarViewer.js';

export default {
    name: "StructureViewerThumbnail",
    data() {
        return {
            plugin: null,
            sceneState: {},
            thumbnailRendered: false,
            renderScheduled: false,
            isActive: false,
            destroyed: false,
            isSpinning: false,
            operationQueue: Promise.resolve(),
        };
    },
    props: {
        thumbnailItem: { type: Object, default: null },
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
        alignments() {
            if (!this.thumbnailItem) return [];
            return (this.thumbnailItem.alignments || []).map(alignment => ({
                ...alignment,
                db: alignment.db || this.thumbnailItem.db,
            }));
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

        async prepareInput() {
            if (this.mode === 2) {
                const alignment = this.alignments[0];
                if (!alignment || !this.queryPdb) return null;

                const targetPdb = await this.fetchFolddiscoTargetPdb(alignment);
                if (!targetPdb) return null;

                return {
                    alignment,
                    queryPdb: this.queryPdb,
                    targetPdb,
                    showQuery: 0,
                    showTarget: 0,
                };
            }

            return prepareFoldseekStructureInput({
                alignments: this.alignments,
                hits: this.hits,
                axios: this.$axios,
                route: this.$route,
                root: this.$root,
                isLocal: this.$LOCAL,
                structureMode: this.structureMode,
            });
        },

        async fetchFolddiscoTargetPdb(alignment) {
            const db = this.thumbnailItem.db;
            const target = db?.startsWith('pdb') ? alignment.target : alignment.dbkey;
            if (!target) return null;

            const url = `api/result/folddisco/${this.$route.params.ticket}?database=${db}&id=${target}`;
            const response = await this.$axios.get(url, {
                transformResponse: [(data) => data],
            });
            return response.data;
        },

        thumbnailSceneInput(input) {
            return {
                ...input,
                showQuery: this.mode === 2 ? input.showQuery : 1,
                showTarget: this.mode === 2 ? input.showTarget : 1,
                showArrows: false,
                queryAlpha: 0.9,
                targetAlpha: 0.7,
                representationQuality: 'thumbnail',
                highlightSelections: [],
                hoverSelection: null,
                focusSelection: null,
            };
        },

        async renderScene() {
            if (!this.alignments.length || !this.plugin) return false;
            await this.plugin.clear();
            this.sceneState = {};

            const input = await this.prepareInput();
            if (!input || (!input.query && !input.target && (!input.queryPdb || !input.targetPdb))) return false;

            const scene = this.mode === 2 ? folddiscoResult : foldseekResult;
            const sceneInput = this.thumbnailSceneInput(input);
            await scene.update(this.plugin, this.sceneState, sceneInput);
            this.fitScene(scene, sceneInput);
            await drawStableFrame(this.plugin);
            return true;
        },

        fitScene(scene, sceneInput) {
            if (scene.resetView) {
                scene.resetView(this.plugin, this.sceneState, sceneInput, { durationMs: 0 });
            } else {
                this.resetCamera();
            }
        },

        async captureThumbnail() {
            return captureViewportPng(this.plugin, (screenshot, previousValues) => {
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
            }, 'Generate Thumbnail');
        },

        resetCamera() {
            this.plugin?.canvas3d?.requestCameraReset({ durationMs: 0 });
            this.plugin?.canvas3d?.commit(true);
        },

        async clearPlugin() {
            if (!this.plugin) return;
            await this.plugin.clear();
            this.sceneState = {};
        },

        moveViewportTo(targetEl, width, height) {
            if (!targetEl || !this.$refs.viewport) return;
            targetEl.appendChild(this.$refs.viewport);
            this.resizeTo(width, height);
        },

        restoreThumbnailViewport() {
            this.moveViewportTo(this.$refs.offscreenContainer, this.thumbWidth, this.thumbHeight);
        },

        stopActiveViewerInteraction() {
            this.setSpin(false);
            this.isSpinning = false;
            this.$refs.canvas?.removeEventListener('pointerdown', this.handlePointerInteraction);
        },

        canRender() {
            return Boolean(this.plugin)
                && !this.destroyed
                && !this.isActive
                && !document.hidden
                && Boolean(this.thumbnailItem)
                && (this.mode !== 2 || Boolean(this.queryPdb));
        },

        scheduleRender() {
            if (this.renderScheduled || this.thumbnailRendered || this.destroyed) return;
            this.renderScheduled = true;

            const schedule = window.requestIdleCallback || ((callback) => setTimeout(callback, 250));
            schedule(() => {
                this.renderScheduled = false;
                this.renderThumbnail();
            }, { timeout: 2000 });
        },

        handleVisibilityChange() {
            if (!document.hidden) this.scheduleRender();
        },

        enqueueOperation(operation) {
            this.operationQueue = this.operationQueue
                .catch(() => {})
                .then(operation);
            return this.operationQueue;
        },

        async renderThumbnail() {
            if (!this.canRender() || this.thumbnailRendered) return;
            this.enqueueOperation(async () => {
                if (!this.canRender() || this.thumbnailRendered) return;
                try {
                    const rendered = await this.renderScene();
                    if (!this.canRender()) return; // hidden or taken over mid-render, retry later
                    if (rendered) {
                        this.$emit('thumbnail-ready', await this.captureThumbnail());
                    }
                    this.thumbnailRendered = true;
                } catch (e) {
                    console.warn('Mol* thumbnail generation failed', e);
                    this.thumbnailRendered = true;
                } finally {
                    await this.clearPlugin();
                }
            });
            await this.operationQueue;
        },

        async setActiveViewer(targetEl) {
            if (!this.plugin) return;
            this.enqueueOperation(async () => {
                if (this.isActive) return;
                this.stopActiveViewerInteraction();
                await this.mountActiveViewer(targetEl);
            });
            await this.operationQueue;
        },

        async mountActiveViewer(targetEl) {
            if (!this.plugin || this.destroyed) return;
            this.isActive = true;
            this.moveViewportTo(targetEl, '100%', '100%');

            try {
                const rendered = await this.renderScene();
                if (!rendered || this.destroyed || !this.plugin) {
                    await this.restoreOffscreenViewer();
                    return;
                }
                this.setActiveSpin(true);
                this.$refs.canvas.addEventListener('pointerdown', this.handlePointerInteraction, { passive: true });
                this.$emit('viewer-ready');
            } catch (e) {
                console.warn('Interactive Mol* viewer failed', e);
                await this.restoreOffscreenViewer();
            }
        },

        async restoreOffscreenViewer() {
            if (!this.isActive) return;
            this.stopActiveViewerInteraction();
            await this.clearPlugin();
            this.restoreThumbnailViewport();
            this.isActive = false;
            this.$emit('spin-change', false);
            this.scheduleRender();
        },

        clearActiveViewer() {
            if (!this.isActive || !this.plugin) return;
            this.enqueueOperation(() => this.restoreOffscreenViewer());
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
    },
    watch: {
        thumbnailItem() {
            this.thumbnailRendered = false;
            this.scheduleRender();
        },
        queryPdb() {
            if (this.mode === 2) {
                this.scheduleRender();
            }
        },
    },
    async mounted() {
        await this.initPlugin();
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.scheduleRender();
    },
    async beforeDestroy() {
        this.destroyed = true;
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
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

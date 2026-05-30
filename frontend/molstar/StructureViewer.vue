<template>
<div class="molstar-structure-panel">
    <div class="molstar-structure-wrapper" ref="structurepanel">
        <slot name="overlay" />
        <StructureViewerTooltip
            attach=".molstar-structure-panel"
            :isFullscreen="isFullscreen"
        />
        <StructureViewerToolbar
            v-bind="toolbar"
            :isFullscreen="isFullscreen"
            :isSpinning="isSpinning"
            @makeImage="handleMakeImage"
            @makeCIF="handleMakeCIF"
            @resetView="handleResetView"
            @toggleFullscreen="handleToggleFullscreen"
            @toggleSpin="handleToggleSpin"
            @toggleQuery="$emit('toggleQuery')"
            @toggleTarget="$emit('toggleTarget')"
            @toggleArrows="$emit('toggleArrows')"
        />
        <div class="molstar-structure-viewer" ref="viewport">
            <canvas class="molstar-structure-canvas" ref="canvas" aria-hidden="true"></canvas>
        </div>
    </div>
</div>
</template>

<script>
import { Color } from 'molstar/lib/mol-util/color';
import { Task } from 'molstar/lib/mol-task';
import { canvasToBlob } from 'molstar/lib/mol-canvas3d/util';
import StructureViewerToolbar from '../StructureViewerToolbar.vue';
import StructureViewerTooltip from '../StructureViewerTooltip.vue';
import { applyViewerCanvasProps, createMolstarPlugin, parseColor, setCanvasSpin } from './viewerHelpers.js';

export default {
    name: 'MolstarStructureViewer',
    components: {
        StructureViewerToolbar,
        StructureViewerTooltip,
    },
    props: {
        scene: { type: Object, default: null },
        sceneInput: { type: Object, default: () => ({}) },
        toolbar: { type: Object, default: () => ({}) },
        bgColorLight: { type: String, default: 'white' },
        bgColorDark: { type: String, default: '#1E1E1E' },
        transitionDuration: { type: Number, default: 100 },
    },
    data: () => ({
        plugin: null,
        canvas: null,
        sceneState: {},
        clickSubscription: null,
        hoverSubscription: null,
        highlightProvider: null,
        initPromise: null,
        updateQueue: Promise.resolve(),
        isDisposed: false,
        isDisposing: false,
        isFullscreen: false,
        isSpinning: true,
    }),
    computed: {
        bgColor() {
            return this.$vuetify.theme.dark ? this.bgColorDark : this.bgColorLight;
        },
    },
    watch: {
        bgColor(value) {
            this.setBackground(value);
        },
        isSpinning(value) {
            this.setSpin(value);
        },
        sceneInput: {
            deep: true,
            async handler(next, previous) {
                await this.runSceneUpdate(next, previous);
            },
        },
    },
    async mounted() {
        window.addEventListener('resize', this.handleResize, { passive: true });
        document.addEventListener('fullscreenchange', this.handleFullscreenChange);
        this.initPromise = this.initialisePlugin();
        await this.initPromise;
        if (this.isDisposed) return;
        await this.scene?.mount?.(this.plugin, this.sceneState, this.sceneInput);
        if (this.isDisposed) return;
        this.bindSceneEvents();
        await this.runSceneUpdate(this.sceneInput, null);
    },
    beforeDestroy() {
        this.disposeViewer();
    },
    methods: {
        async disposeViewer() {
            if (this.isDisposing || this.isDisposed) return;
            this.isDisposing = true;
            this.isDisposed = true;

            if (document.fullscreenElement === this.$refs.structurepanel && document.exitFullscreen) {
                document.exitFullscreen();
            }

            window.removeEventListener('resize', this.handleResize);
            document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
            this.clickSubscription?.unsubscribe();
            this.clickSubscription = null;
            this.hoverSubscription?.unsubscribe();
            this.hoverSubscription = null;
            if (this.highlightProvider) {
                this.plugin?.managers?.interactivity?.lociHighlights?.removeProvider(this.highlightProvider);
                this.plugin?.managers?.interactivity?.lociSelects?.removeProvider(this.highlightProvider);
                this.highlightProvider = null;
            }
            if (this.canvas) {
                this.canvas.removeEventListener('pointerdown', this.handlePointerInteraction);
                this.canvas.removeEventListener('wheel', this.handlePointerInteraction);
            }

            if (this.initPromise) {
                try {
                    await this.initPromise;
                } catch (e) {
                    // Initialization may fail if the component is destroyed mid-mount.
                }
            }

            try {
                await this.updateQueue;
            } catch (e) {
                // If teardown races an update, disposal should still complete.
            }

            const plugin = this.plugin;
            this.plugin = null;
            if (plugin) {
                try {
                    await this.scene?.dispose?.(plugin, this.sceneState);
                } catch (e) {
                    // The plugin state may already be partially disposed during teardown.
                }
                plugin.dispose({ doNotForceWebGLContextLoss: true });
            }

            this.canvas = null;
            this.isDisposing = false;
        },
        runSceneUpdate(next, previous) {
            if (this.isDisposed || this.isDisposing || !this.plugin || !this.scene?.update) {
                return Promise.resolve();
            }

            this.updateQueue = this.updateQueue
                .catch(() => {})
                .then(async () => {
                    if (this.isDisposed || this.isDisposing || !this.plugin) return;
                    await this.scene.update(this.plugin, this.sceneState, next, previous);
                    this.$emit('sceneState', this.sceneState);
                })
                .catch((e) => {
                    if (!this.isDisposed && !this.isDisposing) throw e;
                });

            return this.updateQueue;
        },
        async initialisePlugin() {
            this.plugin = createMolstarPlugin();
            await this.plugin.init();
            this.highlightProvider = (loci, action) => {
                this.plugin?.canvas3d?.mark(loci, action);
            };
            this.plugin.managers.interactivity.lociHighlights.addProvider(this.highlightProvider);
            this.plugin.managers.interactivity.lociSelects.addProvider(this.highlightProvider);

            await this.$nextTick();
            this.canvas = this.$refs.canvas;
            const rect = this.$refs.viewport.getBoundingClientRect();
            this.canvas.width = Math.max(1, Math.floor(rect.width));
            this.canvas.height = Math.max(1, Math.floor(rect.height));
            this.canvas.addEventListener('pointerdown', this.handlePointerInteraction, { passive: true });
            this.canvas.addEventListener('wheel', this.handlePointerInteraction, { passive: true });

            const ok = await this.plugin.initViewerAsync(this.canvas, this.$refs.viewport);
            if (ok === false) {
                throw new Error('Mol* viewer initialization failed');
            }

            applyViewerCanvasProps(this.plugin, {
                renderer: {
                    highlightColor: Color(0xff40ff),
                    highlightStrength: 0.5,
                    selectColor: Color(0x00ffff),
                    selectStrength: 0.65,
                },
                marking: {
                    highlightEdgeColor: Color(0xff40ff),
                    highlightEdgeStrength: 0.85,
                    selectEdgeColor: Color(0x00ffff),
                    selectEdgeStrength: 0.85,
                },
            });

            this.setBackground(this.bgColor);
            this.setSpin(this.isSpinning);
            this.handleResize();
        },
        bindSceneEvents() {
            if (this.scene?.onClick && this.plugin?.behaviors?.interaction?.click) {
                this.clickSubscription = this.plugin.behaviors.interaction.click.subscribe((event) => {
                    const sceneEvent = this.scene.onClick(
                        this.plugin,
                        this.sceneState,
                        this.sceneInput,
                        event,
                    );
                    if (sceneEvent) {
                        this.$emit('sceneEvent', sceneEvent);
                    }
                });
            }

            if (this.scene?.onHover && this.plugin?.behaviors?.interaction?.hover) {
                this.hoverSubscription = this.plugin.behaviors.interaction.hover.subscribe((event) => {
                    const sceneEvent = this.scene.onHover(
                        this.plugin,
                        this.sceneState,
                        this.sceneInput,
                        event,
                    );
                    if (sceneEvent) {
                        this.$emit('sceneEvent', sceneEvent);
                    }
                });
            }
        },
        setBackground(color) {
            if (!this.plugin?.canvas3d) return;
            const renderer = this.plugin.canvas3d.props.renderer;
            this.plugin.canvas3d.setProps({
                renderer: {
                    ...renderer,
                    backgroundColor: parseColor(color),
                },
            });
        },
        setSpin(enabled) {
            setCanvasSpin(this.plugin, enabled);
        },
        handleResize() {
            this.plugin?.canvas3d?.handleResize();
        },
        handleFullscreenChange() {
            this.isFullscreen = Boolean(document.fullscreenElement);
            this.$nextTick(this.handleResize);
        },
        handleToggleFullscreen() {
            const target = this.$refs.structurepanel;
            if (!document.fullscreenElement && target?.requestFullscreen) {
                target.requestFullscreen();
            } else if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
        },
        handleToggleSpin() {
            this.isSpinning = !this.isSpinning;
        },
        handlePointerInteraction() {
            if (this.isSpinning) {
                this.isSpinning = false;
            }
        },
        handleResetView() {
            if (this.scene?.resetView) {
                this.scene.resetView(this.plugin, this.sceneState, this.sceneInput);
                return;
            }
            this.plugin?.managers?.camera?.reset();
        },
        async handleMakeImage() {
            if (!this.plugin?.helpers?.viewportScreenshot) return;
            const wasSpinning = this.isSpinning;
            this.isSpinning = false;

            const screenshot = this.plugin.helpers.viewportScreenshot;
            const previousValues = screenshot.values;
            const previousCropParams = screenshot.cropParams;
            screenshot.behaviors.values.next({
                ...previousValues,
                transparent: true,
                format: { name: 'png', params: {} },
                resolution: this.isFullscreen
                    ? { name: 'full-hd', params: {} }
                    : { name: 'ultra-hd', params: {} },
                axes: { name: 'off', params: {} },
            });
            screenshot.behaviors.cropParams.next({
                ...previousCropParams,
                auto: true,
                relativePadding: 0.04,
            });

            let blob = null;
            try {
                blob = await this.plugin.runTask(Task.create('Generate Image', async (ctx) => {
                    await screenshot.getPreview(ctx, 512);
                    await screenshot.draw(ctx);
                    return canvasToBlob(screenshot.canvas, 'image/png');
                }));
            } finally {
                screenshot.behaviors.values.next(previousValues);
                screenshot.behaviors.cropParams.next(previousCropParams);
                this.isSpinning = wasSpinning;
            }

            if (blob) {
                this.$emit('makeImage', blob);
            }
        },
        async handleMakeCIF() {
            const makeCIF = this.scene?.makeCIF || this.scene?.makePDB;
            const cif = await makeCIF?.(this.plugin, this.sceneState, this.sceneInput);
            this.$emit('makeCIF', cif);
        },
    },
};
</script>

<style scoped>
.molstar-structure-panel {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    contain: layout paint;
}

.molstar-structure-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.molstar-structure-viewer {
    position: relative;
    width: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    line-height: 0;
}

.molstar-structure-canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    border-radius: 2px;
}
</style>

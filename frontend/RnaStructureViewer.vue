<template>
<div class="rna-viewer" ref="root">
    <div class="rna-toolbar">
        <span class="rna-title" :title="name">{{ name }}</span>
        <v-spacer></v-spacer>
        <span v-if="structure" class="rna-mfe" title="Minimum free energy">{{ mfe.toFixed(2) }} kcal/mol</span>
        <v-btn v-if="structure" small icon title="Reset view" @click="resetView">
            <v-icon>{{ $MDI.Restore }}</v-icon>
        </v-btn>
        <v-btn v-if="structure" small icon title="Save secondary structure (dot-bracket)" @click="saveStructure">
            <v-icon>{{ $MDI.TextBoxOutline }}</v-icon>
        </v-btn>
        <v-btn v-if="structure" small icon title="Save image (SVG)" @click="saveImage">
            <v-icon>{{ $MDI.SavePNG }}</v-icon>
        </v-btn>
    </div>

    <div class="rna-canvas" :style="{ height: height + 'px' }">
        <div v-if="loading" class="rna-overlay">
            <v-progress-circular indeterminate size="28" width="2"></v-progress-circular>
            <span>Folding {{ cleaned.length }} nt&hellip;</span>
        </div>
        <div v-else-if="error" class="rna-overlay rna-error">
            <v-icon>{{ $MDI.AlertCircleOutline }}</v-icon>
            <span>{{ error }}</span>
        </div>
        <svg v-else-if="structure"
            ref="svg"
            xmlns="http://www.w3.org/2000/svg"
            :viewBox="viewBox"
            preserveAspectRatio="xMidYMid meet"
            @wheel.prevent="onWheel"
            @mousedown.prevent="onPanStart"
            >
            <g>
                <line v-for="(pair, i) in pairLines" :key="'p' + i"
                    :x1="pair.x1" :y1="pair.y1" :x2="pair.x2" :y2="pair.y2"
                    :class="['rna-pair', { 'rna-highlight': pair.highlight }]"
                    stroke-width="0.09" />
                <polyline :points="backbone" class="rna-backbone" fill="none" stroke-width="0.07" />
                <polyline v-if="highlightBackbone" :points="highlightBackbone"
                    class="rna-backbone rna-highlight" fill="none" stroke-width="0.13" />
                <g v-for="base in bases" :key="'b' + base.i">
                    <circle :cx="base.x" :cy="base.y" r="0.34"
                        :class="['rna-base', 'rna-base-' + base.c, { 'rna-highlight': base.highlight }]" />
                    <text v-if="showLabels" :x="base.x" :y="base.y" class="rna-label"
                        text-anchor="middle" dominant-baseline="central" font-size="0.42">{{ base.c }}</text>
                </g>
                <template v-for="tick in ticks">
                    <text :key="'t' + tick.i" :x="tick.x" :y="tick.y" class="rna-tick"
                        text-anchor="middle" dominant-baseline="central" font-size="0.4">{{ tick.i }}</text>
                </template>
            </g>
        </svg>
        <div v-else class="rna-overlay">
            <span>No sequence</span>
        </div>
    </div>
</div>
</template>

<script>
import { layoutStructure } from './lib/rnaLayout.js';
import { fold, cleanSequence } from './lib/tornadofold.js';
import { downloadBlob } from './Utilities.js';

const PADDING = 1.5;
const MIN_VIEW = 8;

export default {
    name: 'RnaStructureViewer',
    props: {
        sequence: { type: String, required: true },
        name: { type: String, default: '' },
        // 0-based offset and length of the region to highlight
        highlightStart: { type: Number, default: -1 },
        highlightLength: { type: Number, default: 0 },
        height: { type: Number, default: 360 },
    },
    data() {
        return {
            structure: '',
            mfe: 0,
            loading: false,
            error: '',
            layout: null,
            view: null,
            fit: null,
            panning: null,
        };
    },
    computed: {
        cleaned() {
            return cleanSequence(this.sequence);
        },
        viewBox() {
            if (!this.view) {
                return '0 0 1 1';
            }
            const { x, y, w, h } = this.view;
            return `${x} ${y} ${w} ${h}`;
        },
        showLabels() {
            return this.view != null && this.view.w < 90;
        },
        highlighted() {
            if (this.highlightStart < 0 || this.highlightLength <= 0) {
                return null;
            }
            const start = Math.max(0, this.highlightStart);
            const end = Math.min(this.cleaned.length, start + this.highlightLength);
            return end > start ? [start, end] : null;
        },
        bases() {
            if (!this.layout) {
                return [];
            }
            return this.layout.points.map((p, i) => ({
                i: i,
                x: p.x,
                y: p.y,
                c: this.cleaned[i] || 'N',
                highlight: this.isHighlighted(i),
            }));
        },
        backbone() {
            if (!this.layout) {
                return '';
            }
            return this.layout.points.map(p => `${p.x},${p.y}`).join(' ');
        },
        highlightBackbone() {
            if (!this.layout || !this.highlighted) {
                return '';
            }
            const [start, end] = this.highlighted;
            return this.layout.points.slice(start, end).map(p => `${p.x},${p.y}`).join(' ');
        },
        pairLines() {
            if (!this.layout) {
                return [];
            }
            return this.layout.pairs.map(([i, j]) => ({
                x1: this.layout.points[i].x,
                y1: this.layout.points[i].y,
                x2: this.layout.points[j].x,
                y2: this.layout.points[j].y,
                highlight: this.isHighlighted(i) && this.isHighlighted(j),
            }));
        },
        // every 10th base, offset from the backbone so the number stays readable
        ticks() {
            if (!this.layout || !this.showLabels) {
                return [];
            }
            const points = this.layout.points;
            const out = [];
            for (let i = 9; i < points.length; i += 10) {
                const prev = points[Math.max(0, i - 1)];
                const next = points[Math.min(points.length - 1, i + 1)];
                let dx = points[i].y - (prev.y + next.y) / 2;
                let dy = (prev.x + next.x) / 2 - points[i].x;
                const len = Math.hypot(dx, dy);
                if (len < 1e-6) {
                    dx = 0;
                    dy = -1;
                } else {
                    dx /= len;
                    dy /= len;
                }
                out.push({ i: i + 1, x: points[i].x + dx * 0.85, y: points[i].y + dy * 0.85 });
            }
            return out;
        },
    },
    watch: {
        sequence: {
            handler() { this.predict(); },
            immediate: true,
        },
    },
    beforeDestroy() {
        this.stopPan();
    },
    methods: {
        async predict() {
            const seq = this.cleaned;
            this.error = '';
            this.structure = '';
            this.layout = null;
            if (seq.length === 0) {
                return;
            }
            this.loading = true;
            try {
                const result = await fold(seq);
                if (this.cleaned !== seq) {
                    // sequence changed while we were folding
                    return;
                }
                this.structure = result.structure;
                this.mfe = result.mfe;
                this.layout = layoutStructure(this.structure, { bondLength: 1 });
                this.resetView();
            } catch (error) {
                this.error = 'Secondary structure prediction failed';
                console.error(error);
            } finally {
                this.loading = false;
            }
        },
        isHighlighted(i) {
            return this.highlighted != null && i >= this.highlighted[0] && i < this.highlighted[1];
        },
        resetView() {
            if (!this.layout) {
                return;
            }
            const b = this.layout.bounds;
            this.fit = {
                x: b.minX - PADDING,
                y: b.minY - PADDING,
                w: Math.max(1, b.width + 2 * PADDING),
                h: Math.max(1, b.height + 2 * PADDING),
            };
            this.view = { ...this.fit };
        },
        clampPan(view) {
            const maxX = this.fit.x + this.fit.w - view.w;
            const maxY = this.fit.y + this.fit.h - view.h;
            return {
                x: Math.min(maxX, Math.max(this.fit.x, view.x)),
                y: Math.min(maxY, Math.max(this.fit.y, view.y)),
                w: view.w,
                h: view.h,
            };
        },
        onWheel(event) {
            if (!this.view || !this.fit) {
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const intensity = Math.min(Math.abs(event.deltaY), 40) / 40;
            const zoom = 1 - 0.1 * intensity;
            const factor = event.deltaY < 0 ? zoom : 1 / zoom;
            const minW = Math.min(this.fit.w, MIN_VIEW);
            const w = Math.min(this.fit.w, Math.max(minW, this.view.w * factor));
            const scale = w / this.view.w;
            if (scale === 1) {
                return;
            }
            const h = this.view.h * scale;
            const fx = (event.clientX - rect.left) / rect.width;
            const fy = (event.clientY - rect.top) / rect.height;
            this.view = this.clampPan({
                x: this.view.x + (this.view.w - w) * fx,
                y: this.view.y + (this.view.h - h) * fy,
                w: w,
                h: h,
            });
        },
        onPanStart(event) {
            if (!this.view) {
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            this.panning = {
                x: event.clientX,
                y: event.clientY,
                scaleX: this.view.w / rect.width,
                scaleY: this.view.h / rect.height,
            };
            window.addEventListener('mousemove', this.onPanMove);
            window.addEventListener('mouseup', this.stopPan);
        },
        onPanMove(event) {
            if (!this.panning || !this.view) {
                return;
            }
            this.view = this.clampPan({
                x: this.view.x - (event.clientX - this.panning.x) * this.panning.scaleX,
                y: this.view.y - (event.clientY - this.panning.y) * this.panning.scaleY,
                w: this.view.w,
                h: this.view.h,
            });
            this.panning.x = event.clientX;
            this.panning.y = event.clientY;
        },
        stopPan() {
            this.panning = null;
            window.removeEventListener('mousemove', this.onPanMove);
            window.removeEventListener('mouseup', this.stopPan);
        },
        baseName() {
            return (this.name || 'structure').replace(/[^A-Za-z0-9_.-]+/g, '_');
        },
        saveStructure() {
            const header = `>${this.name || 'query'} MFE=${this.mfe.toFixed(2)} kcal/mol`;
            const text = `${header}\n${this.cleaned}\n${this.structure}\n`;
            downloadBlob(new Blob([text], { type: 'text/plain' }), `${this.baseName()}.dbn`);
        },
        saveImage() {
            const svg = this.$refs.svg;
            if (!svg) {
                return;
            }
            const clone = svg.cloneNode(true);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
                .rna-backbone { stroke: #9e9e9e; fill: none; }
                .rna-pair { stroke: #9e9e9e; }
                .rna-base { stroke: none; fill: #bdbdbd; }
                .rna-base-A { fill: #64f73f; }
                .rna-base-C { fill: #ffb340; }
                .rna-base-G { fill: #eb413c; }
                .rna-base-T { fill: #3c88ee; }
                .rna-base-U { fill: #3c88ee; }
                .rna-label { fill: #212121; font-family: monospace; }
                .rna-tick { fill: #757575; font-family: monospace; }
                .rna-highlight { stroke: #1976d2; }
                circle.rna-highlight { stroke: #1976d2; stroke-width: 0.12; }
            `;
            clone.insertBefore(style, clone.firstChild);
            const text = new XMLSerializer().serializeToString(clone);
            downloadBlob(new Blob([text], { type: 'image/svg+xml' }), `${this.baseName()}.svg`);
        },
    },
};
</script>

<style scoped>
.rna-viewer {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.rna-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
}

.rna-title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
}

.rna-mfe {
    font-size: 0.85rem;
    opacity: 0.7;
    white-space: nowrap;
}

.rna-canvas {
    position: relative;
    width: 100%;
    /* border: 1px solid rgba(128, 128, 128, 0.3); */
    border-radius: 4px;
    overflow: hidden;
}

.rna-canvas svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
}

.rna-canvas svg:active {
    cursor: grabbing;
}

.rna-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.9rem;
    opacity: 0.7;
}

.rna-error {
    opacity: 1;
}
</style>

<style>
.rna-canvas .rna-backbone {
    stroke: #9e9e9e;
}

.rna-canvas .rna-pair {
    stroke: #9e9e9e;
}

.rna-canvas .rna-base {
    fill: #bdbdbd;
}

.rna-canvas .rna-base-A { fill: #64f73f; }
.rna-canvas .rna-base-C { fill: #ffb340; }
.rna-canvas .rna-base-G { fill: #eb413c; }
.rna-canvas .rna-base-T { fill: #3c88ee; }
.rna-canvas .rna-base-U { fill: #3c88ee; }

.rna-canvas .rna-label {
    fill: #212121;
    font-family: monospace;
    pointer-events: none;
}

.rna-canvas .rna-tick {
    fill: #757575;
    font-family: monospace;
    pointer-events: none;
}

.theme--dark .rna-canvas .rna-label {
    fill: #121212;
}

.theme--dark .rna-canvas .rna-tick {
    fill: #bdbdbd;
}

.rna-canvas line.rna-highlight,
.rna-canvas polyline.rna-highlight {
    stroke: #1976d2;
}

.rna-canvas circle.rna-highlight {
    stroke: #1976d2;
    stroke-width: 0.12;
}
</style>

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
            <v-icon>{{ $MDI.SaveSVG }}</v-icon>
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
        <div v-else-if="!structure" class="rna-overlay">
            <span>No sequence</span>
        </div>
        <div v-show="structure && !loading && !error" ref="forna" class="rna-forna"></div>
    </div>
</div>
</template>

<script>
import { FornaContainer } from 'fornac';
import { fold, cleanSequence } from './lib/tornadofold.js';
import { downloadBlob } from './Utilities.js';

const RNA_NAME = 'rna';
const HIGHLIGHT_COLOR = '#1976d2';
const MAX_ZOOM = 8;
const OVERPAN = 0.25;
const BASE_COLORS = { A: '#64f73f', C: '#ffb340', G: '#eb413c', T: '#3c88ee', U: '#3c88ee' };

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
        };
    },
    computed: {
        cleaned() {
            return cleanSequence(this.sequence);
        },
        highlighted() {
            if (this.highlightStart < 0 || this.highlightLength <= 0) {
                return null;
            }
            const start = Math.max(0, this.highlightStart);
            const end = Math.min(this.cleaned.length, start + this.highlightLength);
            return end > start ? [start, end] : null;
        },
    },
    watch: {
        sequence: {
            handler() { this.predict(); },
            immediate: true,
        },
        highlighted() { this.applyColors(); },
    },
    mounted() {
        this.render();
    },
    beforeDestroy() {
        this.teardown();
    },
    methods: {
        async predict() {
            const seq = this.cleaned;
            this.error = '';
            this.structure = '';
            if (seq.length === 0) {
                this.teardown();
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
            } catch (error) {
                this.error = 'Secondary structure prediction failed';
                console.error(error);
            } finally {
                this.loading = false;
            }
            this.$nextTick(() => this.render());
        },
        render() {
            const host = this.$refs.forna;
            if (!host || !this.structure) {
                return;
            }
            this.teardown();
            this.container = new FornaContainer(host, {
                applyForce: true,
                allowPanningAndZooming: true,
                initialSize: [host.clientWidth || host.offsetWidth, host.clientHeight || this.height],
            });
            this.container.addRNA(this.structure, { sequence: this.cleaned, name: RNA_NAME });
            this.applyColors();
            this.bindViewBounds();
        },
        bindViewBounds() {
            const container = this.container;
            const svg = this.$refs.forna ? this.$refs.forna.querySelector('svg') : null;
            const svgGraph = svg ? svg.querySelector('g') : null;
            const vis = svgGraph ? Array.prototype.find.call(svgGraph.children,
                (el) => el.tagName.toLowerCase() === 'g' && !el.classList.contains('brush')) : null;
            if (!container || !container.zoomer || !vis) {
                return;
            }

            const bounds = () => {
                const nodes = container.graph.nodes;
                if (nodes.length === 0) {
                    return null;
                }
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (const node of nodes) {
                    minX = Math.min(minX, node.x);
                    maxX = Math.max(maxX, node.x);
                    minY = Math.min(minY, node.y);
                    maxY = Math.max(maxY, node.y);
                }
                return { minX, maxX, minY, maxY };
            };

            const clamp = (offset, scale, low, high, size) => {
                const slack = size * OVERPAN;
                const a = -low * scale;
                const b = size - high * scale;
                return Math.min(
                    Math.max(offset, Math.min(a, b) - slack),
                    Math.max(a, b) + slack);
            };

            const limitScale = () => {
                const view = svg.getBoundingClientRect();
                if (view.width > 0 && view.height > 0) {
                    container.options.svgW = view.width;
                    container.options.svgH = view.height;
                }
                const fit = container.getBoundingBoxTransform().scale;
                container.zoomer.scaleExtent([fit, fit * MAX_ZOOM]);
            };

            const applyLimits = () => {
                const box = bounds();
                if (!box) {
                    return;
                }
                limitScale();

                const scale = container.zoomer.scale();
                const [tx, ty] = container.zoomer.translate();
                const x = clamp(tx, scale, box.minX, box.maxX, container.options.svgW);
                const y = clamp(ty, scale, box.minY, box.maxY, container.options.svgH);
                if (x !== tx || y !== ty) {
                    container.zoomer.translate([x, y]);
                }
                vis.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
            };

            limitScale();
            container.zoomer.on('zoom', applyLimits);
        },
        applyColors() {
            if (!this.container) {
                return;
            }
            if (!this.highlighted) {
                this.container.changeColorScheme('sequence');
                return;
            }
            const colors = {};
            for (let i = 0; i < this.cleaned.length; i++) {
                const inRange = i >= this.highlighted[0] && i < this.highlighted[1];
                colors[i + 1] = inRange ? HIGHLIGHT_COLOR : (BASE_COLORS[this.cleaned[i]] || '#bdbdbd');
            }
            this.container.addCustomColors({ colorValues: { [RNA_NAME]: colors } });
            this.container.changeColorScheme('custom');
        },
        teardown() {
            if (!this.container) {
                return;
            }
            const host = this.$refs.forna;
            if (host) {
                host.innerHTML = '';
            }
            this.container = null;
        },
        resetView() {
            if (this.container) {
                this.container.centerView();
            }
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
            const host = this.$refs.forna;
            const svg = host ? host.querySelector('svg') : null;
            if (!svg) {
                return;
            }
            const clone = svg.cloneNode(true);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
                circle.node { stroke: #ccc; stroke-width: 1px; fill: white; }
                circle.node.label { stroke: transparent; stroke-width: 0; fill: white; }
                circle.outline_node { visibility: hidden; }
                line.link { stroke: #999; stroke-opacity: 0.8; stroke-width: 2; }
                line.basepair, line.pseudoknot { stroke: red; }
                line.intermolecule { stroke: blue; }
                line.chain_chain { stroke-dasharray: 3,3; }
                .transparent { fill: transparent; stroke-width: 0; opacity: 0; visibility: hidden; }
                text.node-label { font-weight: bold; font-family: Tahoma, Geneva, sans-serif; }
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

.rna-forna {
    width: 100%;
    height: 100%;
}

/* re-assert what the reset below takes away, inside our container only */
.rna-forna ::v-deep svg {
    display: block;
    width: 100%;
    height: 100%;
}

.rna-forna ::v-deep text {
    pointer-events: none;
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
/* reset fornac global rules */
html svg {
    display: revert;
    min-width: revert;
    width: revert;
    min-height: revert;
}

html text {
    pointer-events: revert;
}
</style>

<!--
A span of residues in a sequence alignment. Selection and hover ranges are rendered
as child spans so they can be styled independently.
-->

<template>
    <span
        @pointerup="emitPointerUpEvent"
        @pointerdown="emitPointerDownEvent"
        @pointermove="emitPointerMoveEvent"
        @pointerleave="emitPointerLeaveEvent"
        @selectstart="emitSelectStartEvent"
        class="residues"
        :class="sequenceType"
    ><!--
        --><template v-if="segments.length === 1 && !segments[0].selected && !segments[0].hovered && !segments[0].interfaceRegion"><slot></slot></template><!--
        --><template v-else><!--
            --><span
                v-for="(segment, i) in segments"
                :key="i"
                :class="{ selected: segment.selected, hovered: segment.hovered, interfaceRegion: segment.interfaceRegion }"
                @click="segment.selected ? emitClickHighlight($event) : null"
            >{{ segment.text }}</span><!--
        --></template><!--
    --></span>
</template>

<script>
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export default {
    name: 'ResidueSpan',
    props: {
        sequenceType: { type: String },
        selectionStart: { type: Number },
        selectionEnd: { type: Number },
        hoverOffset: { type: Number, default: null },
        interfaceRanges: { type: Array, default: () => [] },
    },
    computed: {
        text() {
            return this.$slots.default?.[0]?.text || '';
        },
        hasSelection() {
            return Number.isFinite(this.selectionStart)
                && Number.isFinite(this.selectionEnd)
                && this.selectionEnd > this.selectionStart;
        },
        hasHover() {
            return Number.isFinite(this.hoverOffset)
                && this.hoverOffset >= 0
                && this.hoverOffset < this.text.length;
        },
        normalizedInterfaceRanges() {
            return this.interfaceRanges
                .filter(range => Array.isArray(range) && range.length === 2)
                .map(([start, end]) => [
                    clamp(start, 0, this.text.length),
                    clamp(end, 0, this.text.length),
                ])
                .filter(([start, end]) => end > start);
        },
        segments() {
            const points = new Set([0, this.text.length]);

            if (this.hasSelection) {
                points.add(clamp(this.selectionStart, 0, this.text.length));
                points.add(clamp(this.selectionEnd, 0, this.text.length));
            }
            if (this.hasHover) {
                points.add(this.hoverOffset);
                points.add(this.hoverOffset + 1);
            }
            for (const [start, end] of this.normalizedInterfaceRanges) {
                points.add(start);
                points.add(end);
            }

            const sorted = Array.from(points).sort((a, b) => a - b);
            const segments = [];
            for (let i = 0; i < sorted.length - 1; i++) {
                const start = sorted[i];
                const end = sorted[i + 1];
                if (end <= start) continue;
                segments.push({
                    text: this.text.slice(start, end),
                    selected: this.hasSelection && start < this.selectionEnd && end > this.selectionStart,
                    hovered: this.hasHover && start <= this.hoverOffset && end > this.hoverOffset,
                    interfaceRegion: this.normalizedInterfaceRanges.some(([rangeStart, rangeEnd]) => (
                        start < rangeEnd && end > rangeStart
                    )),
                });
            }
            return segments;
        },
    },
    methods: {
        emitPointerUpEvent(event) { this.$emit('pointerup', event) },
        emitPointerDownEvent(event) { this.$emit('pointerdown', event) },
        emitPointerMoveEvent(event) { this.$emit('pointermove', event) },
        emitPointerLeaveEvent(event) { this.$emit('pointerleave', event) },
        emitSelectStartEvent(event) { this.$emit('selectstart', event) },
        emitClickHighlight(event) { this.$emit('clickHighlight', event) },
    }
}
</script>

<style>
.residues {
    font-family:
        Protsolata, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono",
        "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
    white-space: pre;
}

.interfaceRegion {
    background: rgba(255, 193, 7, 0.16);
    box-shadow: inset 0 -2px 0 rgba(255, 193, 7, 0.85);
}
</style>

<!--
A span of residues in a sequence alignment. If a selection start/end is specified, this
will render a span with three child spans (before, highlight, after).
-->

<template>
    <span
        v-if="!selectionStart && !selectionEnd"
        @pointerup="emitPointerUpEvent"
        @selectstart="emitSelectStartEvent"
        class="residues"
        :class="sequenceType"
    ><slot></slot></span>
    <span
        v-else
        @pointerup="emitPointerUpEvent"
        @selectstart="emitSelectStartEvent"
        class="residues"
        :class="sequenceType"
    ><!--
        --><span>{{ $slots.default[0].text.slice(0, selectionStart) }}</span><!--
        --><span class="selected">{{ $slots.default[0].text.slice(selectionStart, selectionEnd) }}</span><!--
        --><span>{{ $slots.default[0].text.slice(selectionEnd, $slots.default[0].text.length) }}</span>
    </span>
</template>

<script>
export default {
    name: 'ResidueSpan',
    props: {
        sequenceType: { type: String },
        selectionStart: { type: Number },
        selectionEnd: { type: Number },
    },
    methods: {
        emitPointerUpEvent(event) {
            this.$emit('pointerup', event)
        },
        emitSelectStartEvent(event) {
            this.$emit('selectstart', event)
        },
    }
}
</script>

<style>
.selected {
    border-radius: 4px;
    background-color: rgba(0, 255, 255, 0.1);
    box-shadow: 0 0 .4em .1em rgba(0, 255, 255, 0.5);
}
.residues {
    font-family:
        InconsolataClustal, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono",
        "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
    white-space: pre;
}
</style>
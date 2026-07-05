<template>
    <div :id="alnIndex" class="alignment-wrapper-inner">
        <span class="monospace" v-for="i in Math.max(1, Math.ceil(alignment.alnLength / lineLen))" :key="i">
            <span :id="i" class="line" ref="lines">
                <span class="protsolata-auto">Q&nbsp;{{padNumber(getQueryRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;</span><!--
                --><ResidueSpan
                    sequenceType="query"
                    :text="alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)"
                    :selectionStart="getSelectionStart(i, 'query')"
                    :selectionEnd="getSelectionEnd(i, 'query')"
                    :hoverOffset="getHoverOffset(i, 'query')"
                    :interfaceRanges="getInterfaceRanges(i, 'query')"
                    @selectstart="onSelectStart($event, alnIndex, i, 'query')"
                    @pointerdown="onPointerDown($event, alnIndex, i, 'query')"
                    @pointerup="onPointerUp($event, alnIndex, i, 'query')"
                    @pointermove="onPointerMove($event, alnIndex, i, 'query')"
                    @pointerleave="onPointerLeave($event, alnIndex, i, 'query')"
                    @clickHighlight="onClickHighlight($event, alnIndex, i, 'query')"
                    :class="colorscheme ? colorscheme : null"
                /><br><!--
                --><span class="protsolata-auto">{{'&nbsp;'.repeat(3+(Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length)}}</span><!--
                --><span class="residues diff" :class="colorscheme ? colorscheme : null">{{formatAlnDiff(alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen), alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen))}}</span><br><!--
                --><span class="protsolata-auto">T&nbsp;{{padNumber(getTargetRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;</span><!--
                --><ResidueSpan
                    sequenceType="target"
                    :text="alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)"
                    :selectionStart="getSelectionStart(i, 'target')"
                    :selectionEnd="getSelectionEnd(i, 'target')"
                    :hoverOffset="getHoverOffset(i, 'target')"
                    :interfaceRanges="getInterfaceRanges(i, 'target')"
                    @selectstart="onSelectStart($event, alnIndex, i, 'target')"
                    @pointerdown="onPointerDown($event, alnIndex, i, 'target')"
                    @pointerup="onPointerUp($event, alnIndex, i, 'target')"
                    @pointermove="onPointerMove($event, alnIndex, i, 'target')"
                    @pointerleave="onPointerLeave($event, alnIndex, i, 'target')"
                    @clickHighlight="onClickHighlight($event, alnIndex, i, 'target')"
                    :class="colorscheme ? colorscheme : null"
                />
            </span><br>
        </span>
    </div>
</template>

<script>
    
import ResidueSpan from './ResidueSpan.vue'

// cat blosum62.out  | grep -v '^#' | awk 'NR == 1 { for (i = 1; i <= NF; i++) { r[i] = $i; } next; } { col = $1; for (i = 2; i <= NF; i++) { print col,r[i-1],$i; } }' | awk '$3 > 0 && $1 != $2 { printf "\""$1""$2"\",";}'
const blosum62Sim = [
    "AG", "AS", "DE", "DN",
    "ED", "EK", "EQ", "FL",
    "FM", "FW", "FY", "GA",
    "HN", "HQ", "HY", "IL",
    "IM", "IV", "KE", "KQ",
    "KR", "LF", "LI", "LM",
    "LV", "MF", "MI", "ML",
    "MV", "ND", "NH", "NQ",
    "NS", "QE", "QH", "QK",
    "QN", "QR", "RK", "RQ",
    "SA", "SN", "ST", "TS",
    "VI", "VL", "VM", "WF",
    "WY", "YF", "YH", "YW"
]

export default {
    props: [
        'alignment',
        'lineLen',
        'queryMap',
        'targetMap',
        'alnIndex',
        'highlights',
        'queryHighlights',
        'interfaceHighlights',
        'queryInterfaceHighlights',
        'hover',
        'colorscheme'
    ],
    components: { ResidueSpan },
    methods: {
        getSelectionStart(i, side) {
            const highlights = side === 'query' ? this.queryHighlights : this.highlights;
            return (i > 0 && i <= highlights.length) ? highlights[i-1][0] : 0;
        },
        getSelectionEnd(i, side) {
            const highlights = side === 'query' ? this.queryHighlights : this.highlights;
            return (i > 0 && i <= highlights.length) ? highlights[i-1][1] : 0;
        },
        getHoverOffset(i, side) {
            return this.hover?.side === side && this.hover?.lineNo === i ? this.hover.offset : null;
        },
        getInterfaceRanges(i, side) {
            const highlights = side === 'query' ? this.queryInterfaceHighlights : this.interfaceHighlights;
            return (i > 0 && highlights && i <= highlights.length) ? highlights[i - 1] : [];
        },

        // Get the index of a given residue in the alignment
        getQueryIndex(index) { return this.queryMap[index] },
        getTargetIndex(index) { return this.targetMap[index] },
        getFirstResidueNumber(map, i) {
            let start = this.lineLen * (i - 1)
            while (map[start] === null) start--
            return map[start]
        },
        getQueryRowStartPos(i) { return this.getFirstResidueNumber(this.queryMap, i) },
        getTargetRowStartPos(i) { return this.getFirstResidueNumber(this.targetMap, i) },
        formatAlnDiff(seq1, seq2) {
            if (seq1.length != seq2.length) return ''
            var res = ''
            for (var i = 0; i < seq1.length; i++) {
                if (seq1[i] == seq2[i]) res += seq1[i];
                else if (blosum62Sim.indexOf(seq1[i] + seq2[i]) != -1) res += '+';
                else res += ' ';
            }
            return res;
        },
        padNumber(nr, n, str){
            return Array(n - String(nr).length + 1).join(str || '0') + nr
        },
        onSelectStart(event, alnIndex, lineNo, side) {
            this.$emit('residueSelectStart', event, alnIndex, lineNo, side);
        },
        onPointerUp(event, alnIndex, lineNo, side) {
            this.$emit('residuePointerUp', event, alnIndex, lineNo, side);
        },
        onPointerDown(event, alnIndex, lineNo, side) {
            this.$emit('residuePointerDown', event, alnIndex, lineNo, side);
        },
        onPointerMove(event, alnIndex, lineNo, side) {
            this.$emit('residuePointerMove', event, alnIndex, lineNo, side);
        },
        onPointerLeave(event, alnIndex, lineNo, side) {
            this.$emit('residuePointerLeave', event, alnIndex, lineNo, side);
        },
        onClickHighlight(event, alnIndex, lineNo, side) {
            this.$emit('residueClickHighlight', event, alnIndex, lineNo, side);
        }
    }, 
}
</script>

<style scoped>
.residues {
    font-family: Protsolata, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
    white-space: pre;
}
.alignment-wrapper-outer {
    display: inline-block;
    overflow-x: auto;
}
.inselection, .inselection * {
    user-select: none;
}
.inselection span.query, .inselection span.query *,
.inselection span.target, .inselection span.target * {
    user-select: text !important; 
}
.alignment-wrapper-inner .line {
    display: inline-block;
    margin-bottom: 0.5em;
    white-space: nowrap;
    font-size: 1rem;
}
</style>

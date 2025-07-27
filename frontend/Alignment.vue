<template>
    <div :id="alnIndex" class="alignment-wrapper-inner">
        <span class="monospace" v-for="i in Math.max(1, Math.ceil(alignment.alnLength / lineLen))" :key="i">
            <span :id="i" class="line" ref="lines">
                <span class="protsolata-auto">Q&nbsp;{{padNumber(getQueryRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;</span><!--
                --><ResidueSpan sequenceType="query"><!--
                    -->{{alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)}}<!--
                --></ResidueSpan><br><!--
                --><span class="protsolata-auto">{{'&nbsp;'.repeat(3+(Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length)}}</span><!--
                --><span class="residues diff">{{formatAlnDiff(alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen), alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen))}}</span><br><!--
                --><span class="protsolata-auto">T&nbsp;{{padNumber(getTargetRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;</span><!--
                --><ResidueSpan
                    sequenceType="target"
                    :selectionStart="getSelectionStart(i)"
                    :selectionEnd="getSelectionEnd(i)"
                    @selectstart="onSelectStart($event, alnIndex, i)"
                    @pointerup="onPointerUp($event, alnIndex, i)"
                >{{alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)}}<!--
                --></ResidueSpan>
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
    props: ['alignment', 'lineLen', 'queryMap', 'targetMap', 'showhelp', 'alnIndex', 'highlights'],
    components: { ResidueSpan },
    methods: {
        getSelectionStart(i) {
            return (i > 0 && i <= this.highlights.length) ? this.highlights[i-1][0] : 0;
        },
        getSelectionEnd(i) {
            return (i > 0 && i <= this.highlights.length) ? this.highlights[i-1][1] : 0;
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
        onSelectStart(event, alnIndex, lineNo) {
            this.$emit('residueSelectStart', event, alnIndex, lineNo);
        },
        onPointerUp(event, alnIndex, lineNo) {
            this.$emit('residuePointerUp', event, alnIndex, lineNo);
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
.inselection span.target, span.target * {
    user-select: text !important; 
}
.alignment-wrapper-inner .line {
    display: inline-block;
    margin-bottom: 0.5em;
    white-space: nowrap;
    font-size: 1rem;
}
</style>

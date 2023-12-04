<template>
    <div class="alignment-wrapper-inner">
        <span class="monospace" v-for="i in Math.max(1, Math.ceil(alignment.alnLength / lineLen))" :key="i">
            <span class="line">
                Q&nbsp;{{padNumber(getQueryRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;<span class="residues">{{alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)}}</span>
                <br>
                {{'&nbsp;'.repeat(3+(Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length)}}<span class="residues">{{formatAlnDiff(alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen), alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen))}}</span>
                <br>
                T&nbsp;{{padNumber(getTargetRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}&nbsp;<span class="residues" @pointerup="onSelectText(i)">{{alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)}}</span>
            </span><br>
        </span>
        <small v-if="$APP == 'foldseek' && showhelp" style="float:right">Select target residues to highlight their structure</small>
    </div>
</template>

<script>

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

// Get the first and last non-null values in a map between a range
function getRange(map, start, end) {
    let first = null, last = null
    for (let i = start; i <= end; i++) {
	let val = map[i]
	if (val !== null) {
	    if (first === null) first = val
	    last = val
	}
    }
    return [first, last]
}

export default {
    props: ['alignment', 'lineLen', 'queryMap', 'targetMap', 'showhelp'],
    methods: {
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
        onSelectText(i) {
            var selection = window.getSelection()

            // In case of backwards selection
            var [offsetStart, offsetEnd] = [
                selection.anchorOffset, selection.focusOffset
            ].sort((a, b) => a - b)

            var length = offsetEnd - offsetStart
            var relStart = (i - 1) * this.lineLen + offsetStart
            var relEnd = relStart + length - 1 // the selection is inclusive

            var [start, end] = getRange(this.targetMap, relStart, relEnd)
            this.$emit('selected', [start, end])
        }
    }, 
}
</script>

<style>
.residues {
    font-family: InconsolataClustal, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
    white-space: pre;
}
.alignment-wrapper-inner {
    display: inline-block;
    overflow-x: auto;
}
.alignment-wrapper-inner .line {
    display: inline-block;
    margin-bottom: 0.5em;
    white-space: nowrap;
}
</style>

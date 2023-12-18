<template>
    <div :id="alnIndex" class="alignment-wrapper-inner">
        <span class="monospace" v-for="i in Math.max(1, Math.ceil(alignment.alnLength / lineLen))" :key="i">
            <span :id="i" class="line">
                <span>Q&nbsp;{{padNumber(getQueryRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}</span>&nbsp;<span class="residues query">{{alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)}}</span>
                <br>
                <span>{{'&nbsp;'.repeat(3+(Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length)}}</span><span class="residues diff">{{formatAlnDiff(alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen), alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen))}}</span>
                <br>
                <span>T&nbsp;{{padNumber(getTargetRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}</span>&nbsp;<span class="residues target" @selectstart="onSelectStart" @pointerup="onSelectText(i)">{{alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)}}</span>
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
    let first = null,
        last = null
    for (let i = start; i <= end; i++) {
        let val = map[i]
        if (val !== null) {
            if (first === null) first = val
            last = val
        }
    }
    return [first, last]
}

function countCharacter(string, char) {
    let count = 0;
    for (let c of string) {
        if (c === char) count++;
    }
    return count;
}


export default {
    props: ['alignment', 'lineLen', 'queryMap', 'targetMap', 'showhelp', 'alnIndex'],
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
        onSelectStart(event) {
            event.srcElement.parentElement
                .closest(".alignment-wrapper-outer")
                .classList.add("inselection");
        },
        onSelectText(i) {
            var selection = window.getSelection()
            
            // Get text and (sequence) starting position for each selected alignment
            let chunks = [];
            let chunk = "";
            let prevWrapper = null;
            let start = 0;
            for (let i = 0; i < selection.rangeCount; i++) {
                let range = selection.getRangeAt(i);
                let currWrapper = range.startContainer.parentElement.closest(".alignment-wrapper-inner");
                let lineNo = parseInt(range.startContainer.parentElement.closest(".line").id);
                if (!prevWrapper) {
                    prevWrapper = currWrapper;
                    let preText = range.startContainer.textContent.slice(0, range.startOffset);
                    start = this.getTargetRowStartPos(lineNo) + range.startOffset - countCharacter(preText, '-');
                } else if (currWrapper != prevWrapper) {
                    chunks.push([parseInt(prevWrapper.id), start, chunk]);                     
                    chunk = "";
                    prevWrapper = currWrapper;
                    let preText = range.startContainer.textContent.slice(0, range.startOffset);
                    start = this.getTargetRowStartPos(lineNo) + range.startOffset - countCharacter(preText, '-');
                }
                chunk += range.toString();
            }
            chunks.push([parseInt(prevWrapper.id), start, chunk.replace(/[-]/g, '')])
            this.$emit("selected", chunks);

            // Make everything else selectable again
            let noselects = document.querySelectorAll(".inselection");
            noselects.forEach(el => { el.classList.remove("inselection") })
        }
    }, 
}
</script>

<style>
.residues {
    font-family: InconsolataClustal, Inconsolata, Consolas, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace;
    white-space: pre;
}
.alignment-wrapper-outer {
    display: inline-block;
    overflow-x: auto;
}
.selected {
    background-color: aqua;
}
.inselection, .inselection * {
    user-select: none;
}
.inselection .target {
    user-select: text !important; 
}
.alignment-wrapper-inner .line {
    display: inline-block;
    margin-bottom: 0.5em;
    white-space: nowrap;
}
</style>

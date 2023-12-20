<template>
    <div :id="alnIndex" class="alignment-wrapper-inner">
        <span class="monospace" v-for="i in Math.max(1, Math.ceil(alignment.alnLength / lineLen))" :key="i">
            <span :id="i" class="line" ref="lines">
                <span>Q&nbsp;{{padNumber(getQueryRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}</span>&nbsp;<!--
                --><ResidueSpan sequenceType="query"><!--
                    -->{{alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen)}}<!--
                --></ResidueSpan><br><!--
                --><span>{{'&nbsp;'.repeat(3+(Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length)}}</span><!--
                --><span class="residues diff">{{formatAlnDiff(alignment.qAln.substring((i-1)*lineLen,  (i-1)*lineLen+lineLen), alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen))}}</span><br><!--
                --><span>T&nbsp;{{padNumber(getTargetRowStartPos(i), (Math.max(alignment.qStartPos, alignment.dbStartPos) + alignment.alnLength+"").length, '&nbsp;')}}</span>&nbsp;<!--
                --><ResidueSpan
                    sequenceType="target"
                    :selectionStart="getSelectionStart(i)"
                    :selectionEnd="getSelectionEnd(i)"
                    @selectstart="onSelectStart"
                    @pointerup="onSelectText"
                >{{alignment.dbAln.substring((i-1)*lineLen, (i-1)*lineLen+lineLen)}}<!--
                --></ResidueSpan>
            </span><br>
        </span>
        <small v-if="$APP == 'foldseek' && showhelp" style="float:right">Select target residues to highlight their structure</small>
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

function countCharacter(string, char) {
    let count = 0;
    for (let c of string) {
        if (c === char) count++;
    }
    return count;
}

/**
 * Count characters up until the given node in the parent span.
 * e.g. with layout <span 1/><span 2/><span 3/>
 * Text selection which starts/ends in span 3 will have offset relative only to span 3,
 * so we need to include length of spans 1 + 2
 */
function calculateOffset(node) {
    let container = node.closest("span.residues")
    let children = container.querySelectorAll("span");
    let length = 0;
    for (let child of children) {
        if (child === node)
            break;
        length += child.textContent.length;
    }
    return length;
}


export default {
    props: ['alignment', 'lineLen', 'queryMap', 'targetMap', 'showhelp', 'alnIndex', 'highlights'],
    components: { ResidueSpan },
    methods: {
        getSelectionStart(i) { return this.highlights[i-1][0] },
        getSelectionEnd(i) { return this.highlights[i-1][1] },

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
        onSelectText(event) {
            var selection = window.getSelection()
            
            // Get text and (sequence) starting position for each selected alignment
            let chunks = [];
            let chunk = "";
            let prevWrapper = null;
            let currWrapper = null;
            let lineNo = 0;
            let start = {};
            for (let i = 0; i < selection.rangeCount; i++) {
                let range = selection.getRangeAt(i);
                currWrapper = range.startContainer.parentElement.closest(".alignment-wrapper-inner");
                lineNo = parseInt(range.startContainer.parentElement.closest(".line").id);
                
                // Start/end containers will either be:
                // #text  - Start/end inside a span, so calculate lengths of spans until that point
                // <span> - Start/end of entire span (e.g. multiline selection). Start = 0, end = line length
                let sc = range.startContainer;
                let ec = range.endContainer;
                let startOffset = (sc.nodeType === 3) ? range.startOffset + calculateOffset(sc.parentElement) : 0;
                let endOffset = (ec.nodeType === 3) ? range.endOffset + calculateOffset(ec.parentElement) : this.lineLen;
                
                // Test for new container (alignment), store starting line/offset & calculate position in sequence
                // If in the same alignment, extend sequence and update end line/offset
                if (!prevWrapper) {
                    prevWrapper = currWrapper;
                    let preText = range.startContainer.textContent.slice(0, range.startOffset);
                    start = {
                        startLine: lineNo,
                        startOffset: startOffset,
                        seqStart: this.getTargetRowStartPos(lineNo) + startOffset - countCharacter(preText, '-')
                    }
                } else if (currWrapper != prevWrapper) {
                    chunks.push([parseInt(prevWrapper.id), start, chunk]);
                    chunk = "";
                    prevWrapper = currWrapper;
                    let preText = range.startContainer.textContent.slice(0, startOffset);
                    start = {
                        startLine: lineNo,
                        startOffset: startOffset,
                        seqStart: this.getTargetRowStartPos(lineNo) + startOffset - countCharacter(preText, '-')
                    }
                }
                chunk += range.toString();
                start.endLine = lineNo;
                start.endOffset = endOffset;
            }
            chunks.push([parseInt(prevWrapper.id), start, chunk])

            // For structure: aln Id, start in sequence, selection length
            this.$emit("selected", chunks.map(([ alnId, { seqStart }, text ]) => ([ alnId, seqStart, text.replace(/[-]/g, '') ]))); 
            
            // For sequence: aln Id, line and start position (in start line), line and end position (in end line)
            this.$emit("alnSelections", chunks.map(([ alnId, { startLine, startOffset, endLine, endOffset }, chunk ]) => (
                [ alnId, startLine - 1, startOffset, endLine - 1, endOffset, chunk.length ]
            )));

            // Make everything else selectable again
            let noselects = document.querySelectorAll(".inselection");
            noselects.forEach(el => { el.classList.remove("inselection") })

            // Clear selection afterwards to prevent weird highlighting after inserting spans
            window.getSelection().removeAllRanges();
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
}
</style>

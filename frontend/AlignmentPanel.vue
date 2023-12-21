<template>
    <div class="alignment-panel" slot="content">
        <div class="alignment-wrapper-outer">
            <div style="line-height: 1.2em; display: flex; flex-direction: row; width: 100%; justify-content: space-between; margin-bottom: 1em;">
                <small v-if="$APP == 'foldseek'">
                    Select target residues to highlight their structure.<br style="height: 0.2em">
                    Click on highlighted sequences to dehighlight the corresponding chain.
                </small>
                <v-btn
                    small
                    title="Clear sequence selection"
                    @click="clearAllSelection"
                    :disabled="hasSelection"
                >
                    Clear all selections&nbsp;
                    <v-icon style="width: 16px;">{{ $MDI.CloseCircle }}</v-icon>
                </v-btn>
            </div>

            <template v-for="(alignment, index) in alignments">
                {{ alignment.query.lastIndexOf('_') != -1 ? alignment.query.substring(alignment.query.lastIndexOf('_')+1) : '' }} ➔ {{ alignment.target }}
                <Alignment
                    :key="`aln2-${alignment.id}`"
                    :alnIndex="index"
                    :alignment="alignment"
                    :lineLen="lineLen"
                    :queryMap="queryMaps[index]"
                    :targetMap="targetMaps[index]"
                    :showhelp="index == alignments.length - 1"
                    :highlights="highlights[index]"
                    ref="alignments"
                    @residueSelectStart="onResidueSelectStart"
                    @residuePointerUp="onResiduePointerUp"
                />
            </template>
        </div>
        <div v-if=" $APP == 'foldseek'" class="alignment-structure-wrapper">
            <StructureViewer
                :key="`struc2-${alignments[0].id}`"
                :alignments="alignments"
                :highlights="structureHighlights" 
                :hits="hits"
                bgColorLight="white"
                bgColorDark="#1E1E1E"
                qColor="lightgrey"
                tColor="red"
                qRepr="cartoon"
                tRepr="cartoon"
                ref="structureViewer"
            />
        </div>
    </div>
</template>

<script>
import Alignment from './Alignment.vue'
import { makePositionMap } from './Utilities.js'

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

function countCharacter(string, char) {
    let count = 0;
    for (let c of string) {
        if (c === char) count++;
    }
    return count;
}

export default {
    components: { StructureViewer: () => __APP__ == "foldseek" ? import('./StructureViewer.vue') : null, Alignment },
    data: () => ({
        queryMap: null,
        targetMap: null,
        highlights: [],
        structureHighlights: [],
        isSelecting: false,
    }),
    props: {
        alignments: { type: Array, required: true, },
        lineLen: { type: Number, required: true, },
        hits: { type: Object }
    },
    computed: {
        hasSelection() {
            return !this.structureHighlights.some(e => e !== null);
        }
    },
    methods: {
        getFirstResidueNumber(map, i) {
            let start = this.lineLen * (i - 1);
            while (map[start] === null) start--;
            return map[start];
        },
        getQueryRowStartPos(alnIndex, i) { return this.getFirstResidueNumber(this.queryMaps[alnIndex], i) },
        getTargetRowStartPos(alnIndex, i) { return this.getFirstResidueNumber(this.targetMaps[alnIndex], i) },
        setEmptyHighlight() {
            this.highlights = this.alignments.map(a => new Array(Math.ceil(a.qAln.length / this.lineLen)).fill([undefined, undefined]))
        },
        setEmptyStructureHighlight() {
            this.structureHighlights = new Array(this.alignments.length).fill(null);
        },
        clearAllSelection() {
            this.setEmptyHighlight();
            this.setEmptyStructureHighlight();
        },
        setAlignmentSelection(selections) {
            // array per alignment, then array per line in alignment
            this.setEmptyHighlight();
            for (let [ alnId, startLine, startOffset, endLine, endOffset, _ ] of selections) {
                for (let i = startLine; i <= endLine; i++) {
                    if (i === startLine) {
                        this.highlights[alnId][i] = [startOffset, (i === endLine) ? endOffset : this.lineLen];
                    } else if (i === endLine) {
                        this.highlights[alnId][i] = [0, endOffset];
                    } else {
                        this.highlights[alnId][i] = [0, this.lineLen];
                    }
                }
            }
        },
        updateMaps() {
            if (!this.alignments) return
            this.queryMaps = [];
            this.targetMaps = [];
            for (let alignment of this.alignments) {
                this.queryMaps.push(makePositionMap(alignment.qStartPos, alignment.qAln));
                this.targetMaps.push(makePositionMap(alignment.dbStartPos, alignment.dbAln));
            }

        },
        onResidueSelectStart(event, alnIndex, lineNo) {
            this.isSelecting = true;
            document.querySelector(".alignment-wrapper-outer")
                .classList.add("inselection");
        },
        onResiduePointerUp(event, targetAlnIndex, targetLineNo) {
            if (!this.isSelecting) {
                // handle as click
                // this.highlights[targetAlnIndex].splice(targetLineNo - 1, 1, [undefined, undefined]);
                let a = this.alignments[targetAlnIndex];
                this.highlights.splice(targetAlnIndex, 1, new Array(Math.ceil(a.qAln.length / this.lineLen)).fill([undefined, undefined]));
                this.structureHighlights.splice(targetAlnIndex, 1, null);
                window.getSelection().removeAllRanges();
                return;
            }
            var selection = window.getSelection()
            
            // Get text and (sequence) starting position for each selected alignment
            let chunks = [];
            let chunk = "";
            let prevWrapper = null;
            let currWrapper = null;
            let lineNo = 0;
            let alnIndex = 0;
            let start = {};
            for (let i = 0; i < selection.rangeCount; i++) {
                let range = selection.getRangeAt(i);
                currWrapper = range.startContainer.parentElement.closest(".alignment-wrapper-inner");
                alnIndex = parseInt(currWrapper.id);
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
                        seqStart: this.getTargetRowStartPos(alnIndex, lineNo) + startOffset - countCharacter(preText, '-')
                    }
                } else if (currWrapper != prevWrapper) {
                    chunks.push([parseInt(prevWrapper.id), start, chunk]);
                    chunk = "";
                    prevWrapper = currWrapper;
                    let preText = range.startContainer.textContent.slice(0, startOffset);
                    start = {
                        startLine: lineNo,
                        startOffset: startOffset,
                        seqStart: this.getTargetRowStartPos(alnIndex, lineNo) + startOffset - countCharacter(preText, '-')
                    }
                }
                chunk += range.toString();
                start.endLine = lineNo;
                start.endOffset = endOffset;
            }
            chunks.push([parseInt(prevWrapper.id), start, chunk])

            // For structure: aln Id, start in sequence, selection length
            for (let [ alnId, { seqStart }, text ] of chunks) {
                this.structureHighlights.splice(alnId, 1, [seqStart, text.replace(/[-]/g, '').length]);
            }
            
            // For sequence: aln Id, line and start position (in start line), line and end position (in end line)
            this.setAlignmentSelection(chunks.map(([ alnId, { startLine, startOffset, endLine, endOffset }, chunk ]) => (
                [ alnId, startLine - 1, startOffset, endLine - 1, endOffset, chunk.length ]
            )));

            // Make everything else selectable again
            this.resetUserSelect();

            // Clear selection afterwards to prevent weird highlighting after inserting spans
            window.getSelection().removeAllRanges();
        },
        resetUserSelect() {
            this.isSelecting = false;
            let noselects = document.querySelectorAll(".inselection");
            noselects.forEach(el => { el.classList.remove("inselection") });
        }
    },
    watch: {
        'alignment': function() {
            this.updateMaps()
        }
    },
    beforeMount() {
        this.updateMaps()
        this.setEmptyHighlight();
        this.setEmptyStructureHighlight();
    },
}
</script>

<style scoped>
.alignment-panel {
    display: inline-flex;
    flex-wrap: nowrap;
    justify-content: center;
    width: 100%;
}

.alignment-wrapper-outer {
    display: inline-flex;
    flex-direction: column;
}

.alignment-wrapper-inner {
    padding-bottom: 1em;
}

.alignment-structure-wrapper {
    min-width:450px;
    margin: 0;
    margin-bottom: auto;
}

@media screen and (max-width: 960px) {
    .alignment-wrapper-outer, .alignment-panel  {
        display: flex;
    }
    .alignment-panel {
        flex-direction: column-reverse;
    }
    .alignment-structure-wrapper {
        padding-bottom: 1em;
    }

    .alignment-wrapper-outer, .alignment-structure-wrapper {
        align-self: center;
    }
}

@media screen and (min-width: 961px) {
    .alignment-structure-wrapper {
        padding-left: 2em;
    }
}

</style>

<style>
/* Some sort of banding thing here */
/* .alignment-wrapper-inner:nth-child(odd) span.selected {
    outline: 2px solid navy !important; 
} */
</style>
<template>
<div class="msa-wrapper" ref="msaWrapper" @mouseover="onMouseOver" @mouseleave="onMouseLeave">
    <div class="msa-block" v-for="([start, end], i) in blockRanges">
        <!-- <SequenceLogo
            :sequences="getEntryRanges(start, end, makeGradients=false)"
            :alphabet="alphabet"
            :lineLen="lineLen"
        /> -->
        <!--
            <div class="msa-row" v-for="({name, aa, ss, seqStart, css}, j) in getEntryRanges(start, end)">
        -->
        <template v-for="({name, aa, ss, indices, seqStart, css}, j) in getEntryRanges(start, end)">
            <span
                class="header"
                :title="name"
                :style="headerStyle(j)"
                @click="handleClickHeader($event, j)"
            >{{ name }}</span>
            <div class="sequence-wrapper" style="position: relative; z-index: 3;">
                <span class="sequence" :style="$vuetify.theme.dark ? css : {'color': sequenceColor, 'font-weight': fontWeight}" 
                >{{ alphabet == 'aa' ? aa : ss }}</span>
            </div>
            <div class="column-wrapper" v-if="j == 0"
                style="position: absolute; 
                height: 100%; display: flex;
                flex-direction: row; justify-content: center; align-items: center;
                grid-column: 2; user-select: none; 
                z-index: 5; transform: translateX(-2px);" 
                :style="{'width': 'calc((1ch + 4px) * ' + String(aa.length) +')'}"
            >
            <div v-for="(c, i) in indices" class="column-box" :data-index="c" :key="c" @click.stop="toggleHighlightColumn"></div>
            </div>
            <div class="row-wrapper" 
                style="position: absolute; 
                grid-column: 2; height: 1em; transform: translateX(-2px);" 
                :style="{'grid-row': j+1, 'width': 'calc((1ch + 4px) * ' + String(aa.length) +')'}"
            >
                <div class="row-block" style="width: 100%; height: 100%; z-index: 2;" :style="css"></div>
            </div>
            <span class="count">{{ countSequence(aa, seqStart).toString()  }}</span>
        </template>
        <!-- </div> -->
    </div>
</div>
</template>

<script>
import SequenceLogo from './SequenceLogo.vue';
import { debounce } from './Utilities.js';

const colorsAa = {
    "A": "#80A0F0FF",
    "R": "#F01505FF",
    "N": "#00FF00FF",
    "D": "#C048C0FF",
    "C": "#F08080FF",
    "Q": "#00FF00FF",
    "E": "#C048C0FF",
    "G": "#F09048FF",
    "H": "#15A4A4FF",
    "I": "#80A0F0FF",
    "L": "#80A0F0FF",
    "K": "#F01505FF",
    "M": "#80A0F0FF",
    "F": "#80A0F0FF",
    "P": "#FFD700FF",
    "S": "#00FF00FF",
    "T": "#00FF00FF",
    "W": "#80A0F0FF",
    "Y": "#15A4A4FF",
    "V": "#80A0F0FF",
    "B": "#FFFFFFFF",
    "X": "#FFFFFFFF",
    "Z": "#FFFFFFFF",
    "-": "#ffffff"
}

const colors3di = {
    "A": "#df9a8c",
    "C": "#fb72c5",
    "D": "#b4a3d8",
    "E": "#ff5701",
    "F": "#d99e81",
    "G": "#7491c5",
    "H": "#94abe1",
    "I": "#609d7b",
    "K": "#d7a304",
    "L": "#fe4c8b",
    "M": "#12a564",
    "N": "#d570fd",
    "P": "#cb99c4",
    "Q": "#da8e99",
    "R": "#9487d0",
    "S": "#e842fe",
    "T": "#42a299",
    "V": "#fb7edd",
    "W": "#d1a368",
    "Y": "#17a8fd",
    "X": "#c0c0c0",
    "-": "#ffffff"
}

export default {
    components: { SequenceLogo, SequenceLogo },
    data() {
        return {
            lineLen: 80,
            headerLen: null,
            countLen: null,
            resizeObserver: null,
            hoverTimer: null,
            activeColumn: "",
            pendingColumn: "",
            ticking: false,
        }
    },
    props: {
        matchRatio: Number,
        entries: Array,
        scores: Array,
        alnLen: Number,
        alphabet: String,
        mask: { type: Array },
        selectedStructures: { type: Array, required: false },
        referenceStructure: { type: Number },
        colorScheme: { type: String, default: 'lddt' },
        maxHeaderWidth: { type: Number, default: 30 },
        highlightedColumns: {type: Array},
    },
    mounted() {
        this.resizeObserver = new ResizeObserver(debounce(this.handleResize, 100)).observe(this.$refs.msaWrapper);
        this.handleUpdateEntries();
        this.handleResize();
        this.emitGradients();
    },
    updated() {
        this.handleResize();
        this.emitGradients();
    },
    beforeDestroy() {
        if (this.resizeObserver)
            this.resizeObserver.disconnect();
    },
    watch: {
        entries: function() {
            this.handleUpdateEntries();
        },
        lineLen: function() {
            this.$emit("lineLen", this.lineLen);
        },
        mask() {
            this.$nextTick(() => {
                setTimeout(() => {
                    for (let id in this.selectedColumns) {
                        this.$refs.msaWrapper
                            .querySelector(`.column-box[data-index="${id}"]`)
                            ?.classList.add('active-column')
                    }
                }, 0)
            })
        },
    },
    computed: {
        maskCumSum() {
            if (!this.mask) {
                return [];
            }

            const result = [];
            let sum = 0;
            for (let i = 0; i < this.mask.length; i++) {
                sum += this.mask[i] == 0;
                result.push(sum);
            }
            return result;
        },
        beforeMaskedIndices() {
            if (!this.mask) {
                return []
            }

            const res = []
            let idx = 0
            for (let v of this.mask) {
                if (v) {
                    res.push(idx)
                }
                idx++
            }
            return res
        },
        firstSequenceWidth() {
            const container = document.querySelector(".msa-block");
            if (!container)
                return 0
            const sequence = container.querySelector(".sequence");
            return sequence.scrollWidth;
        },
        blockRanges() {
            const maxVal = Math.max(1, Math.ceil(this.alnLen / this.lineLen));
            return Array.from({ length: maxVal }, (_, i) => {
                let start = i * this.lineLen;
                let end = Math.min(this.alnLen, i * this.lineLen + this.lineLen);
                return [start, end];
            });
        },
        backgroundClip() {
            return this.$vuetify.theme.dark ? 'text' : 'border-box';
        },
        sequenceColor() {
            return this.$vuetify.theme.dark ? 'transparent' : 'black';
        },
        fontWeight() {
            return this.$vuetify.theme.dark ? 'bolder' : 'normal';
        },
    },
    methods: {
        handleClickHeader(event, index) {
            if (this.selectedStructures.length === 0 || event.altKey) {
                this.$emit("newStructureReference", index);
            } else {
                this.$emit("newStructureSelection", index);
            }
        },
        getSequenceWidth() {
            const container = document.querySelector(".msa-block");
            const sequence  = container.querySelector(".sequence");
            return sequence.scrollWidth;
        },
        headerStyle(index) {
            const isSelected  = this.selectedStructures.length > 0 && this.selectedStructures.includes(index);
            const isReference = this.selectedStructures.length > 0 && this.referenceStructure === index;
            return {
                fontWeight: isSelected ? 'bold' : 'normal',                
                color: isReference
                    ? '#1E88E5'
                    : (isSelected
                        ? '#e6ac00'
                        : this.$vuetify.theme.dark ? 'rgba(180, 180, 180, 1)' : 'black'),
            }
        },
        handleUpdateEntries() {
            this.headerLen = 0;
            this.countLen = 0;
            this.entries.forEach((e, i) => {
                this.headerLen = Math.min(30, Math.max(this.headerLen, e.name.length));
                let count = 0;
                for (const char of e.aa) {
                    if (char !== '-') count++;
                }
                this.countLen = Math.max(this.countLen, count.toString().length);
            })
        },
        handleResize() {
            // Resize based on first row
            const container = document.querySelector(".msa-block");
            if (!container) {
                return
            }
            const header    = container.querySelector(".header");
            const count     = container.querySelector(".count");
            const sequence  = container.querySelector(".sequence");
            const containerWidth = container.offsetWidth - header.offsetWidth - count.offsetWidth - 32;
            
            // calculate #chars difference
            const content = sequence.textContent;
            const charDiff = Math.abs(Math.ceil(content.length * (sequence.scrollWidth - containerWidth) / sequence.scrollWidth));

            if (sequence.scrollWidth > containerWidth) {
                this.lineLen = Math.min(this.lineLen - charDiff, this.entries[0].aa.length);
            } else if (sequence.scrollWidth < containerWidth) {
                this.lineLen = Math.min(this.lineLen + charDiff, this.entries[0].aa.length);
            }
        },
        emitGradients() {
            const elements = document.getElementsByClassName("row-block"); 
            this.$emit(
                "cssGradients",
                Array.prototype.map.call(elements, element => element.style['background-image'])
            );
        },
        percentageToColor(percentage, maxHue = 120, minHue = 0) {
            if (percentage === -1) {
                return this.$vuetify.theme.dark ? 'rgba(180, 180, 180, 1)' : 'rgba(0, 0, 0, 0)';
            }
            const hue = percentage * (maxHue - minHue) + minHue;
            // const hue = (1 - percentage) * 120;
            // const lightness = this.$vuetify.theme.dark ? 50 : 30;
            return `hsl(${hue}, 100%, 50%)`;
        },
        getEntryRange(entry, start, end, makeGradients=true) {
            let result = {
                name: entry.name,
                aa: entry.aa.slice(start, end),
                ss: entry.ss.slice(start, end),
                indices: this.beforeMaskedIndices.slice(start, end),
                seqStart: 0
            };
            for (let i = 0; i < start; i++) {
                if (entry.aa[i] === '-') continue;
                result.seqStart++;
            }
            if (makeGradients) {
                result.css = this.generateCSSGradient(start, end, result.ss);
            }
            return result;
        },
        getEntryRanges(start, end, makeGradients=true) {
            return Array.from(this.entries, entry => this.getEntryRange(entry, start, end, makeGradients));
        },
        countSequence(sequence, start) {
            let gaps = sequence.split('-').length - 1;
            return start + this.lineLen - gaps;
        },
        generateCSSGradient(start, end, sequence) {
            if (!this.scores) {
                return null;
            }
            let colors = [];
            if (this.colorScheme === '3di') {
                for (const residue of sequence) {
                    colors.push(colors3di[residue]); 
                }
            } else {
                colors = this.scores
                    .slice(start, end)
                    .map(score => this.percentageToColor(parseFloat(score)));
            }
            for (let i = 0; i < sequence.length; i++) {
                if (sequence[i] === '-') {
                    colors[i] = this.$vuetify.theme.dark ? "rgba(100, 100, 100, 0.4)" : "rgba(0, 0, 0, 0)";
                }
            }
            
            const step = 100 / colors.length;
            let gradient = 'linear-gradient(to right';
            
            let preStep = 0;
            let curStep = step;
            for (let i = 0; i < colors.length; i++) {
                curStep = (i === colors.length - 1) ? 100 : preStep + step;
                gradient += `, ${colors[i]} ${preStep}%, ${colors[i]} ${curStep}%`;
                preStep = curStep;
            }
            gradient += ')';

            return {
                backgroundImage: gradient,
                // decrease width to account for weird font glyph spacing
                backgroundSize: `100% 100%`,
                backgroundPosition: 'left top',
                backgroundAttachment: 'scroll',
                backgroundClip: this.backgroundClip,
                color: this.sequenceColor,
                fontWeight: this.fontWeight,
            };
        },
        onMouseLeave() {
            this.resetPreviewState()
        },
        onMouseOver(event) {
            // console.log("fired");
            const target = event.target.closest('.column-box')
            if (!target) {
                this?.resetPreviewState()
                return
            }
            
            const id = target.dataset.index
            
            if (id) {
                this.pendingColumn = id
                if (!this?.ticking) {
                    this.ticking = true

                    window.requestAnimationFrame(() => {
                        this?.togglePreviewColumn()
                        this.ticking = false
                    })
                }
            } else {
                this?.resetPreviewState()
            }
        },
        setTimer(id) {
            const binded = this.activateColumn.bind(this)
            this.hoverTimer = setTimeout(() => {
                this.activeColumn = id
                binded(id)
            }, 1000)
        },
        clearTimer() {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer)
                this.hoverTimer = null
            }
            this.activeColumn = ""
        },
        togglePreviewColumn() {
            if (this.activateColumn == this.pendingColumn) return;

            this?.clearTimer()
            const wrapper = this.$refs.msaWrapper

            // remove active column
            const arr = wrapper?.querySelectorAll('.preview-column')
            arr?.forEach(e => e.classList.remove('preview-column'))
            this.$emit('changePreview', -1)

            this.setTimer(this.pendingColumn)
        },
        resetPreviewState() {
            this.clearTimer()
            const wrapper = this.$refs.msaWrapper

            const arr = wrapper?.querySelectorAll('.preview-column')
            arr?.forEach(e => e.classList.remove('preview-column'))
            this.$emit('changePreview', -1)
        },
        activateColumn(id) {
            const wrapper = this.$refs.msaWrapper

            wrapper?.querySelector(`.column-box[data-index="${id}"]`)?.classList.add('preview-column')
            
            this.$emit('changePreview', id)
        },
        toggleHighlightColumn(event) {
            const value = event.target.classList.contains('active-column')
            if (value) {
                this.$emit('removeHighlight', Number(event.target.dataset.index))
            } else {
                this.$emit('addHighlight', Number(event.target.dataset.index))
            }
        },
        addHighlightColumn(idx) {
            const wrapper = this.$refs.msaWrapper
            wrapper?.querySelector(`.column-box[data-index="${idx}"]`)?.classList.add('active-column')
        },
        removeHighlightColumn(idx) {
            const wrapper = this.$refs.msaWrapper
            wrapper?.querySelector(`.column-box[data-index="${idx}"]`)?.classList.remove('active-column')
        },
        clearHighlightColumns() {
            const wrapper = this.$refs.msaWrapper
            const arr = wrapper?.querySelectorAll('.active-column')
            for (let el of arr) {
                el.classList.remove('active-column')
            }
        },
    },
}
</script>

<style>
.msa-wrapper {
    padding: 16px; /* equivalent to pa-4 */
    display: flex;
    flex-direction: column;
    font-family: monospace;
    white-space: nowrap;
    width: 100%;
    user-select: none;
}
.msa-block {
    margin-bottom: 1.5em;
    display: grid;
    grid-template-columns: fit-content(20%) 5fr auto;
    grid-auto-rows: 1em;
    width: 100%;
    justify-content: space-between;
    gap: 0px 16px;
    line-height: 1em;
    position: relative;
}
.msa-block:last-child {
    margin-bottom: 0;
}
.msa-block .sequence {
    display: inline-block;
    padding: 0px;
    margin: 0px;
    letter-spacing: 4px;
    color: transparent;
    z-index: 0;
}
.msa-block .sequence::selection, .msa-block .sequence strong {
    background: #11FFEE;
    color: #111;
}
.msa-row {
    display: contents;
/*     padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: fit-content(20%) 5fr auto;
    width: 100%;
    justify-content: space-between;
    gap: 16px;
    line-height: 1em; */
}
.sequence-wrapper {
    overflow: hidden;
    align-content: left;
    align-items: center;
    display: flex;
    flex-grow: 1;
    text-align: left;
}
.sequence {
    margin-left: auto;
    margin: 0;
    padding: 0;
    line-height: 1em;
}
.header {
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
}
.header:hover {
    cursor: pointer;
}
.count {
    text-align: right;
}
.column-box {
    position: relative;
    width: calc(1ch + 4px);
    display: block;
    height: 100%;
    user-select: none;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.4s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.column-box::before {
    content: "";
    position: absolute;
    width: 0;
    height: 0;
    left: calc(50% - 4px);
    top: -12px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 6px solid rgba(0, 0, 0, 0.7);
    opacity: 0;
    transition: opacity 0.4s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.column-box.preview-column:not(.active-column) {
    background-color: rgba(0, 0, 0, 0.3);
}

.column-box.active-column {
    background-color: rgba(0, 0, 0, 0.5);
}

.column-box.preview-column:not(.active-column)::before {
    opacity: 0.5;
}

.column-box.active-column::before {
    opacity: 1;
}

/* .column-box:nth-child(odd) {
    background-color: rgba(0,0,0,0.05);
}
.column-box:nth-child(even) {
    background-color: transparent;
} */
.column-box:hover {
    box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.5);
}
.column-box:not(.active-column):active {
    background-color: rgba(0, 0, 0, 0.4);
}

.column-box.active-column:active {
    background-color: rgba(0, 0, 0, 0.5);
}

.theme--dark .column-box:hover {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.theme--dark .column-box.preview-column:not(.active-column) {
    background-color: rgba(255, 255, 255, 0.2);
}

.theme--dark .column-box:not(.active-column):active {
    background-color: rgba(255, 255, 255, 0.3);
}

.theme--dark .column-box.active-column {
    background-color: rgba(255, 255, 255, 0.4);
}
.theme--dark .column-box.active-column:active {
    background-color: rgba(255, 255, 255, 0.5);
}

.theme--dark .column-box::before {
    border-top: 6px solid rgba(255, 255, 255, 0.7);
}

.theme--dark .column-box.preview-column:not(.active-column)::before {
    opacity: 0.5;
}

.theme--dark .column-box.active-column::before {
    opacity: 1;
}
</style>
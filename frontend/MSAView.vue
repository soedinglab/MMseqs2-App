<template>
<div class="msa-wrapper" ref="msaWrapper">
    <div class="msa-block" v-for="([start, end], i) in blockRanges">
        <!-- <SequenceLogo
            :sequences="getEntryRanges(start, end, makeGradients=false)"
            :alphabet="alphabet"
            :lineLen="lineLen"
        /> -->
        <div class="msa-row" v-for="({name, aa, ss, seqStart, css}, j) in getEntryRanges(start, end)">
            <span
                class="header"
                :style="headerStyle(j)"
                @click="handleClickHeader($event, j)"
            >{{ name.padStart(headerLen, '&nbsp') }}</span>
            <div class="sequence-wrapper">
                <span class="sequence" :style="css">{{ alphabet === 'aa' ? aa : ss }}</span>
            </div>
            <span class="count">{{ countSequence(aa, seqStart).toString().padStart(countLen, '&nbsp')  }}</span>
        </div>
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
            mask: [],
            lineLen: 80,
            headerLen: null,
            countLen: null,
            resizeObserver: null,
        }
    },
    props: {
        matchRatio: Number,
        entries: Array,
        scores: Array,
        alnLen: Number,
        alphabet: String,
        selectedStructures: { type: Array, required: false },
        referenceStructure: { type: Number },
        colorScheme: { type: String, default: 'lddt' }
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
    },
    computed: {
        firstSequenceWidth() {
            const container = document.querySelector(".msa-row");
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
            if (event.altKey) {
                this.$emit("newStructureReference", index);
            } else {
                this.$emit("newStructureSelection", index);
            }
        },
        getSequenceWidth() {
            const container = document.querySelector(".msa-row");
            const sequence  = container.querySelector(".sequence");
            return sequence.scrollWidth;
        },
        headerStyle(index) {
            const isSelected  = this.selectedStructures.length > 0 && this.selectedStructures.includes(index);
            const isReference = this.selectedStructures.length > 0 && this.selectedStructures[this.referenceStructure] === index;
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
                this.headerLen = Math.max(this.headerLen, e.name.length);
                let count = 0;
                for (const char of e.aa) {
                    if (char !== '-') count++;
                }
                this.countLen = Math.max(this.countLen, count.toString().length);
            })
        },
        handleResize() {
            // Resize based on first row
            const container = document.querySelector(".msa-row");
            if (!container) {
                return
            }
            const header    = container.querySelector(".header");
            const count     = container.querySelector(".count");
            const sequence  = container.querySelector(".sequence");
            const containerWidth = container.offsetWidth - header.scrollWidth - count.scrollWidth - 32;
            
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
            const elements = document.getElementsByClassName("sequence"); 
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
                backgroundSize: `calc(100% - 2px) 100%`,
                backgroundPosition: 'left top',
                backgroundAttachment: 'scroll',
                backgroundClip: this.backgroundClip,
                color: this.sequenceColor,
                fontWeight: this.fontWeight,
            };
        }
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
    /* line-height: 1.2em; */
}
.msa-block {
    margin-bottom: 1.5em;
}
.msa-block:last-child {
    margin-bottom: 0;
}
.msa-block .sequence, .msa-block .sequence-ss {
    display: inline-block;
    padding: 0px;
    margin: 0px;
    letter-spacing: 4px;
    color: transparent;
    z-index: 0;
}
.msa-block .sequence::selection {
  background: rgba(100, 100, 255, 1);
  color: white;
}
.msa-row {
    padding: 0;
    margin: 0;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    line-height: 1em;
}
.header, .count {
    flex-shrink: 0;
    flex-grow: 0;
    white-space: nowrap;
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
.msa-block .sequence-ss::selection {
  background: rgba(100, 100, 255, 1);
  color: white;
}
.header:hover {
    cursor: pointer;
}
</style>
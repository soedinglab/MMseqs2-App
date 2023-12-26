<template>
<div class="msa-wrapper">
    <div class="msa-block" v-for="([start, end], i) in blockRanges">
        <!-- <SequenceLogo
            :sequences="getEntryRanges(start, end, makeGradients=false)"
            :alphabet="alphabet"
            :lineLen="lineLen"
        /> -->
        <div class="msa-row" v-for="({name, aa, ss, css}, j) in getEntryRanges(start, end)">
            <span
                class="header"
                :style="headerStyle(j)"
                @click="handleClickHeader($event, j)"
            >{{ name.padStart(headerLen, '&nbsp') }}</span>
            <div class="sequence-wrapper">
                <span class="sequence" :style="css">{{ alphabet === 'aa' ? aa : ss }}</span>
            </div>
            <span class="count"   >{{ countSequence(i, aa, start, end).toString().padStart(countLen, '&nbsp')  }}</span>
        </div>
    </div>
</div>
</template>

<script>
import SequenceLogo from './SequenceLogo.vue';
import { debounce } from './Utilities.js';

export default {
    components: { SequenceLogo, SequenceLogo },
    data() {
        return {
            mask: [],
            lineLen: 80,
            headerLen: null,
            countLen: null,
        }
    },
    props: {
        matchRatio: Number,
        entries: Array,
        scores: Array,
        alnLen: Number,
        alphabet: String,
        selectedStructures: { type: Array, required: false },
        referenceStructure: { type: Number }
    },
    mounted() {
        window.addEventListener('resize', debounce(this.handleResize, 100));
        this.handleUpdateEntries();
        this.handleResize();
        this.emitGradients();
    },
    updated() {
        this.handleResize();
        this.emitGradients();
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.handleResize);
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
                        ? this.$vuetify.theme.dark ? 'lightBlue' : '#e6ac00'
                        : this.$vuetify.theme.dark ? 'rgba(180, 180, 180, 1)' : 'black'),
            }
        },
        handleUpdateEntries() {
            this.headerLen = 0;
            this.countLen = 0;
            this.entries.forEach(e => {
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
            const header    = container.querySelector(".header");
            const count     = container.querySelector(".count");
            const sequence  = container.querySelector(".sequence");
            const containerWidth = container.offsetWidth - header.scrollWidth - count.scrollWidth - 32;
            
            // calculate #chars difference
            const content = sequence.textContent;
            const charDiff = Math.abs(Math.ceil(content.length * (sequence.scrollWidth - containerWidth) / sequence.scrollWidth));

            if (sequence.scrollWidth > containerWidth) {
                this.lineLen -= charDiff;
            } else if (sequence.scrollWidth < containerWidth) {
                this.lineLen += charDiff;                
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
                ss: entry.ss.slice(start, end)
            };
            if (makeGradients)
                result.css = this.generateCSSGradient(start, end, result.aa);
            return result;
        },
        getEntryRanges(start, end, makeGradients=true) {
            return Array.from(this.entries, entry => this.getEntryRange(entry, start, end, makeGradients));
        },
        countSequence(blockIndex, sequence) {
            let gaps = sequence.split('-').length - 1;
            return blockIndex * this.lineLen + this.lineLen - gaps;
        },
        generateCSSGradient(start, end, sequence) {
            if (!this.scores) {
                return null;
            }
            const colours = this.scores
                .slice(start, end)
                .map(score => this.percentageToColor(parseFloat(score)));;
            
            for (let i = 0; i < sequence.length; i++) {
                if (sequence[i] === '-') {
                    colours[i] = this.$vuetify.theme.dark ? "rgba(100, 100, 100, 0.4)" : "rgba(0, 0, 0, 0)";
                    // colours[i] = "rgba(0, 0, 0, 0)";
                }
            }

            const step = 100 / colours.length;
            let gradient = 'linear-gradient(to right';
            
            let preStep = 0;
            let curStep = step;
            for (let i = 0; i < colours.length; i++) {
                curStep = (i === colours.length - 1) ? 100 : preStep + step;
                gradient += `, ${colours[i]} ${preStep}%, ${colours[i]} ${curStep}%`;
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
    line-height: 1.2em;
}
.msa-block {
    margin-bottom: 1em;
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
.msa-block .sequence::selection {
  background: rgba(100, 100, 255, 1);
  color: white;
}
.msa-row {
    padding: 0;
    margin: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}
.header, .count {
    flex: 0 0 auto;
    white-space: nowrap;
}
.sequence-wrapper {
    width: 100%;
    flex: grow;
    overflow: hidden;
    align-content: left;
}
.sequence {
    margin-left: auto;
}
.header:hover {
    cursor: pointer;
}
</style>
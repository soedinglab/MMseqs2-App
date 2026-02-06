<template>
<div class="msa-wrapper" ref="msaWrapper" @mouseover="onMouseOver" @mouseleave="onMouseLeave">
    <div v-for="([start, end], i) in blockRanges" class="msa-block-wrapper">
        <div class="msa-block">
            <span class="conservation-label">Conservation</span>
            <svg
                class="conservation-track"
                :viewBox="`0 0 ${end - start} ${conservationHeight}`"
                :style="{
                    gridColumn: 2,
                    gridRow: 1,
                    width: 'calc((1ch + 4px) * ' + String(end - start) + ')',
                    height: conservationHeight + 'px',
                    transform: 'translateX(-2px)'
                }"
                preserveAspectRatio="none"
            >
                <path :d="conservationPath(getConservationRange(start, end))" />
                <g :transform="`scale(${1 / conservationScaleX}, 1)`">
                    <text
                        v-for="(idx) in getConservationMaxCols(start, end)"
                        :key="`cons-max-${i}-${idx}`"
                        class="conservation-max"
                        :x="(idx + 0.5) * conservationScaleX"
                        y="0"
                        text-anchor="middle"
                        dominant-baseline="hanging"
                    >*</text>
                </g>
            </svg>
        <!-- <SequenceLogo
            :sequences="getEntryRanges(start, end, makeGradients=false)"
            :alphabet="alphabet"
            :lineLen="lineLen"
        /> -->
        <template v-for="({ name, aa, ss, indices, seqStart, css }, j) in getEntryRanges(start, end)">
            <span class="header" :title="name" :style="headerStyle(j)" @click="handleClickHeader($event, j)">{{
                name }}</span>
            <div class="sequence-wrapper" :style="sequenceStyle(j)">
                <span class="sequence"
                    :style="$vuetify.theme.dark ? css : { 'color': sequenceColor, 'font-weight': fontWeight }">{{
                    alphabet == 'aa' ? aa : ss }}</span>
            </div>
            <div class="column-wrapper" v-if="j == 0"
                :style="{ 'width': 'calc((1ch + 4px) * ' + String(aa.length) + ')' }">
                <div v-for="(c, i) in indices" class="column-box" :data-index="c" :key="c"
                    @click.stop="toggleHighlightColumn">
                    <div v-for="v in entryLength" class="column-box-cell"
                        :title="actualResno.length > 0 ? actualResno[v - 1][c] : ''"></div>
                </div>
            </div>
            <div class="row-wrapper"
                :style="{ 'grid-row': j + 2, 'width': 'calc((1ch + 4px) * ' + String(aa.length) + ')' }">
                <div class="row-block" :style="css"></div>
            </div>
            <span class="count" :style="countStyle(j)">{{ countSequence(aa, seqStart).toString() }}</span>
        </template>
        </div>
    </div>
</div>
</template>

<script>
import SequenceLogo from './SequenceLogo.vue';
import { debounce } from './Utilities.js';

const aaToIndex = {
    A: 0, B: 2, C: 1, D: 2, E: 3, F: 4, G: 5, H: 6, I: 7, J: 20, K: 8, L: 9, M: 10,
    N: 11, O: 20, P: 12, Q: 13, R: 14, S: 15, T: 16, U: 1, V: 17, W: 18, X: 20,
    Y: 19, Z: 3, "-": 21,
};

const propertyMatrix = [
    [1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 1, 1],
    [0, 1, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
    [0, 1, 1, 0, 1, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const colorsAaByPalette = {
    "3di": {
        A: "#DF9A8C", C: "#FB72C5", D: "#B4A3D8", E: "#FF5701", F: "#D99E81",
        G: "#7491C5", H: "#94ABE1", I: "#609D7B", K: "#D7A304", L: "#FE4C8B",
        M: "#12A564", N: "#D570FD", P: "#CB99C4", Q: "#DA8E99", R: "#9487D0",
        S: "#E842FE", T: "#42A299", V: "#FB7EDD", W: "#D1A368", Y: "#17A8FD",
        X: "#C0C0C0", "-": "#FFFFFF"
    },
    clustal: {
        A: "#FFA500", R: "#FF0000", N: "#FFFFFF", D: "#FF0000", C: "#008000",
        Q: "#FFFFFF", E: "#FF0000", G: "#FFA500", H: "#FF0000", I: "#008000",
        L: "#008000", K: "#FF0000", M: "#008000", F: "#2555D9", P: "#FFA500",
        S: "#FFA500", T: "#FFA500", W: "#2555D9", Y: "#2555D9", V: "#008000",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff"
    },
    clustal2: {
        A: "#80A0F0", R: "#F01505", N: "#00FF00", D: "#C048C0", C: "#F08080",
        Q: "#00FF00", E: "#C048C0", G: "#F09048", H: "#15A4A4", I: "#80A0F0",
        L: "#80A0F0", K: "#F01505", M: "#80A0F0", F: "#80A0F0", P: "#FFD700",
        S: "#00FF00", T: "#00FF00", W: "#80A0F0", Y: "#15A4A4", V: "#80A0F0",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff",
    },
    buried: {
        A: "#00A35C", R: "#00FC03", N: "#00EB14", D: "#00EB14", C: "#2555D9",
        Q: "#00F10E", E: "#00F10E", G: "#009D62", H: "#00D52A", I: "#0054AB",
        L: "#007B84", K: "#00FF00", M: "#009768", F: "#008778", P: "#00E01F",
        S: "#00D52A", T: "#00DB24", W: "#00A857", Y: "#00E619", V: "#005FA0",
        B: "#00EB14", X: "#00B649", Z: "#00F10E", "-": "#ffffff",
    },
    cinema: {
        A: "#BBBBBB", R: "#00FFFF", N: "#008000", D: "#FF0000", C: "#FFD700",
        Q: "#008000", E: "#FF0000", G: "#A52A2A", H: "#00FFFF", I: "#BBBBBB",
        L: "#BBBBBB", K: "#00FFFF", M: "#BBBBBB", F: "#FF00FF", P: "#A52A2A",
        S: "#008000", T: "#008000", W: "#FF00FF", Y: "#FF00FF", V: "#BBBBBB",
        B: "#808080", X: "#808080", Z: "#808080", "-": "#ffffff",
    },
    clustal: {
        A: "#FFA500", R: "#FF0000", N: "#FFFFFF", D: "#FF0000", C: "#008000",
        Q: "#FFFFFF", E: "#FF0000", G: "#FFA500", H: "#FF0000", I: "#008000",
        L: "#008000", K: "#FF0000", M: "#008000", F: "#2555D9", P: "#FFA500",
        S: "#FFA500", T: "#FFA500", W: "#2555D9", Y: "#2555D9", V: "#008000",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff",
    },
    helix: {
        A: "#E718E7", R: "#6F906F", N: "#1BE41B", D: "#778877", C: "#23DC23",
        Q: "#926D92", E: "#FF00FF", G: "#00FF00", H: "#758A75", I: "#8A758A",
        L: "#AE51AE", K: "#A05FA0", M: "#EF10EF", F: "#986798", P: "#00FF00",
        S: "#36C936", T: "#47B847", W: "#8A758A", Y: "#21DE21", V: "#857A85",
        B: "#49B649", X: "#758A75", Z: "#C936C9", "-": "#ffffff",
    },
    hydrophobicity: {
        A: "#AD0052", R: "#2555D9", N: "#0C00F3", D: "#0C00F3", C: "#C2003D",
        Q: "#0C00F3", E: "#0C00F3", G: "#6A0095", H: "#1500EA", I: "#FF0000",
        L: "#EA0015", K: "#2555D9", M: "#B0004F", F: "#CB0034", P: "#4600B9",
        S: "#5E00A1", T: "#61009E", W: "#5B00A4", Y: "#4F00B0", V: "#F60009",
        B: "#0C00F3", X: "#680097", Z: "#0C00F3", "-": "#ffffff",
    },
    lesk: {
        A: "#FFA500", R: "#FF0000", N: "#FF00FF", D: "#FF0000", C: "#008000",
        Q: "#FF00FF", E: "#FF0000", G: "#FFA500", H: "#FF00FF", I: "#008000",
        L: "#008000", K: "#FF0000", M: "#008000", F: "#008000", P: "#008000",
        S: "#FFA500", T: "#FFA500", W: "#008000", Y: "#008000", V: "#008000",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff",
    },
    mae: {
        A: "#77DD88", R: "#FFCC77", N: "#55BB33", D: "#55BB33", C: "#99EE66",
        Q: "#55BB33", E: "#55BB33", G: "#77DD88", H: "#5555FF", I: "#66BBFF",
        L: "#66BBFF", K: "#FFCC77", M: "#66BBFF", F: "#9999FF", P: "#EEAAAA",
        S: "#FF4455", T: "#FF4455", W: "#9999FF", Y: "#9999FF", V: "#66BBFF",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff",
    },
    strand: {
        A: "#5858A7", R: "#6B6B94", N: "#64649B", D: "#2121DE", C: "#9D9D62",
        Q: "#8C8C73", E: "#2555D9", G: "#4949B6", H: "#60609F", I: "#ECEC13",
        L: "#B2B24D", K: "#4747B8", M: "#82827D", F: "#C2C23D", P: "#2323DC",
        S: "#4949B6", T: "#9D9D62", W: "#C0C03F", Y: "#D3D32C", V: "#FFD700",
        B: "#4343BC", X: "#797986", Z: "#4747B8", "-": "#ffffff",
    },
    taylor: {
        A: "#CCFF00", R: "#2555d9", N: "#CC00FF", D: "#FF0000", C: "#FFD700",
        Q: "#FF00CC", E: "#FF0066", G: "#FF9900", H: "#7d98e8", I: "#66FF00",
        L: "#33FF00", K: "#6600FF", M: "#00FF00", F: "#00FF66", P: "#FFCC00",
        S: "#FF3300", T: "#FF6600", W: "#00CCFF", Y: "#00FFCC", V: "#99FF00",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff",
    },
    turn: {
        A: "#2CD3D3", R: "#708F8F", N: "#FF0000", D: "#E81717", C: "#A85757",
        Q: "#3FC0C0", E: "#778888", G: "#FF0000", H: "#708F8F", I: "#00FFFF",
        L: "#1CE3E3", K: "#7E8181", M: "#1EE1E1", F: "#1EE1E1", P: "#F60909",
        S: "#E11E1E", T: "#738C8C", W: "#738C8C", Y: "#9D6262", V: "#07F8F8",
        B: "#F30C0C", X: "#7C8383", Z: "#5BA4A4", "-": "#ffffff",
    },
    zappo: {
        A: "#FFAFAF", R: "#6464FF", N: "#00FF00", D: "#FF0000", C: "#FFD700",
        Q: "#00FF00", E: "#FF0000", G: "#FF00FF", H: "#6464FF", I: "#FFAFAF",
        L: "#FFAFAF", K: "#6464FF", M: "#FFAFAF", F: "#FFC800", P: "#FF00FF",
        S: "#00FF00", T: "#00FF00", W: "#FFC800", Y: "#FFC800", V: "#FFAFAF",
        B: "#FFFFFF", X: "#FFFFFF", Z: "#FFFFFF", "-": "#ffffff",
    },
};

export default {
    components: { SequenceLogo, SequenceLogo },
    data() {
        return {
            lineLen: 80,
            resizeObserver: null,
            hoverTimer: null,
            activeColumn: "",
            pendingColumn: "",
            ticking: false,
            actualResno: [],
            sequenceLogoHeight: 45,
            conservationHeight: 45,
            conservationScaleX: 2,
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
        highlightedColumns: function(newColumns) {
            this.$nextTick(() => {
                this.clearHighlightColumns();
                if (!newColumns || newColumns.length === 0) {
                    return;
                }
                for (const idx of newColumns) {
                    this.addHighlightColumn(idx, false);
                }
            });
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
        entryLength() {
            return this.entries ? this.entries.length : 0
        },
        conservationValues() {
            if (!this.entries || this.entries.length === 0) {
                return [];
            }
            const residueThreshold = 3;
            const gapsThreshold = 25;
            const seqCount = this.entries.length;
            const length = this.entries[0].aa.length;
            const numAminoAcids = 22;
            const countMatrix = Array.from({ length }, () => new Array(numAminoAcids).fill(0));

            for (const entry of this.entries) {
                const seq = entry.aa;
                for (let i = 0; i < length; i++) {
                    const residue = seq[i] ? seq[i].toUpperCase() : "X";
                    const idx = aaToIndex[residue] !== undefined ? aaToIndex[residue] : 20;
                    countMatrix[i][idx] += 1;
                }
            }

            const resThreshold = Math.floor(((seqCount * residueThreshold) / 100) + 0.5);
            for (let i = 0; i < length; i++) {
                for (let aa = 0; aa < numAminoAcids; aa++) {
                    if (countMatrix[i][aa] < resThreshold) {
                        countMatrix[i][aa] = 0;
                    }
                }
            }

            const scores = new Array(length).fill(0);
            for (let i = 0; i < length; i++) {
                const gapPercentage = (countMatrix[i][21] * 100) / seqCount;
                if (gapPercentage >= gapsThreshold) {
                    scores[i] = 0;
                    continue;
                }

                const aminoAcidIndices = [];
                for (let aa = 0; aa < numAminoAcids; aa++) {
                    if (countMatrix[i][aa] > 0) {
                        aminoAcidIndices.push(aa);
                    }
                }

                if (aminoAcidIndices.length === 0) {
                    scores[i] = 0;
                    continue;
                }

                let score = 0;
                const propertyCount = propertyMatrix[0].length;
                for (let prop = 0; prop < propertyCount; prop++) {
                    let allZero = true;
                    let allOne = true;
                    for (const aaIdx of aminoAcidIndices) {
                        const value = propertyMatrix[aaIdx][prop];
                        if (value !== 0) {
                            allZero = false;
                        }
                        if (value !== 1) {
                            allOne = false;
                        }
                    }
                    if (allZero || allOne) {
                        score += 1;
                    }
                }
                scores[i] = score;
            }

            return scores;
        }
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
                gridRow: index + 2,
                fontWeight: isSelected ? 'bold' : 'normal',                
                color: isReference
                    ? '#1E88E5'
                    : (isSelected
                        ? '#e6ac00'
                        : this.$vuetify.theme.dark ? 'rgba(180, 180, 180, 1)' : 'black'),
            }
        },
        sequenceStyle(index) {
            return { gridRow: index + 2 };
        },
        countStyle(index) {
            return { gridRow: index + 2 };
        },
        getConservationMaxCols(start, end) {
            const maxScore = propertyMatrix[0].length;
            const result = [];
            const values = this.conservationValues.slice(start, end);
            for (let i = 0; i < values.length; i++) {
                if (values[i] >= maxScore) {
                    result.push(i);
                }
            }
            return result;
        },
        getConservationRange(start, end) {
            return this.conservationValues.slice(start, end);
        },
        conservationPath(values) {
            if (!values || values.length === 0) {
                return "";
            }
            const maxScore = propertyMatrix[0].length;
            if (maxScore === 0) {
                return "";
            }
            const topOffset = 12;
            const height = this.conservationHeight - topOffset;
            const base = topOffset + height;
            let d = "";
            for (let i = 0; i < values.length; i++) {
                const normalized = values[i] / maxScore;
                const clamped = Math.max(0, Math.min(1, normalized));
                const y = base - (clamped * height);
                const x0 = i;
                const x1 = i + 1;
                d += ` M${x0} ${base} L${x0} ${y} L${x1} ${y} L${x1} ${base} Z`;
            }
            return d;
        },
        handleUpdateEntries() {
            this.actualResno.length = 0
            this.entries.forEach((e, i) => {
                let acc = 0
                const nums = [...e.aa].map((c, j) => {
                    if (c !== '-') return c + String(++acc)
                    else return ""
                })
                this.actualResno.push(nums)
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
            if (sequence && sequence.textContent.length > 0) {
                this.conservationScaleX = Math.max(1, sequence.scrollWidth / sequence.textContent.length);
            }
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
                result.css = this.generateCSSGradient(start, end, result.aa, result.ss);
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
        generateCSSGradient(start, end, aaSequence, ssSequence) {
            if (!this.scores) {
                return null;
            }
            let colors = [];
            const palette = colorsAaByPalette[this.colorScheme];
            if (palette) { 
                const paletteSequence = (this.colorScheme === "3di" && ssSequence) ? ssSequence : aaSequence;
                const fallbackColor = palette.X || "#ffffff";
                for (const residue of paletteSequence) {
                    const key = residue ? residue.toUpperCase() : residue;
                    colors.push(palette[key] || fallbackColor);
                }
            } else {
                colors = this.scores
                    .slice(start, end)
                    .map(score => this.percentageToColor(parseFloat(score)));
            }
            for (let i = 0; i < aaSequence.length; i++) {
                if (aaSequence[i] === '-') {
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
            if (this.activeColumn == this.pendingColumn) return;

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
        activateColumn(id, fromUpward=false, move=false) {
            const wrapper = this.$refs.msaWrapper
            
            const arr = wrapper?.querySelectorAll('.preview-column')
            arr?.forEach(e => e.classList.remove('preview-column'))

            const el = wrapper?.querySelector(`.column-box[data-index="${id}"]`)
            el?.classList.add('preview-column')
            if (move) {
                if (el) {
                window.scrollTo({
                    top: el.getBoundingClientRect().top + window.scrollY - (180),
                    left: 0,
                    behavior: 'smooth'
                })}
            } else if (!fromUpward) {
                this.$emit('changePreview', id)
            }
        },
        toggleHighlightColumn(event) {
            const parent = event.target.closest('.column-box')
            if (!parent) return

            const value = parent.classList.contains('active-column')
            if (value) {
                this.$emit('removeHighlight', Number(parent.dataset.index))
            } else {
                this.$emit('addHighlight', Number(parent.dataset.index))
            }
        },
        addHighlightColumn(idx, move) {
            const wrapper = this.$refs.msaWrapper
            const el = wrapper?.querySelector(`.column-box[data-index="${idx}"]`)
            el?.classList.add('active-column')
            if (move && el) {
                window.scrollTo({
                    top: el.getBoundingClientRect().top + window.scrollY - (180),
                    left: 0,
                    behavior: 'smooth'
                })
            }
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
.msa-block-wrapper {
    margin-bottom: 1.5em;
}
.msa-block {
    --conservation-height: 45px;
    --conservation-gap: 0.3em;
    display: grid;
    grid-template-columns: fit-content(20%) 5fr auto;
    grid-template-rows: calc(var(--conservation-height) + var(--conservation-gap));
    grid-auto-rows: 1em;
    width: 100%;
    justify-content: space-between;
    gap: 0px 16px;
    line-height: 1em;
    position: relative;
}
.msa-block-wrapper:last-child {
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
.conservation-track {
    height: var(--conservation-height);
    margin-bottom: var(--conservation-gap);
    align-self: end;
    transform: translateX(-2px);
}
.conservation-track path {
    fill: rgba(30, 136, 229, 0.3);
    stroke: rgba(30, 136, 229, 0.7);
    vector-effect: non-scaling-stroke;
    stroke-width: 1.5;
    stroke-linejoin: miter;
    stroke-linecap: butt;
}
.conservation-max {
    fill: #e53935;
    font-size: 20px;
    font-weight: 600;
}
.conservation-label {
    grid-column: 1;
    grid-row: 1;
    align-self: end;
    line-height: 1em;
    font-size: 12px;
    color: rgba(180, 180, 180, 0.9);
    padding-bottom: var(--conservation-gap);
}
.msa-row {
    display: contents;
}
.sequence-wrapper {
    position: relative;
    z-index: 3;
    overflow: hidden;
    align-content: left;
    align-items: center;
    display: flex;
    flex-grow: 1;
    text-align: left;
}
.column-wrapper {
    position: absolute;
    top: calc(var(--conservation-height) + var(--conservation-gap));
    height: calc(100% - var(--conservation-height) - var(--conservation-gap));
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    grid-column: 2;
    user-select: none;
    z-index: 5;
    transform: translateX(-2px);
}
.column-box-cell {
    width: 100%;
    height: 1em;
}
.row-wrapper {
    position: absolute;
    grid-column: 2;
    height: 1em;
    transform: translateX(-2px);
}
.row-block {
    width: 100%;
    height: 100%;
    z-index: 2;
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

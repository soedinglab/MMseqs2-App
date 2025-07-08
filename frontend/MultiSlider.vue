<template>
    <div
    class="v-multi-slider"
    :class="{'v-input--disabled': disabled}"
    :style="{
        '--multi-slider-background-color': backgroundColor,
        '--multi-slider-contrast-color':
        'lch(from var(--multi-slider-background-color) calc((49.44 - l) * infinity) 0 0)'
    }"
    >
        <div class="v-multi-slider__track-container" ref="track" aria-hidden="true">
            <div
            v-for="(segment, idx) in segments"
            :key="idx"
            class="v-multi-slider__track-segment"
            :style="getTrackStyle(segment.start, segment.end)"
            ></div>
        </div>
        <div
            class="v-multi-slider__thumb"
            v-for="(val, idx) in normalized"
            :key="idx"
            :class="{ active: selectedIndices.includes(idx) }"
            :style="thumbStyle(val)"
            @click="toggleSelection(idx)">
            <span class="v-multi-slider__thumb-label">{{ flat_chain[idx] + flat_pos[idx] }}</span>
        </div>
        </div>
</template>

<script>
export default {
    name: 'MultiSlider',
    model: {
        prop: 'value',
        event: 'input'
    },
    props: {
        // bits string
        value: {
            type: String,
            default: ''
        },
        // object of chains with numeric positions
        values: {
            type: Object,
            default: () => []
        },
        disabled: {
            type: Boolean,
            default: false
        },
        // minimum spacing between knobs in percent
        minSpacing: {
            type: Number,
            default: 4
        },
        // color for filled segments and active thumb
        backgroundColor: {
            type: String,
            default: '#3f51b5'
        }
    },
    data() {
        return {
            selectedIndices: [] //[...Array(this.values.length).keys()]
        };
    },
    watch: {
        value: {
            immediate: true,
            handler(bits) {
                this.selectedIndices = [];
                if (bits && typeof bits === 'string') {
                    bits.split('').forEach((b, i) => {
                        if (b === '1') this.selectedIndices.push(i);
                    });
                }
            }
        },
        selectedIndices(newIndices) {
            let bits = Array(this.flat_cum.length).fill('0');
            let total = 0;
            newIndices.forEach(i => { bits[i] = '1'; total++; });
            this.$emit('input', total ? bits.join('') : '');
        }
    },
    computed: {
        segments() {
            const items = this.normalized
                .map((val, idx) => ({ val, chain: this.flat_chain[idx] }))
                .sort((a, b) => a.val - b.val);
            
            // Group by chain
            const groups = [];
            items.forEach(item => {
                const last = groups[groups.length - 1];
                if (last && last.chain === item.chain) {
                    last.vals.push(item.val);
                } else {
                    groups.push({ chain: item.chain, vals: [item.val] });
                }
            });
            
            const segments = [];
            
            // Leading segment
            const firstGroupFirst = groups[0].vals[0];
            if (firstGroupFirst > 0) {
                segments.push({ start: 0, end: firstGroupFirst });
            }
            
            // Segments for each group
            groups.forEach((grp, i) => {
                const gap = 1;
                const firstVal = grp.vals[0];
                const lastVal = grp.vals[grp.vals.length - 1];
                
                // midpoint with previous group
                const prevVal = i > 0 ? groups[i - 1].vals.slice(-1)[0] : 0;
                const startMid = (prevVal + firstVal) / 2;
                
                // midpoint with next group
                const nextVal = i < groups.length - 1 ? groups[i + 1].vals[0] : 100;
                const endMid = (lastVal + nextVal) / 2;
                
                segments.push({
                    start: startMid + gap,
                    end: endMid - gap
                });
            });
            
            // Trailing segment
            const lastGroupLast = groups[groups.length - 1].vals.slice(-1)[0];
            if (lastGroupLast < 100) {
                segments.push({ start: lastGroupLast, end: 100 });
            }
            
            return segments;
        },
        flat_chain() {
            let flat = []
            for (let chain in this.values) {
                flat.push(...Array(this.values[chain].length).fill(chain))
            }
            return flat;
        },
        flat_pos() {
            let flat = []
            for (let chain in this.values) {
                flat.push(...this.values[chain].map(x => x));
            }
            return flat;
        },
        flat_cum() {
            let flat = []
            let cummax = 0;
            for (let chain in this.values) {
                const max = Math.max(...this.values[chain]);
                cummax += max;
                flat.push(...this.values[chain].map(x => x + cummax));
            }
            return flat;
        },
        // normalized values [0..100] with spacing
        normalized() {
            // normalization to 100
            let max = Math.max(...this.flat_cum);
            let min = Math.min(...this.flat_cum);
            const len = max - min;
            const padding = Math.sqrt(len);
            max += padding;
            min -= padding;
            let arr = this.flat_cum.map((v, idx) => ({
                val: ((v - min) / (max - min)) * 100,
                idx
            }));

            // sort by normalized position
            arr.sort((a, b) => a.val - b.val);

            const gap = this.minSpacing;
            // forward pass: ensure each is at least gap from previous
            for (let i = 1; i < arr.length; i++) {
                const prev = arr[i - 1];
                if (arr[i].val - prev.val < gap) {
                    arr[i].val = prev.val + gap;
                }
            }
            // backward pass: ensure last <=100 and others maintain gap
            for (let i = arr.length - 2; i >= 0; i--) {
                const next = arr[i + 1];
                if (next.val - arr[i].val < gap) {
                    arr[i].val = next.val - gap;
                }
            }

            // clamp to [0,100]
            arr.forEach(item => {
                item.val = Math.max(0, Math.min(100, item.val));
            });

            // restore original order
            const result = [];
            arr.forEach(item => {
                result[item.idx] = item.val;
            });
            return result;
        },
    },
    methods: {
        // style for each track segment
        getTrackStyle(start, end) {
            return {
                left: `${start}%`,
                width: `${end - start}%`
            };
        },
        // position thumb
        thumbStyle(val) {
            return {
                left: `${val}%`
            };
        },
        // toggle thumb selection
        toggleSelection(idx) {
            if (this.disabled) {
                return;
            }

            const i = this.selectedIndices.indexOf(idx);
            if (i === -1) {
                this.selectedIndices.push(idx);
            } else {
                this.selectedIndices.splice(i, 1);
            }
        },
    }
};
</script>

<style scoped>
.v-multi-slider {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
    height: 48px;
}

.v-multi-slider__track-container {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    transform: translateY(-50%);
}

.v-multi-slider__track-segment {
    position: absolute;
    height: 100%;
    background: var(--multi-slider-background-color);
}

.v-multi-slider__thumb {
    position: absolute;
    top: 50%;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #fff;
    /* background: var(--multi-slider-contrast-color); */
    outline: 2px solid var(--multi-slider-background-color);
    transform: translate(-50%, -50%);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.v-multi-slider__thumb.active {
    background: var(--multi-slider-background-color);
    border-color: var(--multi-slider-background-color);
}

.v-multi-slider__thumb.active .v-multi-slider__thumb-label {
    color: #fff;
    /* color: var(--multi-slider-contrast-color); */
}

.v-multi-slider__thumb-label {
    font-size: 12px;
    color: var(--multi-slider-background-color);
    user-select: none;
}

.theme--dark .v-multi-slider__thumb {
    background-color: #1E1E1E;
}
.theme--dark .v-multi-slider__thumb.active .v-multi-slider__thumb-label {
    color: #fff;
}
</style>

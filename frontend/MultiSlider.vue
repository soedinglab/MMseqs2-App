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
        <div class="v-multi-slider__track-container" ref="track">
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
        <span class="v-multi-slider__thumb-label">{{ values[idx] }}</span>
    </div>
</div>
</template>

<script>
export default {
    name: 'MultiSlider',
    props: {
        // array of numeric positions (0-100)
        values: {
            type: Array,
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
    computed: {
        // compute segments between thumbs to color track
        segments() {
            const sorted = [...this.normalized].sort((a, b) => a - b);
            const bounds = [0, ...sorted, 100];
            return bounds.slice(0, -1).map((start, i) => ({
                start,
                end: bounds[i + 1]
            }));
        },
        // normalized values [0..100] with spacing
        normalized() {
            // normalization to 100
            const max = Math.max(...this.values) + 10;
            const min = Math.min(...this.values) - 10;
            let arr = this.values.map((v, idx) => ({
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

            const bits = this.values
                .map((_, i) => (this.selectedIndices.includes(i) ? '1' : '0'))
                .join('');

            const gaps = bits.includes('1') ? bits : '';
            this.$emit('update:active', gaps);
            this.$emit('change', gaps);
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
  background: var(--multi-slider-background-color);
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
  background: var(--multi-slider-contrast-color);
  border: 2px solid var(--multi-slider-background-color);
  transform: translate(-50%, -50%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.v-multi-slider__thumb.active {
  background: var(--multi-slider-background-color);
  border-color: var(--multi-slider-background-color);
}

.v-multi-slider__thumb.active .v-multi-slider__thumb-label {
    color: #fff;
    color: var(--multi-slider-contrast-color);
}

.v-multi-slider__thumb-label {
  font-size: 12px;
  color: var(--multi-slider-background-color);
  user-select: none;
}
</style>

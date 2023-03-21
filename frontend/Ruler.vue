<template>
    <div class="ruler">
      <!-- <div class="tick" v-once v-for="(tick, i) in ticks" :key="tick" :style="{ left: tick + '%' }"></div> -->
      <!-- <div class="tick-label" v-if="label">1</div> -->
      <!-- <div class="tick-label" v-if="label" style="left: 100%">{{ length }}</div> -->
      <div class="query" :class="{ reversed : reversed }" :style="{ left: queryLeft + '%', right: queryRight + '%' }">
        <div class="chevron-start" :style="{ 'background-color': color }"></div>
        <div class="chevron-mid" :style="{ 'background-color': color }"></div>
        <div class="chevron-end" :style="{ 'background-color': color }"></div>
      </div>
      <div class="tick-label" :style="{ left: queryLeft + '%' }">{{ minStart }}</div>
      <div class="tick-label" :style="{ right: queryRight + '%', 'margin-left': 0, 'margin-right': '-25px' }">{{ maxEnd }}</div>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      length: Number,
      start: Number,
      end: Number,
      color: String,
      label: Boolean,
      tickInterval: {
        type: Number,
        default: 10
      }
    },
    computed: {
      minStart() {
        return Math.min(this.start, this.end);
      },
      maxEnd() {
        return Math.max(this.start, this.end);
      },
      reversed() {
        return this.start > this.end;
      },
      queryLeft() {
        return ((this.minStart - 1) / this.length) * 100;
      },
      queryRight() {
        return 100 - ((this.maxEnd / this.length) * 100);
      },
      numTicks() {
        return 3;
      },
      ticks() {
        return Array.from({ length: this.numTicks + 1 }, (_, i) => i / this.numTicks * 100);
      }
    }
  };
  </script>
  
<style lang="scss" scoped>
.ruler {
  position: relative;
  width: 100%;
  height: 10px;
  border-top: 1px solid #333;
}

.tick-label {
  position: absolute;
  word-wrap: normal;
  font-size: 9px;
  word-break: keep-all;
  line-height: 1em;
  margin-top: 7px;
  width: 50px;
  margin-left: -25px;
  text-align: center;
  font-weight: bold;
}

.tick-label-top {
  margin-top: -15px;
}

.query {
  position: absolute;
  top: 0;
  bottom: 0;
  margin-top: -5px;
  --chevron-width: 5px;
  height: 10px;
}

.chevron-start {
  position: absolute;
  left:0;
  bottom:0;
  top:0;
  width:5px;
  clip-path: polygon(0 0, var(--chevron-width) 0, var(--chevron-width) 100%, 0 100%, var(--chevron-width) 50%);
}

.query.reversed .chevron-start {
  clip-path: polygon(var(--chevron-width) 0, 0 50%, var(--chevron-width) 100%);
}

.chevron-mid {
  position: absolute;
  left:5px;
  right:5px;
  bottom:0;
  top:0;
}

.chevron-end {
  position: absolute;
  right:0;
  bottom:0;
  top:0;
  width:5px;
  clip-path: polygon(0 0, var(--chevron-width) 50%, 0 100%);
}
.query.reversed .chevron-end {
  clip-path: polygon(0 0, var(--chevron-width) 0, 0 50%, var(--chevron-width) 100%, 0 100%);
  clip-path: polygon()
}

.theme--dark {
    .ruler {
      border-color: #aaa;
    }
}
</style>
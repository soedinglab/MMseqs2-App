<template functional>
    <div class="ruler">
      <div class="query" :class="{ reversed : props.start > props.end }" :style="{ left: ((Math.min(props.start, props.end) - 1) / props.length) * 100 + '%', right: 100 - ((Math.max(props.start, props.end) / props.length) * 100) + '%' }">
        <div class="chevron-start" :style="{ 'background-color': props.color }"></div>
        <div class="chevron-mid" :style="{ 'background-color': props.color }"></div>
        <div class="chevron-end" :style="{ 'background-color': props.color }"></div>
      </div>
      <div class="tick-label" :style="{ left: ((Math.min(props.start, props.end) - 1) / props.length) * 100 + '%' }">{{ Math.min(props.start, props.end) }}</div>
      <div class="tick-label" :style="{ right: 100 - ((Math.max(props.start, props.end) / props.length) * 100) + '%', 'margin-left': 0, 'margin-right': '-25px' }">{{ Math.max(props.start, props.end) }}</div>
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
    },
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
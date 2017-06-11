<template>
  <div>
    <nav :class="{affix:affixed}" :style="{marginTop:top}" v-scroll="checkScroll">
      <slot></slot>
    </nav>
  </div>
</template>

<script>
import Affix from '../node_modules/vue-strap/src/Affix.vue';
export default {
    mixins: [Affix]
};
</script>
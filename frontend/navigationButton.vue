<template>
    <v-sheet color="transparent" style="position: fixed; width: 200px; right: 16px; bottom: 16px; z-index: 99998; align-items: center; justify-content: flex-end;"
    class="d-flex pa-2">
      <v-flex shrink style="flex-direction: row;">
        <v-tooltip top>
          <template v-slot:activator='{on,attrs}'>
            <v-fab-transition>
              <v-btn small v-bind="attrs" v-on="on" fab 
                v-show="enableScrollPrev" @click="goTo(scrollPrevTarget)">
                <v-icon>{{ $MDI.ChevronUp }}</v-icon>
              </v-btn>
            </v-fab-transition>
          </template>
          <span>Scroll to prev. DB</span>
        </v-tooltip>
        <v-tooltip top>
          <template v-slot:activator='{on,attrs}'>
            <v-fab-transition>
              <v-btn small v-bind="attrs" v-on="on" fab 
              v-show="enableScrollNext" @click="goTo(scrollNextTarget)">
              <v-icon>{{ $MDI.ChevronDown }}</v-icon>
              </v-btn>
            </v-fab-transition>
          </template>
          <span>Scroll to next DB</span>
        </v-tooltip>
    </v-flex>
    <v-tooltip top color="primary">
      <template v-slot:activator='{on,attrs}'>
        <v-fab-transition>
          <v-btn class="ml-3" color="primary" fab v-show="enableScrollTop" @click="goTo(0)" v-bind="attrs" v-on="on">
            <v-icon>{{ $MDI.DoubleChevronUp }}</v-icon>
        </v-btn>
        </v-fab-transition>
      </template>
      <span>Scroll to top</span>
    </v-tooltip>
  </v-sheet>
</template>
<script>
import { throttle } from './lib/throttle';
export default {
  name: 'NavigationButton',
  data() {
    return {
      enableScrollTop: false,
      enableScrollNext: false,
      enableScrollPrev: false,
      scrollNextTarget: 0,
      scrollPrevTarget: 0,
      scrollOption: {
        duration: 500,
        offset: 0,
        easing: 'easeInOutQuart'
      },
      throttled: null,
      observer: null,
    }
  },
  props: {
    selectedDatabases: {
      type: Number,
      default: -1
    },
    scrollOffsetArr: {
      type: Array,
      default: []
    },
    tabOffset: {
      type: Number,
      default: 140
    }
  },
  emits: [
    'needUpdate'
  ],
  watch: {
    scrollOffsetArr: {
      handler(n, o) {
        if (n != o) {
          this.updateScrollStates()
        }
      }
    }
  },
  mounted() {
    this.throttled = throttle(this.updateScrollStates, 100)
    window.addEventListener("scroll", this.throttled, {passive: true})
    this.observer = new ResizeObserver(this.emitEvent)
    this.observer.observe(document.documentElement)
  },
  beforeDestroy() {
    window.removeEventListener("scroll", this.throttled);
    this.observer.disconnect()
  },
  methods: {
    getCurrentScrollDbIdx() {
        const currOffset = window.scrollY + this.tabOffset
        let idx = 0
        for (let i = 0; i < this.scrollOffsetArr.length; i++) {
            if (this.scrollOffsetArr[i] > currOffset+1) {
                break
            } else {
                idx = i
            }
        }
        return idx
    },
    updateScrollStates() {
        let offset = window.scrollY
        let innerHeightHalf = window.innerHeight / 2
        
        if (offset >= innerHeightHalf) {
            this.enableScrollTop = true
        } else {
            this.enableScrollTop = false
        }

        if (this.selectedDatabases != 0 || this.scrollOffsetArr?.length < 2) {
            this.enableScrollNext = false
            this.enableScrollPrev = false
            return
        }
        
        let currIdx = this.getCurrentScrollDbIdx()
        let endOfPage = offset + (2 * innerHeightHalf) >= document.documentElement.scrollHeight

        // scrollNext behavior
        if (currIdx == this.scrollOffsetArr?.length-1 || endOfPage) {
            this.enableScrollNext = false
        } else {
            this.enableScrollNext = true
            this.scrollNextTarget = this.scrollOffsetArr?.[currIdx+1] - this.tabOffset
        }

        // scrollPrev behavior
        if (offset >= this.scrollOffsetArr?.[0] + innerHeightHalf - this.tabOffset) {
            this.enableScrollPrev = true
            if (offset + this.tabOffset >= this.scrollOffsetArr?.[currIdx] + innerHeightHalf) {
                this.scrollPrevTarget = this.scrollOffsetArr?.[currIdx] - this.tabOffset
            } else {
                this.scrollPrevTarget = currIdx == 0 ? 0 : this.scrollOffsetArr?.[currIdx-1] - this.tabOffset
            }
        } else {
            this.enableScrollPrev = false
        }
    },
    goTo(target) {
      window.scrollTo({
        top: target,
        left: 0,
        behavior: 'smooth'
      })
      setTimeout(() => {this.updateScrollStates()}, 300)
    },
    emitEvent() {
      this.$emit('needUpdate')
    }
  },
}
</script>
<style lang="scss">
</style>
<!-- 背景泡泡上升層：疊在背景之上、UI 之下，不接收點擊 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { bubbleCount, bubbleSpecs } from './bubbles'

const width = ref(window.innerWidth)
const height = ref(window.innerHeight)
const reduced = ref(false)
let motionQuery: MediaQueryList | null = null

function syncSize() {
  width.value = window.innerWidth
  height.value = window.innerHeight
}
function syncMotion() {
  reduced.value = motionQuery?.matches ?? false
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion()
  motionQuery.addEventListener('change', syncMotion)
  window.addEventListener('resize', syncSize, { passive: true })
})
onUnmounted(() => {
  motionQuery?.removeEventListener('change', syncMotion)
  window.removeEventListener('resize', syncSize)
})

const bubbles = computed(() =>
  bubbleSpecs(bubbleCount({ width: width.value, height: height.value, reducedMotion: reduced.value })),
)
</script>

<template>
  <div class="bubble-layer" aria-hidden="true">
    <span
      v-for="(b, i) in bubbles"
      :key="i"
      class="bubble"
      :style="{ left: `${b.left}%`, width: `${b.size}px`, animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }"
    />
  </div>
</template>

<style scoped>
.bubble-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.bubble {
  position: absolute;
  bottom: -40px;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.25);
  animation-name: bubble-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}
/* 唯一允許的待機動態：背景泡泡往上升 */
@keyframes bubble-rise {
  to {
    transform: translate(20px, -115vh);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bubble-layer {
    display: none;
  }
}
</style>

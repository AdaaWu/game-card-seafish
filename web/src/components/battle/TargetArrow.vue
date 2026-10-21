<script setup lang="ts">
// 選目標箭頭：二次貝茲曲線＋準星
import { computed } from 'vue'

const props = defineProps<{ from: { x: number; y: number }; to: { x: number; y: number }; kind: 'attack' | 'spell'; snapped: boolean; invalid: boolean }>()

const path = computed(() => {
  const { from, to } = props
  const cx = (from.x + to.x) / 2
  const cy = Math.min(from.y, to.y) - 80
  return `M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}`
})
const color = computed(() => (props.kind === 'attack' ? 'var(--c-damage)' : 'var(--c-lavender-deep)'))
</script>

<template>
  <svg class="arrow" viewBox="0 0 1920 1080" aria-hidden="true">
    <path :d="path" :stroke="color" />
    <g :transform="`translate(${to.x} ${to.y}) scale(${snapped ? 1.2 : 1})`">
      <template v-if="invalid">
        <circle r="22" fill="none" stroke="#b8b2bf" stroke-width="6" />
        <line x1="-15" y1="15" x2="15" y2="-15" stroke="#b8b2bf" stroke-width="6" />
      </template>
      <template v-else>
        <circle r="22" fill="rgba(255,255,255,0.4)" :stroke="color" stroke-width="6" />
        <circle r="5" :fill="color" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.arrow {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
  pointer-events: none;
  z-index: 30;
}
path {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
  stroke-dasharray: 2 22;
  filter: drop-shadow(0 0 4px #fff);
}
</style>

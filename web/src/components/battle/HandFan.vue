<script setup lang="ts">
// 我方手牌扇形：圓心在畫面底部中心外 1200px，間隔 6°，總張角上限 50°
import { computed } from 'vue'
import CardView from '@/components/CardView.vue'
import type { Card } from '@/engine'
import type { ViewCard } from '@/render/battle/viewModel'

const props = defineProps<{
  cards: ViewCard[]
  cardDb: Record<string, Card>
  playable: ReadonlySet<string>
  selectedId: string | null
  draggingId: string | null
  hoverId: string | null
  dimOthers: boolean
}>()
defineEmits<{ down: [id: string, e: PointerEvent]; enter: [id: string]; leave: [id: string] }>()

const RADIUS = 1200
const CARD_W = 150
const TOP = 900

const layout = computed(() => {
  const n = props.cards.length
  const step = n > 1 ? Math.min(6, 50 / (n - 1)) : 0
  return props.cards.map((c, i) => {
    const deg = (i - (n - 1) / 2) * step
    const rad = (deg * Math.PI) / 180
    const x = 960 + RADIUS * Math.sin(rad) - CARD_W / 2
    const y = TOP + RADIUS * (1 - Math.cos(rad))
    return { c, style: { transform: `translate(${x}px, ${y}px) rotate(${deg}deg)`, zIndex: i + 1 } }
  })
})
</script>

<template>
  <div class="hand">
    <div
      v-for="{ c, style } in layout"
      :key="c.instanceId"
      class="slot"
      :style="style"
      :data-hand="c.instanceId"
    >
      <div
        class="hand-inner"
        :class="{
          playable: playable.has(c.instanceId),
          selected: selectedId === c.instanceId,
          hovered: hoverId === c.instanceId && !draggingId,
          ghosted: draggingId === c.instanceId,
          dim: dimOthers && selectedId !== c.instanceId,
        }"
        @pointerdown.stop="$emit('down', c.instanceId, $event)"
        @pointerenter="$emit('enter', c.instanceId)"
        @pointerleave="$emit('leave', c.instanceId)"
      >
        <div class="lift">
          <CardView v-if="cardDb[c.cardId]" :card="cardDb[c.cardId]!" size="sm" />
          <span v-if="playable.has(c.instanceId)" class="ring" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hand {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}
.slot {
  position: absolute;
  left: 0;
  top: 0;
  width: 150px;
  transform-origin: 50% 100%;
  transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.hand-inner {
  pointer-events: auto;
  cursor: pointer;
  border-radius: 14px;
  touch-action: none;
  user-select: none;
}
.lift {
  position: relative;
  border-radius: 14px;
  transition:
    transform 0.12s ease-out,
    filter 0.12s;
}
.playable .lift {
  filter: drop-shadow(0 0 8px #f6e3a1) drop-shadow(0 0 4px #f6e3a1);
}
.ring {
  position: absolute;
  left: -4px;
  top: -4px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 3px solid #fff8d6;
  box-shadow: 0 0 6px #f6e3a1;
}
.hovered .lift {
  transform: translateY(-40px) scale(1.15);
}
.selected .lift {
  transform: translateY(-70px) scale(1.15);
  filter: drop-shadow(0 0 14px #fff) drop-shadow(0 0 6px #f6e3a1);
}
.dim .lift {
  filter: brightness(0.8);
}
.ghosted {
  opacity: 0.25;
}
</style>

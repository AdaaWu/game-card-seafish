<script setup lang="ts">
// 我方手牌：桌機為扇形；手機預設收合成一排只露上緣，點手牌區展開
import { computed } from 'vue'
import CardView from '@/components/CardView.vue'
import type { Card } from '@/engine'
import { handSpacing, type HandGeometry } from '@/render/battle/battleLayout'
import type { ViewCard } from '@/render/battle/viewModel'

const props = defineProps<{
  cards: ViewCard[]
  cardDb: Record<string, Card>
  playable: ReadonlySet<string>
  selectedId: string | null
  draggingId: string | null
  hoverId: string | null
  dimOthers: boolean
  geo: HandGeometry
  state: 'fan' | 'collapsed' | 'expanded'
}>()
defineEmits<{ down: [id: string, e: PointerEvent]; enter: [id: string]; leave: [id: string] }>()

// CardView sm 的原始寬度
const BASE_W = 150

const layout = computed(() => {
  const g = props.geo
  const n = props.cards.length
  const collapsed = props.state === 'collapsed'
  const half = props.state === 'expanded' ? g.expandedHalf : g.maxHalf
  const top = props.state === 'expanded' ? g.expandedTop : g.top
  const step = handSpacing(n, g.cardW, half)
  return props.cards.map((c, i) => {
    const dx = (i - (n - 1) / 2) * step
    const x = g.cx + dx - g.cardW / 2
    if (collapsed) {
      const y = props.selectedId === c.instanceId ? g.liftedTop : g.collapsedTop
      return { c, style: { transform: `translate(${x}px, ${y}px)`, zIndex: i + 1 } }
    }
    const deg = (Math.asin(dx / g.radius) * 180) / Math.PI
    const y = top + g.radius - Math.sqrt(g.radius * g.radius - dx * dx)
    return { c, style: { transform: `translate(${x}px, ${y}px) rotate(${deg}deg)`, zIndex: i + 1 } }
  })
})
const slotStyle = computed(() => ({ width: `${props.geo.cardW}px`, height: `${props.geo.cardH}px` }))
const innerStyle = computed(() => ({ transform: `scale(${props.geo.cardW / BASE_W})` }))
</script>

<template>
  <div class="hand" :class="state" data-testid="hand">
    <div
      v-for="{ c, style } in layout"
      :key="c.instanceId"
      class="slot"
      :style="[style, slotStyle]"
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
          <div class="card-scale" :style="innerStyle">
            <CardView v-if="cardDb[c.cardId]" :card="cardDb[c.cardId]!" size="sm" variant="hand" />
          </div>
          <span v-if="playable.has(c.instanceId)" class="ring" aria-hidden="true" />
        </div>
        <span class="back-face" aria-hidden="true" />
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
.hand.expanded {
  z-index: 34;
}
.slot {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 50% 100%;
  transition: transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.hand-inner {
  position: relative;
  height: 100%;
  transform-style: preserve-3d;
  pointer-events: auto;
  cursor: pointer;
  border-radius: 14px;
  touch-action: none;
  user-select: none;
}
.lift {
  position: relative;
  height: 100%;
  border-radius: 14px;
  backface-visibility: hidden;
  transition:
    transform 0.12s ease-out,
    filter 0.12s;
}
.card-scale {
  width: 150px;
  transform-origin: 0 0;
  backface-visibility: hidden;
}
/* 抽牌翻面時看到的卡背 */
.back-face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border-radius: 14px;
  background: url('@assets/ui/card-back.webp') center / cover no-repeat;
  box-shadow: 0 3px 8px rgba(62, 53, 80, 0.2);
  transform: rotateY(180deg);
  backface-visibility: hidden;
  pointer-events: none;
}
.playable .lift {
  filter: drop-shadow(0 0 8px #f6e3a1) drop-shadow(0 0 4px #f6e3a1);
}
.ring {
  position: absolute;
  left: -2%;
  top: -2%;
  width: 26%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3px solid #fff8d6;
  box-shadow: 0 0 6px #f6e3a1;
}
.fan .hovered .lift {
  transform: translateY(-40px) scale(1.15);
}
.fan .selected .lift,
.expanded .selected .lift {
  transform: translateY(-70px) scale(1.15);
  filter: drop-shadow(0 0 14px #fff) drop-shadow(0 0 6px #f6e3a1);
}
.collapsed .selected .lift {
  filter: drop-shadow(0 0 14px #fff) drop-shadow(0 0 6px #f6e3a1);
}
.dim .lift {
  filter: brightness(0.8);
}
.ghosted {
  opacity: 0.25;
}
</style>

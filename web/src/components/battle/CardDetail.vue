<script setup lang="ts">
// hover 放大卡牌細節＋關鍵字說明
import { computed } from 'vue'
import CardView from '@/components/CardView.vue'
import { KEYWORDS } from '@/content/cardStyle'
import type { Card } from '@/engine'

const props = defineProps<{
  card: Card
  attack?: number
  health?: number
  keywords?: string[]
  x: number
  y: number
  side: 'left' | 'right'
}>()

const keywordInfo = computed(() =>
  (props.keywords ?? props.card.keywords).map((k) => KEYWORDS[k]).filter((k) => k !== undefined),
)
const changed = computed(
  () =>
    props.card.type === 'creature' &&
    ((props.attack !== undefined && props.attack !== props.card.attack) ||
      (props.health !== undefined && props.health !== props.card.health)),
)
</script>

<template>
  <div class="detail" :class="side" :style="{ left: `${x}px`, top: `${y}px` }">
    <CardView :card="card" :attack="attack" :health="health" size="lg" />
    <div class="side-info">
      <p v-if="changed" class="base">原始數值（{{ card.attack }}/{{ card.health }}）</p>
      <div v-for="k in keywordInfo" :key="k.label" class="kw">
        <svg viewBox="0 0 24 24" :class="k.icon.mode" aria-hidden="true"><path :d="k.icon.d" /></svg>
        <div>
          <b>{{ k.label }}</b>
          <span>{{ k.desc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail {
  position: absolute;
  z-index: 40;
  display: flex;
  gap: 12px;
  pointer-events: none;
  filter: drop-shadow(0 10px 24px rgba(62, 53, 80, 0.3));
}
.detail.left {
  flex-direction: row-reverse;
}
.side-info {
  width: 230px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.base {
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fffdf7;
  font-size: 16px;
  color: var(--c-ink-soft);
}
.kw {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #fffdf7;
  font-size: 16px;
  line-height: 1.4;
}
.kw b {
  display: block;
  font-size: 18px;
}
.kw svg {
  flex: none;
  width: 26px;
  height: 26px;
}
svg.fill path {
  fill: var(--c-ink);
}
svg.stroke path {
  fill: none;
  stroke: var(--c-ink);
  stroke-width: 2.2;
  stroke-linecap: round;
}
</style>

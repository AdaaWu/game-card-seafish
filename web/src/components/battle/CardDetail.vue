<script setup lang="ts">
// hover 放大卡牌細節＋關鍵字說明；場上生物顯示目前數值
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
  cardW: number
  minFont: number
}>()

// CardView lg 的原始寬度
const BASE_W = 300

const keywordInfo = computed(() =>
  (props.keywords ?? props.card.keywords).map((k) => KEYWORDS[k]).filter((k) => k !== undefined),
)
// 與 CardView 相同：高於原始值為綠、低於原始值為紅
const trend = (cur: number | undefined, base: number | undefined) =>
  cur === undefined || base === undefined || cur === base ? 'same' : cur > base ? 'up' : 'down'
const attackTrend = computed(() => trend(props.attack, props.card.attack))
const healthTrend = computed(() => trend(props.health, props.card.health))
const changed = computed(() => props.card.type === 'creature' && (attackTrend.value !== 'same' || healthTrend.value !== 'same'))
const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  '--f': `${Math.max(16, props.minFont)}px`,
  '--side': `${Math.max(230, props.minFont * 11)}px`,
}))
</script>

<template>
  <div class="detail" :class="side" :style="style" data-testid="card-detail">
    <div class="card-box" :style="{ width: `${cardW}px`, height: `${cardW * 1.4}px` }">
      <div class="card-scale" :style="{ transform: `scale(${cardW / BASE_W})` }">
        <CardView :card="card" :attack="attack" :health="health" size="lg" />
      </div>
    </div>
    <div class="side-info">
      <p v-if="changed" class="base" data-testid="detail-stats">
        目前
        <b :class="attackTrend">{{ attack }}</b>/<b :class="healthTrend">{{ health }}</b>
        <span class="orig">（原始 {{ card.attack }}/{{ card.health }}）</span>
      </p>
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
.card-box {
  flex: none;
}
.card-scale {
  width: 300px;
  transform-origin: 0 0;
}
.side-info {
  width: var(--side);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.base {
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fffdf7;
  font-size: var(--f);
  color: var(--c-ink);
}
.base b {
  font: 900 calc(var(--f) * 1.3) var(--font-num);
}
.base b.up {
  color: var(--c-buff);
}
.base b.down {
  color: var(--c-debuff);
}
.orig {
  color: var(--c-ink-soft);
}
.kw {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #fffdf7;
  font-size: var(--f);
  line-height: 1.4;
}
.kw b {
  display: block;
  font-size: calc(var(--f) + 2px);
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

<script setup lang="ts">
// hover 放大卡牌細節＋關鍵字說明；場上生物顯示目前數值；手機改橫向，完整文字放右側；直式上下排
import { computed } from 'vue'
import CardView from '@/components/CardView.vue'
import { KEYWORDS, attackTone, cardTypeLine, healthTone, splitKeywordText } from '@/content/cardStyle'
import type { Card } from '@/engine'

const props = defineProps<{
  card: Card
  attack?: number
  health?: number
  maxHealth?: number
  keywords?: string[]
  x: number
  y: number
  side: 'left' | 'right'
  cardW: number
  sideW: number
  minFont: number
  compact: boolean
  stacked?: boolean
}>()

// CardView lg 的原始寬度
const BASE_W = 300

const keywordInfo = computed(() =>
  (props.keywords ?? props.card.keywords).map((k) => KEYWORDS[k]).filter((k) => k !== undefined),
)
const attackTrend = computed(() => (props.attack === undefined ? 'same' : attackTone(props.attack, props.card.attack ?? 0)))
const healthTrend = computed(() =>
  props.health === undefined ? 'same' : healthTone(props.health, props.maxHealth ?? props.health, props.card.health ?? 0),
)
const segments = computed(() => splitKeywordText(props.card.text))
const changed = computed(() => props.card.type === 'creature' && (attackTrend.value !== 'same' || healthTrend.value !== 'same'))
const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  '--f': `${props.compact ? props.minFont : Math.max(16, props.minFont)}px`,
  '--side': `${props.sideW}px`,
  '--card-h': `${props.cardW * 1.4}px`,
}))
</script>

<template>
  <div class="detail" :class="[side, { compact, stacked }]" :style="style" data-testid="card-detail">
    <div class="card-box" :style="{ width: `${cardW}px`, height: `${cardW * 1.4}px` }">
      <div class="card-scale" :style="{ transform: `scale(${cardW / BASE_W})` }">
        <CardView
          :card="card"
          :attack="attack"
          :health="health"
          :max-health="maxHealth"
          size="lg"
          :variant="compact ? 'hand' : 'full'"
        />
      </div>
    </div>
    <div class="side-info">
      <div v-if="compact" class="text-panel" data-testid="detail-text">
        <b class="title">{{ card.name }}</b>
        <span class="type">{{ cardTypeLine(card) }}</span>
        <p v-if="card.text" class="effect">
          <template v-for="(t, i) in segments" :key="i">
            <strong v-if="t.bold">{{ t.text }}</strong><template v-else>{{ t.text }}</template>
          </template>
        </p>
      </div>
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
.compact .side-info {
  max-height: var(--card-h);
  overflow-y: auto;
}
.detail.stacked {
  flex-direction: column;
  align-items: center;
}
.stacked .side-info {
  max-height: calc(var(--card-h) * 0.6);
}
.text-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 14px;
  background: #fffdf7;
  font-size: var(--f);
  line-height: 1.4;
  color: var(--c-ink);
}
.text-panel .title {
  font-size: calc(var(--f) * 1.3);
}
.text-panel .type {
  color: var(--c-ink-soft);
}
.text-panel .effect {
  margin: 0;
  font-size: calc(var(--f) * 1.1);
}
.text-panel strong {
  font-weight: 900;
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

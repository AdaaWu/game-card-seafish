<script setup lang="ts">
// DOM 卡面：版面座標與 Canvas 卡面共用 cardStyle
import { computed, ref, watch } from 'vue'
import type { Card } from '@/content/types'
import {
  FACTION_STYLE,
  LAYOUT,
  RARITY_STYLE,
  SHAPES,
  cardArtUrl,
  cardTypeLine,
  cardKeywords,
  framePatternPath,
  gemPoints,
  nameFontSize,
  splitKeywordText,
  textFontSize,
} from '@/content/cardStyle'

const props = withDefaults(
  defineProps<{
    card: Card
    attack?: number
    health?: number
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md', attack: undefined, health: undefined },
)

const WIDTH = { sm: 150, md: 200, lg: 300 } as const

// 設計稿 px 轉成容器寬度單位
const u = (n: number) => `calc(${n} * 100cqw / 500)`
const box = (b: { x: number; y: number; w?: number; h?: number; d?: number }) => ({
  left: u(b.x),
  top: u(b.y),
  width: u(b.w ?? b.d ?? 0),
  height: u(b.h ?? b.d ?? 0),
})

const faction = computed(() => FACTION_STYLE[props.card.faction])
const rarity = computed(() => RARITY_STYLE[props.card.rarity])
const isCreature = computed(() => props.card.type === 'creature')
const keywords = computed(() => cardKeywords(props.card))
const segments = computed(() => splitKeywordText(props.card.text))
const pattern = computed(() => framePatternPath(props.card.faction))
const gem = computed(() => {
  const { cx, cy, d } = LAYOUT.gem
  const pts = gemPoints(props.card.rarity, d / 2, d / 2, d / 2 - 2)
  return { pts: pts?.map((p) => p.join(',')).join(' ') ?? null, style: box({ x: cx - d / 2, y: cy - d / 2, d }) }
})

const artUrl = computed(() => cardArtUrl(props.card.id))
const artFailed = ref(false)
watch(artUrl, () => (artFailed.value = false))

type Trend = 'up' | 'down' | 'same'
function trend(current: number | undefined, base: number | undefined): Trend {
  if (current === undefined || base === undefined || current === base) return 'same'
  return current > base ? 'up' : 'down'
}
const attackValue = computed(() => props.attack ?? props.card.attack ?? 0)
const healthValue = computed(() => props.health ?? props.card.health ?? 0)
const attackTrend = computed(() => trend(props.attack, props.card.attack))
const healthTrend = computed(() => trend(props.health, props.card.health))

const textBox = computed(() => {
  const t = LAYOUT.text
  return box({ ...t, h: isCreature.value ? t.h : t.spellBottom - t.y })
})

const ariaLabel = computed(() => {
  const c = props.card
  const stats = isCreature.value ? `，攻擊 ${attackValue.value}，生命 ${healthValue.value}` : ''
  return `${c.name}，${faction.value.label}陣營，${rarity.value.label}，費用 ${c.cost}${stats}。${c.text}`
})
</script>

<template>
  <div class="card-view" :style="{ width: `${WIDTH[size]}px` }" role="img" :aria-label="ariaLabel">
    <div
      class="face"
      :class="[`f-${card.faction}`, `r-${card.rarity}`, card.type]"
      :style="{
        '--main': faction.main,
        '--dark': faction.dark,
        '--light': faction.light,
        borderRadius: u(LAYOUT.radius),
        borderWidth: u(LAYOUT.border),
      }"
    >
      <svg class="pattern" viewBox="0 0 500 700" preserveAspectRatio="none" aria-hidden="true">
        <path v-if="pattern" :d="pattern" />
      </svg>
      <svg v-if="card.rarity === 'legendary'" class="crown" viewBox="0 0 500 700" aria-hidden="true">
        <path :d="SHAPES.crown" />
      </svg>

      <div class="art" :style="{ ...box(LAYOUT.art), borderRadius: u(LAYOUT.art.r) }">
        <div class="art-shadow" />
      </div>
      <img
        v-if="artUrl && !artFailed"
        class="art-img"
        :src="artUrl"
        alt=""
        draggable="false"
        :style="{
          left: u(LAYOUT.art.x),
          top: u(LAYOUT.art.y - LAYOUT.art.overflowTop),
          width: u(LAYOUT.art.w),
          height: u(LAYOUT.art.h + LAYOUT.art.overflowTop - 10),
        }"
        @error="artFailed = true"
      />
      <div v-else class="art-fallback" :style="box(LAYOUT.art)">
        <svg viewBox="0 0 24 24" :class="faction.icon.mode" aria-hidden="true"><path :d="faction.icon.d" /></svg>
        <span :style="{ fontSize: u(28) }">{{ card.species }}</span>
      </div>

      <div class="ribbon" :style="box(LAYOUT.ribbon)">
        <span class="name" :style="{ fontSize: u(nameFontSize(card.name)) }">{{ card.name }}</span>
      </div>

      <svg class="gem" viewBox="0 0 28 28" :style="gem.style" :aria-label="rarity.label">
        <polygon v-if="gem.pts" :points="gem.pts" :fill="rarity.color" />
        <circle v-else cx="14" cy="14" r="12" :fill="rarity.color" />
      </svg>

      <div class="textbox" :style="{ ...textBox, borderRadius: u(LAYOUT.text.r) }">
        <p class="effect" :style="{ fontSize: u(textFontSize(card.text)) }">
          <template v-for="(s, i) in segments" :key="i">
            <strong v-if="s.bold">{{ s.text }}</strong><template v-else>{{ s.text }}</template>
          </template>
        </p>
        <span class="type-label" :style="{ fontSize: u(LAYOUT.font.type) }">
          {{ cardTypeLine(card) }}
        </span>
      </div>

      <div class="badge cost" :style="box(LAYOUT.cost)">
        <svg viewBox="0 0 96 96" aria-hidden="true"><path :d="SHAPES.cost" /></svg>
        <span class="num" :style="{ fontSize: u(card.cost >= 10 ? LAYOUT.font.statWide : LAYOUT.font.cost) }">
          {{ card.cost }}
        </span>
      </div>

      <template v-if="isCreature">
        <div class="badge attack" :class="attackTrend" :style="box(LAYOUT.attack)">
          <svg viewBox="0 0 88 88" aria-hidden="true">
            <path :d="SHAPES.attack" />
            <path class="icon" :d="SHAPES.sword" />
          </svg>
          <span class="num" :style="{ fontSize: u(attackValue >= 10 ? LAYOUT.font.statWide : LAYOUT.font.stat) }">
            {{ attackValue }}
          </span>
          <span v-if="attackTrend !== 'same'" class="arrow" :style="{ fontSize: u(26) }">
            {{ attackTrend === 'up' ? '▲' : '▼' }}
          </span>
        </div>
        <div class="badge health" :class="healthTrend" :style="box(LAYOUT.health)">
          <svg viewBox="0 0 88 88" aria-hidden="true">
            <path :d="SHAPES.health" />
            <path v-if="healthTrend === 'down'" class="crack" :d="SHAPES.crack" />
          </svg>
          <span class="num" :style="{ fontSize: u(healthValue >= 10 ? LAYOUT.font.statWide : LAYOUT.font.stat) }">
            {{ healthValue }}
          </span>
          <span v-if="healthTrend !== 'same'" class="arrow" :style="{ fontSize: u(26) }">
            {{ healthTrend === 'up' ? '▲' : '▼' }}
          </span>
        </div>
      </template>

      <div class="faction-icon" :style="{ ...box({ x: 404, y: 10, d: 80 }) }" :title="`${faction.label}陣營`">
        <svg viewBox="0 0 24 24" :class="faction.icon.mode" aria-hidden="true"><path :d="faction.icon.d" /></svg>
      </div>

      <div v-if="keywords.length" class="keywords" :style="{ left: u(116), top: u(14), gap: u(6) }">
        <span
          v-for="k in keywords"
          :key="k.label"
          class="kw"
          :title="`${k.label}：${k.desc}`"
          :style="{ width: u(52), height: u(52) }"
        >
          <svg viewBox="0 0 24 24" :class="k.icon.mode" aria-hidden="true"><path :d="k.icon.d" /></svg>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-view {
  container-type: inline-size;
  aspect-ratio: 5 / 7;
  flex: none;
  user-select: none;
}
.face {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border-style: solid;
  border-color: var(--dark);
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.55), transparent 60%),
    linear-gradient(160deg, var(--main), var(--light) 55%, var(--main));
  box-shadow: 0 6px 18px rgba(62, 53, 80, 0.18);
  overflow: visible;
  color: var(--c-ink, #3e3550);
  font-family: var(--font-ui);
}
.face > * {
  position: absolute;
}
.pattern,
.crown {
  inset: calc(-12 * 100cqw / 500);
  width: calc(100% + 24 * 100cqw / 500);
  height: calc(100% + 24 * 100cqw / 500);
  pointer-events: none;
}
.pattern path {
  fill: none;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.crown {
  top: calc(-40 * 100cqw / 500);
}
.crown path {
  fill: #f0b45a;
  stroke: #c98a2e;
  stroke-width: 3;
}
.art {
  background: radial-gradient(ellipse at 50% 45%, #fff 0%, var(--light) 55%, var(--main) 130%);
  overflow: hidden;
}
.art-shadow {
  position: absolute;
  left: 25%;
  right: 25%;
  bottom: 6%;
  height: 10%;
  border-radius: 50%;
  background: rgba(62, 53, 80, 0.15);
}
.art-img {
  object-fit: contain;
  object-position: center bottom;
  pointer-events: none;
}
.art-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4%;
  color: var(--dark);
  font-weight: 700;
  text-align: center;
}
.art-fallback svg {
  width: 36%;
  height: 36%;
}
svg.fill path {
  fill: currentColor;
}
svg.stroke path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ribbon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fffdf7;
  clip-path: polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%, 4% 50%);
  box-shadow: inset 0 -3px 0 rgba(62, 53, 80, 0.08);
}
.name {
  font-weight: 800;
  white-space: nowrap;
}
.gem {
  filter: drop-shadow(0 1px 1px rgba(62, 53, 80, 0.4));
}
.gem polygon,
.gem circle {
  stroke: #3e3550;
  stroke-width: 1.5;
}
.r-epic .gem,
.r-legendary .gem {
  animation: shimmer 2.4s ease-in-out infinite;
}
.textbox {
  box-sizing: border-box;
  background: rgba(251, 246, 236, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3% 4% 7%;
}
.effect {
  margin: 0;
  line-height: 1.35;
  text-align: center;
  line-break: strict;
  word-break: break-all;
}
.effect strong {
  font-weight: 900;
}
.type-label {
  position: absolute;
  bottom: 4%;
  color: var(--c-ink-soft, #6e6580);
}
.badge {
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.badge.cost path {
  fill: var(--c-sky, #a9d4ec);
  stroke: #2f5f8a;
  stroke-width: 5;
}
.badge.attack path {
  fill: var(--c-butter, #f6e3a1);
  stroke: #3e3550;
  stroke-width: 4;
  stroke-linejoin: round;
}
.badge.attack path.icon {
  fill: rgba(62, 53, 80, 0.35);
  stroke: none;
}
.badge.health path {
  fill: var(--c-pink, #f2b8c6);
  stroke: #3e3550;
  stroke-width: 4;
}
.badge.health path.crack {
  fill: none;
  stroke: #3e3550;
  stroke-width: 3;
}
.num {
  position: relative;
  font-family: var(--font-num);
  font-weight: 800;
  line-height: 1;
  color: #fff;
  -webkit-text-stroke: calc(8 * 100cqw / 500) #3e3550;
  paint-order: stroke fill;
}
.cost .num {
  -webkit-text-stroke-color: #234a6e;
  padding-top: 12%;
}
.badge.up .num {
  color: var(--c-buff, #3e9e5c);
}
.badge.down .num {
  color: var(--c-debuff, #d9534f);
}
.arrow {
  position: absolute;
  top: -12%;
  right: -8%;
  font-weight: 900;
  -webkit-text-stroke: calc(3 * 100cqw / 500) #fff;
  paint-order: stroke fill;
}
.health .arrow {
  right: auto;
  left: -8%;
}
.up .arrow {
  color: var(--c-buff, #3e9e5c);
}
.down .arrow {
  color: var(--c-debuff, #d9534f);
}
.faction-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fffdf7;
  color: var(--dark);
  box-shadow: 0 2px 4px rgba(62, 53, 80, 0.2);
}
.faction-icon svg {
  width: 62%;
  height: 62%;
}
.keywords {
  display: flex;
}
.kw {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fffdf7;
  color: #3e3550;
  border: 2px solid var(--dark);
  box-sizing: border-box;
}
.kw svg {
  width: 64%;
  height: 64%;
}
@keyframes shimmer {
  50% {
    filter: drop-shadow(0 0 4px #fff) brightness(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .gem {
    animation: none !important;
  }
}
</style>

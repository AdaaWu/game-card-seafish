<script setup lang="ts">
// DOM 卡面：版面座標與 Canvas 卡面共用 cardStyle
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Card } from '@/content/types'
import {
  FACTION_STYLE,
  HAND_LAYOUT,
  LAYOUT,
  RARITY_STYLE,
  SHAPES,
  SLICE_INSET,
  SLICE_PX,
  artPlacement,
  cardArtUrl,
  cardFaceLayout,
  cardTypeLine,
  gemPoints,
  cardKeywords,
  attackTone,
  estimateTextLines,
  hasEffectText,
  healthTone,
  nameFontSize,
  splitKeywordText,
  textFontSize,
  type Rect,
} from '@/content/cardStyle'
import { alphaBounds, cardPartUrls, loadImage, withoutFailed, type CardFaceParts } from '@/render/cardTexture'

const props = withDefaults(
  defineProps<{
    card: Card
    attack?: number
    health?: number
    maxHealth?: number
    size?: 'sm' | 'md' | 'lg'
    variant?: 'full' | 'hand'
  }>(),
  { size: 'md', attack: undefined, health: undefined, maxHealth: undefined, variant: 'full' },
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
const layout = computed(() => cardFaceLayout(props.card.type, estimateTextLines(props.card.text)))

// 切片與圖示：1x 加 2x srcset；載入失敗的部件退回 CSS 底框與向量圖示
type PartKey = keyof CardFaceParts
const failedParts = reactive(new Set<PartKey>())
const partUrls = computed(() => ({
  lo: cardPartUrls(props.card.faction, props.card.rarity),
  hi: cardPartUrls(props.card.faction, props.card.rarity, true),
}))
function probeParts() {
  failedParts.clear()
  const { lo, hi } = partUrls.value
  for (const k of Object.keys(lo) as PartKey[]) {
    for (const url of [lo[k], hi[k]]) {
      if (url) void loadImage(url).then((img) => !img && failedParts.add(k))
    }
  }
}
onMounted(probeParts)
watch(partUrls, probeParts)
const parts = computed(() => {
  const lo = withoutFailed(partUrls.value.lo, failedParts)
  const hi = withoutFailed(partUrls.value.hi, failedParts)
  const pick = (k: keyof typeof lo) => ({ src: lo[k], srcset: lo[k] && hi[k] ? `${lo[k]} 1x, ${hi[k]} 2x` : undefined })
  return {
    frame: pick('frame'),
    artwash: pick('artwash'),
    gem: pick('gem'),
    crown: pick('crown'),
    cost: pick('cost'),
    attack: pick('attack'),
    health: pick('health'),
    faction: pick('faction'),
    hi,
  }
})
// 九宮格切片以 border-image 拉伸，使用 2x 圖
function nineSlice(url: string | undefined, inset: { t: number; r: number; b: number; l: number }) {
  if (!url) return {}
  const sides = [inset.t, inset.r, inset.b, inset.l]
  return {
    borderStyle: 'solid',
    borderImageSource: `url("${url}")`,
    borderImageSlice: `${sides.map((n) => n * 2).join(' ')} fill`,
    borderImageWidth: sides.map((n) => u(n / SLICE_PX)).join(' '),
    borderImageRepeat: 'stretch',
  }
}
const scrimStyle = computed(() => ({
  height: u(112 / SLICE_PX),
  ...nineSlice(parts.value.hi.scrim, SLICE_INSET.scrim),
}))
const gemStyle = computed(() => {
  const d = 28 / SLICE_PX
  return box({ x: layout.value.gem.cx - d / 2, y: layout.value.gem.cy - d / 2, d })
})
const gemFallback = computed(() => {
  const d = 28
  const pts = gemPoints(props.card.rarity, d / 2, d / 2, d / 2 - 2)
  return pts?.map((p) => p.join(',')).join(' ') ?? null
})
const crownStyle = { left: u((500 - 204 / SLICE_PX) / 2), top: '0', width: u(204 / SLICE_PX), height: u(60 / SLICE_PX) }

const artUrl = computed(() => cardArtUrl(props.card.id))
const artFailed = ref(false)
watch(artUrl, () => (artFailed.value = false))

// 角色插畫依不透明範圍裁切；量測完成前先以 contain 顯示
const artBounds = ref<{ bounds: Rect; w: number; h: number } | null>(null)
async function measureArt() {
  const url = artUrl.value
  artBounds.value = null
  if (!url || isHand.value) return
  const img = await loadImage(url)
  if (img && url === artUrl.value) artBounds.value = { bounds: alphaBounds(img), w: img.width, h: img.height }
}
onMounted(measureArt)
watch(artUrl, measureArt)
const artImgStyle = computed(() => {
  const a = layout.value.art
  if (!artBounds.value) return { left: '0', top: '0', width: '100%', height: '100%', objectFit: 'contain' as const }
  const p = artPlacement(artBounds.value.bounds, artBounds.value.w, artBounds.value.h, { ...a, x: 0, y: 0 })
  return { left: u(p.x), top: u(p.y), width: u(p.w), height: u(p.h) }
})

const attackValue = computed(() => props.attack ?? props.card.attack ?? 0)
const healthValue = computed(() => props.health ?? props.card.health ?? 0)
const attackTrend = computed(() => (props.attack === undefined ? 'same' : attackTone(props.attack, props.card.attack ?? 0)))
const healthTrend = computed(() => {
  if (props.health === undefined) return 'same'
  const base = props.card.health ?? 0
  return healthTone(props.health, props.maxHealth ?? Math.max(props.health, base), base)
})

// 手牌精簡版型：放大角色圖、卡名與數值，不放效果文字
const isHand = computed(() => props.variant === 'hand')
const HAND = HAND_LAYOUT
const hasEffect = computed(() => hasEffectText(props.card))
const costFont = computed(() =>
  isHand.value
    ? props.card.cost >= 10 ? HAND.font.costWide : HAND.font.cost
    : props.card.cost >= 10 ? LAYOUT.font.statWide : LAYOUT.font.cost,
)
const statFont = (n: number) =>
  isHand.value ? (n >= 10 ? HAND.font.statWide : HAND.font.stat) : n >= 10 ? LAYOUT.font.statWide : LAYOUT.font.stat
const geo = computed(() => {
  const g = isHand.value ? HAND : layout.value
  return { cost: box(g.cost), attack: box(g.attack), health: box(g.health), ribbon: box(g.ribbon) }
})
const handKeywordsStyle = { right: u(HAND.kw.right), top: u(HAND.kw.top), gap: u(HAND.kw.gap) }
const K = LAYOUT.keyword
const fullKeywordsStyle = { left: u(K.cx - K.d / 2), top: u(K.cy - K.d / 2), gap: u(K.gap - K.d) }
const kwSize = computed(() => u(isHand.value ? HAND.kw.d : K.d))
const kwRing = computed(() => (isHand.value || !parts.value.hi.keywordRing ? {} : { backgroundImage: `url("${parts.value.hi.keywordRing}")` }))

const textBox = computed(() => ({ ...box(layout.value.text), ...nineSlice(parts.value.hi.textbox, SLICE_INSET.textbox) }))
const ribbonStyle = computed(() => (isHand.value ? geo.value.ribbon : { ...geo.value.ribbon, ...nineSlice(parts.value.hi.ribbon, SLICE_INSET.ribbon) }))
// 手牌版型沿用含 12 外框的座標，框架圖往外推 12
const frameStyle = computed(() => (isHand.value ? { inset: u(-LAYOUT.border) } : { inset: '0' }))

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
      :class="[`f-${card.faction}`, `r-${card.rarity}`, card.type, { hand: isHand, 'no-frame': !parts.frame.src }]"
      :style="{
        '--main': faction.main,
        '--dark': faction.dark,
        '--light': faction.light,
        borderRadius: u(LAYOUT.radius),
        borderWidth: isHand ? u(LAYOUT.border) : '0',
      }"
    >
      <img v-if="parts.frame.src" class="frame" :src="parts.frame.src" :srcset="parts.frame.srcset" :style="frameStyle" alt="" draggable="false" />

      <template v-if="isHand">
        <div class="art" :style="{ ...box(HAND.art), borderRadius: u(HAND.art.r) }" />
        <img
          v-if="artUrl && !artFailed"
          class="art-img"
          :src="artUrl"
          alt=""
          draggable="false"
          :style="box({ ...HAND.art, h: HAND.art.h - 6 })"
          @error="artFailed = true"
        />
        <div v-else class="art-fallback" :style="box(HAND.art)">
          <svg viewBox="0 0 24 24" :class="faction.icon.mode" aria-hidden="true"><path :d="faction.icon.d" /></svg>
          <span :style="{ fontSize: u(28) }">{{ card.species }}</span>
        </div>
      </template>
      <div v-else class="art full" :style="{ ...box(layout.art), borderRadius: u(layout.art.r) }">
        <img v-if="parts.artwash.src" class="artwash" :src="parts.artwash.src" :srcset="parts.artwash.srcset" alt="" draggable="false" />
        <div class="art-shadow" :style="{ bottom: u(LAYOUT.art.shadowUp - 16), height: u(32) }" />
        <img
          v-if="artUrl && !artFailed"
          class="art-img"
          :src="artUrl"
          alt=""
          draggable="false"
          :style="artImgStyle"
          @error="artFailed = true"
        />
        <div v-else class="art-fallback">
          <svg viewBox="0 0 24 24" :class="faction.icon.mode" aria-hidden="true"><path :d="faction.icon.d" /></svg>
          <span :style="{ fontSize: u(28) }">{{ card.species }}</span>
        </div>
        <div class="scrim top" :style="scrimStyle" />
        <div class="scrim bottom" :style="scrimStyle" />
      </div>
      <img
        v-if="!isHand && card.rarity === 'legendary' && parts.crown.src"
        class="crown"
        :src="parts.crown.src"
        :srcset="parts.crown.srcset"
        :style="crownStyle"
        alt=""
        draggable="false"
      />
      <svg v-else-if="!isHand && card.rarity === 'legendary'" class="crown crown-fallback" viewBox="0 0 500 80" :style="crownStyle" aria-hidden="true">
        <path :d="SHAPES.crown" />
      </svg>

      <div class="ribbon" :class="{ hand: isHand, plain: isHand || !parts.hi.ribbon }" :style="ribbonStyle">
        <span v-if="isHand" class="name single" :style="{ fontSize: u(HAND.font.name) }">{{ card.name }}</span>
        <span v-else class="name" :style="{ fontSize: u(nameFontSize(card.name)) }">{{ card.name }}</span>
      </div>

      <img
        v-if="!isHand && parts.gem.src"
        class="gem"
        :src="parts.gem.src"
        :srcset="parts.gem.srcset"
        :style="gemStyle"
        :alt="rarity.label"
        draggable="false"
      />
      <svg v-else-if="!isHand" class="gem" viewBox="0 0 28 28" :style="gemStyle" role="img" :aria-label="rarity.label">
        <polygon v-if="gemFallback" :points="gemFallback" :fill="rarity.color" />
        <circle v-else cx="14" cy="14" r="12" :fill="rarity.color" />
      </svg>

      <div v-if="!isHand" class="textbox" :class="{ plain: !parts.hi.textbox }" :style="textBox">
        <p class="effect" :style="{ fontSize: u(textFontSize(card.text)) }">
          <template v-for="(s, i) in segments" :key="i">
            <strong v-if="s.bold">{{ s.text }}</strong><template v-else>{{ s.text }}</template>
          </template>
        </p>
        <span class="type-label" :style="{ fontSize: u(LAYOUT.font.type) }">
          {{ cardTypeLine(card) }}
        </span>
      </div>

      <div class="badge cost" :style="geo.cost">
        <img v-if="parts.cost.src" class="icon-img" :src="parts.cost.src" :srcset="parts.cost.srcset" alt="" draggable="false" />
        <svg v-else class="shape" viewBox="0 0 96 96" aria-hidden="true"><path :d="SHAPES.cost" /></svg>
        <span class="num" :style="{ fontSize: u(costFont) }">
          {{ card.cost }}
        </span>
      </div>

      <template v-if="isCreature">
        <div class="badge attack" :class="attackTrend" :style="geo.attack">
          <img v-if="parts.attack.src" class="icon-img" :src="parts.attack.src" :srcset="parts.attack.srcset" alt="" draggable="false" />
          <svg v-else class="shape" viewBox="0 0 88 88" aria-hidden="true"><path :d="SHAPES.attack" /></svg>
          <span class="num" :style="{ fontSize: u(statFont(attackValue)) }">
            {{ attackValue }}
          </span>
          <span v-if="attackTrend !== 'same'" class="arrow" :style="{ fontSize: u(26) }">
            {{ attackTrend === 'up' ? '▲' : '▼' }}
          </span>
        </div>
        <div class="badge health" :class="healthTrend" :style="geo.health">
          <img v-if="parts.health.src" class="icon-img" :src="parts.health.src" :srcset="parts.health.srcset" alt="" draggable="false" />
          <svg v-else class="shape" viewBox="0 0 88 88" aria-hidden="true"><path :d="SHAPES.health" /></svg>
          <svg v-if="healthTrend === 'down'" viewBox="0 0 88 88" aria-hidden="true">
            <path class="crack" :d="SHAPES.crack" />
          </svg>
          <span class="num" :style="{ fontSize: u(statFont(healthValue)) }">
            {{ healthValue }}
          </span>
          <span v-if="healthTrend !== 'same'" class="arrow" :style="{ fontSize: u(26) }">
            {{ healthTrend === 'up' ? '▲' : '▼' }}
          </span>
        </div>
      </template>

      <span
        v-if="isHand && hasEffect"
        class="effect-mark"
        data-testid="effect-mark"
        title="有效果，長按或停留看完整內容"
        :style="{ ...box(HAND.mark), borderRadius: u(HAND.mark.h / 2) }"
      >
        <svg viewBox="0 0 24 24" class="stroke" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" /></svg>
      </span>

      <img
        v-if="!isHand && parts.faction.src"
        class="faction-icon"
        :src="parts.faction.src"
        :srcset="parts.faction.srcset"
        :style="box(layout.faction)"
        :alt="`${faction.label}陣營`"
        :title="`${faction.label}陣營`"
        draggable="false"
      />
      <span
        v-else-if="!isHand"
        class="faction-icon faction-fallback"
        :style="box(layout.faction)"
        role="img"
        :aria-label="`${faction.label}陣營`"
        :title="`${faction.label}陣營`"
      >
        <svg viewBox="0 0 24 24" :class="faction.icon.mode" aria-hidden="true"><path :d="faction.icon.d" /></svg>
      </span>

      <div v-if="keywords.length" class="keywords" :style="isHand ? handKeywordsStyle : fullKeywordsStyle">
        <span
          v-for="k in keywords"
          :key="k.label"
          class="kw"
          :title="`${k.label}：${k.desc}`"
          :style="{ width: kwSize, height: kwSize, ...kwRing }"
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
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(62, 53, 80, 0.18);
  overflow: visible;
  color: var(--c-ink, #3e3550);
  font-family: var(--font-ui);
}
.face > * {
  position: absolute;
}
.face.no-frame {
  border-color: var(--dark);
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.55), transparent 60%),
    linear-gradient(160deg, var(--main), var(--light) 55%, var(--main));
}
.face.no-frame:not(.hand) {
  box-shadow:
    inset 0 0 0 calc(12 * 100cqw / 500) var(--dark),
    0 6px 18px rgba(62, 53, 80, 0.18);
}
.frame {
  width: auto;
  height: auto;
  pointer-events: none;
}
.face.hand .frame {
  width: calc(100% + 24 * 100cqw / 500);
  height: calc(100% + 24 * 100cqw / 500);
}
.face:not(.hand) .frame {
  width: 100%;
  height: 100%;
}
.crown {
  pointer-events: none;
}
.crown-fallback path {
  fill: #f0b45a;
  stroke: #c98a2e;
  stroke-width: 3;
}
.face.hand .art {
  background: radial-gradient(ellipse at 50% 45%, #fff 0%, var(--light) 55%, var(--main) 130%);
  overflow: hidden;
}
.art.full {
  overflow: hidden;
  background: var(--light);
}
.art.full > * {
  position: absolute;
}
.artwash {
  left: 0;
  top: 0;
  width: 100%;
  height: auto;
  pointer-events: none;
}
.art-shadow {
  position: absolute;
  left: 25%;
  right: 25%;
  border-radius: 50%;
  background: rgba(62, 53, 80, 0.15);
}
.art-img {
  object-fit: contain;
  object-position: center bottom;
  pointer-events: none;
  max-width: none;
}
.art.full .art-fallback {
  inset: 0;
}
.scrim {
  left: 0;
  right: 0;
  box-sizing: border-box;
  pointer-events: none;
}
.scrim.top {
  top: 0;
}
.scrim.bottom {
  bottom: 0;
  transform: scaleY(-1);
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
  box-sizing: border-box;
}
.ribbon.plain {
  background: #fffdf7;
  clip-path: polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%, 4% 50%);
  box-shadow: inset 0 -3px 0 rgba(62, 53, 80, 0.08);
}
.name {
  font-weight: 800;
  white-space: nowrap;
}
.ribbon.hand {
  padding: 0 4.5%;
  box-sizing: border-box;
}
.name.single {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
.effect-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fffdf7;
  border: 2px solid var(--dark);
  box-sizing: border-box;
  color: #3e3550;
}
.effect-mark svg {
  width: 56%;
  height: 56%;
}
.gem {
  pointer-events: none;
}
.r-epic .gem,
.r-legendary .gem {
  animation: shimmer 2.4s ease-in-out infinite;
}
.textbox.plain {
  background: #fffdf7;
  border-radius: calc(16 * 100cqw / 500);
}
.textbox {
  box-sizing: border-box;
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
.badge svg,
.badge .icon-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.badge.cost .shape path {
  fill: var(--c-sky, #a9d4ec);
  stroke: #2f5f8a;
  stroke-width: 5;
}
.badge.attack .shape path {
  fill: var(--c-butter, #f6e3a1);
  stroke: #3e3550;
  stroke-width: 4;
  stroke-linejoin: round;
}
.badge.health .shape path {
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
  pointer-events: auto;
}
.faction-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  background: #fffdf7;
  border: calc(4 * 100cqw / 500) solid var(--dark);
  color: var(--dark);
}
.faction-fallback svg {
  width: 60%;
  height: 60%;
}
.keywords {
  display: flex;
}
.kw {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fffdf7 center / cover no-repeat;
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

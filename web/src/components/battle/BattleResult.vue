<script setup lang="ts">
// 勝負畫面：緞帶標題、小葉立繪、泡泡花瓣、數據列；勝利翻開獎勵卡，失敗提供重新挑戰與離開
import gsap from 'gsap'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CardView from '@/components/CardView.vue'
import GameButton from '@/components/ui/GameButton.vue'
import type { Card } from '@/content/types'
import { resultFigureUrl, uiImageUrl } from '@/content/cardStyle'
import { resultActions, resultStats, resultTitle } from './resultSummary'

const props = defineProps<{
  result: 'win' | 'lose' | 'draw'
  speed: number
  rounds: number
  damage: number
  rewards: Card[]
  exitLabel: string
  figureH: number
  lw: number
}>()
const emit = defineEmits<{ continue: []; retry: [] }>()

// 直式寬度不足時立繪在上、面板在下
const STACK_BELOW = 800
const FLIP_START = 0.6
const FLIP_GAP = 0.25
const FLIP_DURATION = 0.5

const title = ref<HTMLElement | null>(null)
const flips = ref<HTMLElement[]>([])
const showButton = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const pieces = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 7) * 0.18}s`,
  hue: ['#F2B8C6', '#A9D4EC', '#F6E3A1', '#B9A6DB', '#9CC79A'][i % 5],
  size: `${14 + (i % 4) * 8}px`,
}))

const figure = resultFigureUrl(props.result)
const heading = resultTitle(props.result)
const stats = computed(() => resultStats(props.rounds, props.damage))
const actions = computed(() => resultActions(props.result, props.exitLabel))
const stacked = computed(() => props.lw < STACK_BELOW)
const panelStyle = computed(() => (stacked.value ? { maxWidth: `${props.lw - 40}px` } : {}))
const slice = (path: string) => {
  const u = uiImageUrl(path, true)
  return u ? `url("${u}")` : 'none'
}
const frameVars = { '--ribbon': slice('panels/ribbon'), '--panel': slice('panels/panel') }

function flipRewards(): void {
  if (flips.value.length === 0) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  gsap.set(flips.value, { rotationY: 180 })
  flips.value.forEach((el, i) =>
    gsap.to(el, {
      rotationY: 0,
      duration: FLIP_DURATION / props.speed,
      delay: (FLIP_START + i * FLIP_GAP) / props.speed,
      ease: 'power2.out',
    }),
  )
}

onMounted(() => {
  if (title.value) {
    if (props.result === 'win') gsap.from(title.value, { y: -420, duration: 0.5 / props.speed, ease: 'bounce.out' })
    else gsap.from(title.value, { opacity: 0, duration: 0.4 / props.speed, ease: 'power1.out' })
  }
  flipRewards()
  timer = setTimeout(() => (showButton.value = true), (props.result === 'win' ? 1500 + 500 : 1000) / props.speed)
})
onUnmounted(() => {
  clearTimeout(timer)
  gsap.killTweensOf(flips.value)
})
</script>

<template>
  <div class="result" :class="[result, { stacked }]" :style="frameVars" role="dialog" aria-live="polite">
    <div v-if="result === 'win'" class="confetti" aria-hidden="true">
      <span
        v-for="(p, i) in pieces"
        :key="i"
        :style="{ left: p.left, animationDelay: p.delay, background: p.hue, width: p.size, height: p.size }"
      />
    </div>
    <div class="scene">
      <img v-if="figure" class="figure" :src="figure" alt="小葉" draggable="false" :style="{ height: `${figureH}px` }" data-testid="result-figure" />
      <div class="result-panel" :style="panelStyle">
        <h2 ref="title" class="ribbon">{{ heading }}</h2>
        <p v-if="result === 'lose'" class="sub">海流有點急，深呼吸再出發吧</p>
        <div class="stats">
          <p v-for="(s, i) in stats" :key="s.testId" class="stat" :data-testid="s.testId">
            <span v-if="i > 0" class="stat-sep" aria-hidden="true">｜</span>{{ s.label }} <b class="num">{{ s.value }}</b>
          </p>
        </div>
        <div v-if="rewards.length" class="rewards" data-testid="result-rewards">
          <div v-for="c in rewards" :key="c.id" class="reward" data-testid="result-reward">
            <div ref="flips" class="flip">
              <div class="face front"><CardView :card="c" size="md" /></div>
              <div class="face back" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div class="actions">
          <template v-if="showButton">
            <GameButton
              v-for="a in actions"
              :key="a.label"
              :variant="a.variant"
              size="lg"
              :data-testid="a.testId"
              @click="a.emit === 'retry' ? emit('retry') : emit('continue')"
            >{{ a.label }}</GameButton>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 毛玻璃底由 BattleScreen 的 .result-veil 負責，這層只放內容 */
.result {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.scene {
  position: relative;
  display: flex;
  align-items: flex-end;
}
/* 立繪靜態：勝利暖光、失敗降飽和偏冷，不跳動 */
.figure {
  display: block;
  width: auto;
  margin-right: -60px;
  pointer-events: none;
  animation: figure-in 0.4s ease-out both;
}
.win .figure,
.draw .figure {
  filter: drop-shadow(0 0 28px rgba(246, 227, 161, 0.9)) drop-shadow(0 12px 24px rgba(62, 53, 80, 0.25));
}
.lose .figure {
  filter: saturate(0.75) brightness(0.92) hue-rotate(-8deg) drop-shadow(0 12px 24px rgba(62, 53, 80, 0.3));
}
.result-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  min-width: 620px;
  margin-bottom: 40px;
  padding: 24px 56px 48px;
  border-style: solid;
  border-width: 72px;
  border-image-source: var(--panel);
  border-image-slice: 128 fill;
  border-image-width: 72px;
  border-image-repeat: stretch;
}
/* 緞帶標題：燕尾兩端不拉伸 */
.ribbon {
  --rh: 168px;
  box-sizing: border-box;
  height: var(--rh);
  min-width: 560px;
  margin: -150px 0 0;
  padding: 0 24px calc(var(--rh) * 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  border-style: solid;
  border-width: 0 calc(var(--rh) * 0.905);
  border-image-source: var(--ribbon);
  border-image-slice: 0 152 fill;
  border-image-width: 0 calc(var(--rh) * 0.905);
  border-image-repeat: stretch;
  font-size: 72px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.06em;
  white-space: nowrap;
  color: var(--btn-primary-500);
}
.lose .ribbon {
  color: #6e5f80;
}
.sub {
  margin: 0;
  font-size: max(26px, var(--min-font, 0px));
  color: var(--c-ink);
}
/* 數據列：上方分隔線，回合數｜總傷害 */
.stats {
  display: flex;
  justify-content: center;
  align-self: stretch;
  padding: 16px 24px 0;
  border-top: 2px solid rgba(110, 95, 128, 0.25);
  font-size: max(26px, var(--min-font, 0px));
  font-weight: 800;
  color: var(--c-ink);
}
.stat {
  margin: 0;
  white-space: nowrap;
}
.stat-sep {
  margin: 0 16px;
  opacity: 0.45;
}
.num {
  font-family: var(--font-num);
}
/* 獎勵卡：依序翻開一次，不循環 */
.rewards {
  display: flex;
  gap: 24px;
}
.reward {
  perspective: 1200px;
}
.flip {
  position: relative;
  transform-style: preserve-3d;
}
.face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.face.back {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: #8d74c2 url('@assets/ui/card-back.webp') center / cover no-repeat;
  transform: rotateY(180deg);
}
.stacked .scene {
  flex-direction: column;
  align-items: center;
}
.stacked .figure {
  margin: 0 0 -40px;
}
.stacked .result-panel {
  box-sizing: border-box;
  min-width: 0;
  margin-bottom: 0;
}
.stacked .ribbon {
  min-width: 0;
}
.actions {
  display: flex;
  gap: 24px;
  min-height: var(--btn-h-lg);
}
.confetti span {
  position: absolute;
  bottom: -40px;
  border-radius: 50%;
  opacity: 0.85;
  animation: up 2s ease-out forwards;
}
.confetti span:nth-child(3n) {
  border-radius: 60% 0;
}
/* 一次性彩片，不循環 */
@keyframes up {
  to {
    transform: translate(40px, -1200px) rotate(360deg);
    opacity: 0;
  }
}
@keyframes figure-in {
  from {
    opacity: 0;
  }
}
</style>

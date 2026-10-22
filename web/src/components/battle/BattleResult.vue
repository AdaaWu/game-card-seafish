<script setup lang="ts">
// 勝負畫面：緞帶標題、小葉立繪、泡泡花瓣；失敗提供重新挑戰與離開
import gsap from 'gsap'
import { onMounted, onUnmounted, ref } from 'vue'
import GameButton from '@/components/ui/GameButton.vue'
import { portraitUrl, uiImageUrl } from '@/content/cardStyle'

const props = defineProps<{ result: 'win' | 'lose' | 'draw'; speed: number; rounds: number; exitLabel: string; figureH: number }>()
defineEmits<{ continue: []; retry: [] }>()

const title = ref<HTMLElement | null>(null)
const showButton = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const pieces = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 7) * 0.18}s`,
  hue: ['#F2B8C6', '#A9D4EC', '#F6E3A1', '#B9A6DB', '#9CC79A'][i % 5],
  size: `${14 + (i % 4) * 8}px`,
}))

const figure = portraitUrl('xiaoye')
const slice = (path: string) => {
  const u = uiImageUrl(path, true)
  return u ? `url("${u}")` : 'none'
}
const frameVars = { '--ribbon': slice('panels/ribbon'), '--panel': slice('panels/panel') }

onMounted(() => {
  if (title.value) {
    if (props.result === 'win') gsap.from(title.value, { y: -420, duration: 0.5 / props.speed, ease: 'bounce.out' })
    else gsap.from(title.value, { opacity: 0, duration: 0.4 / props.speed, ease: 'power1.out' })
  }
  timer = setTimeout(() => (showButton.value = true), (props.result === 'win' ? 1500 + 500 : 1000) / props.speed)
})
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="result" :class="result" :style="frameVars" role="dialog" aria-live="polite">
    <div v-if="result === 'win'" class="confetti" aria-hidden="true">
      <span
        v-for="(p, i) in pieces"
        :key="i"
        :style="{ left: p.left, animationDelay: p.delay, background: p.hue, width: p.size, height: p.size }"
      />
    </div>
    <div class="scene">
      <img v-if="figure" class="figure" :src="figure" alt="小葉" draggable="false" :style="{ height: `${figureH}px` }" data-testid="result-figure" />
      <div class="result-panel">
        <h2 ref="title" class="ribbon">{{ result === 'win' ? '勝利！' : result === 'lose' ? '再試一次' : '平手' }}</h2>
        <p v-if="result === 'lose'" class="sub">海流有點急，深呼吸再出發吧</p>
        <p class="rounds" data-testid="result-rounds">回合數 {{ rounds }}</p>
        <div class="actions">
          <template v-if="showButton">
            <template v-if="result === 'lose'">
              <GameButton variant="primary" size="lg" data-testid="retry" @click="$emit('retry')">重新挑戰</GameButton>
              <GameButton variant="secondary" size="lg" data-testid="back-map" @click="$emit('continue')">{{ exitLabel }}</GameButton>
            </template>
            <GameButton v-else variant="primary" size="lg" @click="$emit('continue')">繼續</GameButton>
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
.sub,
.rounds {
  margin: 0;
  font-size: max(26px, var(--min-font, 0px));
  color: var(--c-ink);
}
.rounds {
  padding: 6px 24px;
  border-radius: 999px;
  background: rgba(255, 253, 247, 0.9);
  font-weight: 800;
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

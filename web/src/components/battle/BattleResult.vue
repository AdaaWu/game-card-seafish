<script setup lang="ts">
// 勝負畫面：勝利標題落下＋泡泡花瓣，1.5 秒後顯示繼續
import gsap from 'gsap'
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ result: 'win' | 'lose' | 'draw'; speed: number }>()
defineEmits<{ continue: [] }>()

const title = ref<HTMLElement | null>(null)
const showButton = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
const pieces = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 7) * 0.18}s`,
  hue: ['#F2B8C6', '#A9D4EC', '#F6E3A1', '#B9A6DB', '#9CC79A'][i % 5],
  size: `${14 + (i % 4) * 8}px`,
}))

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
  <div class="result" :class="result" role="dialog" aria-live="polite">
    <div v-if="result === 'win'" class="confetti" aria-hidden="true">
      <span
        v-for="(p, i) in pieces"
        :key="i"
        :style="{ left: p.left, animationDelay: p.delay, background: p.hue, width: p.size, height: p.size }"
      />
    </div>
    <h2 ref="title">{{ result === 'win' ? '勝利！' : result === 'lose' ? '再試一次' : '平手' }}</h2>
    <p v-if="result === 'lose'" class="sub">海流有點急，整理好牌組再出發吧</p>
    <button v-if="showButton" class="btn continue" type="button" @click="$emit('continue')">繼續</button>
  </div>
</template>

<style scoped>
.result {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: rgba(251, 246, 236, 0.45);
  overflow: hidden;
}
h2 {
  margin: 0;
  font-size: 120px;
  font-weight: 900;
  color: #fff;
  -webkit-text-stroke: 6px var(--c-lavender-deep);
  paint-order: stroke fill;
  text-shadow: 0 8px 0 rgba(62, 53, 80, 0.2);
}
.lose h2 {
  -webkit-text-stroke-color: var(--c-ink-soft);
}
.sub {
  margin: 0;
  font-size: 26px;
  color: var(--c-ink);
}
.continue {
  font-size: 28px;
  padding: 16px 56px;
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
@keyframes up {
  to {
    transform: translate(40px, -1200px) rotate(360deg);
    opacity: 0;
  }
}
</style>

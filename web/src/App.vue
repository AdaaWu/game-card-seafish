<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsDialog from '@/components/SettingsDialog.vue'
import { audio } from '@/fx/audio'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()
const showSettings = ref(false)

// 對戰回報結果後回到章節地圖播放戰後對話
watch(
  () => progress.pendingOutcome,
  (outcome) => {
    if (outcome && route.name === 'battle') void router.push({ name: 'story' })
  },
)

function openSettings() {
  audio.play('sfx_ui_click')
  showSettings.value = true
}
</script>

<template>
  <div class="app-root">
    <div class="sea-bg" aria-hidden="true">
      <span
        v-for="i in 12"
        :key="i"
        class="bubble"
        :style="{ '--i': i, left: `${(i * 37) % 100}%`, width: `${8 + ((i * 7) % 14)}px`, animationDelay: `-${(i * 53) % 17}s` }"
      />
    </div>
    <RouterView />
    <button v-if="route.name !== 'title'" class="gear" type="button" aria-label="設定" @click="openSettings">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10.3 2h3.4l.5 2.6 2 .9 2.2-1.5 2.4 2.4-1.5 2.2.9 2 2.6.5v3.4l-2.6.5-.9 2 1.5 2.2-2.4 2.4-2.2-1.5-2 .9-.5 2.6h-3.4l-.5-2.6-2-.9-2.2 1.5-2.4-2.4 1.5-2.2-.9-2L2 13.7v-3.4l2.6-.5.9-2L4 5.6 6.4 3.2l2.2 1.5 2-.9z"
        />
      </svg>
    </button>
    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style>
:root {
  --c-cream: #fbf6ec;
  --c-ink: #3e3550;
  --c-ink-soft: #6e6580;
  --c-leaf: #9cc79a;
  --c-lavender: #b9a6db;
  --c-lavender-deep: #8d74c2;
  --c-pink: #f2b8c6;
  --c-sky: #a9d4ec;
  --c-butter: #f6e3a1;
  --c-damage: #e0607a;
  --c-heal: #4fa866;
  --c-buff: #3e9e5c;
  --c-debuff: #d9534f;
  --c-disabled: #b8b2bf;
  --radius: 20px;
  --shadow: 0 8px 24px rgba(62, 53, 80, 0.14);
  --font-ui: 'jf-openhuninn-2.0', 'jf open 粉圓', 'Noto Sans TC', 'M PLUS Rounded 1c', sans-serif;
  --font-num: 'M PLUS Rounded 1c', 'Baloo 2', 'Noto Sans TC', sans-serif;
  color-scheme: light;
}
html,
body {
  margin: 0;
  min-height: 100%;
  background: #dff1f6;
  color: var(--c-ink);
  font-family: var(--font-ui);
}
#app {
  min-height: 100vh;
  min-height: 100dvh;
}
button {
  font-family: inherit;
  color: inherit;
}
.btn {
  border: none;
  border-radius: 999px;
  padding: 12px 28px;
  min-height: 44px;
  font-size: 18px;
  font-weight: 700;
  background: #7a64b0;
  color: #fff;
  box-shadow:
    0 4px 0 #5e4c94,
    var(--shadow);
  cursor: pointer;
  transition: transform 0.1s;
  text-shadow: 0 1px 2px rgba(62, 53, 80, 0.35);
}
.btn:hover {
  transform: scale(1.05);
  background: #6a549f;
}
.btn:active {
  transform: scale(0.95);
}
.btn.ghost {
  background: #fffdf7;
  color: var(--c-ink);
  box-shadow:
    0 3px 0 #e2d8c8,
    var(--shadow);
  text-shadow: none;
}
.btn:disabled {
  background: var(--c-disabled);
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}
.panel {
  background: rgba(251, 246, 236, 0.92);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.page {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 72px 24px 32px;
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>

<style scoped>
.app-root {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
}
.sea-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.7), transparent 50%),
    linear-gradient(180deg, #e9f6f4 0%, #cde8f1 45%, #b6d6ea 75%, #c9c2e8 100%);
  overflow: hidden;
  pointer-events: none;
}
.bubble {
  position: absolute;
  bottom: -40px;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.25);
  animation: rise calc(9s + var(--i) * 1.3s) linear infinite;
}
@keyframes rise {
  to {
    transform: translate(20px, -115vh);
  }
}
.gear {
  position: fixed;
  top: 14px;
  right: 16px;
  z-index: 50;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: #fffdf7;
  box-shadow: var(--shadow);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.2s;
}
.gear svg {
  width: 26px;
  height: 26px;
  fill: var(--c-lavender-deep);
  fill-rule: evenodd;
}
.gear:hover {
  transform: rotate(30deg);
}
</style>

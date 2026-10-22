<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsDialog from '@/components/SettingsDialog.vue'
import BubbleLayer from '@/components/ui/BubbleLayer.vue'
import ScreenBackground from '@/components/ui/ScreenBackground.vue'
import { screenForRoute } from '@/components/ui/screenBackground'
import { audio } from '@/fx/audio'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()
const showSettings = ref(false)
const screen = computed(() => screenForRoute(route.name))

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
    <div class="backdrop" aria-hidden="true">
      <ScreenBackground :screen="screen" />
      <BubbleLayer />
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
  background: var(--btn-primary-500);
  color: #fff;
  box-shadow:
    0 4px 0 var(--btn-primary-700),
    var(--shadow);
  cursor: pointer;
  transition:
    background-color 120ms,
    filter 120ms;
  text-shadow: var(--btn-text-shadow);
}
.btn:hover {
  background: var(--btn-primary-600);
  filter: drop-shadow(var(--btn-glow));
}
.btn:active {
  transform: translateY(var(--btn-press-shift));
}
.btn:focus-visible {
  outline: none;
  box-shadow: var(--btn-focus-ring);
}
.btn.ghost {
  background: #fffdf7;
  color: var(--c-ink);
  box-shadow:
    0 3px 0 #e2d8c8,
    var(--shadow);
  text-shadow: none;
}
.btn.ghost:not(:disabled):hover {
  background: var(--btn-cream);
}
.btn:disabled {
  background: var(--btn-disabled-bg);
  color: var(--btn-disabled-ink);
  text-shadow: none;
  box-shadow: none;
  filter: none;
  cursor: not-allowed;
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
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
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

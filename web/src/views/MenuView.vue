<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import SettingsDialog from '@/components/SettingsDialog.vue'
import { audio } from '@/fx/audio'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()
const showSettings = ref(false)

interface MenuItem {
  label: string
  to: RouteLocationRaw
  locked: boolean
}

// 首次遊玩只開放劇情模式
const items = computed<MenuItem[]>(() => [
  { label: '劇情模式', to: { name: 'story' }, locked: false },
  { label: '自由對戰', to: { name: 'battle', query: { mode: 'free' } }, locked: !progress.hasClearedFirstBattle },
  { label: '牌組／收藏', to: { name: 'deck' }, locked: !progress.hasClearedFirstBattle },
])

function go(item: MenuItem) {
  if (item.locked) {
    audio.play('sfx_error')
    return
  }
  audio.play('sfx_ui_click')
  void router.push(item.to)
}

function openSettings() {
  audio.play('sfx_ui_click')
  showSettings.value = true
}

onMounted(() => audio.playBgm('bgm_title'))
</script>

<template>
  <main class="page menu">
    <h1>主選單</h1>
    <nav class="list">
      <button
        v-for="item in items"
        :key="item.label"
        type="button"
        class="item panel"
        :class="{ locked: item.locked }"
        :aria-disabled="item.locked"
        @mouseenter="audio.play('sfx_ui_hover')"
        @click="go(item)"
      >
        <span class="label">{{ item.label }}</span>
        <span v-if="item.locked" class="lock">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" />
          </svg>
          完成第 1 場後開放
        </span>
      </button>
      <button type="button" class="item panel" @mouseenter="audio.play('sfx_ui_hover')" @click="openSettings">
        <span class="label">設定</span>
      </button>
    </nav>
    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </main>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}
h1 {
  margin: 4vh 0 0;
  font-size: 40px;
  color: #fff;
  -webkit-text-stroke: 8px var(--c-lavender-deep);
  paint-order: stroke fill;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(420px, 100%);
}
.item {
  border: 3px solid #fff;
  padding: 18px 24px;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.1s;
}
.item:not(.locked):hover {
  transform: scale(1.04);
  border-color: var(--c-lavender);
}
.item:active {
  transform: scale(0.96);
}
.label {
  font-size: 24px;
  font-weight: 900;
}
.item.locked {
  cursor: not-allowed;
  background: rgba(236, 232, 240, 0.9);
}
.item.locked .label {
  color: #8f879a;
}
.lock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--c-ink-soft);
}
.lock svg {
  width: 20px;
  height: 20px;
  fill: #8f879a;
}
</style>

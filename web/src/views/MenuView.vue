<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import SettingsDialog from '@/components/SettingsDialog.vue'
import GameButton from '@/components/ui/GameButton.vue'
import PageTitle from '@/components/ui/PageTitle.vue'
import { portraitUrl } from '@/content/cardStyle'
import { audio } from '@/fx/audio'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progress = useProgressStore()
const showSettings = ref(false)
const figure = portraitUrl('xiaoye')

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
    <img v-if="figure" class="figure" :src="figure" alt="" draggable="false" />
    <div class="group">
      <PageTitle level="page" prefix="shell" faction="common" divider="pearl">主選單</PageTitle>
      <nav class="list">
        <GameButton
          v-for="item in items"
          :key="item.label"
          class="item"
          variant="menu"
          :locked="item.locked"
          locked-hint="完成第 1 場後開放"
          @mouseenter="audio.play('sfx_ui_hover')"
          @click="go(item)"
        >
          {{ item.label }}
        </GameButton>
        <GameButton class="item" variant="menu" @mouseenter="audio.play('sfx_ui_hover')" @click="openSettings">設定</GameButton>
      </nav>
    </div>
    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </main>
</template>

<style scoped>
/* 立繪是正方形圖，可見範圍約佔寬度 15% 到 85% */
.menu {
  --fig-h: clamp(240px, 62vh, 640px);
  --fig-left: 6vw;
  --fig-bottom: 4vh;
  --group-left: calc(var(--fig-left) + var(--fig-h) * 0.85 + 2vw);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-bottom: 10vh;
}
.figure {
  position: fixed;
  left: var(--fig-left);
  bottom: var(--fig-bottom);
  z-index: 0;
  width: var(--fig-h);
  height: var(--fig-h);
  pointer-events: none;
  filter: drop-shadow(0 12px 24px rgba(90, 78, 106, 0.22));
}
.group {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 2vh, 20px);
  width: min(500px, calc(100vw - var(--group-left) - 4vw));
  margin-left: var(--group-left);
}
.list {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.8vh, 16px);
  width: 100%;
}
.list .item {
  width: 100%;
}
@media (max-height: 500px) {
  .menu {
    --fig-h: 78vh;
    --fig-left: 2vw;
    --fig-bottom: -4vh;
    padding-top: 12px;
    padding-bottom: 12px;
  }
  .group {
    width: min(400px, calc(100vw - var(--group-left) - 4vw));
  }
}
/* 直式窄螢幕放不下立繪，只留選單 */
@media (max-aspect-ratio: 1/1) {
  .figure {
    display: none;
  }
  .group {
    width: min(500px, 100%);
    margin: 0 auto;
  }
}
</style>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { assetUrls } from '@/content/assetUrls'
import { audio } from '@/fx/audio'

const router = useRouter()
const hero = assetUrls['stickers/role1-01.png'] ?? null

// 首次點擊同時解鎖瀏覽器音訊
function start() {
  audio.unlock()
  audio.play('sfx_ui_click')
  audio.playBgm('bgm_title')
  void router.push({ name: 'menu' })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') start()
}
onMounted(() => document.querySelector<HTMLElement>('.title-page')?.focus())
</script>

<template>
  <main class="page title-page" tabindex="0" @click="start" @keydown="onKey">
    <div class="logo">
      <img v-if="hero" :src="hero" alt="" class="hero" draggable="false" />
      <h1>海蛞蝓卡牌對戰</h1>
    </div>
    <p class="hint">點擊任意處開始</p>
  </main>
</template>

<style scoped>
.title-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 4vh, 48px);
  cursor: pointer;
  outline: none;
}
.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.hero {
  width: min(260px, 50vw, 38vh);
  filter: drop-shadow(0 10px 18px rgba(62, 53, 80, 0.18));
}
h1 {
  margin: 0;
  text-align: center;
  font-size: clamp(32px, min(6vw, 9vh), 72px);
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.06em;
  -webkit-text-stroke: 6px var(--c-lavender-deep);
  paint-order: stroke fill;
  text-shadow:
    0 3px 0 #8d74c2,
    0 8px 0 rgba(141, 116, 194, 0.35);
}
.hint {
  margin: 0;
  padding: 10px 26px;
  border-radius: 999px;
  background: rgba(255, 253, 247, 0.85);
  font-size: 20px;
  font-weight: 800;
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
</style>

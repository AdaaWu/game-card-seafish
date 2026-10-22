<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageTitle from '@/components/ui/PageTitle.vue'
import { assetUrls } from '@/content/assetUrls'
import { uiImageUrl } from '@/content/cardStyle'
import { audio } from '@/fx/audio'

const router = useRouter()
const hero = assetUrls['portraits/xiaoye.webp'] ?? null
const pearl = uiImageUrl('titles/divider-pearl', true)
const pearlStyle = pearl ? { backgroundImage: `url("${pearl}")` } : {}

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
    <div v-if="hero" class="hero">
      <img :src="hero" alt="" draggable="false" />
    </div>
    <div class="text">
      <PageTitle class="logo" level="page" prefix="leaf" faction="leaf">海蛞蝓卡牌對戰</PageTitle>
      <p class="hint">
        <span>點擊任意處開始</span>
        <span class="rule" :style="pearlStyle" aria-hidden="true" />
      </p>
    </div>
  </main>
</template>

<style scoped>
.title-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 3vh, 36px);
  padding: 24px 16px;
  cursor: pointer;
  outline: none;
}
/* 立繪四周留白多，框只取角色範圍（原圖 1024 中的 153,210 到 870,813） */
.hero {
  position: relative;
  flex-shrink: 0;
  width: clamp(200px, 46vh, 440px);
  aspect-ratio: 717 / 603;
  filter: drop-shadow(0 10px 18px rgba(62, 53, 80, 0.18));
}
.hero img {
  position: absolute;
  left: -21.34%;
  top: -34.83%;
  width: 142.82%;
  height: auto;
}
.text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(12px, 3vh, 32px);
  min-width: 0;
}
.logo {
  --title-page-h: clamp(84px, 12vh, 120px);
  --title-page-fs: clamp(40px, 6.2vh, 60px);
  --title-page-prefix: clamp(52px, 7.6vh, 76px);
}
.hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 8px 22px 4px;
  border-radius: 14px;
  background: rgba(255, 253, 247, 0.85);
  color: var(--btn-primary-500);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.06em;
  animation: hint-fade 1.6s ease-in-out infinite;
}
.rule {
  width: 192px;
  height: 24px;
  background-repeat: repeat-x;
  background-size: 96px 24px;
  background-position: center;
}
/* 只改透明度，不位移不縮放 */
@keyframes hint-fade {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
/* 手機橫向：左角色、右標題與提示 */
@media (max-height: 500px) {
  .title-page {
    flex-direction: row;
    gap: 3vw;
  }
  .hero {
    width: auto;
    height: 78vh;
    height: 78dvh;
  }
  .logo {
    --title-page-h: 48px;
    --title-page-fs: 26px;
    --title-page-prefix: 34px;
  }
  .hint {
    font-size: 17px;
  }
}
</style>

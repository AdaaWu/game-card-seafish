<script setup lang="ts">
// 劇情開場影片：全螢幕播放，可跳過，播完或跳過都 emit done
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GameButton from '@/components/ui/GameButton.vue'
import { assetUrls } from '@/content/assetUrls'

const emit = defineEmits<{ done: [] }>()

const FADE_MS = 300
const src = assetUrls['video/opening.mp4'] ?? null
const leaving = ref(false)
let finished = false
let fadeTimer: ReturnType<typeof setTimeout> | null = null

function finish() {
  if (finished) return
  finished = true
  emit('done')
}

// 跳過時先淡出再切到地圖
function skip() {
  if (leaving.value || finished) return
  leaving.value = true
  fadeTimer = setTimeout(finish, FADE_MS)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') skip()
}

onMounted(() => {
  // 找不到影片檔時直接略過
  if (!src) finish()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <!-- 移到 body 層級，蓋過 App 的設定齒輪 -->
  <Teleport to="body">
    <div v-if="src" class="opening" :class="{ leaving }" role="dialog" aria-label="開場影片">
      <video class="video" :src="src" autoplay muted playsinline @ended="finish" @error="finish" />
      <GameButton class="skip" variant="secondary" size="sm" @click="skip">跳過</GameButton>
    </div>
  </Teleport>
</template>

<style scoped>
.opening {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: #2b2638;
  transition: opacity 300ms ease-out;
}
.opening.leaving {
  opacity: 0;
  pointer-events: none;
}
.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* 右上留給設定齒輪 */
.skip {
  position: absolute;
  top: 14px;
  right: 76px;
}
</style>

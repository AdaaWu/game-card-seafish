<script setup lang="ts">
// 劇情開場影片：全螢幕播放，可跳過，播完或跳過都 emit done
import { onBeforeUnmount, onMounted } from 'vue'
import { assetUrls } from '@/content/assetUrls'

const emit = defineEmits<{ done: [] }>()

const src = assetUrls['video/opening.mp4'] ?? null
let finished = false

function finish() {
  if (finished) return
  finished = true
  emit('done')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') finish()
}

onMounted(() => {
  // 找不到影片檔時直接略過
  if (!src) finish()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="src" class="opening" role="dialog" aria-label="開場影片">
    <video class="video" :src="src" autoplay muted playsinline @ended="finish" @error="finish" />
    <button class="skip btn ghost" type="button" @click="finish">跳過</button>
  </div>
</template>

<style scoped>
.opening {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: #2b2638;
}
.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.skip {
  position: absolute;
  top: 14px;
  right: 16px;
}
</style>

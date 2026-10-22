<!-- 畫面背景：依畫面與直式橫式切換，鋪滿父層 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { assetUrls } from '@/content/assetUrls'
import { backgroundKey, orientationOf, type Orientation, type Screen } from './screenBackground'

const props = defineProps<{ screen: Screen }>()

const orientation = ref<Orientation>(orientationOf(window.innerWidth, window.innerHeight))

function sync() {
  orientation.value = orientationOf(window.innerWidth, window.innerHeight)
}

onMounted(() => window.addEventListener('resize', sync, { passive: true }))
onUnmounted(() => window.removeEventListener('resize', sync))

const src = computed(() => assetUrls[backgroundKey(props.screen, orientation.value)] ?? null)
</script>

<template>
  <div class="screen-bg" aria-hidden="true">
    <img v-if="src" :key="src" class="screen-bg__img" :src="src" alt="" decoding="async" draggable="false" />
  </div>
</template>

<style scoped>
.screen-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.7), transparent 50%),
    linear-gradient(180deg, #e9f6f4 0%, #cde8f1 45%, #b6d6ea 75%, #c9c2e8 100%);
}
.screen-bg__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

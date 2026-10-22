<!-- 設定開關：開與關各一張切片，原生 button 提供空白鍵與 Enter -->
<script setup lang="ts">
import { uiImageUrl } from '@/content/cardStyle'

const props = defineProps<{ modelValue: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const onUrl = uiImageUrl('settings/toggle-on', true)
const offUrl = uiImageUrl('settings/toggle-off', true)

function flip() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button type="button" class="gtoggle" role="switch" :aria-checked="modelValue" :aria-label="label" @click="flip">
    <img :src="modelValue ? onUrl : offUrl" alt="" draggable="false" />
  </button>
</template>

<style scoped>
.gtoggle {
  flex: none;
  display: grid;
  place-items: center;
  width: 72px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.gtoggle:focus {
  outline: none;
}
.gtoggle:focus-visible {
  box-shadow: var(--btn-focus-ring);
}
.gtoggle img {
  width: 64px;
  height: 36px;
}
</style>

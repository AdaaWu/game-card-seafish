<!-- 設定滑桿：軌道、已填段、珍珠把手切片，支援鍵盤與拖曳 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { uiImageUrl } from '@/content/cardStyle'
import { ratioOf, stepByKey, valueFromRatio, type SliderRange } from './slider'

const props = withDefaults(
  defineProps<{ modelValue: number; min?: number; max?: number; step?: number; label: string }>(),
  { min: 0, max: 100, step: 1 },
)
const emit = defineEmits<{ 'update:modelValue': [value: number]; change: [value: number] }>()

const range = computed<SliderRange>(() => ({ min: props.min, max: props.max, step: props.step }))
const percent = computed(() => `${ratioOf(props.modelValue, range.value) * 100}%`)
const trackEl = ref<HTMLElement | null>(null)
const dragging = ref(false)
const CAP = 8

const sliceUrl = (p: string) => {
  const u = uiImageUrl(p, true)
  return u ? `url("${u}")` : 'none'
}
const vars = {
  '--track': sliceUrl('settings/slider-track'),
  '--fill': sliceUrl('settings/slider-fill'),
}
const knobUrl = uiImageUrl('settings/knob', true)

function set(v: number) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function onKey(e: KeyboardEvent) {
  const v = stepByKey(props.modelValue, e.key, range.value)
  if (v === null) return
  e.preventDefault()
  set(v)
  emit('change', v)
}

function fromPointer(e: PointerEvent) {
  const rect = trackEl.value?.getBoundingClientRect()
  // 軌道左右各 8px 是圓頭，不算進數值範圍
  if (!rect || rect.width <= CAP * 2) return
  set(valueFromRatio((e.clientX - rect.left - CAP) / (rect.width - CAP * 2), range.value))
}

function onDown(e: PointerEvent) {
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  fromPointer(e)
}

function onMove(e: PointerEvent) {
  if (dragging.value) fromPointer(e)
}

function onUp() {
  if (!dragging.value) return
  dragging.value = false
  emit('change', props.modelValue)
}
</script>

<template>
  <div
    class="gslider"
    :style="vars"
    role="slider"
    tabindex="0"
    :aria-label="label"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    @keydown="onKey"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <div ref="trackEl" class="gslider__track">
      <div class="gslider__fill" :style="{ width: `calc(${percent} + 8px)` }" />
      <img v-if="knobUrl" class="gslider__knob" :src="knobUrl" alt="" draggable="false" :style="{ left: percent }" />
    </div>
  </div>
</template>

<style scoped>
.gslider {
  position: relative;
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 18px;
  border-radius: 22px;
  cursor: pointer;
  touch-action: none;
  outline: none;
}
.gslider:focus-visible {
  box-shadow: var(--btn-focus-ring);
}
.gslider__track,
.gslider__fill {
  box-sizing: border-box;
  height: 16px;
  border-style: solid;
  border-width: 0 8px;
  border-image-slice: 0 16 0 16 fill;
  border-image-width: 0 8px;
  border-image-repeat: stretch;
}
.gslider__track {
  position: relative;
  flex: 1;
  border-image-source: var(--track);
}
.gslider__fill {
  position: absolute;
  top: 0;
  left: -8px;
  min-width: 16px;
  border-image-source: var(--fill);
}
.gslider__knob {
  position: absolute;
  top: 50%;
  width: 36px;
  height: 36px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
</style>

<script setup lang="ts">
// 設定對話框：音量、動畫速度、跳過教學
import { onBeforeUnmount, onMounted } from 'vue'
import { audio } from '@/fx/audio'
import type { GameSpeed, SettingsData } from '@/persistence'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{ close: [] }>()
const store = useSettingsStore()

const volumes: { key: keyof Pick<SettingsData, 'masterVolume' | 'musicVolume' | 'sfxVolume'>; label: string }[] = [
  { key: 'masterVolume', label: '主音量' },
  { key: 'musicVolume', label: '音樂' },
  { key: 'sfxVolume', label: '音效' },
]

function setVolume(key: (typeof volumes)[number]['key'], e: Event) {
  void store.update({ [key]: Number((e.target as HTMLInputElement).value) })
}

function previewSfx() {
  audio.play('sfx_ui_click')
}

function setSpeed(speed: GameSpeed) {
  audio.play('sfx_ui_click')
  void store.update({ speed })
}

function close() {
  audio.play('sfx_ui_back')
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="backdrop" @click.self="close">
    <section class="dialog panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <h2 id="settings-title">設定</h2>

      <fieldset>
        <legend>音訊</legend>
        <label v-for="v in volumes" :key="v.key" class="row">
          <span>{{ v.label }}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="store.settings[v.key]"
            @input="setVolume(v.key, $event)"
            @change="previewSfx"
          />
          <output>{{ store.settings[v.key] }}</output>
        </label>
      </fieldset>

      <fieldset>
        <legend>動畫速度</legend>
        <div class="seg" role="radiogroup" aria-label="動畫速度">
          <button
            v-for="s in [1, 2] as const"
            :key="s"
            type="button"
            role="radio"
            :aria-checked="store.settings.speed === s"
            :class="{ on: store.settings.speed === s }"
            @click="setSpeed(s)"
          >
            {{ s }}x
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>教學</legend>
        <label class="row check">
          <input
            type="checkbox"
            :checked="store.settings.skipTutorial"
            @change="store.update({ skipTutorial: ($event.target as HTMLInputElement).checked })"
          />
          <span>跳過新手教學</span>
        </label>
      </fieldset>

      <button class="btn" type="button" @click="close">完成</button>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(62, 53, 80, 0.35);
  display: grid;
  place-items: center;
  padding: 16px;
}
.dialog {
  width: min(440px, 100%);
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h2 {
  margin: 0;
  font-size: 26px;
}
fieldset {
  border: none;
  margin: 0;
  padding: 0;
}
legend {
  font-weight: 800;
  color: var(--c-lavender-deep);
  margin-bottom: 6px;
}
.row {
  display: grid;
  grid-template-columns: 70px 1fr 36px;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  font-size: 16px;
}
.row.check {
  grid-template-columns: 28px 1fr;
}
input[type='range'] {
  accent-color: var(--c-lavender-deep);
}
input[type='checkbox'] {
  width: 22px;
  height: 22px;
  accent-color: var(--c-lavender-deep);
}
output {
  text-align: right;
  font-family: var(--font-num);
  font-weight: 800;
}
.seg {
  display: inline-flex;
  background: #ece4f6;
  border-radius: 999px;
  padding: 4px;
}
.seg button {
  border: none;
  background: transparent;
  min-width: 72px;
  min-height: 40px;
  border-radius: 999px;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
}
.seg button.on {
  background: var(--c-lavender-deep);
  color: #fff;
}
</style>

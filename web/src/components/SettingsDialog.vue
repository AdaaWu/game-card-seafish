<script setup lang="ts">
// 設定對話框：音量、動畫速度、跳過教學
import { onBeforeUnmount, onMounted } from 'vue'
import GameButton from '@/components/ui/GameButton.vue'
import GameSlider from '@/components/ui/GameSlider.vue'
import GameToggle from '@/components/ui/GameToggle.vue'
import PageTitle from '@/components/ui/PageTitle.vue'
import { uiImageUrl } from '@/content/cardStyle'
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

const panelUrl = uiImageUrl('panels/panel', true)
const panelStyle = panelUrl ? { borderImageSource: `url("${panelUrl}")` } : {}

function setVolume(key: (typeof volumes)[number]['key'], value: number) {
  void store.update({ [key]: value })
}

function previewSfx() {
  audio.play('sfx_ui_click')
}

function setSpeed(speed: GameSpeed) {
  audio.play('sfx_ui_click')
  void store.update({ speed })
}

function setSkipTutorial(skipTutorial: boolean) {
  audio.play('sfx_ui_click')
  void store.update({ skipTutorial })
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
  <div class="settings-backdrop" @click.self="close">
    <section class="dialog" :style="panelStyle" role="dialog" aria-modal="true" aria-label="設定">
      <PageTitle class="title" level="section" prefix="star" faction="common" divider="seagrass">設定</PageTitle>

      <div class="cols">
        <fieldset>
          <legend>音訊</legend>
          <div v-for="v in volumes" :key="v.key" class="row">
            <span>{{ v.label }}</span>
            <GameSlider
              :model-value="store.settings[v.key]"
              :min="0"
              :max="100"
              :step="5"
              :label="v.label"
              @update:model-value="setVolume(v.key, $event)"
              @change="previewSfx"
            />
            <output>{{ store.settings[v.key] }}</output>
          </div>
        </fieldset>

        <div class="side">
          <fieldset>
            <legend>動畫速度</legend>
            <div class="seg" role="radiogroup" aria-label="動畫速度">
              <GameButton
                v-for="s in [1, 2] as const"
                :key="s"
                :variant="store.settings.speed === s ? 'primary' : 'secondary'"
                size="sm"
                role="radio"
                :aria-checked="store.settings.speed === s"
                @click="setSpeed(s)"
              >
                {{ s }}x
              </GameButton>
            </div>
          </fieldset>

          <fieldset>
            <legend>教學</legend>
            <div class="row toggle-row">
              <span>跳過新手教學</span>
              <GameToggle :model-value="store.settings.skipTutorial" label="跳過新手教學" @update:model-value="setSkipTutorial" />
            </div>
          </fieldset>

          <GameButton class="done" variant="primary" size="lg" @click="close">完成</GameButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(62, 53, 80, 0.35);
  display: grid;
  place-items: center;
  padding: 16px;
}
.dialog {
  --pb: 52px;
  box-sizing: border-box;
  width: min(520px, 100%);
  max-height: 92vh;
  max-height: 92dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 0 4px;
  border-style: solid;
  border-width: var(--pb);
  border-image-slice: 128 fill;
  border-image-width: var(--pb);
  border-image-repeat: stretch;
}
.title {
  align-self: center;
}
.cols,
.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}
legend {
  margin-bottom: 6px;
  padding: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--btn-primary-500);
}
.row {
  display: grid;
  grid-template-columns: 64px 1fr 36px;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  font-size: 16px;
  font-weight: 700;
}
.toggle-row {
  grid-template-columns: 1fr auto;
}
output {
  text-align: right;
  font-family: var(--font-num);
  font-weight: 800;
}
.seg {
  display: flex;
  gap: 8px;
}
.done {
  align-self: center;
  margin-top: 4px;
}
/* 手機橫向改兩欄：左音訊，右速度、教學與完成 */
@media (max-height: 500px) {
  .dialog {
    --pb: 28px;
    width: min(760px, 100%);
    gap: 4px;
  }
  .title :deep(.ptitle__divider) {
    display: none;
  }
  .cols {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 22px;
  }
  .side {
    gap: 6px;
  }
  .row {
    min-height: 40px;
  }
  .done {
    align-self: flex-start;
  }
}
</style>

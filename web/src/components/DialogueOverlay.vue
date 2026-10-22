<script setup lang="ts">
// 劇情對話：逐字打字、點擊下一句、快轉、跳過、紀錄
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/CharacterPortrait.vue'
import GameButton from '@/components/ui/GameButton.vue'
import { characterByName } from '@/content'
import { portraitUrl, uiImageUrl } from '@/content/cardStyle'
import type { DialogueLine, Faction } from '@/content/types'
import { audio } from '@/fx/audio'

const props = withDefaults(
  defineProps<{ lines: DialogueLine[]; protagonist?: string; opponentFaction?: Faction }>(),
  { protagonist: '小葉', opponentFaction: undefined },
)
const emit = defineEmits<{ done: [] }>()

const CHAR_MS = 30
const FAST_LINE_MS = 150

const index = ref(0)
const shown = ref(0)
const fast = ref(false)
const confirmSkip = ref(false)
const showLog = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const line = computed(() => props.lines[index.value])
const chars = computed(() => [...(line.value?.text ?? '')])
const typing = computed(() => shown.value < chars.value.length)
const visibleText = computed(() => chars.value.slice(0, shown.value).join(''))
const opponent = computed(() => props.lines.find((l) => l.speaker !== props.protagonist)?.speaker ?? '')
const leftActive = computed(() => line.value?.speaker === props.protagonist)
const history = computed(() => props.lines.slice(0, index.value + 1))
// 對話用無框大立繪，缺圖時退回頭像
const leftUrl = computed(() => portraitUrl(characterByName(props.protagonist)?.id))
const rightUrl = computed(() => portraitUrl(characterByName(opponent.value)?.id))
const failed = ref<Record<string, boolean>>({})
const nameplate = uiImageUrl('panels/nameplate', true)
const nameplateStyle = nameplate ? { borderImageSource: `url("${nameplate}")` } : {}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function tick() {
  if (!typing.value) {
    if (fast.value) timer = setTimeout(next, FAST_LINE_MS)
    return
  }
  if (fast.value) {
    shown.value = chars.value.length
    timer = setTimeout(next, FAST_LINE_MS)
    return
  }
  shown.value += 1
  if (shown.value % 3 === 1) audio.play('sfx_text_blip')
  timer = setTimeout(tick, CHAR_MS)
}

function startLine() {
  clearTimer()
  shown.value = 0
  if (!line.value) {
    emit('done')
    return
  }
  tick()
}

function next() {
  clearTimer()
  if (index.value >= props.lines.length - 1) {
    emit('done')
    return
  }
  index.value += 1
}

// 點一下先補完整句，再點才下一句
function advance() {
  if (confirmSkip.value || showLog.value) return
  if (typing.value) {
    clearTimer()
    shown.value = chars.value.length
    return
  }
  audio.play('sfx_dialog_next')
  next()
}

function toggleFast() {
  fast.value = !fast.value
  clearTimer()
  tick()
}

function skip() {
  clearTimer()
  confirmSkip.value = false
  emit('done')
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    advance()
  } else if (e.key === 'Escape') {
    confirmSkip.value = false
    showLog.value = false
  }
}

watch(index, startLine)
watch(
  () => props.lines,
  () => {
    index.value = 0
    startLine()
  },
)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  startLine()
})
onBeforeUnmount(() => {
  clearTimer()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="overlay" @click="advance">
    <div class="tools" @click.stop>
      <GameButton :variant="fast ? 'primary' : 'secondary'" size="sm" :aria-pressed="fast" @click="toggleFast">快轉</GameButton>
      <GameButton variant="secondary" size="sm" @click="confirmSkip = true">跳過</GameButton>
      <GameButton variant="secondary" size="sm" @click="showLog = true">紀錄</GameButton>
    </div>

    <div class="stage">
      <div class="side left" :class="{ dim: !leftActive }">
        <img
          v-if="leftUrl && !failed[protagonist]"
          class="figure"
          :src="leftUrl"
          :alt="protagonist"
          draggable="false"
          @error="failed[protagonist] = true"
        />
        <CharacterPortrait v-else :name="protagonist" :size="200" />
      </div>
      <div v-if="opponent" class="side right" :class="{ dim: leftActive }">
        <img
          v-if="rightUrl && !failed[opponent]"
          class="figure"
          :src="rightUrl"
          :alt="opponent"
          draggable="false"
          @error="failed[opponent] = true"
        />
        <CharacterPortrait v-else :name="opponent" :faction="opponentFaction" :size="200" />
      </div>
    </div>

    <div v-if="line" class="box panel" aria-live="polite">
      <div class="speaker" :class="{ right: !leftActive }" :style="nameplateStyle">{{ line.speaker }}</div>
      <p class="text">{{ visibleText }}<span v-if="!typing" class="caret" aria-hidden="true">▼</span></p>
    </div>

    <div v-if="confirmSkip" class="modal-backdrop" @click.stop>
      <div class="modal panel" role="alertdialog" aria-label="跳過對話確認">
        <p>要跳過這段對話嗎？</p>
        <div class="actions">
          <GameButton variant="secondary" @click="confirmSkip = false">繼續看</GameButton>
          <GameButton variant="primary" @click="skip">跳過</GameButton>
        </div>
      </div>
    </div>

    <div v-if="showLog" class="modal-backdrop" @click.stop="showLog = false">
      <div class="modal log panel" role="dialog" aria-label="對話紀錄" @click.stop>
        <ol>
          <li v-for="(l, i) in history" :key="i">
            <strong>{{ l.speaker }}</strong>
            <span>{{ l.text }}</span>
          </li>
        </ol>
        <GameButton variant="primary" @click="showLog = false">關閉</GameButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: linear-gradient(180deg, rgba(62, 53, 80, 0.35), rgba(62, 53, 80, 0.6));
  -webkit-backdrop-filter: blur(8px) saturate(0.8);
  backdrop-filter: blur(8px) saturate(0.8);
  cursor: pointer;
  user-select: none;
}
.tools {
  position: absolute;
  top: 14px;
  right: 76px;
  display: flex;
  gap: 8px;
  z-index: 2;
}
.stage {
  --fig-h: clamp(420px, 72vh, 760px);
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.side {
  position: absolute;
  bottom: 12vh;
  bottom: 12dvh;
  transition:
    filter 0.2s,
    opacity 0.2s;
}
.side.left {
  left: 4vw;
}
.side.right {
  right: 4vw;
  z-index: 1;
}
.side:not(.dim) {
  z-index: 2;
}
/* 說話者加白色外光；非說話者壓暗，不位移不縮放 */
.side:not(.dim) .figure {
  filter: drop-shadow(0 0 1px #fff) drop-shadow(0 12px 24px rgba(90, 78, 106, 0.2));
}
.side.dim {
  filter: brightness(0.7) saturate(0.6);
  opacity: 0.85;
}
.figure {
  display: block;
  height: var(--fig-h);
  width: auto;
  max-width: 44vw;
  object-fit: contain;
  filter: drop-shadow(0 12px 24px rgba(90, 78, 106, 0.2));
}
@supports (height: 1dvh) {
  .stage {
    --fig-h: clamp(420px, 72dvh, 760px);
  }
}
.box {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: 2vh;
  transform: translateX(-50%);
  width: min(960px, calc(100% - 32px));
  min-height: min(150px, 23vh);
  max-height: 23vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 16px 32px 22px;
  border: 3px solid #fff;
  background: #fbf6ec;
}
.speaker {
  flex: none;
  box-sizing: border-box;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  height: 44px;
  margin-bottom: 8px;
  padding: 0 4px 4px 18px;
  border-style: solid;
  border-width: 0 22px;
  border-image-slice: 0 52 0 52 fill;
  border-image-width: 0 22px;
  border-image-repeat: stretch;
  white-space: nowrap;
  color: var(--c-ink);
  font-weight: 900;
  font-size: 18px;
}
.speaker.right {
  align-self: flex-end;
}
.text {
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  font-size: 22px;
  line-height: 1.6;
}
.caret {
  display: inline-block;
  margin-left: 6px;
  font-size: 14px;
  color: var(--c-lavender-deep);
}
.modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  background: rgba(62, 53, 80, 0.3);
  cursor: default;
  padding: 16px;
}
.modal {
  padding: 22px 26px;
  text-align: center;
  max-width: 100%;
}
.modal p {
  font-size: 20px;
  margin: 0 0 16px;
}
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.log {
  width: min(640px, 100%);
  max-height: 70vh;
  overflow: auto;
  text-align: left;
}
.log ol {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.log li {
  display: flex;
  gap: 12px;
  font-size: 17px;
  line-height: 1.5;
}
.log strong {
  flex: none;
  min-width: 4.5em;
  color: var(--c-lavender-deep);
}
/* 矮螢幕名牌放在文字左側，不佔高度 */
@media (max-height: 500px) {
  .stage {
    --fig-h: 78vh;
  }
  @supports (height: 1dvh) {
    .stage {
      --fig-h: 78dvh;
    }
  }
  .box {
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 20px 8px;
  }
  .speaker {
    height: 36px;
    margin-bottom: 0;
    padding: 0 2px 3px 14px;
    border-width: 0 18px;
    border-image-width: 0 18px;
    font-size: 15px;
  }
  .speaker.right {
    order: 1;
    align-self: flex-start;
  }
  .text {
    flex: 1;
  }
  .text {
    font-size: 18px;
    line-height: 1.5;
  }
}
@media (max-width: 720px) {
  .stage :deep(.portrait) {
    width: 110px !important;
    height: 110px !important;
  }
  .text {
    font-size: 18px;
  }
}
@media (orientation: portrait) {
  .stage {
    --fig-h: 50vh;
  }
  .side {
    bottom: 16vh;
  }
  .side.left {
    left: -8vw;
  }
  .side.right {
    right: -8vw;
  }
  @supports (height: 1dvh) {
    .stage {
      --fig-h: 50dvh;
    }
  }
}
/* 手機直式只留說話者，避免兩張立繪重疊 */
@media (orientation: portrait) and (max-width: 599px) {
  .side.dim {
    display: none;
  }
}
</style>

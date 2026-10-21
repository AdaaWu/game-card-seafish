<script setup lang="ts">
// 劇情對話：逐字打字、點擊下一句、快轉、跳過、紀錄
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CharacterPortrait from '@/components/CharacterPortrait.vue'
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
      <button class="tool" :class="{ on: fast }" type="button" :aria-pressed="fast" @click="toggleFast">快轉</button>
      <button class="tool" type="button" @click="confirmSkip = true">跳過</button>
      <button class="tool" type="button" @click="showLog = true">紀錄</button>
    </div>

    <div class="stage">
      <div class="side left" :class="{ dim: !leftActive }">
        <CharacterPortrait :name="protagonist" :size="200" />
      </div>
      <div v-if="opponent" class="side right" :class="{ dim: leftActive }">
        <CharacterPortrait :name="opponent" :faction="opponentFaction" :size="200" />
      </div>
    </div>

    <div v-if="line" class="box panel" aria-live="polite">
      <div class="speaker" :class="{ right: !leftActive }">{{ line.speaker }}</div>
      <p class="text">{{ visibleText }}<span v-if="!typing" class="caret" aria-hidden="true">▼</span></p>
    </div>

    <div v-if="confirmSkip" class="modal-backdrop" @click.stop>
      <div class="modal panel" role="alertdialog" aria-label="跳過對話確認">
        <p>要跳過這段對話嗎？</p>
        <div class="actions">
          <button class="btn ghost" type="button" @click="confirmSkip = false">繼續看</button>
          <button class="btn" type="button" @click="skip">跳過</button>
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
        <button class="btn" type="button" @click="showLog = false">關閉</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: linear-gradient(180deg, rgba(62, 53, 80, 0.05), rgba(62, 53, 80, 0.35));
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
.tool {
  min-height: 44px;
  min-width: 64px;
  border: none;
  border-radius: 999px;
  background: #fffdf7;
  font-weight: 800;
  font-size: 15px;
  box-shadow: var(--shadow);
  cursor: pointer;
}
.tool.on {
  background: var(--c-butter);
}
.stage {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 210px;
  display: flex;
  justify-content: space-between;
  padding: 0 6vw;
  pointer-events: none;
}
.side {
  transition:
    filter 0.2s,
    transform 0.2s;
}
.side.dim {
  filter: brightness(0.6) saturate(0.7);
  transform: scale(0.94);
}
.side.right {
  margin-left: auto;
}
.box {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: min(960px, calc(100% - 32px));
  min-height: 150px;
  box-sizing: border-box;
  padding: 34px 32px 22px;
  border: 3px solid #fff;
}
.speaker {
  position: absolute;
  top: -20px;
  left: 28px;
  padding: 6px 20px;
  border-radius: 999px;
  background: var(--c-lavender-deep);
  color: #fff;
  font-weight: 900;
  font-size: 18px;
}
.speaker.right {
  left: auto;
  right: 28px;
  background: #5e9fb0;
}
.text {
  margin: 0;
  font-size: 22px;
  line-height: 1.6;
}
.caret {
  display: inline-block;
  margin-left: 6px;
  font-size: 14px;
  color: var(--c-lavender-deep);
  animation: bob 0.9s ease-in-out infinite;
}
@keyframes bob {
  50% {
    transform: translateY(3px);
  }
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
@media (max-width: 720px) {
  .stage {
    bottom: 190px;
  }
  .stage :deep(.portrait) {
    width: 110px !important;
    height: 110px !important;
  }
  .text {
    font-size: 18px;
  }
}
</style>

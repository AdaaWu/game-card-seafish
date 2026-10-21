<script setup lang="ts">
// 新手教學疊層：遮罩挖洞、高亮外框、說明框、步驟計數、跳過鈕；座標為對戰邏輯 px
import { computed, ref } from 'vue'
import type { Rect } from '@/render/battle/battleLayout'
import type { Beat } from '@/tutorial/tutorialFlow'

export type Hole = Rect & { focus: string }

const props = defineProps<{
  beat: Beat | null
  // 動畫播放中只留跳過鈕
  showGuide: boolean
  holes: Hole[]
  total: number
  lw: number
  lh: number
  skipAt: Rect
  nudgeKey: number
  keyword: { label: string; desc: string } | null
}>()
const emit = defineEmits<{ next: []; skip: [] }>()

const confirming = ref(false)

const CALLOUT_W = 760
const GAP = 28
// 說明框估計高度（三行字＋步驟列）
const CALLOUT_MIN_H = 320

const anchor = computed<Rect | null>(() => {
  if (props.holes.length === 0) return null
  const x = Math.min(...props.holes.map((h) => h.x))
  const y = Math.min(...props.holes.map((h) => h.y))
  const r = Math.max(...props.holes.map((h) => h.x + h.w))
  const b = Math.max(...props.holes.map((h) => h.y + h.h))
  return { x, y, w: r - x, h: b - y }
})

// 說明框放在目標上下空間較大的一側
const calloutStyle = computed(() => {
  const w = Math.min(CALLOUT_W, props.lw - 80)
  const a = anchor.value
  if (!a) return { left: `${(props.lw - w) / 2}px`, top: `${props.lh * 0.16}px`, width: `${w}px` }
  const left = Math.min(Math.max(a.x + a.w / 2 - w / 2, 40), props.lw - w - 40)
  const spaceAbove = a.y
  const spaceBelow = props.lh - (a.y + a.h)
  // 上下都放不下時改放目標左右兩側空間較大的一邊
  if (Math.max(spaceAbove, spaceBelow) < CALLOUT_MIN_H) {
    const leftSpace = a.x
    const rightSpace = props.lw - (a.x + a.w)
    const sw = Math.min(w, Math.max(leftSpace, rightSpace) - GAP - 40)
    const x = leftSpace >= rightSpace ? a.x - GAP - sw : a.x + a.w + GAP
    const top = Math.min(Math.max(a.y + a.h / 2 - CALLOUT_MIN_H / 2, 20), props.lh - CALLOUT_MIN_H - 20)
    return { left: `${x}px`, top: `${top}px`, width: `${sw}px` }
  }
  const above = spaceAbove > spaceBelow
  return above
    ? { left: `${left}px`, bottom: `${Math.max(props.lh - a.y + GAP, 20)}px`, width: `${w}px` }
    : { left: `${left}px`, top: `${Math.min(a.y + a.h + GAP, props.lh - 200)}px`, width: `${w}px` }
})

const pos = (r: Rect) => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })

function askSkip() {
  confirming.value = true
}

function confirmSkip() {
  confirming.value = false
  emit('skip')
}
</script>

<template>
  <div class="tutorial" data-testid="tutorial" :data-beat="beat?.id ?? ''">
    <template v-if="beat && showGuide">
      <svg v-if="beat.dim !== 'none'" class="mask" :class="beat.dim" :width="lw" :height="lh" :viewBox="`0 0 ${lw} ${lh}`" aria-hidden="true">
        <defs>
          <mask id="tutorial-holes">
            <rect :width="lw" :height="lh" fill="#fff" />
            <rect v-for="(h, i) in holes" :key="i" :x="h.x" :y="h.y" :width="h.w" :height="h.h" rx="22" fill="#000" />
          </mask>
        </defs>
        <rect :width="lw" :height="lh" mask="url(#tutorial-holes)" />
      </svg>
      <div
        v-for="(h, i) in holes"
        :key="`${i}-${nudgeKey}`"
        class="ring"
        :class="{ nudge: nudgeKey > 0 }"
        :style="pos(h)"
        :data-focus="h.focus"
        data-testid="tutorial-hole"
      />
      <div v-if="beat.kind === 'info'" class="catcher" data-testid="tutorial-catcher" @pointerdown.stop @click="emit('next')" />
      <div class="callout" :style="calloutStyle" role="status" data-testid="tutorial-callout">
        <div class="counter" data-testid="tutorial-step">{{ beat.step }} / {{ total }}　{{ beat.title }}</div>
        <p class="text">{{ beat.text }}</p>
        <p v-if="keyword" class="keyword"><b>{{ keyword.label }}</b>：{{ keyword.desc }}</p>
        <button v-if="beat.kind === 'info'" class="btn next" type="button" data-testid="tutorial-next" @pointerdown.stop @click="emit('next')">
          下一步 ▸
        </button>
      </div>
    </template>
    <div class="skip" :style="{ right: `${lw - skipAt.x - skipAt.w}px`, top: `${skipAt.y}px` }" @pointerdown.stop>
      <template v-if="confirming">
        <span class="ask">確定跳過教學？</span>
        <button class="btn" type="button" data-testid="tutorial-skip-confirm" @click="confirmSkip">跳過</button>
        <button class="btn ghost" type="button" data-testid="tutorial-skip-cancel" @click="confirming = false">繼續教學</button>
      </template>
      <button v-else class="btn ghost" type="button" data-testid="tutorial-skip" @click="askSkip">跳過教學</button>
    </div>
  </div>
</template>

<style scoped>
/* 不設 z-index，子層直接和對戰疊層排序 */
.tutorial {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.mask {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 29;
}
.mask.dark rect:last-child {
  fill: rgba(30, 24, 48, 0.6);
}
.mask.light rect:last-child {
  fill: rgba(30, 24, 48, 0.25);
}
/* 強調目標：外框光暈與透明度脈動，不位移、不縮放 */
.ring {
  position: absolute;
  z-index: 29;
  box-sizing: border-box;
  border: 5px solid var(--c-butter);
  border-radius: 22px;
  box-shadow: 0 0 18px 6px rgba(246, 227, 161, 0.65);
  animation: tutorial-pulse 1.4s ease-in-out infinite;
}
.ring.nudge {
  animation:
    tutorial-flash 0.18s linear 3,
    tutorial-pulse 1.4s ease-in-out 0.54s infinite;
}
.catcher {
  position: absolute;
  inset: 0;
  z-index: 55;
  pointer-events: auto;
  cursor: pointer;
}
.callout {
  position: absolute;
  z-index: 56;
  box-sizing: border-box;
  padding: 0.7em 1.1em 0.8em;
  border-radius: 24px;
  background: rgba(255, 253, 247, 0.97);
  border: 4px solid var(--c-lavender-deep);
  box-shadow: var(--shadow);
  font-size: max(30px, calc(var(--min-font) * 1.5));
  font-weight: 800;
  line-height: 1.4;
  color: var(--c-ink);
}
.counter {
  font-size: max(22px, calc(var(--min-font) * 1.1));
  color: var(--c-lavender-deep);
}
.text {
  margin: 0.2em 0 0;
}
.keyword {
  margin: 0.4em 0 0;
  padding: 0.3em 0.6em;
  border-radius: 14px;
  background: #efe9f8;
  font-size: 0.85em;
}
.next {
  pointer-events: auto;
  display: block;
  margin: 0.4em 0 0 auto;
  min-height: var(--btn-h);
  padding: 0 1em;
  font-size: max(24px, var(--min-font));
}
.skip {
  position: absolute;
  z-index: 57;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}
.skip .btn {
  min-height: var(--btn-h);
  padding: 0 0.9em;
  font-size: max(24px, var(--min-font));
}
.ask {
  padding: 0.2em 0.6em;
  border-radius: 12px;
  background: rgba(255, 253, 247, 0.95);
  font-size: max(24px, var(--min-font));
  font-weight: 800;
}
@keyframes tutorial-pulse {
  50% {
    opacity: 0.55;
    box-shadow: 0 0 30px 12px rgba(246, 227, 161, 0.9);
  }
}
@keyframes tutorial-flash {
  50% {
    opacity: 0.1;
  }
}
</style>

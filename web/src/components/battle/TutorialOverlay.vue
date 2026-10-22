<script setup lang="ts">
// 新手教學疊層：遮罩挖洞、高亮外框、說明框、步驟計數、跳過鈕；座標為對戰邏輯 px
import { onUnmounted, ref, watch } from 'vue'
import GameButton from '@/components/ui/GameButton.vue'
import { uiImageUrl } from '@/content/cardStyle'
import type { Rect } from '@/render/battle/battleLayout'
import type { Beat } from '@/tutorial/tutorialFlow'

export type Hole = Rect & { focus: string }

defineProps<{
  beat: Beat | null
  // 動畫播放中只留跳過鈕
  showGuide: boolean
  holes: Hole[]
  total: number
  lw: number
  lh: number
  skipAt: Rect
  // 說明框位置由對戰畫面依避讓規則算好
  callout: Rect
  nudgeKey: number
  keyword: { label: string; desc: string } | null
}>()
const emit = defineEmits<{ next: []; skip: []; measure: [height: number] }>()

const confirming = ref(false)
const panel = uiImageUrl('panels/panel', true)
const panelVar = panel ? `url("${panel}")` : 'none'

// 回報說明框實際高度（邏輯 px），供避讓計算使用
const calloutEl = ref<HTMLElement | null>(null)
let observer: ResizeObserver | null = null
watch(calloutEl, (el) => {
  observer?.disconnect()
  if (!el) return
  observer = new ResizeObserver(() => emit('measure', el.offsetHeight))
  observer.observe(el)
})
onUnmounted(() => observer?.disconnect())

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
      <div
        ref="calloutEl"
        class="callout"
        :style="{ left: `${callout.x}px`, top: `${callout.y}px`, width: `${callout.w}px`, '--panel': panelVar }"
        role="status"
        data-testid="tutorial-callout"
      >
        <div class="counter" data-testid="tutorial-step">{{ beat.step }} / {{ total }}　{{ beat.title }}</div>
        <p class="text">{{ beat.text }}</p>
        <p v-if="keyword" class="keyword"><b>{{ keyword.label }}</b>：{{ keyword.desc }}</p>
        <GameButton
          v-if="beat.kind === 'info'"
          class="next"
          variant="primary"
          data-testid="tutorial-next"
          @pointerdown.stop
          @click="emit('next')"
        >
          下一步 ▸
        </GameButton>
      </div>
    </template>
    <div class="skip" :style="{ right: `${lw - skipAt.x - skipAt.w}px`, top: `${skipAt.y}px` }" @pointerdown.stop>
      <template v-if="confirming">
        <span class="ask">確定跳過教學？</span>
        <GameButton variant="primary" size="sm" data-testid="tutorial-skip-confirm" @click="confirmSkip">跳過</GameButton>
        <GameButton variant="secondary" size="sm" data-testid="tutorial-skip-cancel" @click="confirming = false">繼續教學</GameButton>
      </template>
      <GameButton v-else variant="secondary" size="sm" data-testid="tutorial-skip" @click="askSkip">跳過教學</GameButton>
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
/* 說明框外框用面板九宮格，四角貝殼不拉伸 */
.callout {
  position: absolute;
  z-index: 56;
  box-sizing: border-box;
  padding: 0 0.3em;
  border-style: solid;
  border-width: 52px;
  border-image-source: var(--panel);
  border-image-slice: 128 fill;
  border-image-width: 52px;
  border-image-repeat: stretch;
  filter: drop-shadow(0 8px 18px rgba(62, 53, 80, 0.22));
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
  display: flex;
  margin: 0.4em 0 0 auto;
}
.skip {
  position: absolute;
  z-index: 57;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
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

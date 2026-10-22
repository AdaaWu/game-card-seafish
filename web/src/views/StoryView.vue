<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterPortrait from '@/components/CharacterPortrait.vue'
import DialogueOverlay from '@/components/DialogueOverlay.vue'
import OpeningVideo from '@/components/OpeningVideo.vue'
import GameButton from '@/components/ui/GameButton.vue'
import PageTitle from '@/components/ui/PageTitle.vue'
import { story } from '@/content'
import { portraitUrl, uiImageUrl } from '@/content/cardStyle'
import type { DialogueLine, StoryBattle } from '@/content/types'
import { audio } from '@/fx/audio'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { chapterTitleStyle, isBossBattle, nodePortraitId, nodeVisual, pathSlice } from './storyMap'

const router = useRouter()
const progress = useProgressStore()
const settings = useSettingsStore()

const selectedId = ref<string | null>(null)
const dialogue = ref<{ lines: DialogueLine[]; battle: StoryBattle; phase: 'pre' | 'after' } | null>(null)
const justUnlockedId = ref<string | null>(null)
const showOpening = ref(false)
const failedFigure = ref(false)

const selected = computed(() => story.chapters.flatMap((c) => c.battles).find((b) => b.id === selectedId.value) ?? null)
const selectedFigure = computed(() => (selected.value ? portraitUrl(nodePortraitId(selected.value.enemy.name)) : null))

const sliceUrl = (p: string) => uiImageUrl(p, true) ?? ''
const bgImage = (p: string) => {
  const u = uiImageUrl(p, true)
  return u ? `url("${u}")` : 'none'
}
const panelStyle = { borderImageSource: bgImage('panels/panel') }
const nameplateStyle = { borderImageSource: bgImage('panels/nameplate') }
const lockUrl = sliceUrl('icons/icon-lock')

const chapters = computed(() =>
  story.chapters.map((ch) => ({
    ch,
    title: chapterTitleStyle(ch.battles[0]?.enemy.faction ?? 'neutral'),
    nodes: ch.battles.map((b, i) => {
      const status = progress.statusOf(b.id)
      const boss = isBossBattle(i, ch.battles.length)
      const visual = nodeVisual(status, boss)
      return {
        b,
        status,
        boss,
        visual,
        ringUrl: sliceUrl(visual.ringPath),
        face: portraitUrl(nodePortraitId(b.enemy.name)),
        pathStyle: { backgroundImage: bgImage(pathSlice(status)) },
      }
    }),
  })),
)

function select(b: StoryBattle) {
  if (progress.statusOf(b.id) === 'locked') {
    audio.play('sfx_error')
    return
  }
  audio.play('sfx_ui_click')
  failedFigure.value = false
  selectedId.value = b.id
}

function startSelected() {
  const b = selected.value
  if (!b) return
  progress.startBattle(b.id)
  audio.play('sfx_ui_click')
  audio.playBgm('bgm_story_calm')
  selectedId.value = null
  dialogue.value = { lines: b.pre, battle: b, phase: 'pre' }
}

function closePopup() {
  selectedId.value = null
}

function onDialogueDone() {
  const d = dialogue.value
  dialogue.value = null
  if (!d) return
  if (d.phase === 'pre') {
    void router.push({ name: 'battle', query: { battleId: d.battle.id } })
    return
  }
  const outcome = progress.consumeOutcome()
  audio.playBgm('bgm_map')
  if (outcome?.newlyUnlockedId) {
    justUnlockedId.value = outcome.newlyUnlockedId
    audio.play('sfx_unlock')
    setTimeout(() => (justUnlockedId.value = null), 1600)
  } else if (outcome?.result === 'lose') {
    selectedId.value = outcome.battleId
  }
}

function replayOpening() {
  audio.play('sfx_ui_click')
  showOpening.value = true
}

function onOpeningDone() {
  showOpening.value = false
  if (!settings.settings.seenOpening) void settings.update({ seenOpening: true })
}

function back() {
  audio.play('sfx_ui_back')
  void router.push({ name: 'menu' })
}

// 從對戰回來時播放戰後或落敗對話
onMounted(() => {
  const outcome = progress.pendingOutcome
  const battle = outcome && story.chapters.flatMap((c) => c.battles).find((b) => b.id === outcome.battleId)
  if (outcome && battle) {
    audio.playBgm(outcome.result === 'win' ? 'bgm_story_calm' : 'bgm_story_tense')
    dialogue.value = { lines: outcome.result === 'win' ? battle.post : battle.defeat, battle, phase: 'after' }
  } else {
    progress.consumeOutcome()
    audio.playBgm('bgm_map')
    // 第一次進入劇情模式時自動播放開場
    if (!settings.settings.seenOpening) showOpening.value = true
  }
})
</script>

<template>
  <main class="page story">
    <GameButton class="back" variant="secondary" size="sm" @click="back">返回</GameButton>
    <GameButton class="replay" variant="text" size="sm" @click="replayOpening">重看開場</GameButton>
    <PageTitle level="page" prefix="leaf" faction="common" divider="seagrass">劇情模式</PageTitle>

    <div class="chapters">
      <section v-for="{ ch, title, nodes } in chapters" :key="ch.id" class="chapter" :style="panelStyle">
        <header>
          <PageTitle level="section" :prefix="title.prefix" :faction="title.faction">{{ ch.title }}</PageTitle>
          <p>{{ ch.summary }}</p>
        </header>
        <ol class="path">
          <li v-for="(n, i) in nodes" :key="n.b.id" class="stop">
            <span v-if="i > 0" class="pearls" :style="n.pathStyle" aria-hidden="true" />
            <div class="slot">
              <button
                type="button"
                class="node"
                :class="[n.status, { boss: n.boss, unlocking: justUnlockedId === n.b.id }]"
                :aria-label="`${n.b.title}（${n.visual.statusText}）`"
                @click="select(n.b)"
              >
                <img class="ring" :src="n.ringUrl" alt="" draggable="false" />
                <span class="face" :class="{ dim: n.visual.dimFace }">
                  <img v-if="n.face" :src="n.face" alt="" draggable="false" />
                </span>
                <img
                  v-if="n.visual.showLock || justUnlockedId === n.b.id"
                  class="lk"
                  :src="lockUrl"
                  alt=""
                  draggable="false"
                />
                <svg v-if="n.visual.checkBadge" viewBox="0 0 24 24" class="badge" aria-hidden="true">
                  <path d="M12 4C6 4 3 9 3 13l9 7 9-7c0-4-3-9-9-9z" />
                  <path class="check" d="M8 12l3 3 5-6" />
                </svg>
              </button>
            </div>
            <span class="caption">{{ n.b.title }}</span>
            <span class="status">{{ n.visual.statusText }}</span>
          </li>
        </ol>
      </section>
    </div>

    <div v-if="selected" class="popup-backdrop" @click.self="closePopup">
      <div class="popup" :style="panelStyle" role="dialog" :aria-label="selected.title">
        <img
          v-if="selectedFigure && !failedFigure"
          class="figure"
          :src="selectedFigure"
          :alt="selected.enemy.name"
          draggable="false"
          @error="failedFigure = true"
        />
        <CharacterPortrait v-else class="figure-fallback" :name="selected.enemy.name" :faction="selected.enemy.faction" :size="160" />
        <div class="info">
          <PageTitle level="section" prefix="shell" :faction="selected.enemy.faction">{{ selected.title }}</PageTitle>
          <span class="nameplate" :style="nameplateStyle">
            {{ selected.enemy.name }}
            <img
              v-if="sliceUrl(`icons/icon-faction-${selected.enemy.faction}`)"
              class="fac"
              :src="sliceUrl(`icons/icon-faction-${selected.enemy.faction}`)"
              alt=""
              draggable="false"
            />
          </span>
          <p class="meta">
            {{ selected.enemy.species }}・難度
            <span class="stars" :aria-label="`${selected.difficulty} 顆星`">{{ '★'.repeat(selected.difficulty) }}</span>
            ・對手生命 {{ selected.enemyHeroHp }}
          </p>
          <p class="meta">推薦牌組：葉陣營起始牌組</p>
          <div class="actions">
            <GameButton variant="secondary" @click="closePopup">取消</GameButton>
            <GameButton variant="primary" @click="startSelected">開始</GameButton>
          </div>
        </div>
      </div>
    </div>

    <DialogueOverlay
      v-if="dialogue"
      :lines="dialogue.lines"
      :opponent-faction="dialogue.battle.enemy.faction"
      @done="onDialogueDone"
    />

    <OpeningVideo v-if="showOpening" @done="onOpeningDone" />
  </main>
</template>

<style scoped>
.story {
  --nd: clamp(72px, min(12.4vh, 8vw), 120px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
}
.back {
  position: fixed;
  top: 14px;
  left: 16px;
  z-index: 40;
}
.replay {
  position: fixed;
  top: 16px;
  right: 76px;
  z-index: 40;
}
.chapters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(1000px, 100%);
}
.chapter {
  --pb: 48px;
  box-sizing: border-box;
  border-style: solid;
  border-width: var(--pb);
  border-image-slice: 128 fill;
  border-image-width: var(--pb);
  border-image-repeat: stretch;
  padding: 0 4px 6px;
}
header {
  margin-top: -12px;
}
header p {
  margin: 6px 0 4px 8px;
  color: var(--c-ink-soft);
  font-size: 15px;
  line-height: 1.5;
}
.path {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.stop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
/* 珍珠路徑：從前一個節點邊緣接到本節點邊緣 */
.pearls {
  position: absolute;
  z-index: 0;
  top: calc(var(--nd) * 0.6 - 12px);
  right: calc(50% + var(--nd) / 2 - 4px);
  width: calc(100% - var(--nd) + 8px);
  height: 24px;
  background-repeat: repeat-x;
  background-size: 64px 24px;
  background-position: center;
}
.slot {
  position: relative;
  z-index: 1;
  height: calc(var(--nd) * 1.2);
  display: grid;
  place-items: center;
}
.node {
  position: relative;
  width: var(--nd);
  height: var(--nd);
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  transition: filter 120ms;
  -webkit-tap-highlight-color: transparent;
}
.node.boss {
  width: calc(var(--nd) * 1.2);
  height: calc(var(--nd) * 1.2);
}
.node:focus {
  outline: none;
}
.node:focus-visible {
  box-shadow: var(--btn-focus-ring);
}
.node.locked {
  cursor: not-allowed;
}
@media (hover: hover) {
  .node:not(.locked):hover {
    filter: drop-shadow(0 0 10px rgba(246, 227, 161, 0.95));
  }
}
.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.face {
  position: absolute;
  z-index: 1;
  left: 18%;
  top: 16%;
  width: 64%;
  height: 64%;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.node.boss .face {
  left: 21%;
  top: 26%;
  width: 58%;
  height: 58%;
}
.face img {
  width: 128%;
  height: 128%;
  object-fit: contain;
}
.face.dim img {
  filter: grayscale(1) brightness(1.15) opacity(0.45);
}
.lk {
  position: absolute;
  z-index: 2;
  left: 31%;
  top: 29%;
  width: 38%;
  height: 38%;
}
.node.boss .lk {
  top: 36%;
}
.badge {
  position: absolute;
  z-index: 2;
  right: -4px;
  bottom: -2px;
  width: 34%;
  height: 34%;
}
.badge path {
  fill: #fbe1e7;
  stroke: #d48aa0;
  stroke-width: 1.5;
}
.badge .check {
  fill: none;
  stroke: var(--c-buff);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* 可挑戰：外圈光暈只改透明度 */
.node.available::before {
  content: '';
  position: absolute;
  inset: -6%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(246, 227, 161, 0) 52%, rgba(246, 227, 161, 0.85) 66%, rgba(246, 227, 161, 0) 74%);
  animation: node-glow 1.8s ease-in-out infinite;
}
/* 解鎖演出只播一次：鎖頭淡出、光暈擴散，節點本體不動 */
.node.unlocking::before {
  animation: none;
}
.node.unlocking .lk {
  animation: lock-out 1.2s ease-out forwards;
}
.node.unlocking::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: unlock-glow 1.4s ease-out forwards;
}
.caption {
  font-weight: 800;
  font-size: 16px;
  text-align: center;
}
.status {
  font-size: 13px;
  color: var(--c-ink-soft);
}
.popup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(62, 53, 80, 0.3);
  padding: 16px;
}
.popup {
  --pb: 52px;
  --fig: clamp(200px, 52vh, 480px);
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  gap: 24px;
  max-width: 92vw;
  border-style: solid;
  border-width: var(--pb);
  border-image-slice: 128 fill;
  border-image-width: var(--pb);
  border-image-repeat: stretch;
}
.figure {
  flex: none;
  height: var(--fig);
  width: var(--fig);
  margin: calc(var(--fig) * -0.3) 0 -8px -12px;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 10px 18px rgba(90, 78, 106, 0.25));
}
.info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 300px;
  padding-bottom: 6px;
}
.nameplate {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 0 4px 18px;
  border-style: solid;
  border-width: 0 22px;
  border-image-slice: 0 52 0 52 fill;
  border-image-width: 0 22px;
  border-image-repeat: stretch;
  white-space: nowrap;
  font-size: 19px;
  font-weight: 900;
}
.fac {
  width: 28px;
  height: 28px;
}
.meta {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--c-ink-soft);
}
.stars {
  color: #e0a43a;
  letter-spacing: 2px;
}
.actions {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}
@keyframes node-glow {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
@keyframes lock-out {
  to {
    opacity: 0;
  }
}
@keyframes unlock-glow {
  0% {
    box-shadow: 0 0 0 0 rgba(246, 227, 161, 0.95);
  }
  100% {
    box-shadow: 0 0 0 22px rgba(246, 227, 161, 0);
  }
}
/* 手機橫向 */
@media (max-height: 500px) {
  .chapter {
    --pb: 36px;
  }
  header p {
    font-size: 13px;
  }
  .caption {
    font-size: 14px;
  }
  .popup {
    --pb: 36px;
    --fig: 70vh;
    gap: 12px;
  }
  .figure {
    margin-top: -12vh;
  }
  .info {
    min-width: 280px;
    gap: 4px;
  }
  .nameplate {
    height: 38px;
    font-size: 17px;
  }
  .meta {
    font-size: 14px;
    line-height: 1.45;
  }
}
@media (max-width: 640px) {
  .popup {
    --fig: 36vh;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .figure {
    margin: -10vh 0 0;
  }
  .info {
    min-width: 0;
    align-items: center;
  }
  .path {
    grid-template-columns: 1fr;
    row-gap: 18px;
  }
  /* 小螢幕改直排：節點在左、標題與狀態在右 */
  .stop {
    display: grid;
    grid-template-columns: calc(var(--nd) * 1.2) 1fr;
    column-gap: 14px;
    row-gap: 2px;
    align-items: center;
  }
  .slot {
    grid-row: 1 / span 2;
  }
  .caption {
    align-self: end;
    text-align: left;
  }
  .status {
    align-self: start;
  }
  .pearls {
    top: -21px;
    right: auto;
    left: calc(var(--nd) * 0.6 - 9px);
    width: 18px;
    transform: rotate(90deg);
  }
}
</style>

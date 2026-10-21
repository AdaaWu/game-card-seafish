<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterPortrait from '@/components/CharacterPortrait.vue'
import DialogueOverlay from '@/components/DialogueOverlay.vue'
import OpeningVideo from '@/components/OpeningVideo.vue'
import { story } from '@/content'
import { FACTION_STYLE } from '@/content/cardStyle'
import type { DialogueLine, StoryBattle } from '@/content/types'
import { audio } from '@/fx/audio'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const progress = useProgressStore()
const settings = useSettingsStore()

const selectedId = ref<string | null>(null)
const dialogue = ref<{ lines: DialogueLine[]; battle: StoryBattle; phase: 'pre' | 'after' } | null>(null)
const justUnlockedId = ref<string | null>(null)
const showOpening = ref(false)

const selected = computed(() => story.chapters.flatMap((c) => c.battles).find((b) => b.id === selectedId.value) ?? null)

const STATUS_LABEL = { locked: '未解鎖', available: '可挑戰', cleared: '已通關' } as const

function select(b: StoryBattle) {
  if (progress.statusOf(b.id) === 'locked') {
    audio.play('sfx_error')
    return
  }
  audio.play('sfx_ui_click')
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
    <button class="back btn ghost" type="button" @click="back">返回</button>
    <h1>劇情模式</h1>
    <button class="replay btn ghost" type="button" @click="replayOpening">重看開場</button>

    <div class="chapters">
      <section v-for="ch in story.chapters" :key="ch.id" class="chapter panel">
        <header>
          <h2>{{ ch.title }}</h2>
          <p>{{ ch.summary }}</p>
        </header>
        <ol class="path">
          <li v-for="(b, i) in ch.battles" :key="b.id" class="stop">
            <span v-if="i > 0" class="reef" aria-hidden="true" />
            <button
              type="button"
              class="node"
              :class="[progress.statusOf(b.id), { unlocking: justUnlockedId === b.id }]"
              :style="{ '--fc': FACTION_STYLE[b.enemy.faction].main, '--fd': FACTION_STYLE[b.enemy.faction].dark }"
              :aria-label="`${b.title}（${STATUS_LABEL[progress.statusOf(b.id)]}）`"
              @click="select(b)"
            >
              <svg v-if="progress.statusOf(b.id) === 'locked'" viewBox="0 0 24 24" class="state-icon" aria-hidden="true">
                <path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" />
              </svg>
              <template v-else>
                <span class="no">{{ i + 1 }}</span>
                <svg v-if="progress.statusOf(b.id) === 'cleared'" viewBox="0 0 24 24" class="shell" aria-hidden="true">
                  <path d="M12 4C6 4 3 9 3 13l9 7 9-7c0-4-3-9-9-9z" />
                  <path class="check" d="M8 12l3 3 5-6" />
                </svg>
              </template>
            </button>
            <span class="caption">{{ b.title }}</span>
            <span class="status">{{ STATUS_LABEL[progress.statusOf(b.id)] }}</span>
          </li>
        </ol>
      </section>
    </div>

    <div v-if="selected" class="popup-backdrop" @click.self="selectedId = null">
      <div class="popup panel" role="dialog" :aria-label="selected.title">
        <CharacterPortrait :name="selected.enemy.name" :faction="selected.enemy.faction" :size="120" />
        <div class="info">
          <h3>{{ selected.title }}</h3>
          <p class="enemy">對手：{{ selected.enemy.name }}（{{ selected.enemy.species }}）</p>
          <p class="meta">
            難度 <span class="stars" :aria-label="`${selected.difficulty} 顆星`">{{ '★'.repeat(selected.difficulty) }}</span>
            ・對手生命 {{ selected.enemyHeroHp }}
          </p>
          <p class="meta">推薦牌組：葉陣營起始牌組</p>
          <div class="actions">
            <button class="btn ghost" type="button" @click="selectedId = null">取消</button>
            <button class="btn" type="button" @click="startSelected">開始</button>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.back {
  position: fixed;
  top: 14px;
  left: 16px;
  z-index: 40;
}
h1 {
  margin: 0;
  font-size: 36px;
  color: #fff;
  -webkit-text-stroke: 8px var(--c-lavender-deep);
  paint-order: stroke fill;
}
.replay {
  margin-top: -8px;
}
.chapters {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(980px, 100%);
}
.chapter {
  padding: 18px 24px 22px;
}
header h2 {
  margin: 0;
  font-size: 22px;
}
header p {
  margin: 4px 0 12px;
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
  gap: 6px;
}
.reef {
  position: absolute;
  top: 40px;
  right: calc(50% + 44px);
  width: calc(100% - 88px);
  border-top: 6px dotted #f2b8c6;
}
.node {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 5px solid var(--fd);
  background: radial-gradient(circle at 40% 35%, #fff, var(--fc));
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.15s;
}
.node.available {
  animation: glow 1.8s ease-in-out infinite;
}
.node.available:hover,
.node.cleared:hover {
  transform: scale(1.08);
}
.node.locked {
  background: #e4e0e8;
  border-color: var(--c-disabled);
  cursor: not-allowed;
}
.node.unlocking {
  animation: unlock 1.4s ease-out;
}
.no {
  font-family: var(--font-num);
  font-weight: 800;
  font-size: 32px;
  color: #fff;
  -webkit-text-stroke: 6px var(--c-ink);
  paint-order: stroke fill;
}
.state-icon {
  width: 34px;
  height: 34px;
  fill: #8f879a;
}
.shell {
  position: absolute;
  right: -10px;
  bottom: -8px;
  width: 38px;
  height: 38px;
}
.shell path {
  fill: #fbe1e7;
  stroke: #d48aa0;
  stroke-width: 1.5;
}
.shell .check {
  fill: none;
  stroke: var(--c-buff);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
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
  display: flex;
  gap: 20px;
  padding: 24px;
  width: min(520px, 100%);
  box-sizing: border-box;
  border: 3px solid #fff;
}
.info h3 {
  margin: 0 0 6px;
  font-size: 24px;
}
.info p {
  margin: 4px 0;
}
.enemy {
  font-weight: 700;
}
.meta {
  font-size: 15px;
  color: var(--c-ink-soft);
}
.stars {
  color: #e0a43a;
  letter-spacing: 2px;
}
.actions {
  margin-top: 14px;
  display: flex;
  gap: 12px;
}
@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(246, 227, 161, 0.9);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(246, 227, 161, 0.4);
  }
}
@keyframes unlock {
  0% {
    transform: scale(0.7) rotate(-10deg);
    filter: grayscale(1);
  }
  40% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}
@media (max-width: 640px) {
  .popup {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .actions {
    justify-content: center;
  }
  .node {
    width: 64px;
    height: 64px;
  }
  .reef {
    top: 30px;
    right: calc(50% + 34px);
    width: calc(100% - 68px);
  }
}
</style>

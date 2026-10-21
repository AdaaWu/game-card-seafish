<!-- 對戰頁：劇情戰用 currentBattle 開打，自由對戰先選對手 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BattleScreen from '@/components/battle/BattleScreen.vue'
import OpponentPicker from '@/components/battle/OpponentPicker.vue'
import { FREE_HERO_HP, storyPortraitId, type FreeOpponent } from '@/components/battle/opponents'
import { decks } from '@/content'
import { audio } from '@/fx/audio'
import { PLAYER_DECK_ID, useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const progress = useProgressStore()

const queryBattleId = computed(() => (typeof route.query.battleId === 'string' ? route.query.battleId : null))
const freeMode = computed(() => route.query.mode === 'free')
const freeOpponent = ref<FreeOpponent | null>(null)
const reporting = ref(false)

// 重新整理後 currentBattle 會遺失，依網址補回
onMounted(() => {
  const id = queryBattleId.value
  if (id && progress.currentBattle?.id !== id && progress.statusOf(id) !== 'locked') progress.startBattle(id)
  const b = progress.currentBattle
  if (!freeMode.value && b) audio.playBgm(b.isChapterFinal ? 'bgm_battle_boss' : 'bgm_battle_normal')
})
onUnmounted(() => audio.stopBgm())

const storyBattle = computed(() => (freeMode.value ? null : progress.currentBattle))

function pickFree(o: FreeOpponent) {
  audio.unlock()
  audio.play('sfx_ui_click')
  freeOpponent.value = o
  audio.playBgm(o.deckId === 'ai-boss' ? 'bgm_battle_boss' : 'bgm_battle_normal')
}

// 平手視為失敗；回報後由 App 導回章節地圖
async function storyFinished(result: 'win' | 'lose' | 'draw') {
  const id = storyBattle.value?.id
  if (!id || reporting.value) return
  reporting.value = true
  await progress.reportBattleResult(id, result === 'win' ? 'win' : 'lose')
}

function freeFinished() {
  void router.push({ name: 'menu' })
}
</script>

<template>
  <BattleScreen
    v-if="storyBattle"
    :key="storyBattle.id"
    :player-deck="decks[storyBattle.playerDeckId] ?? decks[PLAYER_DECK_ID] ?? []"
    :enemy-deck="decks[storyBattle.enemyDeckId] ?? []"
    :enemy-name="storyBattle.enemy.name"
    :enemy-portrait-id="storyPortraitId(storyBattle.enemy.name)"
    :enemy-hero-hp="storyBattle.enemyHeroHp"
    :bgm="storyBattle.isChapterFinal ? 'bgm_battle_boss' : 'bgm_battle_normal'"
    @finished="storyFinished"
  />
  <template v-else-if="freeMode">
    <BattleScreen
      v-if="freeOpponent"
      :player-deck="decks[PLAYER_DECK_ID] ?? []"
      :enemy-deck="decks[freeOpponent.deckId] ?? []"
      :enemy-name="freeOpponent.name"
      :enemy-portrait-id="freeOpponent.portraitId"
      :enemy-hero-hp="FREE_HERO_HP"
      :bgm="freeOpponent.deckId === 'ai-boss' ? 'bgm_battle_boss' : 'bgm_battle_normal'"
      exit-label="回選單"
      @finished="freeFinished"
    />
    <main v-else class="page">
      <OpponentPicker title="自由對戰" @pick="pickFree">
        <button class="btn ghost back" type="button" @click="router.push({ name: 'menu' })">返回</button>
      </OpponentPicker>
    </main>
  </template>
  <main v-else class="page empty">
    <div class="panel box">
      <h1>沒有進行中的對戰</h1>
      <button class="btn" type="button" @click="router.push({ name: 'story' })">回到章節地圖</button>
    </div>
  </main>
</template>

<style scoped>
.empty {
  display: grid;
  place-items: center;
}
.box {
  padding: 28px 36px;
  text-align: center;
}
.back {
  margin-top: 20px;
}
</style>

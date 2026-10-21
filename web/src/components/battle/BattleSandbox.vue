<script setup lang="ts">
// 測試頁：starter-leaf 對任一 AI 牌組
import { onUnmounted, ref } from 'vue'
import { decks } from '@/content'
import { audio } from '@/fx/audio'
import BattleScreen from './BattleScreen.vue'
import OpponentPicker from './OpponentPicker.vue'
import { FREE_HERO_HP, type FreeOpponent } from './opponents'

const opponent = ref<FreeOpponent | null>(null)
const seedText = ref('')
const seed = ref<number | undefined>(undefined)
const last = ref<string | null>(null)
const round = ref(0)

function start(o: FreeOpponent) {
  audio.unlock()
  audio.play('sfx_ui_click')
  const n = Number.parseInt(seedText.value, 10)
  seed.value = Number.isFinite(n) ? n : undefined
  opponent.value = o
  round.value++
  audio.playBgm(o.deckId === 'ai-boss' ? 'bgm_battle_boss' : 'bgm_battle_normal')
}

function finished(result: string) {
  last.value = `${opponent.value?.label ?? ''}：${result}`
  opponent.value = null
  audio.stopBgm()
}

onUnmounted(() => audio.stopBgm())
</script>

<template>
  <main v-if="!opponent" class="page">
    <OpponentPicker title="對戰測試場" @pick="start">
      <label class="seed">
        種子（可留空）
        <input v-model="seedText" inputmode="numeric" data-testid="seed" />
      </label>
      <p v-if="last" class="last" data-testid="last-result">上一場：{{ last }}</p>
    </OpponentPicker>
  </main>
  <BattleScreen
    v-else
    :key="round"
    :player-deck="decks['starter-leaf'] ?? []"
    :enemy-deck="decks[opponent.deckId] ?? []"
    :enemy-name="opponent.name"
    :enemy-hero-hp="FREE_HERO_HP"
    :seed="seed"
    @finished="finished"
  />
</template>

<style scoped>
.seed {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-top: 20px;
  font-size: 16px;
}
.seed input {
  width: 120px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 2px solid #e2d8c8;
  font: inherit;
}
.last {
  margin-top: 12px;
  color: var(--c-ink-soft);
}
</style>

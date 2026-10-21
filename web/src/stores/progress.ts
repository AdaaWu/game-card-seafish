// 劇情進度：解鎖、目前戰鬥、戰鬥結果
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { decks, story } from '@/content'
import type { Faction, StoryBattle } from '@/content/types'
import { openGameDb, ProgressRepository } from '@/persistence'

export type BattleStatus = 'locked' | 'available' | 'cleared'
export type BattleResult = 'win' | 'lose'

export interface CurrentBattle extends StoryBattle {
  chapterId: string
  isChapterFinal: boolean
  enemyDeckId: string
  playerDeckId: string
}

export interface BattleOutcome {
  battleId: string
  result: BattleResult
  newlyUnlockedId: string | null
}

export const PLAYER_DECK_ID = 'starter-leaf'

const ENEMY_DECK_BY_FACTION: Record<Faction, string> = {
  leaf: 'starter-leaf',
  tide: 'ai-tide',
  frost: 'ai-frost',
  light: 'ai-light',
  neutral: 'ai-boss',
}

// 依章節順序攤平的所有戰鬥
export const orderedBattles: CurrentBattle[] = story.chapters.flatMap((ch) =>
  ch.battles.map((b, i) => ({
    ...b,
    chapterId: ch.id,
    isChapterFinal: i === ch.battles.length - 1,
    enemyDeckId: decks[ENEMY_DECK_BY_FACTION[b.enemy.faction]] ? ENEMY_DECK_BY_FACTION[b.enemy.faction] : PLAYER_DECK_ID,
    playerDeckId: PLAYER_DECK_ID,
  })),
)

function findBattle(battleId: string): CurrentBattle {
  const battle = orderedBattles.find((b) => b.id === battleId)
  if (!battle) throw new Error(`[progress] 找不到戰鬥 ${battleId}`)
  return battle
}

// 第一場永遠開放，其餘需前一場通關
function statusFor(battleId: string, cleared: readonly string[]): BattleStatus {
  if (cleared.includes(battleId)) return 'cleared'
  const index = orderedBattles.findIndex((b) => b.id === battleId)
  if (index < 0) return 'locked'
  if (index === 0) return 'available'
  return cleared.includes(orderedBattles[index - 1]!.id) ? 'available' : 'locked'
}

let defaultRepo: ProgressRepository | null = null

export const useProgressStore = defineStore('progress', () => {
  let repo: ProgressRepository | null = null
  const clearedBattleIds = ref<string[]>([])
  const currentBattleId = ref<string | null>(null)
  const pendingOutcome = ref<BattleOutcome | null>(null)
  const loaded = ref(false)

  const currentBattle = computed<CurrentBattle | null>(() =>
    currentBattleId.value ? findBattle(currentBattleId.value) : null,
  )
  const statusOf = computed(() => (battleId: string): BattleStatus => statusFor(battleId, clearedBattleIds.value))
  const hasClearedFirstBattle = computed(() => clearedBattleIds.value.includes(orderedBattles[0]?.id ?? ''))

  async function init(customRepo?: ProgressRepository): Promise<void> {
    repo = customRepo ?? (defaultRepo ??= new ProgressRepository(openGameDb()))
    const saved = await repo.load()
    clearedBattleIds.value = saved ? saved.clearedBattleIds.filter((id) => orderedBattles.some((b) => b.id === id)) : []
    loaded.value = true
  }

  function startBattle(battleId: string): CurrentBattle {
    const battle = findBattle(battleId)
    if (statusFor(battleId, clearedBattleIds.value) === 'locked') {
      throw new Error(`[progress] 戰鬥 ${battleId} 尚未解鎖`)
    }
    currentBattleId.value = battleId
    pendingOutcome.value = null
    return battle
  }

  async function reportBattleResult(battleId: string, result: BattleResult): Promise<BattleOutcome> {
    const index = orderedBattles.findIndex((b) => b.id === battleId)
    if (index < 0) throw new Error(`[progress] 找不到戰鬥 ${battleId}`)
    let newlyUnlockedId: string | null = null
    if (result === 'win' && !clearedBattleIds.value.includes(battleId)) {
      clearedBattleIds.value = [...clearedBattleIds.value, battleId]
      const next = orderedBattles[index + 1]
      if (next && statusFor(next.id, clearedBattleIds.value) === 'available') newlyUnlockedId = next.id
      await repo?.save({ clearedBattleIds: clearedBattleIds.value })
    }
    const outcome: BattleOutcome = { battleId, result, newlyUnlockedId }
    pendingOutcome.value = outcome
    currentBattleId.value = null
    return outcome
  }

  // 劇情地圖播完戰後對話後清掉
  function consumeOutcome(): BattleOutcome | null {
    const outcome = pendingOutcome.value
    pendingOutcome.value = null
    return outcome
  }

  return {
    clearedBattleIds,
    currentBattleId,
    pendingOutcome,
    loaded,
    currentBattle,
    statusOf,
    hasClearedFirstBattle,
    init,
    startBattle,
    reportBattleResult,
    consumeOutcome,
  }
})

// 對戰狀態：持有引擎 state 與顯示狀態，玩家與 AI 的指令都經過這裡
import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, toRaw } from 'vue'
import { applyAction, getLegalActions, IllegalActionError, startGame } from '@/engine'
import type { Action, CardDb, GameEvent, GameState } from '@/engine'
import { cardDb, tokens } from '@/content'
import { reduceView, snapshotView, type BattleView } from '@/render/battle/viewModel'

export interface BattleSetup {
  playerDeck: string[]
  enemyDeck: string[]
  enemyHeroHp?: number
  seed: number
  // false 時牌庫照傳入順序
  shuffle?: boolean
}

const tokenSet = new Set(tokens)
const engineDb: CardDb = { cards: Object.values(cardDb).filter((c) => !tokenSet.has(c)), tokens }

export type ActResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string }

export const useBattleStore = defineStore('battle', () => {
  const state = shallowRef<GameState | null>(null)
  const view = ref<BattleView | null>(null)
  const busy = ref(false)

  const legal = computed<Action[]>(() => {
    const s = state.value
    if (!s || busy.value || s.activePlayer !== 'p1') return []
    return getLegalActions(s, 'p1')
  })

  function start(setup: BattleSetup): GameEvent[] {
    const r = startGame({
      cardDb: engineDb,
      decks: { p1: setup.playerDeck, p2: setup.enemyDeck },
      seed: setup.seed,
      heroHealth: setup.enemyHeroHp ? { p2: setup.enemyHeroHp } : undefined,
      ...(setup.shuffle === false ? { shuffle: false } : {}),
    })
    state.value = markRaw(r.state)
    // 開局抽牌由動畫逐張補上
    const v = snapshotView(r.state)
    for (const pid of ['p1', 'p2'] as const) {
      const drawn = new Set(r.events.flatMap((e) => (e.type === 'draw' && e.playerId === pid ? [e.instanceId] : [])))
      v.players[pid].deckCount += drawn.size
      v.players[pid].hand = v.players[pid].hand.filter((c) => !drawn.has(c.instanceId))
      v.players[pid].mana = 0
      v.players[pid].maxMana = 0
    }
    view.value = v
    return r.events
  }

  function act(action: Action): ActResult {
    const s = state.value
    if (!s) return { ok: false, reason: '對戰尚未開始' }
    try {
      const r = applyAction(s, action)
      state.value = markRaw(r.state)
      return { ok: true, events: r.events }
    } catch (e) {
      if (e instanceof IllegalActionError) return { ok: false, reason: e.message }
      throw e
    }
  }

  // 不合法動作的原因直接取引擎錯誤訊息，不在 UI 重寫規則
  function reasonFor(action: Action): string | null {
    const s = state.value
    if (!s) return null
    try {
      applyAction(s, action)
      return null
    } catch (e) {
      return e instanceof IllegalActionError ? e.message : null
    }
  }

  function applyEvent(event: GameEvent): void {
    if (view.value && state.value) view.value = reduceView(toRaw(view.value), event, state.value.cards)
  }

  function sync(): void {
    if (state.value) view.value = snapshotView(state.value)
  }

  function reset(): void {
    state.value = null
    view.value = null
    busy.value = false
  }

  return { state, view, busy, legal, start, act, reasonFor, applyEvent, sync, reset }
})

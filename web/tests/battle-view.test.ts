import { describe, expect, it } from 'vitest'
import { applyAction, createRng, startGame, type CardDb, type GameState } from '@/engine'
import { chooseAction } from '@/ai'
import { cardDb, decks, tokens } from '@/content'
import { reduceView, snapshotView } from '@/render/battle/viewModel'

const db: CardDb = { cards: Object.values(cardDb).filter((c) => !tokens.includes(c)), tokens }

describe('snapshotView 從引擎狀態取顯示狀態', () => {
  it('開局：雙方生命、手牌、牌庫數、回合與行動方', () => {
    const { state } = startGame({ cardDb: db, decks: { p1: decks['starter-leaf']!, p2: decks['ai-tide']! }, seed: 3, heroHealth: { p2: 20 } })
    const v = snapshotView(state)
    expect(v.activePlayer).toBe('p1')
    expect(v.turn).toBe(1)
    expect(v.winner).toBeNull()
    expect(v.players.p1).toMatchObject({ hp: 30, maxHp: 30, armor: 0, mana: 1, maxMana: 1, deckCount: 26 })
    expect(v.players.p2).toMatchObject({ hp: 20, maxHp: 20, deckCount: 26 })
    expect(v.players.p1.hand.map((c) => c.instanceId)).toEqual(state.players.p1.hand.map((c) => c.instanceId))
    expect(v.players.p2.hand).toHaveLength(5)
  })
})

describe('reduceView 逐一套用事件後與引擎最終狀態一致', () => {
  function playOut(seed: number, p2Deck: string) {
    let { state } = startGame({ cardDb: db, decks: { p1: decks['starter-leaf']!, p2: decks[p2Deck]! }, seed })
    const rng = createRng(seed * 7 + 1)
    let steps = 0
    let mismatches = 0
    let view = snapshotView(state)
    while (state.winner === null && steps < 400) {
      const action = chooseAction(state, state.activePlayer, rng)
      const prev: GameState = state
      const r = applyAction(prev, action)
      for (const e of r.events) view = reduceView(view, e, prev.cards)
      if (JSON.stringify(view) !== JSON.stringify(snapshotView(r.state))) mismatches++
      expect(view).toEqual(snapshotView(r.state))
      view = snapshotView(r.state)
      state = r.state
      steps++
    }
    return { steps, mismatches, winner: state.winner }
  }

  for (const [seed, deck] of [
    [1, 'ai-tide'],
    [2, 'ai-frost'],
    [3, 'ai-light'],
    [4, 'ai-boss'],
  ] as const) {
    it(`種子 ${seed} 對 ${deck} 完整一局`, () => {
      const r = playOut(seed, deck)
      expect(r.steps).toBeGreaterThan(10)
      expect(r.mismatches).toBe(0)
    })
  }

  it('不修改傳入的 view', () => {
    const { state } = startGame({ cardDb: db, decks: { p1: decks['starter-leaf']!, p2: decks['ai-tide']! }, seed: 5 })
    const v = snapshotView(state)
    const before = JSON.stringify(v)
    reduceView(v, { type: 'damage', targetId: 'p1-hero', amount: 3, armorAbsorbed: 0 }, state.cards)
    expect(JSON.stringify(v)).toBe(before)
  })

  it('英雄受傷時扣護甲與生命', () => {
    const { state } = startGame({ cardDb: db, decks: { p1: decks['starter-leaf']!, p2: decks['ai-tide']! }, seed: 5 })
    let v = snapshotView(state)
    v = reduceView(v, { type: 'armor', playerId: 'p1', amount: 2 }, state.cards)
    v = reduceView(v, { type: 'damage', targetId: 'p1-hero', amount: 3, armorAbsorbed: 2 }, state.cards)
    expect(v.players.p1).toMatchObject({ hp: 27, armor: 0 })
  })
})

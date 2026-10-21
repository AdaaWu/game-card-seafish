import { describe, expect, it } from 'vitest'
import { applyAction, createGame, createRng, getLegalActions } from '@/engine'
import type { GameState } from '@/engine'
import { DB, mixedDeck, setup } from './helpers'

describe('getLegalActions', () => {
  it('行動玩家一定有 endTurn', () => {
    const s = setup()
    expect(getLegalActions(s, 'p1')).toEqual([{ type: 'endTurn' }])
  })

  it('生物列出每個可放置的位置', () => {
    const s = setup({ p1: { hand: ['v11'], board: ['v04', 'v04'], mana: 1 } })
    const plays = getLegalActions(s, 'p1').filter((a) => a.type === 'playCard')
    expect(plays).toEqual([
      { type: 'playCard', cardInstanceId: 'p1-h0', position: 0 },
      { type: 'playCard', cardInstanceId: 'p1-h0', position: 1 },
      { type: 'playCard', cardInstanceId: 'p1-h0', position: 2 },
    ])
  })

  it('指定目標法術列出每個合法目標，排除敵方潛行', () => {
    const s = setup({ p1: { hand: ['bolt3'], board: ['v04'] }, p2: { board: ['stealth21', 'v22'] } })
    const targets = getLegalActions(s, 'p1')
      .filter((a) => a.type === 'playCard')
      .map((a) => (a.type === 'playCard' ? a.targetId : undefined))
    expect(new Set(targets)).toEqual(new Set(['p1-hero', 'p2-hero', 'p1-m0', 'p2-m1']))
    expect(targets).toHaveLength(4)
  })

  it('潮能不足的牌不列出', () => {
    const s = setup({ p1: { hand: ['v55'], mana: 4 } })
    expect(getLegalActions(s, 'p1')).toEqual([{ type: 'endTurn' }])
  })

  it('隨機走訪：所有列出的動作都能套用不丟錯，最終分出勝負', () => {
    const rng = createRng(2024)
    let s: GameState = createGame({ cardDb: DB, decks: { p1: mixedDeck(0), p2: mixedDeck(7) }, seed: 99 })
    let steps = 0
    while (s.winner === null && steps < 3000) {
      const actions = getLegalActions(s, s.activePlayer)
      expect(actions.length).toBeGreaterThan(0)
      // 偏向不結束回合，讓遊戲有進展
      const nonEnd = actions.filter((a) => a.type !== 'endTurn')
      const pool = nonEnd.length > 0 && rng() < 0.8 ? nonEnd : actions
      const a = pool[Math.floor(rng() * pool.length)]!
      s = applyAction(s, a).state
      steps++
    }
    expect(s.winner).not.toBeNull()
  })
})

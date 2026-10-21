import { describe, expect, it } from 'vitest'
import { applyAction, createGame, createRng, getLegalActions, nextRandom } from '@/engine'
import type { GameEvent, GameState } from '@/engine'
import { DB, mixedDeck } from './helpers'

function randomRun(seed: number, aiSeed: number): { state: GameState; events: GameEvent[] } {
  const rng = createRng(aiSeed)
  let s = createGame({ cardDb: DB, decks: { p1: mixedDeck(0), p2: mixedDeck(3) }, seed })
  const events: GameEvent[] = []
  for (let i = 0; i < 400 && s.winner === null; i++) {
    const actions = getLegalActions(s, s.activePlayer)
    const r = applyAction(s, actions[Math.floor(rng() * actions.length)]!)
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}

describe('deterministic', () => {
  it('createRng 同種子產生相同序列，值介於 [0, 1)', () => {
    const a = createRng(7)
    const b = createRng(7)
    const xs = Array.from({ length: 20 }, () => a())
    expect(Array.from({ length: 20 }, () => b())).toEqual(xs)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(new Set(xs).size).toBe(20)
  })

  it('nextRandom 是純函式', () => {
    expect(nextRandom(123)).toEqual(nextRandom(123))
    expect(nextRandom(123)[1]).not.toBe(123)
  })

  it('同種子開局牌庫順序相同，不同種子不同', () => {
    const order = (seed: number) =>
      createGame({ cardDb: DB, decks: { p1: mixedDeck(), p2: mixedDeck() }, seed }).players.p1.deck.map(
        (c) => c.cardId,
      )
    expect(order(5)).toEqual(order(5))
    expect(order(5)).not.toEqual(order(6))
  })

  it('同種子加同動作序列，狀態與事件完全相同', () => {
    const a = randomRun(11, 22)
    const b = randomRun(11, 22)
    expect(b.state).toEqual(a.state)
    expect(b.events).toEqual(a.events)
  })
})

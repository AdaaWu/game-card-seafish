import { describe, expect, it } from 'vitest'
import { startGame } from '@/engine'
import { DB, mixedDeck } from './helpers'

const p1 = mixedDeck(0)
const p2 = mixedDeck(5)

describe('startGame 不洗牌選項', () => {
  it('shuffle 為 false 時我方依序抽到牌組前 4 張', () => {
    const g = startGame({ cardDb: DB, decks: { p1, p2 }, seed: 42, shuffle: false }).state
    expect(g.players.p1.hand.map((c) => c.cardId)).toEqual(p1.slice(0, 4))
    expect(g.players.p1.deck.map((c) => c.cardId)).toEqual(p1.slice(4))
  })

  it('shuffle 為 false 時對手依序抽到前 4 張再拿珍珠', () => {
    const g = startGame({ cardDb: DB, decks: { p1, p2 }, seed: 42, shuffle: false }).state
    expect(g.players.p2.hand.map((c) => c.cardId)).toEqual([...p2.slice(0, 4), 'token-pearl'])
  })

  it('shuffle 為 false 時不同種子結果相同', () => {
    const a = startGame({ cardDb: DB, decks: { p1, p2 }, seed: 1, shuffle: false }).state
    const b = startGame({ cardDb: DB, decks: { p1, p2 }, seed: 2, shuffle: false }).state
    expect(a.players.p1.hand.map((c) => c.cardId)).toEqual(b.players.p1.hand.map((c) => c.cardId))
  })

  it('不傳 shuffle 時與傳 true 結果相同', () => {
    const a = startGame({ cardDb: DB, decks: { p1, p2 }, seed: 42 }).state
    const b = startGame({ cardDb: DB, decks: { p1, p2 }, seed: 42, shuffle: true }).state
    expect(a).toEqual(b)
  })
})

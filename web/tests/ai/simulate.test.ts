import { describe, expect, it } from 'vitest'
import { MAX_TURNS, simulate } from '@/ai'
import { DB, deckOf, mixedDeck } from '../engine/helpers'

describe('simulate', () => {
  it('雙 AI 對戰能跑完並回傳勝者與回合數', () => {
    const r = simulate(mixedDeck(0), mixedDeck(4), DB, 7)
    expect(['p1', 'p2', 'draw']).toContain(r.winner)
    expect(r.turns).toBeGreaterThanOrEqual(1)
    expect(r.turns).toBeLessThanOrEqual(MAX_TURNS)
  })

  it('同種子同結果', () => {
    expect(simulate(mixedDeck(1), mixedDeck(6), DB, 13)).toEqual(simulate(mixedDeck(1), mixedDeck(6), DB, 13))
  })

  it('多個種子都能正常結束', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = simulate(mixedDeck(seed), mixedDeck(seed + 3), DB, seed)
      expect(r.turns).toBeLessThanOrEqual(MAX_TURNS)
    }
  })

  it('雙方都無法造成傷害時在回合上限判平手並標記 timeout', () => {
    expect(simulate(deckOf('v04'), deckOf('v04'), DB, 1)).toEqual({ winner: 'draw', turns: 60, timeout: true })
  })

  it('分出勝負時 timeout 為 false', () => {
    const r = simulate(deckOf('v33'), deckOf('v04'), DB, 1)
    expect(r.winner).toBe('p1')
    expect(r.timeout).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { simulate } from '@/ai'
import type { CardDb, Winner } from '@/engine'

const files = import.meta.glob('../../../content/cards.phase1.json', { eager: true, import: 'default' })
const db = Object.values(files)[0] as CardDb | undefined

describe.skipIf(!db)('cards.phase1.json 自我對戰', () => {
  const decks = Object.entries(db?.decks ?? {})
  const pairs = decks.flatMap(([a], i) => decks.slice(i + 1).map(([b]) => [a, b] as const))

  it('5 套牌組', () => {
    expect(decks).toHaveLength(5)
  })

  it.each(pairs)('%s 對 %s 各 20 場都能正常結束', (a, b) => {
    const tally: Record<Winner, number> = { p1: 0, p2: 0, draw: 0 }
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulate(db!.decks![a]!, db!.decks![b]!, db!, seed)
      expect(r.turns).toBeLessThanOrEqual(60)
      tally[r.winner]++
    }
    expect(tally.p1 + tally.p2 + tally.draw).toBe(20)
  })
})

describe.skipIf(!db)('cards.phase1.json 資料修正', () => {
  const byId = (id: string) => db!.cards.find((c) => c.id === id)!

  it.each(['frost-005', 'frost-011'])('%s 的冰凍目標為一個敵方生物', (id) => {
    const c = byId(id)
    expect(c.effects.find((e) => e.action === 'freeze')?.target).toBe('chosenEnemyMinion')
    expect(c.text).toContain('冰凍一個敵方生物')
  })
})

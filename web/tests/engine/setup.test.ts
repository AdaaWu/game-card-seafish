import { describe, expect, it } from 'vitest'
import { createGame, startGame } from '@/engine'
import { DB, deckOf } from './helpers'

const config = { cardDb: DB, decks: { p1: deckOf('v11'), p2: deckOf('taunt23') }, seed: 42 }

describe('createGame 開局', () => {
  it('先手抽 3 加回合開始抽 1，後手抽 4 並拿到珍珠', () => {
    const g = createGame(config)
    expect(g.players.p1.hand).toHaveLength(4)
    expect(g.players.p1.deck).toHaveLength(26)
    expect(g.players.p2.hand).toHaveLength(5)
    expect(g.players.p2.deck).toHaveLength(26)
    expect(g.players.p2.hand.filter((c) => c.cardId === 'token-pearl')).toHaveLength(1)
    expect(g.players.p1.hand.filter((c) => c.cardId === 'token-pearl')).toHaveLength(0)
  })

  it('先手第一回合潮能 1/1，後手 0/0', () => {
    const g = createGame(config)
    expect([g.players.p1.mana, g.players.p1.maxMana]).toEqual([1, 1])
    expect([g.players.p2.mana, g.players.p2.maxMana]).toEqual([0, 0])
  })

  it('第 1 回合由 p1 行動且未分勝負', () => {
    const g = createGame(config)
    expect(g.turn).toBe(1)
    expect(g.activePlayer).toBe('p1')
    expect(g.winner).toBeNull()
  })

  it('英雄 HP 預設 30', () => {
    const g = createGame(config)
    expect(g.players.p1.hero).toMatchObject({ id: 'p1-hero', health: 30, maxHealth: 30, armor: 0 })
    expect(g.players.p2.hero).toMatchObject({ id: 'p2-hero', health: 30, maxHealth: 30, armor: 0 })
  })

  it('英雄 HP 可由參數覆寫', () => {
    const g = createGame({ ...config, heroHealth: { p2: 20 } })
    expect(g.players.p1.hero.health).toBe(30)
    expect(g.players.p2.hero.health).toBe(20)
    expect(g.players.p2.hero.maxHealth).toBe(20)
  })

  it('生物實例帶入卡牌數值與關鍵字', () => {
    const g = createGame(config)
    const t = g.players.p2.hand.find((c) => c.cardId === 'taunt23')
    expect(t).toMatchObject({ owner: 'p2', attack: 2, health: 3, maxHealth: 3, keywords: ['taunt'], frozen: false })
  })

  it('所有實例 id 不重複', () => {
    const g = createGame(config)
    const ids = (['p1', 'p2'] as const).flatMap((p) =>
      [...g.players[p].deck, ...g.players[p].hand].map((c) => c.instanceId),
    )
    expect(ids).toHaveLength(61)
    expect(new Set(ids).size).toBe(61)
  })

  it('牌組含未知卡牌時丟錯', () => {
    expect(() => createGame({ ...config, decks: { p1: ['nope'], p2: deckOf('v11') } })).toThrow(/nope/)
  })

  it('startGame 回傳開局事件：8 次抽牌、p1 回合開始、潮能 1/1', () => {
    const { events } = startGame(config)
    expect(events.filter((e) => e.type === 'draw')).toHaveLength(8)
    expect(events).toContainEqual({ type: 'turnStart', playerId: 'p1', turn: 1 })
    expect(events).toContainEqual({ type: 'manaChange', playerId: 'p1', mana: 1, maxMana: 1 })
  })

  it('事件可序列化', () => {
    const { events } = startGame(config)
    expect(JSON.parse(JSON.stringify(events))).toEqual(events)
  })
})

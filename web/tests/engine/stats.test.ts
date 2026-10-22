import { describe, expect, it } from 'vitest'
import { applyAction, initialStats, startGame, tallyEvent } from '@/engine'
import type { Action, BattleStats, GameEvent, GameState } from '@/engine'
import { DB, deckOf } from './helpers'

const tally = (events: GameEvent[], from: BattleStats = initialStats()): BattleStats => events.reduce(tallyEvent, from)

const dmg = (targetId: string, amount: number, armorAbsorbed = 0): GameEvent => ({ type: 'damage', targetId, amount, armorAbsorbed })
const played = (playerId: 'p1' | 'p2', instanceId: string): GameEvent => ({
  type: 'cardPlayed',
  playerId,
  instanceId,
  cardId: 'v11',
  position: 0,
})

describe('統計我方造成的總傷害：成功', () => {
  it('打敵方英雄計入', () => {
    expect(tally([dmg('p2-hero', 3)]).damageDealt).toBe(3)
  })

  it('打敵方出場的生物計入，且不改動原本的統計', () => {
    const before = tally([played('p2', 'c40')])
    const after = tallyEvent(before, dmg('c40', 2))
    expect(after.damageDealt).toBe(2)
    expect(before.damageDealt).toBe(0)
  })

  it('護甲吸收的量也計入', () => {
    expect(tally([dmg('p2-hero', 1, 4)]).damageDealt).toBe(5)
  })

  it('敵方召喚的生物受傷計入', () => {
    const summon: GameEvent = { type: 'summon', playerId: 'p2', instanceId: 'c90', cardId: 'token-fish', position: 1 }
    expect(tally([summon, dmg('c90', 1)]).damageDealt).toBe(1)
  })

  it('多筆傷害累加', () => {
    expect(tally([played('p2', 'c41'), dmg('p2-hero', 2), dmg('c41', 3), dmg('p2-hero', 4, 1)]).damageDealt).toBe(10)
  })
})

describe('統計我方造成的總傷害：邊界', () => {
  it('初始為 0', () => {
    expect(initialStats().damageDealt).toBe(0)
  })

  it('過量傷害照原值計入', () => {
    expect(tally([played('p2', 'c42'), dmg('c42', 7)]).damageDealt).toBe(7)
  })

  it('彈回手牌後重新打出仍認得是敵方生物', () => {
    const bounce: GameEvent = { type: 'bounce', playerId: 'p2', instanceId: 'c43', cardId: 'v11' }
    expect(tally([played('p2', 'c43'), bounce, played('p2', 'c43'), dmg('c43', 2)]).damageDealt).toBe(2)
  })

  it('實際對局：固定種子跑完指令，總傷害等於手算值 3', () => {
    const r = startGame({ cardDb: DB, decks: { p1: deckOf('pinger'), p2: deckOf('pinger') }, seed: 11, shuffle: false })
    let state: GameState = r.state
    let stats = tally(r.events)
    const run = (action: Action) => {
      const next = applyAction(state, action)
      state = next.state
      stats = tally(next.events, stats)
    }
    const firstInHand = (s: GameState) => s.players[s.activePlayer].hand.find((c) => c.cardId === 'pinger')!.instanceId
    // 我方 1 點打敵方英雄
    run({ type: 'playCard', cardInstanceId: firstInHand(state), targetId: 'p2-hero' })
    run({ type: 'endTurn' })
    // 敵方 1 點打我方英雄，不計
    run({ type: 'playCard', cardInstanceId: firstInHand(state), targetId: 'p1-hero' })
    run({ type: 'endTurn' })
    // 我方 1 點打死敵方生物，再用場上生物打敵方英雄 1 點
    const enemyMinion = state.players.p2.board[0]!.instanceId
    const myMinion = state.players.p1.board[0]!.instanceId
    run({ type: 'playCard', cardInstanceId: firstInHand(state), targetId: enemyMinion })
    run({ type: 'attack', attackerId: myMinion, targetId: 'p2-hero' })
    expect(state.players.p2.hero.health).toBe(28)
    expect(state.players.p1.hero.health).toBe(29)
    expect(stats.damageDealt).toBe(3)
  })
})

describe('統計我方造成的總傷害：不應計入', () => {
  it('敵方打我方英雄不計', () => {
    expect(tally([dmg('p1-hero', 5, 2)]).damageDealt).toBe(0)
  })

  it('我方打自己的生物不計', () => {
    expect(tally([played('p1', 'c44'), dmg('c44', 2)]).damageDealt).toBe(0)
  })

  it('敵方疲勞傷害不計，之後的傷害照常計入', () => {
    const fatigue: GameEvent = { type: 'fatigue', playerId: 'p2', damage: 2 }
    expect(tally([fatigue, dmg('p2-hero', 2), dmg('p2-hero', 3)]).damageDealt).toBe(3)
  })

  it('泡泡擋下的攻擊不計', () => {
    expect(tally([played('p2', 'c45'), { type: 'bubblePop', targetId: 'c45' }]).damageDealt).toBe(0)
  })

  it('治療與負值增益不計', () => {
    const heal: GameEvent = { type: 'heal', targetId: 'p2-hero', amount: 3 }
    const debuff: GameEvent = { type: 'buff', targetId: 'c46', atk: -1, hp: -2 }
    expect(tally([played('p2', 'c46'), heal, debuff]).damageDealt).toBe(0)
  })
})

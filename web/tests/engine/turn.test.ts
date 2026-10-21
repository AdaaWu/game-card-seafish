import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, createGame, getLegalActions } from '@/engine'
import { DB, END, act, attack, deckOf, handIds, play, setup } from './helpers'

describe('回合流程', () => {
  it('結束回合後換對手，對手潮能 1/1 並抽 1 張', () => {
    const g = createGame({ cardDb: DB, decks: { p1: deckOf('v11'), p2: deckOf('v22') }, seed: 3 })
    const { state, events } = act(g, END)
    expect(state.activePlayer).toBe('p2')
    expect(state.turn).toBe(2)
    expect([state.players.p2.mana, state.players.p2.maxMana]).toEqual([1, 1])
    expect(state.players.p2.hand).toHaveLength(6)
    expect(state.players.p2.deck).toHaveLength(25)
    expect(events).toContainEqual({ type: 'turnStart', playerId: 'p2', turn: 2 })
    expect(events.filter((e) => e.type === 'draw' && e.playerId === 'p2')).toHaveLength(1)
  })

  it('潮能上限每回合 +1 並補滿', () => {
    const s = setup({ p2: { mana: 0, maxMana: 4 } })
    const { state } = act(s, END)
    expect([state.players.p2.mana, state.players.p2.maxMana]).toEqual([5, 5])
  })

  it('潮能上限最多 10', () => {
    const s = setup({ p2: { mana: 2, maxMana: 10 } })
    const { state } = act(s, END)
    expect([state.players.p2.mana, state.players.p2.maxMana]).toEqual([10, 10])
  })

  it('牌庫空時抽牌受疲勞傷害 1、2 遞增', () => {
    const s = setup({ p2: { deck: [] } })
    const r1 = act(s, END)
    expect(r1.state.players.p2.hero.health).toBe(29)
    expect(r1.events).toContainEqual({ type: 'fatigue', playerId: 'p2', damage: 1 })
    const r2 = act(r1.state, END, END)
    expect(r2.state.players.p2.hero.health).toBe(27)
    expect(r2.events).toContainEqual({ type: 'fatigue', playerId: 'p2', damage: 2 })
  })

  it('疲勞傷害先扣護甲', () => {
    const s = setup({ p2: { deck: [], armor: 3 } })
    const { state } = act(s, END, END, END)
    expect(state.players.p2.hero.armor).toBe(0)
    expect(state.players.p2.hero.health).toBe(30)
  })

  it('手牌已滿 10 張時抽到的牌燒掉', () => {
    const s = setup({ p2: { hand: deckOf('v11', 10), deck: ['v55', 'v22'] } })
    const { state, events } = act(s, END)
    expect(state.players.p2.hand).toHaveLength(10)
    expect(handIds(state, 'p2')).not.toContain('v55')
    expect(state.players.p2.deck).toHaveLength(1)
    expect(events).toContainEqual({ type: 'burn', playerId: 'p2', instanceId: 'p2-d0', cardId: 'v55' })
  })

  it('applyAction 不修改傳入的 state', () => {
    const s = setup({ p1: { hand: ['v22', 'bolt3'], board: ['v33'] }, p2: { board: ['v22'] } })
    const before = structuredClone(s)
    act(s, play('p1-h0'))
    applyAction(s, play('p1-h1', { targetId: 'p2-m0' }))
    applyAction(s, attack('p1-m0', 'p2-m0'))
    applyAction(s, END)
    expect(s).toEqual(before)
  })

  it('非行動玩家的動作丟出 IllegalActionError', () => {
    const s = setup({ p2: { board: ['v22'] } })
    expect(() => applyAction(s, attack('p2-m0', 'p1-hero'))).toThrow(IllegalActionError)
  })

  it('非行動玩家沒有合法動作', () => {
    const s = setup({ p2: { board: ['v22'], hand: ['v11'] } })
    expect(getLegalActions(s, 'p2')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, getLegalActions } from '@/engine'
import { END, act, attack, boardIds, minionOf, play, setup } from './helpers'

const attacksOf = (s: ReturnType<typeof setup>) => getLegalActions(s, 'p1').filter((a) => a.type === 'attack')

describe('攻擊', () => {
  it('生物互打雙方受傷，歸零者死亡', () => {
    const s = setup({ p1: { board: ['v33'] }, p2: { board: ['v22'] } })
    const { state, events } = act(s, attack('p1-m0', 'p2-m0'))
    expect(minionOf(state, 'p1-m0').health).toBe(1)
    expect(boardIds(state, 'p2')).toEqual([])
    expect(events).toContainEqual({ type: 'attack', attackerId: 'p1-m0', targetId: 'p2-m0' })
    expect(events).toContainEqual({ type: 'damage', targetId: 'p2-m0', amount: 3, armorAbsorbed: 0 })
    expect(events).toContainEqual({ type: 'damage', targetId: 'p1-m0', amount: 2, armorAbsorbed: 0 })
    expect(events).toContainEqual({ type: 'death', playerId: 'p2', instanceId: 'p2-m0', cardId: 'v22' })
  })

  it('攻擊英雄時英雄不反擊', () => {
    const s = setup({ p1: { board: ['v33'] } })
    const { state } = act(s, attack('p1-m0', 'p2-hero'))
    expect(state.players.p2.hero.health).toBe(27)
    expect(minionOf(state, 'p1-m0').health).toBe(3)
  })

  it('攻擊英雄先扣護甲', () => {
    const s = setup({ p1: { board: ['v33'] }, p2: { armor: 2 } })
    const { state, events } = act(s, attack('p1-m0', 'p2-hero'))
    expect(state.players.p2.hero).toMatchObject({ health: 29, armor: 0 })
    expect(events).toContainEqual({ type: 'damage', targetId: 'p2-hero', amount: 1, armorAbsorbed: 2 })
  })

  it('每隻生物每回合只能攻擊一次，下回合重置', () => {
    const s = setup({ p1: { board: ['v33'] } })
    const r = act(s, attack('p1-m0', 'p2-hero'))
    expect(() => applyAction(r.state, attack('p1-m0', 'p2-hero'))).toThrow(IllegalActionError)
    const r2 = act(r.state, END, END, attack('p1-m0', 'p2-hero'))
    expect(r2.state.players.p2.hero.health).toBe(24)
  })

  it('英雄不能攻擊', () => {
    const s = setup({ p2: { board: ['v11'] } })
    expect(() => applyAction(s, attack('p1-hero', 'p2-m0'))).toThrow(IllegalActionError)
    expect(attacksOf(s)).toEqual([])
  })

  it('攻擊力 0 的生物不能攻擊', () => {
    const s = setup({ p1: { board: ['v04'] } })
    expect(() => applyAction(s, attack('p1-m0', 'p2-hero'))).toThrow(IllegalActionError)
  })

  it('不能攻擊己方', () => {
    const s = setup({ p1: { board: ['v33', 'v22'] } })
    expect(() => applyAction(s, attack('p1-m0', 'p1-m1'))).toThrow(IllegalActionError)
    expect(() => applyAction(s, attack('p1-m0', 'p1-hero'))).toThrow(IllegalActionError)
  })
})

describe('taunt', () => {
  it('敵方有 taunt 時只能攻擊 taunt 生物', () => {
    const s = setup({ p1: { board: ['v33'] }, p2: { board: ['v11', 'taunt23'] } })
    expect(() => applyAction(s, attack('p1-m0', 'p2-hero'))).toThrow(IllegalActionError)
    expect(() => applyAction(s, attack('p1-m0', 'p2-m0'))).toThrow(IllegalActionError)
    expect(attacksOf(s)).toEqual([{ type: 'attack', attackerId: 'p1-m0', targetId: 'p2-m1' }])
    const { state } = act(s, attack('p1-m0', 'p2-m1'))
    expect(boardIds(state, 'p2')).toEqual(['v11'])
  })
})

describe('stealth', () => {
  it('潛行生物不能被敵方攻擊或指定', () => {
    const s = setup({ p1: { board: ['v33'], hand: ['bolt3'] }, p2: { board: ['stealth21'] } })
    expect(() => applyAction(s, attack('p1-m0', 'p2-m0'))).toThrow(IllegalActionError)
    expect(() => applyAction(s, play('p1-h0', { targetId: 'p2-m0' }))).toThrow(IllegalActionError)
  })

  it('潛行不阻擋 all 與 random 效果', () => {
    const s = setup({ p1: { hand: ['aoe1', 'randomBolt'] }, p2: { board: ['stealth21', { cardId: 'stealth21', health: 5 }] } })
    const { state } = act(s, play('p1-h0'), play('p1-h1'))
    expect(boardIds(state, 'p2')).toEqual(['stealth21'])
    expect(minionOf(state, 'p2-m1').health).toBe(2)
  })

  it('己方可以指定自己的潛行生物', () => {
    const s = setup({ p1: { board: ['stealth21'], hand: ['buff22'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p1-m0' }))
    expect(minionOf(state, 'p1-m0')).toMatchObject({ attack: 4, health: 3 })
  })

  it('攻擊後失去潛行', () => {
    const s = setup({ p1: { board: ['stealth21'] } })
    const { state } = act(s, attack('p1-m0', 'p2-hero'))
    expect(minionOf(state, 'p1-m0').keywords).not.toContain('stealth')
    expect(state.players.p2.hero.health).toBe(28)
  })
})

describe('bubble', () => {
  it('抵擋一次傷害後消失', () => {
    const s = setup({ p1: { board: ['v33', 'v22'] }, p2: { board: ['bubble23'] } })
    const r = act(s, attack('p1-m0', 'p2-m0'))
    expect(minionOf(r.state, 'p2-m0')).toMatchObject({ health: 3 })
    expect(minionOf(r.state, 'p2-m0').keywords).not.toContain('bubble')
    expect(minionOf(r.state, 'p1-m0').health).toBe(1)
    expect(r.events).toContainEqual({ type: 'bubblePop', targetId: 'p2-m0' })
    const r2 = act(r.state, attack('p1-m1', 'p2-m0'))
    expect(minionOf(r2.state, 'p2-m0').health).toBe(1)
  })
})

describe('lifesteal', () => {
  it('造成傷害時為英雄回復等量', () => {
    const s = setup({ p1: { board: ['lifesteal33'], health: 25 } })
    const { state, events } = act(s, attack('p1-m0', 'p2-hero'))
    expect(state.players.p2.hero.health).toBe(27)
    expect(state.players.p1.hero.health).toBe(28)
    expect(events).toContainEqual({ type: 'heal', targetId: 'p1-hero', amount: 3 })
  })

  it('回復不超過上限', () => {
    const s = setup({ p1: { board: ['lifesteal33'], health: 29 } })
    const { state } = act(s, attack('p1-m0', 'p2-hero'))
    expect(state.players.p1.hero.health).toBe(30)
  })

  it('打在 bubble 上沒有造成傷害就不回血', () => {
    const s = setup({ p1: { board: ['lifesteal33'], health: 25 }, p2: { board: ['bubble23'] } })
    const { state } = act(s, attack('p1-m0', 'p2-m0'))
    expect(state.players.p1.hero.health).toBe(25)
  })
})

describe('freeze', () => {
  it('被凍結的生物在擁有者下個回合不能攻擊，該回合結束時解凍', () => {
    const s = setup({ p1: { hand: ['frostbite'] }, p2: { board: ['v22'] } })
    const r1 = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(minionOf(r1.state, 'p2-m0').frozen).toBe(true)
    expect(r1.events).toContainEqual({ type: 'freeze', targetId: 'p2-m0' })

    const r2 = act(r1.state, END)
    expect(() => applyAction(r2.state, attack('p2-m0', 'p1-hero'))).toThrow(IllegalActionError)
    expect(getLegalActions(r2.state, 'p2').filter((a) => a.type === 'attack')).toEqual([])

    const r3 = act(r2.state, END)
    expect(minionOf(r3.state, 'p2-m0').frozen).toBe(false)
    expect(r3.events).toContainEqual({ type: 'unfreeze', targetId: 'p2-m0' })

    const r4 = act(r3.state, END, attack('p2-m0', 'p1-hero'))
    expect(r4.state.players.p1.hero.health).toBe(28)
  })
})

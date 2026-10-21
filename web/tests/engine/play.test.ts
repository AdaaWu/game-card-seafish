import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, getLegalActions } from '@/engine'
import { END, act, attack, boardIds, deckOf, handIds, minionOf, play, setup } from './helpers'

describe('打出卡牌', () => {
  it('打出生物扣潮能並放到指定位置', () => {
    const s = setup({ p1: { hand: ['v22', 'v33'], board: ['v11'], mana: 3 } })
    const { state, events } = act(s, { type: 'playCard', handIndex: 0, position: 0 })
    expect(boardIds(state, 'p1')).toEqual(['v22', 'v11'])
    expect(state.players.p1.mana).toBe(1)
    expect(handIds(state, 'p1')).toEqual(['v33'])
    expect(events).toContainEqual({
      type: 'cardPlayed',
      playerId: 'p1',
      instanceId: 'p1-h0',
      cardId: 'v22',
      position: 0,
    })
    expect(events).toContainEqual({ type: 'manaChange', playerId: 'p1', mana: 1, maxMana: 10 })
  })

  it('用 cardInstanceId 打出且預設放場尾', () => {
    const s = setup({ p1: { hand: ['v22', 'v33'], board: ['v11'], mana: 3 } })
    const { state } = act(s, play('p1-h1'))
    expect(boardIds(state, 'p1')).toEqual(['v11', 'v33'])
    expect(state.players.p1.mana).toBe(0)
  })

  it('潮能不足丟錯', () => {
    const s = setup({ p1: { hand: ['v33'], mana: 2 } })
    expect(() => applyAction(s, play('p1-h0'))).toThrow(IllegalActionError)
  })

  it('手牌不存在丟錯', () => {
    const s = setup({ p1: { hand: ['v11'] } })
    expect(() => applyAction(s, { type: 'playCard', handIndex: 5 })).toThrow(IllegalActionError)
    expect(() => applyAction(s, play('zzz'))).toThrow(IllegalActionError)
    expect(() => applyAction(s, { type: 'playCard' })).toThrow(IllegalActionError)
  })

  it('位置越界丟錯', () => {
    const s = setup({ p1: { hand: ['v11'], board: ['v22'] } })
    expect(() => applyAction(s, play('p1-h0', { position: 2 }))).toThrow(IllegalActionError)
    expect(() => applyAction(s, play('p1-h0', { position: -1 }))).toThrow(IllegalActionError)
  })

  it('場上已有 6 隻生物時不能再出生物', () => {
    const s = setup({ p1: { hand: ['v11', 'aoe1'], board: deckOf('v22', 6) } })
    expect(() => applyAction(s, play('p1-h0'))).toThrow(IllegalActionError)
    const plays = getLegalActions(s, 'p1').filter((a) => a.type === 'playCard')
    expect(plays).toEqual([{ type: 'playCard', cardInstanceId: 'p1-h1' }])
  })

  it('不需目標的牌帶 targetId 丟錯', () => {
    const s = setup({ p1: { hand: ['v22'] } })
    expect(() => applyAction(s, play('p1-h0', { targetId: 'p2-hero' }))).toThrow(IllegalActionError)
  })
})

describe('上場當回合的攻擊限制', () => {
  it('一般生物上場當回合不能攻擊，下個自己回合可以', () => {
    const s = setup({ p1: { hand: ['v22'] } })
    const r = act(s, play('p1-h0'))
    expect(() => applyAction(r.state, attack('p1-h0', 'p2-hero'))).toThrow(IllegalActionError)
    expect(getLegalActions(r.state, 'p1').filter((a) => a.type === 'attack')).toEqual([])
    const r2 = act(r.state, END, END, attack('p1-h0', 'p2-hero'))
    expect(r2.state.players.p2.hero.health).toBe(28)
  })

  it('charge 當回合可攻擊英雄', () => {
    const s = setup({ p1: { hand: ['charge31'] } })
    const { state } = act(s, play('p1-h0'), attack('p1-h0', 'p2-hero'))
    expect(state.players.p2.hero.health).toBe(27)
  })

  it('rush 當回合只能攻擊生物', () => {
    const s = setup({ p1: { hand: ['rush21'] }, p2: { board: ['v11'] } })
    const r = act(s, play('p1-h0'))
    expect(() => applyAction(r.state, attack('p1-h0', 'p2-hero'))).toThrow(IllegalActionError)
    const { state } = act(r.state, attack('p1-h0', 'p2-m0'))
    expect(boardIds(state, 'p2')).toEqual([])
  })
})

describe('指定目標', () => {
  it('法術需要目標但沒有合法目標時不能打出', () => {
    const s = setup({ p1: { hand: ['destroyOne'] } })
    expect(() => applyAction(s, play('p1-h0'))).toThrow(IllegalActionError)
    expect(getLegalActions(s, 'p1').filter((a) => a.type === 'playCard')).toEqual([])
  })

  it('生物戰吼沒有合法目標時仍可打出，效果略過', () => {
    const s = setup({ p1: { hand: ['friendBuffer'] } })
    const { state } = act(s, play('p1-h0'))
    expect(minionOf(state, 'p1-h0')).toMatchObject({ attack: 1, health: 1 })
  })

  it('chosenEnemy 不能指定己方', () => {
    const s = setup({ p1: { hand: ['pinger'] } })
    expect(() => applyAction(s, play('p1-h0', { targetId: 'p1-hero' }))).toThrow(IllegalActionError)
  })

  it('chosenEnemy 指定敵方英雄造成傷害', () => {
    const s = setup({ p1: { hand: ['pinger'] } })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p2-hero' }))
    expect(state.players.p2.hero.health).toBe(29)
    expect(events).toContainEqual({ type: 'damage', targetId: 'p2-hero', amount: 1, armorAbsorbed: 0 })
  })

  it('chosenFriendlyMinion 不能指定敵方生物', () => {
    const s = setup({ p1: { hand: ['buff22'], board: ['v11'] }, p2: { board: ['v11'] } })
    expect(() => applyAction(s, play('p1-h0', { targetId: 'p2-m0' }))).toThrow(IllegalActionError)
  })

  it('chosenEnemyMinion 不能指定英雄', () => {
    const s = setup({ p1: { hand: ['frostbite'] }, p2: { board: ['v11'] } })
    expect(() => applyAction(s, play('p1-h0', { targetId: 'p2-hero' }))).toThrow(IllegalActionError)
  })

  it('同一張卡兩個 chosen 效果只選一次目標並共用', () => {
    const s = setup({ p1: { hand: ['freezeBolt'] }, p2: { board: ['v33', 'v22'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p2-m1' }))
    expect(minionOf(state, 'p2-m1')).toMatchObject({ health: 1, frozen: true })
    expect(minionOf(state, 'p2-m0')).toMatchObject({ health: 3, frozen: false })
  })
})

describe('珍珠', () => {
  it('後手打出珍珠本回合 +1 潮能', () => {
    const s = setup({ active: 'p2', p2: { hand: ['token-pearl'], mana: 1, maxMana: 1 } })
    const { state, events } = act(s, play('p2-h0'))
    expect([state.players.p2.mana, state.players.p2.maxMana]).toEqual([2, 1])
    expect(events).toContainEqual({ type: 'manaChange', playerId: 'p2', mana: 2, maxMana: 1 })
  })
})

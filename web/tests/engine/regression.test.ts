// QA 回報問題的回歸測試
import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, createInstance, getLegalActions } from '@/engine'
import type { Card, GameState, PlayerId } from '@/engine'
import { END, act, attack, boardIds, card, minionOf, play, setup } from './helpers'

// 把測試專用卡牌加進盤面
function addCards(s: GameState, ...cards: Card[]): void {
  s.cards = { ...s.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) }
}

function putHand(s: GameState, pid: PlayerId, c: Card, id: string): void {
  s.players[pid].hand.push(createInstance(c, id, pid))
}

function putBoard(s: GameState, pid: PlayerId, c: Card, id: string): void {
  s.players[pid].board.push(createInstance(c, id, pid))
}

describe('多隻生物同時死亡的召喚位置', () => {
  it('[a, X, d, X] 同時死亡後變成 [a, F1, F1, d, F2, F2]', () => {
    const s = setup({
      p1: { hand: ['aoe1'] },
      p2: {
        board: ['v33', { cardId: 'deathSummon', health: 1 }, 'v55', { cardId: 'deathSummon', health: 1 }],
      },
    })
    const { state, events } = act(s, play('p1-h0'))
    expect(boardIds(state, 'p2')).toEqual(['v33', 'token-fish', 'token-fish', 'v55', 'token-fish', 'token-fish'])
    const positions = events.filter((e) => e.type === 'summon').map((e) => (e.type === 'summon' ? e.position : -1))
    expect(positions).toEqual([1, 2, 4, 5])
  })
})

describe('自己回合被冰凍', () => {
  const freezeAny = card({
    id: 'freezeAny',
    type: 'spell',
    cost: 1,
    effects: [{ trigger: 'onPlay', action: 'freeze', target: 'chosenMinion' }],
  })

  it('凍結到擁有者下一個回合結束才解凍', () => {
    const s = setup({ p1: { board: ['v22'] } })
    addCards(s, freezeAny)
    putHand(s, 'p1', freezeAny, 'p1-h0')

    const r1 = act(s, play('p1-h0', { targetId: 'p1-m0' }), END)
    expect(minionOf(r1.state, 'p1-m0').frozen).toBe(true)
    expect(r1.events.filter((e) => e.type === 'unfreeze')).toEqual([])

    const r2 = act(r1.state, END)
    expect(() => applyAction(r2.state, attack('p1-m0', 'p2-hero'))).toThrow(IllegalActionError)

    const r3 = act(r2.state, END)
    expect(minionOf(r3.state, 'p1-m0').frozen).toBe(false)
    expect(r3.events).toContainEqual({ type: 'unfreeze', targetId: 'p1-m0' })
  })
})

describe('英雄歸零後立即結束', () => {
  it('同一張牌擊殺對手後，後續的疲勞不再發生', () => {
    const killThenDraw = card({
      id: 'killThenDraw',
      type: 'spell',
      cost: 1,
      effects: [
        { trigger: 'onPlay', action: 'damage', target: 'enemyHero', amount: 6 },
        { trigger: 'onPlay', action: 'draw', target: 'self', amount: 1 },
      ],
    })
    const s = setup({ p1: { deck: [], health: 1 }, p2: { health: 6 } })
    addCards(s, killThenDraw)
    putHand(s, 'p1', killThenDraw, 'p1-h0')
    const { state, events } = act(s, play('p1-h0'))
    expect(state.winner).toBe('p1')
    expect(state.players.p1.hero.health).toBe(1)
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 'p1' })
    expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1)
  })

  it('擊殺英雄後同一張牌的增益不再發事件', () => {
    const faceThenBuff = card({
      id: 'faceThenBuff',
      type: 'spell',
      cost: 1,
      effects: [
        { trigger: 'onPlay', action: 'damage', target: 'enemyHero', amount: 3 },
        { trigger: 'onPlay', action: 'buff', target: 'allFriendlyMinions', atk: 2, hp: 0 },
      ],
    })
    const s = setup({ p1: { board: ['v22'] }, p2: { health: 3 } })
    addCards(s, faceThenBuff)
    putHand(s, 'p1', faceThenBuff, 'p1-h0')
    const { state, events } = act(s, play('p1-h0'))
    expect(events.filter((e) => e.type === 'buff')).toEqual([])
    expect(minionOf(state, 'p1-m0').attack).toBe(2)
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 'p1' })
  })

  it('共生生物打死英雄後不再回血', () => {
    const s = setup({ p1: { board: ['lifesteal33'], health: 20 }, p2: { health: 3 } })
    const { state, events } = act(s, attack('p1-m0', 'p2-hero'))
    expect(state.winner).toBe('p1')
    expect(state.players.p1.hero.health).toBe(20)
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 'p1' })
  })

  it('同時死亡的致命死亡效果：先結算者獲勝，之後的效果不執行', () => {
    const s = setup({
      p1: { board: ['deathFace'], health: 3 },
      p2: { board: ['deathFace'], health: 3 },
    })
    const { state, events } = act(s, attack('p1-m0', 'p2-m0'))
    expect(state.winner).toBe('p1')
    expect(state.players.p1.hero.health).toBe(3)
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 'p1' })
  })

  it('回合開始疲勞致死後，回合開始效果不再觸發', () => {
    const s = setup({ p2: { deck: [], health: 1, board: ['startArmor'] } })
    const { state, events } = act(s, END)
    expect(state.winner).toBe('p1')
    expect(state.players.p2.hero.armor).toBe(0)
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 'p1' })
  })
})

describe('已死亡的目標不再收到效果事件', () => {
  it('全體傷害後冰凍只對存活者發 freeze', () => {
    const blizzard = card({
      id: 'blizzard',
      type: 'spell',
      cost: 1,
      effects: [
        { trigger: 'onPlay', action: 'damage', target: 'allEnemyMinions', amount: 2 },
        { trigger: 'onPlay', action: 'freeze', target: 'allEnemyMinions' },
      ],
    })
    const s = setup({ p2: { board: ['v11', 'v33'] } })
    addCards(s, blizzard)
    putHand(s, 'p1', blizzard, 'p1-h0')
    const { events } = act(s, play('p1-h0'))
    expect(events.filter((e) => e.type === 'freeze')).toEqual([{ type: 'freeze', targetId: 'p2-m1' }])
  })

  it('全體傷害後增益只對存活者發 buff', () => {
    const hurtThenBuff = card({
      id: 'hurtThenBuff',
      type: 'spell',
      cost: 1,
      effects: [
        { trigger: 'onPlay', action: 'damage', target: 'allMinions', amount: 1 },
        { trigger: 'onPlay', action: 'buff', target: 'allFriendlyMinions', atk: 1, hp: 1 },
      ],
    })
    const s = setup({ p1: { board: ['v11', 'v33'] } })
    addCards(s, hurtThenBuff)
    putHand(s, 'p1', hurtThenBuff, 'p1-h0')
    const { events } = act(s, play('p1-h0'))
    expect(events.filter((e) => e.type === 'buff')).toEqual([{ type: 'buff', targetId: 'p1-m1', atk: 1, hp: 1 }])
  })
})

describe('結算次數上限', () => {
  it('結算超過上限時丟錯', () => {
    const selfHurt = card({
      id: 'selfHurt',
      cost: 1,
      attack: 0,
      health: 100000,
      effects: [{ trigger: 'onDamaged', action: 'damage', target: 'self', amount: 1 }],
    })
    const s = setup({ p1: { hand: ['bolt3'] } })
    addCards(s, selfHurt)
    putBoard(s, 'p2', selfHurt, 'p2-m0')
    expect(() => applyAction(s, play('p1-h0', { targetId: 'p2-m0' }))).toThrow(/結算/)
  })
})

describe('生物戰吼可以不選目標', () => {
  it('有合法目標時不帶 targetId 也能打出，效果略過', () => {
    const s = setup({ p1: { hand: ['pinger'] }, p2: { board: ['v11'] } })
    const { state, events } = act(s, play('p1-h0'))
    expect(boardIds(state, 'p1')).toEqual(['pinger'])
    expect(boardIds(state, 'p2')).toEqual(['v11'])
    expect(events.filter((e) => e.type === 'damage')).toEqual([])
  })

  it('getLegalActions 多列一個無目標的選項', () => {
    const s = setup({ p1: { hand: ['pinger'], mana: 1 }, p2: { board: ['v11'] } })
    const plays = getLegalActions(s, 'p1').filter((a) => a.type === 'playCard')
    expect(plays).toEqual([
      { type: 'playCard', cardInstanceId: 'p1-h0', position: 0, targetId: 'p2-hero' },
      { type: 'playCard', cardInstanceId: 'p1-h0', position: 0, targetId: 'p2-m0' },
      { type: 'playCard', cardInstanceId: 'p1-h0', position: 0 },
    ])
  })

  it('需要目標的法術仍必須選目標', () => {
    const s = setup({ p1: { hand: ['bolt3'] }, p2: { board: ['v11'] } })
    expect(() => applyAction(s, play('p1-h0'))).toThrow(IllegalActionError)
    const plays = getLegalActions(s, 'p1').filter((a) => a.type === 'playCard')
    expect(plays.every((a) => a.type === 'playCard' && a.targetId !== undefined)).toBe(true)
  })
})

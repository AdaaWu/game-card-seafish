import { describe, expect, it } from 'vitest'
import { applyAction, createGame, createInstance, createRng, getLegalActions } from '@/engine'
import type { CardInstance, GameState } from '@/engine'
import { MAX_ACTIONS_PER_TURN, chooseAction } from '@/ai'
import { DB, card, mixedDeck, setup } from '../engine/helpers'

const rng = () => createRng(1)

function playOutTurn(state: GameState): { state: GameState; steps: number } {
  const me = state.activePlayer
  let s = state
  let steps = 0
  while (s.activePlayer === me && s.winner === null && steps < 200) {
    s = applyAction(s, chooseAction(s, me, rng())).state
    steps++
  }
  return { state: s, steps }
}

describe('chooseAction', () => {
  it('無事可做時結束回合', () => {
    expect(chooseAction(setup(), 'p1', rng())).toEqual({ type: 'endTurn' })
  })

  it('單回合動作數達上限時結束回合', () => {
    const s = setup({ p1: { hand: ['v11'], board: ['v33'] } })
    s.actionsThisTurn = MAX_ACTIONS_PER_TURN
    expect(chooseAction(s, 'p1', rng())).toEqual({ type: 'endTurn' })
  })

  it('有致命時打臉取勝', () => {
    const s = setup({ p1: { board: ['v33', 'v22'] }, p2: { board: ['v55'], health: 5 } })
    const { state } = playOutTurn(s)
    expect(state.winner).toBe('p1')
  })

  it('有利交換：能擊殺且存活就先解場', () => {
    const s = setup({ p1: { board: ['v33'] }, p2: { board: ['v22'] } })
    expect(chooseAction(s, 'p1', rng())).toEqual({ type: 'attack', attackerId: 'p1-m0', targetId: 'p2-m0' })
  })

  it('交換不利時改打英雄', () => {
    const s = setup({ p1: { board: ['v22'] }, p2: { board: ['v55'] } })
    expect(chooseAction(s, 'p1', rng())).toEqual({ type: 'attack', attackerId: 'p1-m0', targetId: 'p2-hero' })
  })

  it('優先打出最貴的可負擔卡牌', () => {
    const s = setup({ p1: { hand: ['v11', 'v33', 'v22', 'v55'], mana: 3 } })
    const a = chooseAction(s, 'p1', rng())
    expect(a).toMatchObject({ type: 'playCard', cardInstanceId: 'p1-h1' })
  })

  it('回傳的動作一定在合法動作中', () => {
    let s = createGame({ cardDb: DB, decks: { p1: mixedDeck(0), p2: mixedDeck(5) }, seed: 8 })
    const r = createRng(3)
    for (let i = 0; i < 300 && s.winner === null; i++) {
      const a = chooseAction(s, s.activePlayer, r)
      expect(getLegalActions(s, s.activePlayer)).toContainEqual(a)
      s = applyAction(s, a).state
    }
  })

  it('每回合一定會結束且不超過動作上限', () => {
    let s = createGame({ cardDb: DB, decks: { p1: mixedDeck(2), p2: mixedDeck(9) }, seed: 4 })
    for (let t = 0; t < 30 && s.winner === null; t++) {
      const r = playOutTurn(s)
      expect(r.steps).toBeLessThanOrEqual(MAX_ACTIONS_PER_TURN + 1)
      s = r.state
    }
  })
})

describe('chooseAction 彈回己方生物', () => {
  const bounceFriend = card({
    id: 'bounceFriend',
    cost: 4,
    attack: 3,
    health: 4,
    effects: [{ trigger: 'onPlay', action: 'bounce', target: 'chosenFriendlyMinion' }],
  })
  const drawOnPlay = card({
    id: 'drawOnPlay',
    cost: 2,
    attack: 1,
    health: 2,
    effects: [{ trigger: 'onPlay', action: 'draw', target: 'self', amount: 1 }],
  })

  function withBounce(board: CardInstance[], mana = 4): GameState {
    const s = setup({ p1: { mana } })
    s.cards = { ...s.cards, bounceFriend, drawOnPlay }
    s.players.p1.hand = [createInstance(bounceFriend, 'p1-h0', 'p1')]
    s.players.p1.board = board
    return s
  }

  it('對己方不利時不帶目標打出', () => {
    const s = withBounce([createInstance(DB.cards.find((c) => c.id === 'v22')!, 'p1-m0', 'p1')])
    const a = chooseAction(s, 'p1', rng())
    expect(a).toMatchObject({ type: 'playCard', cardInstanceId: 'p1-h0' })
    expect(a).not.toHaveProperty('targetId')
  })

  it('能重複觸發戰吼時彈回該生物', () => {
    const s = withBounce([createInstance(drawOnPlay, 'p1-m0', 'p1')])
    expect(chooseAction(s, 'p1', rng())).toMatchObject({ type: 'playCard', cardInstanceId: 'p1-h0', targetId: 'p1-m0' })
  })

  it('能救回快死的生物時彈回該生物', () => {
    const hurt = createInstance(DB.cards.find((c) => c.id === 'v55')!, 'p1-m0', 'p1')
    hurt.health = 1
    const s = withBounce([hurt])
    expect(chooseAction(s, 'p1', rng())).toMatchObject({ type: 'playCard', cardInstanceId: 'p1-h0', targetId: 'p1-m0' })
  })
})

describe('chooseAction 處理打不贏的守護', () => {
  it('單隻打不贏時用多隻生物合力打掉守護', () => {
    const s = setup({
      p1: { board: ['v33', 'v33', 'v33'] },
      p2: { board: [{ cardId: 'taunt23', attack: 5, health: 8 }] },
    })
    expect(chooseAction(s, 'p1', rng())).toMatchObject({ type: 'attack', targetId: 'p2-m0' })
    const { state } = playOutTurn(s)
    expect(state.players.p2.board).toEqual([])
  })

  it('優先用法術解掉擋路的守護', () => {
    const s = setup({
      p1: { hand: ['v55', 'bolt3'], board: ['v22'], mana: 5 },
      p2: { board: [{ cardId: 'taunt23', attack: 5, health: 3 }] },
    })
    expect(chooseAction(s, 'p1', rng())).toEqual({ type: 'playCard', cardInstanceId: 'p1-h1', targetId: 'p2-m0' })
  })
})

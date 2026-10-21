// 自動結束回合的判定：行動方除了結束回合之外沒有任何可執行動作
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, createRng, getLegalActions, hasNoActions } from '@/engine'
import type { GameState, PlayerId } from '@/engine'
import { chooseAction } from '@/ai'
import { DB, END, act, attack, mixedDeck, play, setup } from './helpers'

const ONLY_END = [{ type: 'endTurn' }]

describe('hasNoActions 無動作', () => {
  it('手牌全貴於潮能且場上無單位', () => {
    const s = setup({ p1: { hand: ['v55', 'v33'], board: [], mana: 2 } })
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('手牌空且場上單位全已攻擊', () => {
    const s = setup({ p1: { hand: [], board: ['v22', 'v33'] } })
    for (const m of s.players.p1.board) m.attacksThisTurn = 1
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('手牌空且場上單位全凍結', () => {
    const s = setup({ p1: { hand: [], board: [{ cardId: 'v22', frozen: true }, { cardId: 'v33', frozen: true }] } })
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('手牌空且場上只有 0 攻單位', () => {
    const s = setup({ p1: { hand: [], board: ['v04', 'v04'] } })
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('手牌空且場上單位皆剛召喚且無衝鋒或突襲', () => {
    const s = setup({ p1: { hand: [], board: [{ cardId: 'v22', ready: false }, { cardId: 'taunt23', ready: false }] } })
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('出完最後一張牌後', () => {
    const s = setup({ p1: { hand: ['v11'], board: [], mana: 1 } })
    expect(hasNoActions(s, 'p1')).toBe(false)
    const after = act(s, play('p1-h0')).state
    expect(hasNoActions(after, 'p1')).toBe(true)
  })

  it('攻擊完最後一隻後', () => {
    const s = setup({ p1: { hand: [], board: ['v22'] } })
    expect(hasNoActions(s, 'p1')).toBe(false)
    const after = act(s, attack('p1-m0', 'p2-hero')).state
    expect(hasNoActions(after, 'p1')).toBe(true)
  })
})

describe('hasNoActions 邊界', () => {
  it('費用等於潮能算有動作', () => {
    const s = setup({ p1: { hand: ['v33'], board: [], mana: 3 } })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })

  it('手上有 0 費珍珠且潮能 0 算有動作', () => {
    const s = setup({ p1: { hand: ['token-pearl'], board: [], mana: 0 } })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })

  it('場上滿 6 隻且手牌只剩生物算無動作', () => {
    const board = Array.from({ length: 6 }, () => ({ cardId: 'v22', ready: false }))
    const s = setup({ p1: { hand: ['v11', 'v22'], board } })
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('場上滿 6 隻但手牌有可放的法術算有動作', () => {
    const board = Array.from({ length: 6 }, () => ({ cardId: 'v22', ready: false }))
    const s = setup({ p1: { hand: ['v11', 'bolt3'], board } })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })

  it('剛召喚的突襲單位且對面無單位算無動作', () => {
    const s = setup({ p1: { hand: [], board: [{ cardId: 'rush21', ready: false }] }, p2: { board: [] } })
    expect(hasNoActions(s, 'p1')).toBe(true)
  })

  it('對面有嘲諷且我方單位可攻擊算有動作', () => {
    const s = setup({ p1: { hand: [], board: ['v22'] }, p2: { board: ['taunt23'] } })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })
})

describe('hasNoActions 不觸發', () => {
  it('非行動方回傳 false', () => {
    const s = setup({ p1: { hand: [], board: [] }, active: 'p2' })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })

  it('勝負已分時回傳 false 且不丟錯', () => {
    const s = setup({ p1: { hand: [], board: [] } })
    s.winner = 'p2'
    expect(() => hasNoActions(s, 'p1')).not.toThrow()
    expect(hasNoActions(s, 'p1')).toBe(false)
  })

  it('任一單位可攻擊回傳 false', () => {
    const s = setup({ p1: { hand: ['v55'], board: [{ cardId: 'v22', frozen: true }, 'v33'], mana: 0 } })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })

  it('任一手牌可出回傳 false', () => {
    const s = setup({ p1: { hand: ['v55', 'v11'], board: [], mana: 1 } })
    expect(hasNoActions(s, 'p1')).toBe(false)
  })
})

// 用 AI 自我對戰收集各種局面
function collectStates(seeds: number[]): GameState[] {
  const out: GameState[] = []
  for (const seed of seeds) {
    let s = createGame({ cardDb: DB, decks: { p1: mixedDeck(0), p2: mixedDeck(7) }, seed })
    const rng = createRng(seed)
    for (let step = 0; step < 300 && s.winner === null; step++) {
      out.push(s)
      s = applyAction(s, chooseAction(s, s.activePlayer, rng)).state
    }
    out.push(s)
  }
  return out
}

describe('hasNoActions 與規則引擎一致', () => {
  const states = collectStates([1, 2, 3, 4, 5])

  it('收集到的局面同時包含有動作與無動作', () => {
    const idle = states.filter((s) => s.winner === null && getLegalActions(s, s.activePlayer).length === 1)
    expect(idle.length).toBeGreaterThan(0)
    expect(idle.length).toBeLessThan(states.length)
  })

  it('任意局面 hasNoActions 為 true 等價於合法動作只剩結束回合', () => {
    const mismatches: string[] = []
    states.forEach((s, i) => {
      for (const pid of ['p1', 'p2'] as PlayerId[]) {
        const expected = JSON.stringify(getLegalActions(s, pid)) === JSON.stringify(ONLY_END)
        if (hasNoActions(s, pid) !== expected) mismatches.push(`#${i} ${pid} turn=${s.turn} 預期 ${expected}`)
      }
    })
    expect(mismatches).toEqual([])
  })

  it.each([
    ['手牌太貴', setup({ p1: { hand: ['v55'], board: [], mana: 2 } })],
    ['單位已攻擊', (() => {
      const s = setup({ p1: { hand: [], board: ['v33'] } })
      s.players.p1.board[0]!.attacksThisTurn = 1
      return s
    })()],
    ['只有 0 攻單位', setup({ p1: { hand: [], board: ['v04'] } })],
  ])('與 AI 一致：%s 時 hasNoActions 為 true 且 AI 結束回合', (_name, s) => {
    expect(getLegalActions(s, 'p1')).toEqual(ONLY_END)
    expect(hasNoActions(s, 'p1')).toBe(true)
    expect(chooseAction(s, 'p1', createRng(1))).toEqual(END)
  })
})

describe('雙方都無動作', () => {
  it('雙方牌庫空且輪流結束回合時靠疲勞分出勝負，步數有上限', () => {
    const MAX_STEPS = 16
    let s = setup({
      p1: { hand: [], board: [], deck: [], mana: 0, maxMana: 0, health: 30 },
      p2: { hand: [], board: [], deck: [], mana: 0, maxMana: 0, health: 30 },
    })
    s.players.p1.deck = []
    s.players.p2.deck = []
    let steps = 0
    while (s.winner === null && steps < MAX_STEPS) {
      expect(hasNoActions(s, s.activePlayer)).toBe(true)
      s = applyAction(s, END).state
      steps++
    }
    expect(s.winner).not.toBeNull()
  })
})

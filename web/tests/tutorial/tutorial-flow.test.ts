import { describe, expect, it } from 'vitest'
import { createGame } from '@/engine'
import type { Action, GameState } from '@/engine'
import { DB, deckOf } from '../engine/helpers'
import {
  TUTORIAL_BEATS,
  TUTORIAL_TOTAL_STEPS,
  advance,
  createTutorial,
  currentBeat,
  isAllowed,
  isRunning,
  shouldStartTutorial,
  signalOf,
  skipTutorial,
  type Signal,
  type TutorialState,
} from '@/tutorial/tutorialFlow'

// 跳到指定步驟的第一個 beat
function atStep(step: number): TutorialState {
  const index = TUTORIAL_BEATS.findIndex((b) => b.step === step)
  return { index, status: 'running' }
}

function atBeat(id: string): TutorialState {
  return { index: TUTORIAL_BEATS.findIndex((b) => b.id === id), status: 'running' }
}

// 手牌放進指定卡牌、敵方場上放一隻生物的盤面
function gameWith(handIds: string[], enemyBoard = 'v11'): GameState {
  const g = createGame({ cardDb: DB, decks: { p1: deckOf('v11'), p2: deckOf('v11') }, seed: 1 })
  g.players.p1.hand = handIds.map((cardId, i) => ({ ...g.players.p1.hand[0]!, instanceId: `h${i}`, cardId }))
  g.players.p2.board = [{ ...g.players.p2.hand[0]!, instanceId: 'e1', cardId: enemyBoard, owner: 'p2' }]
  return g
}

const play = (id: string, targetId?: string): Action => ({ type: 'playCard', cardInstanceId: id, ...(targetId ? { targetId } : {}) })
const END: Action = { type: 'endTurn' }

describe('教學步驟清單', () => {
  it('共 9 步且步驟編號由 1 依序到 9', () => {
    const steps = [...new Set(TUTORIAL_BEATS.map((b) => b.step))]
    expect(TUTORIAL_TOTAL_STEPS).toBe(9)
    expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const sorted = TUTORIAL_BEATS.map((b) => b.step)
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b))
  })

  it('步驟標題依 ux.md 第 6 節', () => {
    const titles = [...new Map(TUTORIAL_BEATS.map((b) => [b.step, b.title])).values()]
    expect(titles).toEqual([
      '認識戰場',
      '看懂潮能',
      '打出第一張生物',
      '結束回合',
      '用生物攻擊',
      '遇到守護',
      '施放指定目標法術',
      '看卡牌細節',
      '攻擊英雄獲勝',
    ])
  })

  it('每個 beat 都有說明文字，需要操作的 beat 都有高亮目標', () => {
    for (const b of TUTORIAL_BEATS) {
      expect(b.text.length, b.id).toBeGreaterThan(0)
      if (b.kind !== 'wait') expect(b.focus.length, b.id).toBeGreaterThan(0)
    }
  })

  it('最後一步只淡淡壓暗，對手回合不壓暗，其餘壓暗', () => {
    for (const b of TUTORIAL_BEATS) {
      const want = b.kind === 'wait' ? 'none' : b.step === 9 ? 'light' : 'dark'
      expect(b.dim, b.id).toBe(want)
    }
  })

  it('id 不重複', () => {
    const ids = TUTORIAL_BEATS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('教學狀態推進', () => {
  it('開始時在第 1 步第一個說明', () => {
    const t = createTutorial()
    expect(isRunning(t)).toBe(true)
    expect(currentBeat(t)?.step).toBe(1)
    expect(currentBeat(t)?.kind).toBe('info')
  })

  it('說明 beat 收到 next 前進到下一個 beat', () => {
    const t = advance(createTutorial(), { type: 'next' })
    expect(t.index).toBe(1)
  })

  it('第 1 步三個說明都按下一步後進入第 2 步', () => {
    let t = createTutorial()
    for (let i = 0; i < 3; i++) t = advance(t, { type: 'next' })
    expect(currentBeat(t)?.step).toBe(2)
  })

  it('收到不符合完成條件的訊號時停在原地', () => {
    const t = atStep(3)
    const wrong: Signal[] = [{ type: 'next' }, { type: 'endTurn' }, { type: 'played', cardId: 'neutral-002' }]
    for (const s of wrong) expect(advance(t, s)).toEqual(t)
  })

  it('第 3 步打出指定生物後進入第 4 步', () => {
    const t = advance(atStep(3), { type: 'played', cardId: 'leaf-002' })
    expect(currentBeat(t)?.step).toBe(4)
  })

  it('攻擊目標種類不符時不前進', () => {
    const t = atStep(5)
    expect(advance(t, { type: 'attacked', target: 'hero' })).toEqual(t)
    expect(advance(t, { type: 'attacked', target: 'minion' }).index).toBe(t.index + 1)
  })

  it('結束回合後等對手回合，輪回我方才前進', () => {
    let t = advance(atStep(4), { type: 'endTurn' })
    expect(currentBeat(t)?.kind).toBe('wait')
    expect(advance(t, { type: 'next' })).toEqual(t)
    t = advance(t, { type: 'playerTurn' })
    expect(currentBeat(t)?.step).toBe(5)
  })

  it('第 6 步嘗試攻擊英雄被擋下後前進並帶出守護說明', () => {
    const t = advance(atStep(6), { type: 'heroAttackBlocked' })
    expect(currentBeat(t)?.step).toBe(6)
    expect(currentBeat(t)?.keyword).toBe('taunt')
  })

  it('第 8 步看過卡牌細節後進入第 9 步', () => {
    const t = advance(atStep(8), { type: 'detailShown' })
    expect(currentBeat(t)?.step).toBe(9)
  })

  it('第 9 步攻擊英雄後教學完成', () => {
    const t = advance(atStep(9), { type: 'attacked', target: 'hero' })
    expect(t.status).toBe('done')
    expect(isRunning(t)).toBe(false)
    expect(currentBeat(t)).toBeNull()
  })

  it('完成後再收到訊號維持完成', () => {
    const done = advance(atStep(9), { type: 'attacked', target: 'hero' })
    expect(advance(done, { type: 'next' })).toEqual(done)
  })
})

describe('跳過教學', () => {
  it('跳過後狀態為 skipped 且沒有目前步驟', () => {
    const t = skipTutorial(atStep(3))
    expect(t.status).toBe('skipped')
    expect(isRunning(t)).toBe(false)
    expect(currentBeat(t)).toBeNull()
  })

  it('跳過後所有動作都允許', () => {
    const t = skipTutorial(atStep(3))
    const g = gameWith(['v11'])
    expect(isAllowed(t, END, g)).toBe(true)
    expect(isAllowed(t, play('h0'), g)).toBe(true)
  })

  it('跳過後訊號不再推進', () => {
    const t = skipTutorial(atStep(4))
    expect(advance(t, { type: 'endTurn' })).toEqual(t)
  })

  it('沒有教學時視為未進行', () => {
    expect(isRunning(null)).toBe(false)
  })
})

describe('教學期間允許的動作', () => {
  it('說明 beat 不允許任何動作', () => {
    const g = gameWith(['leaf-002'])
    const t = createTutorial()
    expect(isAllowed(t, END, g)).toBe(false)
    expect(isAllowed(t, play('h0'), g)).toBe(false)
  })

  it('第 3 步只能打出指定生物', () => {
    const g = gameWith(['leaf-002', 'neutral-002'])
    const t = atStep(3)
    expect(isAllowed(t, play('h0'), g)).toBe(true)
    expect(isAllowed(t, play('h1'), g)).toBe(false)
    expect(isAllowed(t, END, g)).toBe(false)
    expect(isAllowed(t, { type: 'attack', attackerId: 'x', targetId: 'p2-hero' }, g)).toBe(false)
  })

  it('第 4 步只能結束回合', () => {
    const g = gameWith(['leaf-002'])
    const t = atStep(4)
    expect(isAllowed(t, END, g)).toBe(true)
    expect(isAllowed(t, play('h0'), g)).toBe(false)
  })

  it('第 5 步只能攻擊敵方生物', () => {
    const g = gameWith([])
    const t = atStep(5)
    expect(isAllowed(t, { type: 'attack', attackerId: 'm1', targetId: 'e1' }, g)).toBe(true)
    expect(isAllowed(t, { type: 'attack', attackerId: 'm1', targetId: 'p2-hero' }, g)).toBe(false)
    expect(isAllowed(t, END, g)).toBe(false)
  })

  it('第 6 步可以選攻擊者但不允許實際攻擊', () => {
    const g = gameWith([])
    const t = atStep(6)
    expect(currentBeat(t)?.selectAttackers).toBe(true)
    expect(isAllowed(t, { type: 'attack', attackerId: 'm1', targetId: 'e1' }, g)).toBe(false)
  })

  it('第 7 步法術只能指定敵方生物', () => {
    const g = gameWith(['light-009', 'leaf-002'])
    const t = atStep(7)
    expect(isAllowed(t, play('h0', 'e1'), g)).toBe(true)
    expect(isAllowed(t, play('h0', 'p2-hero'), g)).toBe(false)
    expect(isAllowed(t, play('h1'), g)).toBe(false)
  })

  it('第 8 步不允許任何動作', () => {
    const g = gameWith(['leaf-002'])
    const t = atStep(8)
    expect(isAllowed(t, play('h0'), g)).toBe(false)
    expect(isAllowed(t, END, g)).toBe(false)
  })

  it('第 9 步只能攻擊英雄', () => {
    const g = gameWith([])
    const t = atStep(9)
    expect(isAllowed(t, { type: 'attack', attackerId: 'm1', targetId: 'p2-hero' }, g)).toBe(true)
    expect(isAllowed(t, { type: 'attack', attackerId: 'm1', targetId: 'e1' }, g)).toBe(false)
  })

  it('第 5 步打完生物後的說明再引導出 2 費生物', () => {
    const t = atBeat('s5-play')
    const g = gameWith(['neutral-002', 'leaf-007'])
    expect(isAllowed(t, play('h0'), g)).toBe(true)
    expect(isAllowed(t, play('h1'), g)).toBe(false)
  })
})

describe('動作轉成教學訊號', () => {
  it('打出卡牌回傳卡牌 id', () => {
    const g = gameWith(['leaf-002'])
    expect(signalOf(play('h0'), g)).toEqual({ type: 'played', cardId: 'leaf-002' })
  })

  it('攻擊英雄與攻擊生物分開', () => {
    const g = gameWith([])
    expect(signalOf({ type: 'attack', attackerId: 'm1', targetId: 'p2-hero' }, g)).toEqual({ type: 'attacked', target: 'hero' })
    expect(signalOf({ type: 'attack', attackerId: 'm1', targetId: 'e1' }, g)).toEqual({ type: 'attacked', target: 'minion' })
  })

  it('結束回合', () => {
    expect(signalOf(END, gameWith([]))).toEqual({ type: 'endTurn' })
  })
})

describe('教學觸發條件', () => {
  const base = { battleId: 'ch1-b1', skipTutorial: false, tutorialDone: false, cleared: false }

  it('第一次打 ch1-b1 且沒勾跳過時觸發', () => {
    expect(shouldStartTutorial(base)).toBe(true)
  })

  it('設定勾選跳過新手教學時不觸發', () => {
    expect(shouldStartTutorial({ ...base, skipTutorial: true })).toBe(false)
  })

  it('教學完成或跳過過之後重打不觸發', () => {
    expect(shouldStartTutorial({ ...base, tutorialDone: true })).toBe(false)
  })

  it('舊存檔已通關 ch1-b1 時不觸發', () => {
    expect(shouldStartTutorial({ ...base, cleared: true })).toBe(false)
  })

  it('其他戰鬥與自由對戰不觸發', () => {
    expect(shouldStartTutorial({ ...base, battleId: 'ch1-b2' })).toBe(false)
    expect(shouldStartTutorial({ ...base, battleId: null })).toBe(false)
  })
})

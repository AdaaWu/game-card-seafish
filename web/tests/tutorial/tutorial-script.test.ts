import { describe, expect, it } from 'vitest'
import { applyAction, getLegalActions, startGame } from '@/engine'
import type { CardDb, GameState } from '@/engine'
import { cardDb, decks, tokens } from '@/content'
import { TUTORIAL_BEATS, advance, createTutorial, currentBeat, isAllowed, signalOf } from '@/tutorial/tutorialFlow'
import { TUTORIAL_ENEMY_HP, scriptedEnemyAction, tutorialSetup } from '@/tutorial/tutorialScript'

const tokenSet = new Set(tokens)
const db: CardDb = { cards: Object.values(cardDb).filter((c) => !tokenSet.has(c)), tokens }
const setup = tutorialSetup(decks['starter-leaf']!, decks['ai-tide']!)

function start(seed: number): GameState {
  return startGame({
    cardDb: db,
    decks: { p1: setup.playerDeck, p2: setup.enemyDeck },
    seed,
    heroHealth: { p2: setup.enemyHeroHp },
    shuffle: setup.shuffle,
  }).state
}

const handIds = (g: GameState, pid: 'p1' | 'p2') => g.players[pid].hand.map((c) => c.cardId)

// 對手照劇本打到輪回我方
function runEnemy(g: GameState): GameState {
  for (let i = 0; i < 20 && g.activePlayer === 'p2' && g.winner === null; i++) g = applyAction(g, scriptedEnemyAction(g)).state
  return g
}

describe('教學局固定牌序', () => {
  it('對手英雄生命 15 且不洗牌', () => {
    expect(TUTORIAL_ENEMY_HP).toBe(15)
    expect(setup.enemyHeroHp).toBe(15)
    expect(setup.shuffle).toBe(false)
  })

  it('牌組只用卡牌資料裡存在的卡', () => {
    for (const id of [...setup.playerDeck, ...setup.enemyDeck]) expect(cardDb[id], id).toBeDefined()
  })

  it('任何種子開局我方手牌都是固定的 4 張', () => {
    for (const seed of [1, 42, 99999]) {
      expect(handIds(start(seed), 'p1')).toEqual(['leaf-002', 'neutral-002', 'light-009', 'leaf-007'])
    }
  })

  it('對手起手有 1/1 生物與守護生物', () => {
    const hand = handIds(start(7), 'p2')
    expect(hand).toContain('tide-001')
    expect(hand).toContain('neutral-001')
  })

  it('第 1 回合我方只有一張 1 費生物能出', () => {
    const g = start(3)
    const plays = getLegalActions(g, 'p1').filter((a) => a.type === 'playCard')
    const ids = new Set(plays.map((a) => g.players.p1.hand.find((c) => a.type === 'playCard' && c.instanceId === a.cardInstanceId)?.cardId))
    expect([...ids]).toEqual(['leaf-002'])
  })
})

describe('對手劇本', () => {
  it('對手第 1 回合召喚小丑魚斥候後結束', () => {
    let g = start(5)
    g = applyAction(g, { type: 'endTurn' }).state
    g = runEnemy(g)
    expect(g.players.p2.board.map((m) => m.cardId)).toEqual(['tide-001'])
    expect(g.activePlayer).toBe('p1')
  })

  it('不在劇本內的回合直接結束', () => {
    const g = start(5)
    const enemyTurn = applyAction(g, { type: 'endTurn' }).state
    enemyTurn.turn = 6
    expect(scriptedEnemyAction(enemyTurn)).toEqual({ type: 'endTurn' })
  })
})

describe('完整跑一遍教學', () => {
  it('每個操作步驟都有被允許的合法動作，跑完後教學完成且對戰繼續', () => {
    let g = start(2026)
    let t = createTutorial()
    for (let guard = 0; guard < TUTORIAL_BEATS.length + 5 && t.status === 'running'; guard++) {
      const beat = currentBeat(t)
      expect(beat, `第 ${t.index} 個 beat`).not.toBeNull()
      if (!beat) break
      if (beat.kind === 'info') {
        t = advance(t, { type: 'next' })
        continue
      }
      if (beat.until.type === 'heroAttackBlocked') {
        // 守護在場：英雄不是合法攻擊目標
        const legal = getLegalActions(g, 'p1')
        expect(legal.some((a) => a.type === 'attack')).toBe(true)
        expect(legal.some((a) => a.type === 'attack' && a.targetId === 'p2-hero')).toBe(false)
        t = advance(t, { type: 'heroAttackBlocked' })
        continue
      }
      if (beat.until.type === 'detailShown') {
        t = advance(t, { type: 'detailShown' })
        continue
      }
      if (beat.kind === 'wait') {
        g = runEnemy(g)
        expect(g.activePlayer).toBe('p1')
        t = advance(t, { type: 'playerTurn' })
        continue
      }
      const action = getLegalActions(g, 'p1').find((a) => isAllowed(t, a, g))
      expect(action, beat.id).toBeDefined()
      const signal = signalOf(action!, g)
      g = applyAction(g, action!).state
      t = advance(t, signal)
    }
    expect(t.status).toBe('done')
    expect(g.winner).toBeNull()
    expect(g.players.p2.hero.health).toBe(13)
    expect(g.players.p2.board).toHaveLength(0)
    expect(g.players.p1.board.map((m) => m.cardId).sort()).toEqual(['leaf-002', 'neutral-002'])
  })
})

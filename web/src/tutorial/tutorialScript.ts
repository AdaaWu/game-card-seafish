// 教學局固定牌序與對手劇本
import { getLegalActions } from '@/engine'
import type { Action, GameState } from '@/engine'

export const TUTORIAL_ENEMY_HP = 15

// 我方起手 4 張，接著第 2、3 回合各抽 1 張
const PLAYER_OPENING = ['leaf-002', 'neutral-002', 'light-009', 'leaf-007', 'leaf-004', 'leaf-003']
// 對手起手 4 張，接著每回合抽 1 張
const ENEMY_OPENING = ['tide-001', 'neutral-001', 'tide-002', 'neutral-002', 'tide-005', 'tide-007']

// 對手各回合要打出的卡（依遊戲回合數）
const ENEMY_SCRIPT: Record<number, string[]> = {
  2: ['tide-001'],
  4: ['neutral-001'],
}

export interface TutorialSetup {
  playerDeck: string[]
  enemyDeck: string[]
  enemyHeroHp: number
  shuffle: false
}

// 指定的卡排最前面，其餘照原牌組順序補上，總張數不變
function orderedDeck(opening: readonly string[], base: readonly string[]): string[] {
  const rest = [...base]
  for (const id of opening) {
    const i = rest.indexOf(id)
    if (i >= 0) rest.splice(i, 1)
  }
  return [...opening, ...rest].slice(0, Math.max(base.length, opening.length))
}

export function tutorialSetup(playerBase: readonly string[], enemyBase: readonly string[]): TutorialSetup {
  return {
    playerDeck: orderedDeck(PLAYER_OPENING, playerBase),
    enemyDeck: orderedDeck(ENEMY_OPENING, enemyBase),
    enemyHeroHp: TUTORIAL_ENEMY_HP,
    shuffle: false,
  }
}

// 教學進行中對手照劇本出牌，劇本外的回合直接結束
export function scriptedEnemyAction(game: GameState): Action {
  const end: Action = { type: 'endTurn' }
  if (game.activePlayer !== 'p2') return end
  const cardId = ENEMY_SCRIPT[game.turn]?.[game.actionsThisTurn]
  const inst = cardId ? game.players.p2.hand.find((c) => c.cardId === cardId) : undefined
  if (!inst) return end
  const position = game.players.p2.board.length
  const play = getLegalActions(game, 'p2').find(
    (a) => a.type === 'playCard' && a.cardInstanceId === inst.instanceId && a.position === position && a.targetId === undefined,
  )
  return play ?? end
}

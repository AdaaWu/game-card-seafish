// 常數、實例建立與盤面查詢
import type { Card, CardInstance, EffectTarget, GameState, PlayerId } from './types'

export const MAX_HAND = 10
export const MAX_BOARD = 6
export const MAX_MANA = 10
export const DEFAULT_HERO_HEALTH = 30
export const PEARL_ID = 'token-pearl'

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalActionError'
  }
}

export const heroId = (playerId: PlayerId): string => `${playerId}-hero`
export const opponentOf = (playerId: PlayerId): PlayerId => (playerId === 'p1' ? 'p2' : 'p1')

// 英雄 id 回傳所屬玩家，否則回傳 null
export function heroOwner(id: string): PlayerId | null {
  if (id === 'p1-hero') return 'p1'
  if (id === 'p2-hero') return 'p2'
  return null
}

export function createInstance(card: Card, instanceId: string, owner: PlayerId): CardInstance {
  const health = card.health ?? 0
  return {
    instanceId,
    cardId: card.id,
    owner,
    attack: card.attack ?? 0,
    health,
    maxHealth: health,
    keywords: [...card.keywords],
    frozen: false,
    frozenUntilTurn: 0,
    attacksThisTurn: 0,
    summonedThisTurn: false,
  }
}

export function findMinion(state: GameState, id: string): CardInstance | undefined {
  return state.players.p1.board.find((m) => m.instanceId === id) ?? state.players.p2.board.find((m) => m.instanceId === id)
}

export const hasKeyword = (m: CardInstance, keyword: string): boolean => m.keywords.includes(keyword)

export const isChosenTarget = (target: EffectTarget): boolean => target.startsWith('chosen')

// chosen* 目標的合法候選 id；敵方潛行不可指定，打出中的生物自身排除
export function chosenCandidates(
  state: GameState,
  target: EffectTarget,
  playerId: PlayerId,
  excludeId?: string,
): string[] {
  const enemy = opponentOf(playerId)
  const mine = state.players[playerId].board.filter((m) => m.instanceId !== excludeId).map((m) => m.instanceId)
  const theirs = state.players[enemy].board.filter((m) => !hasKeyword(m, 'stealth')).map((m) => m.instanceId)
  switch (target) {
    case 'chosenEnemy':
      return [heroId(enemy), ...theirs]
    case 'chosenEnemyMinion':
      return theirs
    case 'chosenAny':
      return [heroId(playerId), heroId(enemy), ...mine, ...theirs]
    case 'chosenFriendlyMinion':
      return mine
    case 'chosenMinion':
      return [...mine, ...theirs]
    default:
      return []
  }
}

// 畫面顯示狀態：隨事件逐步追上引擎 state
import type { Card, GameEvent, GameState, PlayerId, Winner } from '@/engine'

export interface ViewCard {
  instanceId: string
  cardId: string
}

export interface ViewMinion extends ViewCard {
  attack: number
  health: number
  maxHealth: number
  keywords: string[]
  frozen: boolean
}

export interface ViewPlayer {
  hp: number
  maxHp: number
  armor: number
  mana: number
  maxMana: number
  deckCount: number
  hand: ViewCard[]
  board: ViewMinion[]
}

export interface BattleView {
  players: Record<PlayerId, ViewPlayer>
  activePlayer: PlayerId
  turn: number
  winner: Winner | null
}

export function snapshotView(state: GameState): BattleView {
  const player = (pid: PlayerId): ViewPlayer => {
    const p = state.players[pid]
    return {
      hp: p.hero.health,
      maxHp: p.hero.maxHealth,
      armor: p.hero.armor,
      mana: p.mana,
      maxMana: p.maxMana,
      deckCount: p.deck.length,
      hand: p.hand.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId })),
      board: p.board.map((m) => ({
        instanceId: m.instanceId,
        cardId: m.cardId,
        attack: m.attack,
        health: m.health,
        maxHealth: m.maxHealth,
        keywords: [...m.keywords],
        frozen: m.frozen,
      })),
    }
  }
  return { players: { p1: player('p1'), p2: player('p2') }, activePlayer: state.activePlayer, turn: state.turn, winner: state.winner }
}

function freshMinion(card: Card | undefined, instanceId: string, cardId: string): ViewMinion {
  const health = card?.health ?? 0
  return { instanceId, cardId, attack: card?.attack ?? 0, health, maxHealth: health, keywords: [...(card?.keywords ?? [])], frozen: false }
}

const heroPid = (id: string): PlayerId | null => (id === 'p1-hero' ? 'p1' : id === 'p2-hero' ? 'p2' : null)

function minionOf(v: BattleView, id: string): ViewMinion | undefined {
  return v.players.p1.board.find((m) => m.instanceId === id) ?? v.players.p2.board.find((m) => m.instanceId === id)
}

// 依單一事件更新顯示狀態；回傳新物件，不改動傳入的 view
export function reduceView(view: BattleView, event: GameEvent, cards: Record<string, Card>): BattleView {
  const v: BattleView = structuredClone(view)
  switch (event.type) {
    case 'turnStart':
      v.activePlayer = event.playerId
      v.turn = event.turn
      break
    case 'draw': {
      const p = v.players[event.playerId]
      p.deckCount = Math.max(0, p.deckCount - 1)
      p.hand.push({ instanceId: event.instanceId, cardId: event.cardId })
      break
    }
    case 'burn': {
      const p = v.players[event.playerId]
      const i = p.hand.findIndex((c) => c.instanceId === event.instanceId)
      if (i >= 0) p.hand.splice(i, 1)
      else p.deckCount = Math.max(0, p.deckCount - 1)
      break
    }
    case 'manaChange':
      v.players[event.playerId].mana = event.mana
      v.players[event.playerId].maxMana = event.maxMana
      break
    case 'cardPlayed': {
      const p = v.players[event.playerId]
      p.hand = p.hand.filter((c) => c.instanceId !== event.instanceId)
      if (event.position !== undefined) {
        p.board.splice(event.position, 0, freshMinion(cards[event.cardId], event.instanceId, event.cardId))
      }
      break
    }
    case 'summon':
      v.players[event.playerId].board.splice(event.position, 0, freshMinion(cards[event.cardId], event.instanceId, event.cardId))
      break
    case 'attack': {
      const m = minionOf(v, event.attackerId)
      if (m) m.keywords = m.keywords.filter((k) => k !== 'stealth')
      break
    }
    case 'damage': {
      const pid = heroPid(event.targetId)
      if (pid) {
        v.players[pid].hp -= event.amount
        v.players[pid].armor -= event.armorAbsorbed
      } else {
        const m = minionOf(v, event.targetId)
        if (m) m.health -= event.amount
      }
      break
    }
    case 'heal': {
      const pid = heroPid(event.targetId)
      if (pid) v.players[pid].hp += event.amount
      else {
        const m = minionOf(v, event.targetId)
        if (m) m.health += event.amount
      }
      break
    }
    case 'armor':
      v.players[event.playerId].armor += event.amount
      break
    case 'buff': {
      const m = minionOf(v, event.targetId)
      if (m) {
        m.attack += event.atk
        m.health += event.hp
        m.maxHealth += event.hp
      }
      break
    }
    case 'freeze':
    case 'unfreeze': {
      const m = minionOf(v, event.targetId)
      if (m) m.frozen = event.type === 'freeze'
      break
    }
    case 'bubblePop': {
      const m = minionOf(v, event.targetId)
      if (m) m.keywords = m.keywords.filter((k) => k !== 'bubble')
      break
    }
    case 'bounce': {
      const p = v.players[event.playerId]
      p.board = p.board.filter((m) => m.instanceId !== event.instanceId)
      p.hand.push({ instanceId: event.instanceId, cardId: event.cardId })
      break
    }
    case 'death': {
      const p = v.players[event.playerId]
      p.board = p.board.filter((m) => m.instanceId !== event.instanceId)
      break
    }
    case 'gameOver':
      v.winner = event.winner
      break
    case 'fatigue':
      break
  }
  return v
}

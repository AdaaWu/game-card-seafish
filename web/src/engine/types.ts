// 卡牌定義、遊戲狀態、指令與事件的型別

export type Faction = 'leaf' | 'tide' | 'frost' | 'light' | 'neutral'
export type CardType = 'creature' | 'spell'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export type Trigger = 'onPlay' | 'onDeath' | 'onTurnStart' | 'onTurnEnd' | 'onAttack' | 'onDamaged'

export type EffectAction =
  | 'damage'
  | 'heal'
  | 'draw'
  | 'buff'
  | 'freeze'
  | 'summon'
  | 'armor'
  | 'bounce'
  | 'destroy'
  | 'gainMana'

export type EffectTarget =
  | 'self'
  | 'chosenEnemy'
  | 'chosenEnemyMinion'
  | 'chosenAny'
  | 'chosenFriendlyMinion'
  | 'chosenMinion'
  | 'enemyHero'
  | 'friendlyHero'
  | 'allEnemyMinions'
  | 'allFriendlyMinions'
  | 'allMinions'
  | 'allEnemies'
  | 'randomEnemy'
  | 'randomEnemyMinion'
  | 'randomFriendlyMinion'
  | 'adjacent'

export interface Effect {
  trigger: Trigger
  action: EffectAction
  target: EffectTarget
  amount?: number
  atk?: number
  hp?: number
  cardId?: string
  count?: number
}

export interface Card {
  id: string
  name: string
  faction: Faction
  type: CardType
  cost: number
  attack?: number
  health?: number
  rarity: Rarity
  keywords: string[]
  effects: Effect[]
  text: string
  flavor: string
  species: string
  artHint: string
  collectible: boolean
  phase: number
}

export interface CardDb {
  cards: Card[]
  tokens: Card[]
  decks?: Record<string, string[]>
}

export type PlayerId = 'p1' | 'p2'
export type Winner = PlayerId | 'draw'

export interface CardInstance {
  instanceId: string
  cardId: string
  owner: PlayerId
  attack: number
  health: number
  maxHealth: number
  keywords: string[]
  frozen: boolean
  // 凍結持續到這個回合結束
  frozenUntilTurn: number
  attacksThisTurn: number
  summonedThisTurn: boolean
}

export interface HeroState {
  id: string
  health: number
  maxHealth: number
  armor: number
}

export interface PlayerState {
  id: PlayerId
  hero: HeroState
  mana: number
  maxMana: number
  deck: CardInstance[]
  hand: CardInstance[]
  board: CardInstance[]
  fatigue: number
}

export interface GameState {
  cards: Record<string, Card>
  players: Record<PlayerId, PlayerState>
  activePlayer: PlayerId
  turn: number
  winner: Winner | null
  rngState: number
  nextInstanceId: number
  actionsThisTurn: number
}

export interface GameConfig {
  cardDb: CardDb
  decks: Record<PlayerId, string[]>
  seed: number
  heroHealth?: Partial<Record<PlayerId, number>>
}

export type PlayCardAction = {
  type: 'playCard'
  handIndex?: number
  cardInstanceId?: string
  position?: number
  targetId?: string
}
export type AttackAction = { type: 'attack'; attackerId: string; targetId: string }
export type EndTurnAction = { type: 'endTurn' }
export type Action = PlayCardAction | AttackAction | EndTurnAction

export type GameEvent =
  | { type: 'turnStart'; playerId: PlayerId; turn: number }
  | { type: 'draw'; playerId: PlayerId; instanceId: string; cardId: string }
  | { type: 'burn'; playerId: PlayerId; instanceId: string; cardId: string }
  | { type: 'fatigue'; playerId: PlayerId; damage: number }
  | { type: 'manaChange'; playerId: PlayerId; mana: number; maxMana: number }
  | {
      type: 'cardPlayed'
      playerId: PlayerId
      instanceId: string
      cardId: string
      position?: number
      targetId?: string
    }
  | { type: 'summon'; playerId: PlayerId; instanceId: string; cardId: string; position: number }
  | { type: 'attack'; attackerId: string; targetId: string }
  | { type: 'damage'; targetId: string; amount: number; armorAbsorbed: number }
  | { type: 'heal'; targetId: string; amount: number }
  | { type: 'armor'; playerId: PlayerId; amount: number }
  | { type: 'buff'; targetId: string; atk: number; hp: number }
  | { type: 'freeze'; targetId: string }
  | { type: 'unfreeze'; targetId: string }
  | { type: 'bubblePop'; targetId: string }
  | { type: 'bounce'; playerId: PlayerId; instanceId: string; cardId: string }
  | { type: 'death'; playerId: PlayerId; instanceId: string; cardId: string }
  | { type: 'gameOver'; winner: Winner }

export interface ApplyResult {
  state: GameState
  events: GameEvent[]
}

// 引擎測試用的 fixture 卡牌與盤面建構工具
import { applyAction, createGame, createInstance } from '@/engine'
import type {
  Action,
  Card,
  CardDb,
  CardInstance,
  Effect,
  GameEvent,
  GameState,
  PlayerId,
} from '@/engine'

export function card(p: Partial<Card> & { id: string }): Card {
  return {
    name: p.id,
    faction: 'neutral',
    type: 'creature',
    cost: 1,
    rarity: 'common',
    keywords: [],
    effects: [],
    text: '',
    flavor: '',
    species: '',
    artHint: '',
    collectible: true,
    phase: 1,
    ...p,
  }
}

const minion = (id: string, cost: number, attack: number, health: number, extra: Partial<Card> = {}) =>
  card({ id, cost, attack, health, ...extra })
const spell = (id: string, cost: number, effects: Effect[]) => card({ id, type: 'spell', cost, effects })
const fx = (
  trigger: Effect['trigger'],
  action: Effect['action'],
  target: Effect['target'],
  extra: Partial<Effect> = {},
): Effect => ({ trigger, action, target, ...extra })

export const CARDS: Card[] = [
  minion('v11', 1, 1, 1),
  minion('v22', 2, 2, 2),
  minion('v33', 3, 3, 3),
  minion('v55', 5, 5, 5),
  minion('v04', 1, 0, 4),
  minion('taunt23', 2, 2, 3, { keywords: ['taunt'] }),
  minion('charge31', 3, 3, 1, { keywords: ['charge'] }),
  minion('rush21', 2, 2, 1, { keywords: ['rush'] }),
  minion('stealth21', 2, 2, 1, { keywords: ['stealth'] }),
  minion('bubble23', 2, 2, 3, { keywords: ['bubble'] }),
  minion('lifesteal33', 3, 3, 3, { keywords: ['lifesteal'] }),
  spell('bolt3', 2, [fx('onPlay', 'damage', 'chosenAny', { amount: 3 })]),
  spell('heal5', 1, [fx('onPlay', 'heal', 'chosenAny', { amount: 5 })]),
  spell('draw2', 2, [fx('onPlay', 'draw', 'friendlyHero', { amount: 2 })]),
  spell('buff22', 1, [fx('onPlay', 'buff', 'chosenFriendlyMinion', { atk: 2, hp: 2 })]),
  spell('frostbite', 1, [fx('onPlay', 'freeze', 'chosenEnemyMinion')]),
  spell('armor5', 1, [fx('onPlay', 'armor', 'friendlyHero', { amount: 5 })]),
  spell('bounceOne', 1, [fx('onPlay', 'bounce', 'chosenMinion')]),
  spell('destroyOne', 3, [fx('onPlay', 'destroy', 'chosenEnemyMinion')]),
  spell('gainMana2', 0, [fx('onPlay', 'gainMana', 'friendlyHero', { amount: 2 })]),
  spell('aoe1', 1, [fx('onPlay', 'damage', 'allEnemyMinions', { amount: 1 })]),
  spell('aoeAll2', 2, [fx('onPlay', 'damage', 'allMinions', { amount: 2 })]),
  spell('fireball6', 4, [fx('onPlay', 'damage', 'enemyHero', { amount: 6 })]),
  spell('randomBolt', 1, [fx('onPlay', 'damage', 'randomEnemyMinion', { amount: 2 })]),
  spell('randomEnemy3', 1, [fx('onPlay', 'damage', 'randomEnemy', { amount: 3 })]),
  spell('blast2', 2, [fx('onPlay', 'damage', 'allEnemies', { amount: 2 })]),
  spell('teamBuff', 1, [fx('onPlay', 'buff', 'allFriendlyMinions', { atk: 1, hp: 1 })]),
  spell('luckyBuff', 1, [fx('onPlay', 'buff', 'randomFriendlyMinion', { atk: 1, hp: 1 })]),
  minion('deathSummon', 3, 2, 2, {
    effects: [fx('onDeath', 'summon', 'self', { cardId: 'token-fish', count: 2 })],
  }),
  minion('deathBoom', 2, 1, 1, { effects: [fx('onDeath', 'damage', 'allEnemyMinions', { amount: 2 })] }),
  minion('deathFace', 2, 2, 2, { effects: [fx('onDeath', 'damage', 'enemyHero', { amount: 3 })] }),
  minion('startArmor', 2, 1, 3, { effects: [fx('onTurnStart', 'armor', 'friendlyHero', { amount: 2 })] }),
  minion('endHeal', 2, 1, 3, { effects: [fx('onTurnEnd', 'heal', 'friendlyHero', { amount: 2 })] }),
  minion('attackBuff', 2, 2, 3, { effects: [fx('onAttack', 'buff', 'self', { atk: 2 })] }),
  minion('damagedDraw', 2, 1, 4, { effects: [fx('onDamaged', 'draw', 'friendlyHero', { amount: 1 })] }),
  minion('adjBuffer', 2, 1, 1, { effects: [fx('onPlay', 'buff', 'adjacent', { atk: 1, hp: 1 })] }),
  minion('pinger', 1, 1, 1, { effects: [fx('onPlay', 'damage', 'chosenEnemy', { amount: 1 })] }),
  minion('friendBuffer', 1, 1, 1, { effects: [fx('onPlay', 'buff', 'chosenFriendlyMinion', { atk: 1, hp: 1 })] }),
  minion('rallyFish', 2, 1, 1, { effects: [fx('onPlay', 'buff', 'allFriendlyMinions', { atk: 1, hp: 1 })] }),
  spell('freezeBolt', 1, [
    fx('onPlay', 'damage', 'chosenEnemyMinion', { amount: 1 }),
    fx('onPlay', 'freeze', 'chosenEnemyMinion'),
  ]),
  spell('selfDraw', 1, [fx('onPlay', 'draw', 'self', { amount: 1 })]),
  minion('summoner', 2, 1, 1, { effects: [fx('onPlay', 'summon', 'self', { cardId: 'token-fish', count: 1 })] }),
]

export const TOKENS: Card[] = [
  spell('token-pearl', 0, [fx('onPlay', 'gainMana', 'self', { amount: 1 })]),
  minion('token-fish', 1, 1, 1, { collectible: false }),
]

export const DB: CardDb = { cards: CARDS, tokens: TOKENS, decks: {} }

export const deckOf = (cardId: string, n = 30): string[] => Array.from({ length: n }, () => cardId)

// 涵蓋所有 fixture 卡的 30 張混合牌組
export function mixedDeck(offset = 0): string[] {
  const ids = CARDS.map((c) => c.id)
  return Array.from({ length: 30 }, (_, i) => ids[(i + offset) % ids.length] as string)
}

export interface MinionSpec {
  cardId: string
  id?: string
  ready?: boolean
  frozen?: boolean
  attack?: number
  health?: number
}

export interface SideSetup {
  hand?: string[]
  board?: (string | MinionSpec)[]
  deck?: string[]
  mana?: number
  maxMana?: number
  health?: number
  armor?: number
}

const cardById = (id: string): Card => {
  const c = [...CARDS, ...TOKENS].find((x) => x.id === id)
  if (!c) throw new Error(`fixture 沒有卡牌 ${id}`)
  return c
}

const inst = (cardId: string, id: string, owner: PlayerId): CardInstance =>
  createInstance(cardById(cardId), id, owner)

// 建立指定盤面：手牌 id 為 p1-h0…、場上 id 為 p1-m0…、牌庫 id 為 p1-d0…
export function setup(opts: { p1?: SideSetup; p2?: SideSetup; active?: PlayerId } = {}): GameState {
  const base = createGame({ cardDb: DB, decks: { p1: deckOf('v11'), p2: deckOf('v11') }, seed: 1 })
  const state = structuredClone(base)
  state.activePlayer = opts.active ?? 'p1'
  for (const pid of ['p1', 'p2'] as const) {
    const side = opts[pid] ?? {}
    const p = state.players[pid]
    p.mana = side.mana ?? 10
    p.maxMana = side.maxMana ?? 10
    p.hero.health = side.health ?? 30
    p.hero.armor = side.armor ?? 0
    p.hand = (side.hand ?? []).map((id, i) => inst(id, `${pid}-h${i}`, pid))
    p.board = (side.board ?? []).map((spec, i) => {
      const s: MinionSpec = typeof spec === 'string' ? { cardId: spec } : spec
      const m = inst(s.cardId, s.id ?? `${pid}-m${i}`, pid)
      m.summonedThisTurn = s.ready === false
      m.frozen = s.frozen ?? false
      if (s.attack !== undefined) m.attack = s.attack
      if (s.health !== undefined) m.health = s.health
      return m
    })
    if (side.deck) p.deck = side.deck.map((id, i) => inst(id, `${pid}-d${i}`, pid))
  }
  return state
}

export function act(state: GameState, ...actions: Action[]): { state: GameState; events: GameEvent[] } {
  let s = state
  const events: GameEvent[] = []
  for (const a of actions) {
    const r = applyAction(s, a)
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}

export const boardIds = (s: GameState, pid: PlayerId): string[] => s.players[pid].board.map((m) => m.cardId)
export const handIds = (s: GameState, pid: PlayerId): string[] => s.players[pid].hand.map((m) => m.cardId)

export function minionOf(s: GameState, id: string): CardInstance {
  const m = [...s.players.p1.board, ...s.players.p2.board].find((x) => x.instanceId === id)
  if (!m) throw new Error(`場上沒有 ${id}`)
  return m
}

export const END: Action = { type: 'endTurn' }
export const play = (cardInstanceId: string, extra: { position?: number; targetId?: string } = {}): Action => ({
  type: 'playCard',
  cardInstanceId,
  ...extra,
})
export const attack = (attackerId: string, targetId: string): Action => ({ type: 'attack', attackerId, targetId })

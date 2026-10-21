// 效果解譯、傷害與死亡結算：都在 applyAction 的工作副本上就地修改
import {
  MAX_BOARD,
  MAX_HAND,
  MAX_MANA,
  chosenCandidates,
  createInstance,
  findMinion,
  hasKeyword,
  heroId,
  heroOwner,
  opponentOf,
} from './board'
import { nextRandom } from './rng'
import type { CardInstance, Effect, GameEvent, GameState, PlayerId, Trigger } from './types'

export interface Ctx {
  state: GameState
  events: GameEvent[]
  // 受傷待觸發 onDamaged 的生物
  damaged: string[]
}

export interface Source {
  playerId: PlayerId
  minionId?: string
  chosenId?: string
  // 死亡觸發時原本所在的位置
  deathIndex?: number
  lifesteal: boolean
}

const SETTLE_LIMIT = 1000

export const isOver = (ctx: Ctx): boolean => ctx.state.winner !== null

export function sourceOf(m: CardInstance, chosenId?: string): Source {
  return { playerId: m.owner, minionId: m.instanceId, chosenId, lifesteal: hasKeyword(m, 'lifesteal') }
}

export function random(ctx: Ctx): number {
  const [value, next] = nextRandom(ctx.state.rngState)
  ctx.state.rngState = next
  return value
}

function pick(ctx: Ctx, ids: string[]): string[] {
  if (ids.length === 0) return []
  return [ids[Math.floor(random(ctx) * ids.length)] as string]
}

export function newInstanceId(state: GameState): string {
  return `c${state.nextInstanceId++}`
}

const aliveIds = (state: GameState, pid: PlayerId): string[] =>
  state.players[pid].board.filter((m) => m.health > 0).map((m) => m.instanceId)

function resolveTargets(ctx: Ctx, effect: Effect, src: Source): string[] {
  const { state } = ctx
  const me = src.playerId
  const enemy = opponentOf(me)
  const self = src.minionId ? findMinion(state, src.minionId) : undefined
  switch (effect.target) {
    case 'self':
      return self ? [self.instanceId] : []
    case 'enemyHero':
      return [heroId(enemy)]
    case 'friendlyHero':
      return [heroId(me)]
    case 'allEnemyMinions':
      return state.players[enemy].board.map((m) => m.instanceId)
    case 'allFriendlyMinions':
      return state.players[me].board.map((m) => m.instanceId)
    case 'allMinions':
      return [...state.players[me].board, ...state.players[enemy].board].map((m) => m.instanceId)
    case 'allEnemies':
      return [heroId(enemy), ...state.players[enemy].board.map((m) => m.instanceId)]
    case 'randomEnemy':
      return pick(ctx, [heroId(enemy), ...aliveIds(state, enemy)])
    case 'randomEnemyMinion':
      return pick(ctx, aliveIds(state, enemy))
    case 'randomFriendlyMinion':
      return pick(ctx, aliveIds(state, me))
    case 'adjacent': {
      if (!self) return []
      const board = state.players[self.owner].board
      const i = board.indexOf(self)
      return [board[i - 1], board[i + 1]].filter((m) => m !== undefined).map((m) => m.instanceId)
    }
    default: {
      const id = src.chosenId
      if (id === undefined) return []
      return chosenCandidates(state, effect.target, me, src.minionId).includes(id) ? [id] : []
    }
  }
}

// draw、gainMana、armor 作用於玩家；self 代表己方
function targetPlayers(ctx: Ctx, effect: Effect, src: Source): PlayerId[] {
  if (effect.target === 'self') return [src.playerId]
  const players = resolveTargets(ctx, effect, src).map((id) => heroOwner(id) ?? findMinion(ctx.state, id)?.owner)
  return [...new Set(players.filter((p) => p !== undefined))]
}

// 已死亡（等待結算）的生物不再受效果影響
function minionTargets(ctx: Ctx, effect: Effect, src: Source): CardInstance[] {
  return resolveTargets(ctx, effect, src)
    .map((id) => findMinion(ctx.state, id))
    .filter((m): m is CardInstance => m !== undefined && m.health > 0)
}

export function heal(ctx: Ctx, targetId: string, amount: number): void {
  const owner = heroOwner(targetId)
  const unit = owner ? ctx.state.players[owner].hero : findMinion(ctx.state, targetId)
  if (!unit || unit.health <= 0) return
  const gain = Math.min(amount, unit.maxHealth - unit.health)
  if (gain <= 0) return
  unit.health += gain
  ctx.events.push({ type: 'heal', targetId, amount: gain })
}

export function dealDamage(ctx: Ctx, targetId: string, amount: number, src?: Source): void {
  if (amount <= 0) return
  const owner = heroOwner(targetId)
  if (owner) {
    const hero = ctx.state.players[owner].hero
    const absorbed = Math.min(hero.armor, amount)
    hero.armor -= absorbed
    hero.health -= amount - absorbed
    ctx.events.push({ type: 'damage', targetId, amount: amount - absorbed, armorAbsorbed: absorbed })
    if (hero.health <= 0) {
      checkGameOver(ctx)
      return
    }
  } else {
    const m = findMinion(ctx.state, targetId)
    if (!m) return
    if (hasKeyword(m, 'bubble')) {
      m.keywords = m.keywords.filter((k) => k !== 'bubble')
      ctx.events.push({ type: 'bubblePop', targetId })
      return
    }
    m.health -= amount
    ctx.events.push({ type: 'damage', targetId, amount, armorAbsorbed: 0 })
    if (m.health > 0) ctx.damaged.push(targetId)
  }
  if (src?.lifesteal) heal(ctx, heroId(src.playerId), amount)
}

export function drawCard(ctx: Ctx, pid: PlayerId): void {
  const p = ctx.state.players[pid]
  const card = p.deck.shift()
  if (!card) {
    p.fatigue += 1
    ctx.events.push({ type: 'fatigue', playerId: pid, damage: p.fatigue })
    dealDamage(ctx, heroId(pid), p.fatigue)
    return
  }
  if (p.hand.length >= MAX_HAND) {
    ctx.events.push({ type: 'burn', playerId: pid, instanceId: card.instanceId, cardId: card.cardId })
    return
  }
  p.hand.push(card)
  ctx.events.push({ type: 'draw', playerId: pid, instanceId: card.instanceId, cardId: card.cardId })
}

function summon(ctx: Ctx, effect: Effect, src: Source): void {
  const cardId = effect.cardId
  const card = cardId === undefined ? undefined : ctx.state.cards[cardId]
  if (!card) return
  const board = ctx.state.players[src.playerId].board
  const self = src.minionId ? board.find((m) => m.instanceId === src.minionId) : undefined
  let position = self ? board.indexOf(self) + 1 : Math.min(src.deathIndex ?? board.length, board.length)
  for (let i = 0; i < (effect.count ?? 1); i++) {
    if (board.length >= MAX_BOARD) return
    const m = createInstance(card, newInstanceId(ctx.state), src.playerId)
    m.summonedThisTurn = true
    board.splice(position, 0, m)
    ctx.events.push({ type: 'summon', playerId: src.playerId, instanceId: m.instanceId, cardId: card.id, position })
    position++
  }
}

function bounce(ctx: Ctx, m: CardInstance): void {
  const p = ctx.state.players[m.owner]
  p.board = p.board.filter((x) => x !== m)
  ctx.events.push({ type: 'bounce', playerId: m.owner, instanceId: m.instanceId, cardId: m.cardId })
  const card = ctx.state.cards[m.cardId]
  if (!card || p.hand.length >= MAX_HAND) {
    ctx.events.push({ type: 'burn', playerId: m.owner, instanceId: m.instanceId, cardId: m.cardId })
    return
  }
  p.hand.push(createInstance(card, m.instanceId, m.owner))
}

export function applyEffect(ctx: Ctx, effect: Effect, src: Source): void {
  const amount = effect.amount ?? 0
  switch (effect.action) {
    case 'damage':
      for (const id of resolveTargets(ctx, effect, src)) {
        if (isOver(ctx)) return
        dealDamage(ctx, id, amount, src)
      }
      return
    case 'heal':
      for (const id of resolveTargets(ctx, effect, src)) heal(ctx, id, amount)
      return
    case 'draw':
      for (const pid of targetPlayers(ctx, effect, src)) {
        for (let i = 0; i < (effect.amount ?? 1) && !isOver(ctx); i++) drawCard(ctx, pid)
      }
      return
    case 'buff':
      for (const m of minionTargets(ctx, effect, src)) {
        const atk = effect.atk ?? 0
        const hp = effect.hp ?? 0
        m.attack += atk
        m.health += hp
        m.maxHealth += hp
        ctx.events.push({ type: 'buff', targetId: m.instanceId, atk, hp })
      }
      return
    case 'freeze':
      for (const m of minionTargets(ctx, effect, src)) {
        // 擁有者自己回合被凍結時，撐到它下一個回合結束
        const until = ctx.state.turn + (m.owner === ctx.state.activePlayer ? 2 : 1)
        m.frozen = true
        m.frozenUntilTurn = Math.max(m.frozenUntilTurn, until)
        ctx.events.push({ type: 'freeze', targetId: m.instanceId })
      }
      return
    case 'summon':
      summon(ctx, effect, src)
      return
    case 'armor':
      for (const pid of targetPlayers(ctx, effect, src)) {
        ctx.state.players[pid].hero.armor += amount
        ctx.events.push({ type: 'armor', playerId: pid, amount })
      }
      return
    case 'bounce':
      for (const m of minionTargets(ctx, effect, src)) bounce(ctx, m)
      return
    case 'destroy':
      for (const m of minionTargets(ctx, effect, src)) m.health = 0
      return
    case 'gainMana':
      for (const pid of targetPlayers(ctx, effect, src)) {
        const p = ctx.state.players[pid]
        p.mana = Math.min(MAX_MANA, p.mana + amount)
        ctx.events.push({ type: 'manaChange', playerId: pid, mana: p.mana, maxMana: p.maxMana })
      }
      return
  }
}

export function runEffects(ctx: Ctx, effects: Effect[], trigger: Trigger, src: Source): void {
  for (const e of effects) {
    if (isOver(ctx)) return
    if (e.trigger === trigger) applyEffect(ctx, e, src)
  }
}

export function runTrigger(ctx: Ctx, m: CardInstance, trigger: Trigger, chosenId?: string): void {
  const card = ctx.state.cards[m.cardId]
  if (card) runEffects(ctx, card.effects, trigger, sourceOf(m, chosenId))
}

// 依序處理 onDamaged 與死亡，直到盤面穩定
export function settle(ctx: Ctx): void {
  const { state } = ctx
  for (let guard = 0; guard < SETTLE_LIMIT; guard++) {
    if (isOver(ctx)) return
    const damagedId = ctx.damaged.shift()
    if (damagedId !== undefined) {
      const m = findMinion(state, damagedId)
      if (m && m.health > 0) runTrigger(ctx, m, 'onDamaged')
      continue
    }
    const dead: { m: CardInstance; index: number }[] = []
    const baseLength = { p1: 0, p2: 0 }
    for (const pid of [state.activePlayer, opponentOf(state.activePlayer)]) {
      let survivors = 0
      for (const m of state.players[pid].board) {
        if (m.health <= 0) dead.push({ m, index: survivors })
        else survivors++
      }
      state.players[pid].board = state.players[pid].board.filter((m) => m.health > 0)
      baseLength[pid] = survivors
    }
    if (dead.length === 0) return
    for (const { m } of dead) {
      ctx.events.push({ type: 'death', playerId: m.owner, instanceId: m.instanceId, cardId: m.cardId })
    }
    for (const { m, index } of dead) {
      if (isOver(ctx)) return
      const card = state.cards[m.cardId]
      if (!card) continue
      // 依板面順序處理，前面死者召喚出的生物會把後面的位置往右推
      const shift = state.players[m.owner].board.length - baseLength[m.owner]
      const src: Source = { playerId: m.owner, deathIndex: index + shift, lifesteal: hasKeyword(m, 'lifesteal') }
      runEffects(ctx, card.effects, 'onDeath', src)
    }
  }
  throw new Error(`結算次數超過上限 ${SETTLE_LIMIT}`)
}

export function checkGameOver(ctx: Ctx): void {
  const { state } = ctx
  if (state.winner !== null) return
  const p1Dead = state.players.p1.hero.health <= 0
  const p2Dead = state.players.p2.hero.health <= 0
  if (!p1Dead && !p2Dead) return
  state.winner = p1Dead && p2Dead ? 'draw' : p1Dead ? 'p2' : 'p1'
  ctx.events.push({ type: 'gameOver', winner: state.winner })
}

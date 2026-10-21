// 對外 API：開局、合法動作、套用動作
import {
  DEFAULT_HERO_HEALTH,
  IllegalActionError,
  MAX_BOARD,
  MAX_MANA,
  PEARL_ID,
  chosenCandidates,
  createInstance,
  findMinion,
  hasKeyword,
  heroId,
  heroOwner,
  isChosenTarget,
  opponentOf,
} from './board'
import type { Ctx } from './effects'
import {
  checkGameOver,
  dealDamage,
  drawCard,
  isOver,
  newInstanceId,
  random,
  runEffects,
  runTrigger,
  settle,
  sourceOf,
} from './effects'
import type {
  Action,
  ApplyResult,
  AttackAction,
  Card,
  CardInstance,
  GameConfig,
  GameState,
  PlayCardAction,
  PlayerId,
  PlayerState,
} from './types'

export {
  DEFAULT_HERO_HEALTH,
  IllegalActionError,
  MAX_BOARD,
  MAX_HAND,
  MAX_MANA,
  PEARL_ID,
  createInstance,
  heroId,
} from './board'

const newCtx = (state: GameState): Ctx => ({ state, events: [], damaged: [] })

function newPlayer(id: PlayerId, health: number): PlayerState {
  return {
    id,
    hero: { id: heroId(id), health, maxHealth: health, armor: 0 },
    mana: 0,
    maxMana: 0,
    deck: [],
    hand: [],
    board: [],
    fatigue: 0,
  }
}

function startTurn(ctx: Ctx, pid: PlayerId): void {
  const { state } = ctx
  const p = state.players[pid]
  state.activePlayer = pid
  state.actionsThisTurn = 0
  ctx.events.push({ type: 'turnStart', playerId: pid, turn: state.turn })
  p.maxMana = Math.min(MAX_MANA, p.maxMana + 1)
  p.mana = p.maxMana
  ctx.events.push({ type: 'manaChange', playerId: pid, mana: p.mana, maxMana: p.maxMana })
  for (const m of p.board) {
    m.attacksThisTurn = 0
    m.summonedThisTurn = false
  }
  drawCard(ctx, pid)
  settle(ctx)
  for (const id of p.board.map((m) => m.instanceId)) {
    if (isOver(ctx)) return
    const m = findMinion(state, id)
    if (m) runTrigger(ctx, m, 'onTurnStart')
    settle(ctx)
  }
}

export function startGame(config: GameConfig): ApplyResult {
  const cards: Record<string, Card> = {}
  for (const c of [...config.cardDb.cards, ...config.cardDb.tokens]) cards[c.id] = c
  const state: GameState = {
    cards,
    players: {
      p1: newPlayer('p1', config.heroHealth?.p1 ?? DEFAULT_HERO_HEALTH),
      p2: newPlayer('p2', config.heroHealth?.p2 ?? DEFAULT_HERO_HEALTH),
    },
    activePlayer: 'p1',
    turn: 1,
    winner: null,
    rngState: config.seed >>> 0,
    nextInstanceId: 1,
    actionsThisTurn: 0,
  }
  const ctx = newCtx(state)
  for (const pid of ['p1', 'p2'] as const) {
    const deck = config.decks[pid].map((cardId) => {
      const card = cards[cardId]
      if (!card) throw new Error(`未知卡牌：${cardId}`)
      return createInstance(card, newInstanceId(state), pid)
    })
    if (config.shuffle !== false) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random(ctx) * (i + 1))
        ;[deck[i], deck[j]] = [deck[j] as CardInstance, deck[i] as CardInstance]
      }
    }
    state.players[pid].deck = deck
  }
  for (let i = 0; i < 3; i++) drawCard(ctx, 'p1')
  for (let i = 0; i < 4; i++) drawCard(ctx, 'p2')
  const pearl = cards[PEARL_ID]
  if (!pearl) throw new Error(`卡牌資料缺少 ${PEARL_ID}`)
  state.players.p2.hand.push(createInstance(pearl, newInstanceId(state), 'p2'))
  startTurn(ctx, 'p1')
  return { state, events: ctx.events }
}

export function createGame(config: GameConfig): GameState {
  return startGame(config).state
}

function canAttack(m: CardInstance): boolean {
  if (m.frozen || m.attacksThisTurn >= 1 || m.attack <= 0) return false
  return !m.summonedThisTurn || hasKeyword(m, 'charge') || hasKeyword(m, 'rush')
}

function attackTargets(state: GameState, m: CardInstance): string[] {
  const enemy = opponentOf(m.owner)
  const visible = state.players[enemy].board.filter((x) => !hasKeyword(x, 'stealth'))
  const taunts = visible.filter((x) => hasKeyword(x, 'taunt'))
  if (taunts.length > 0) return taunts.map((x) => x.instanceId)
  const minions = visible.map((x) => x.instanceId)
  const heroAllowed = !m.summonedThisTurn || hasKeyword(m, 'charge')
  return heroAllowed ? [heroId(enemy), ...minions] : minions
}

// 打出時的目標規則：回傳候選；null 代表此牌不需目標
function playTargets(state: GameState, inst: CardInstance, card: Card): string[] | null {
  const first = card.effects.find((e) => e.trigger === 'onPlay' && isChosenTarget(e.target))
  return first ? chosenCandidates(state, first.target, inst.owner, inst.instanceId) : null
}

export function getLegalActions(state: GameState, playerId: PlayerId): Action[] {
  if (state.winner !== null || state.activePlayer !== playerId) return []
  const p = state.players[playerId]
  const actions: Action[] = []
  for (const inst of p.hand) {
    const card = state.cards[inst.cardId]
    if (!card || card.cost > p.mana) continue
    const isCreature = card.type === 'creature'
    if (isCreature && p.board.length >= MAX_BOARD) continue
    const candidates = playTargets(state, inst, card)
    if (candidates && candidates.length === 0 && !isCreature) continue
    // 生物戰吼可以不選目標
    const targets: (string | undefined)[] =
      candidates && candidates.length > 0 ? [...candidates, ...(isCreature ? [undefined] : [])] : [undefined]
    const positions: (number | undefined)[] = isCreature
      ? Array.from({ length: p.board.length + 1 }, (_, i) => i)
      : [undefined]
    for (const position of positions) {
      for (const targetId of targets) {
        const a: PlayCardAction = { type: 'playCard', cardInstanceId: inst.instanceId }
        if (position !== undefined) a.position = position
        if (targetId !== undefined) a.targetId = targetId
        actions.push(a)
      }
    }
  }
  for (const m of p.board) {
    if (!canAttack(m)) continue
    for (const targetId of attackTargets(state, m)) actions.push({ type: 'attack', attackerId: m.instanceId, targetId })
  }
  actions.push({ type: 'endTurn' })
  return actions
}

// 行動方除了結束回合之外沒有任何可執行動作
export function hasNoActions(state: GameState, playerId: PlayerId): boolean {
  if (state.winner !== null || state.activePlayer !== playerId) return false
  const actions = getLegalActions(state, playerId)
  return actions.length === 1 && actions[0]!.type === 'endTurn'
}

function playCard(ctx: Ctx, action: PlayCardAction): void {
  const { state } = ctx
  const p = state.players[state.activePlayer]
  let index: number
  if (action.cardInstanceId !== undefined) index = p.hand.findIndex((c) => c.instanceId === action.cardInstanceId)
  else if (action.handIndex !== undefined) index = Number.isInteger(action.handIndex) ? action.handIndex : -1
  else throw new IllegalActionError('打出卡牌需要 handIndex 或 cardInstanceId')
  const inst = p.hand[index]
  if (!inst) throw new IllegalActionError('手牌中沒有這張卡')
  const card = state.cards[inst.cardId]
  if (!card) throw new IllegalActionError(`未知卡牌：${inst.cardId}`)
  if (card.cost > p.mana) throw new IllegalActionError(`潮能不足：需要 ${card.cost}，目前 ${p.mana}`)

  const isCreature = card.type === 'creature'
  const position = action.position ?? p.board.length
  if (isCreature) {
    if (p.board.length >= MAX_BOARD) throw new IllegalActionError('場上生物已滿')
    if (!Number.isInteger(position) || position < 0 || position > p.board.length) {
      throw new IllegalActionError(`位置不合法：${position}`)
    }
  }
  const candidates = playTargets(state, inst, card)
  const { targetId } = action
  if (candidates === null || candidates.length === 0) {
    if (candidates && !isCreature) throw new IllegalActionError('沒有合法目標，法術不能施放')
    if (targetId !== undefined) throw new IllegalActionError('此牌目前不需指定目標')
  } else if (targetId !== undefined || !isCreature) {
    if (targetId === undefined) throw new IllegalActionError('需要指定目標')
    if (!candidates.includes(targetId)) throw new IllegalActionError(`目標不合法：${targetId}`)
  }

  p.mana -= card.cost
  ctx.events.push({ type: 'manaChange', playerId: p.id, mana: p.mana, maxMana: p.maxMana })
  p.hand.splice(index, 1)
  const played = {
    type: 'cardPlayed' as const,
    playerId: p.id,
    instanceId: inst.instanceId,
    cardId: card.id,
    ...(isCreature ? { position } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
  }
  if (isCreature) {
    inst.summonedThisTurn = true
    inst.attacksThisTurn = 0
    p.board.splice(position, 0, inst)
    ctx.events.push(played)
    runTrigger(ctx, inst, 'onPlay', targetId)
  } else {
    ctx.events.push(played)
    runEffects(ctx, card.effects, 'onPlay', { playerId: p.id, chosenId: targetId, lifesteal: false })
  }
  settle(ctx)
}

function attack(ctx: Ctx, action: AttackAction): void {
  const { state } = ctx
  if (heroOwner(action.attackerId)) throw new IllegalActionError('英雄不能攻擊')
  const attacker = state.players[state.activePlayer].board.find((m) => m.instanceId === action.attackerId)
  if (!attacker) throw new IllegalActionError(`己方場上沒有 ${action.attackerId}`)
  if (attacker.frozen) throw new IllegalActionError('凍結中的生物不能攻擊')
  if (attacker.attacksThisTurn >= 1) throw new IllegalActionError('本回合已攻擊過')
  if (attacker.attack <= 0) throw new IllegalActionError('攻擊力為 0 不能攻擊')
  if (!canAttack(attacker)) throw new IllegalActionError('剛上場的生物本回合不能攻擊')
  if (!attackTargets(state, attacker).includes(action.targetId)) {
    throw new IllegalActionError(`不能攻擊 ${action.targetId}`)
  }

  attacker.attacksThisTurn += 1
  ctx.events.push({ type: 'attack', attackerId: attacker.instanceId, targetId: action.targetId })
  runTrigger(ctx, attacker, 'onAttack')
  settle(ctx)
  if (isOver(ctx)) return

  const a = findMinion(state, attacker.instanceId)
  const targetHero = heroOwner(action.targetId)
  const defender = targetHero ? undefined : findMinion(state, action.targetId)
  if (!a || (!targetHero && !defender)) return
  a.keywords = a.keywords.filter((k) => k !== 'stealth')
  const attackerSrc = sourceOf(a)
  const defenderSrc = defender ? sourceOf(defender) : undefined
  const defenderAttack = defender?.attack ?? 0
  dealDamage(ctx, action.targetId, a.attack, attackerSrc)
  if (defender) dealDamage(ctx, a.instanceId, defenderAttack, defenderSrc)
  settle(ctx)
}

function endTurn(ctx: Ctx): void {
  const { state } = ctx
  const pid = state.activePlayer
  const p = state.players[pid]
  for (const id of p.board.map((m) => m.instanceId)) {
    if (isOver(ctx)) return
    const m = findMinion(state, id)
    if (m) runTrigger(ctx, m, 'onTurnEnd')
    settle(ctx)
  }
  checkGameOver(ctx)
  if (state.winner !== null) return
  for (const m of p.board) {
    if (!m.frozen || state.turn < m.frozenUntilTurn) continue
    m.frozen = false
    ctx.events.push({ type: 'unfreeze', targetId: m.instanceId })
  }
  state.turn += 1
  startTurn(ctx, opponentOf(pid))
}

export function applyAction(state: GameState, action: Action): ApplyResult {
  if (state.winner !== null) throw new IllegalActionError('遊戲已結束')
  // 卡牌定義視為不可變，共用參照；其餘狀態複製後修改
  const { cards, ...rest } = state
  const next: GameState = { ...structuredClone(rest), cards }
  const ctx = newCtx(next)
  switch (action.type) {
    case 'playCard':
      playCard(ctx, action)
      next.actionsThisTurn += 1
      break
    case 'attack':
      attack(ctx, action)
      next.actionsThisTurn += 1
      break
    case 'endTurn':
      endTurn(ctx)
      break
    default:
      throw new IllegalActionError('未知的動作類型')
  }
  checkGameOver(ctx)
  return { state: next, events: ctx.events }
}


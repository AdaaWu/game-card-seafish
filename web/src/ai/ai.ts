// 啟發式 AI：致命檢查 → 有利交換 → 出最貴的牌 → 打臉 → 結束回合
import { getLegalActions, heroId } from '@/engine'
import type { Action, AttackAction, Card, CardInstance, GameState, PlayCardAction, PlayerId } from '@/engine'

export const MAX_ACTIONS_PER_TURN = 40

const END: Action = { type: 'endTurn' }
const HARMFUL = new Set(['damage', 'freeze', 'destroy', 'bounce'])

const value = (m: CardInstance): number => m.attack + m.health
const has = (m: CardInstance, k: string): boolean => m.keywords.includes(k)

function minionById(state: GameState, id: string): CardInstance | undefined {
  return [...state.players.p1.board, ...state.players.p2.board].find((m) => m.instanceId === id)
}

// 分數最高者勝出，同分用 rng 決定
function best<T>(items: T[], score: (x: T) => number, rng: () => number): { item: T; score: number } | null {
  let top: T[] = []
  let topScore = -Infinity
  for (const x of items) {
    const s = score(x)
    if (s > topScore) {
      top = [x]
      topScore = s
    } else if (s === topScore) top.push(x)
  }
  if (top.length === 0) return null
  return { item: top[Math.floor(rng() * top.length)] as T, score: topScore }
}

function cardOf(state: GameState, playerId: PlayerId, a: PlayCardAction): Card | undefined {
  const inst = state.players[playerId].hand.find((c) => c.instanceId === a.cardInstanceId)
  return inst ? state.cards[inst.cardId] : undefined
}

// 打出後必定打到敵方英雄的傷害
function faceDamage(card: Card, a: PlayCardAction, enemyHero: string): number {
  let total = 0
  for (const e of card.effects) {
    if (e.trigger !== 'onPlay' || e.action !== 'damage') continue
    const hits =
      e.target === 'enemyHero' || e.target === 'allEnemies' || (e.target.startsWith('chosen') && a.targetId === enemyHero)
    if (hits) total += e.amount ?? 0
  }
  return total
}

// 再次打出能得到的戰吼價值
function battlecryValue(card: Card): number {
  let total = 0
  for (const e of card.effects) {
    if (e.trigger !== 'onPlay') continue
    if (e.action === 'draw') total += 2 * (e.amount ?? 1)
    else if (e.action === 'summon') total += 2 * (e.count ?? 1)
    else if (e.action === 'damage' || e.action === 'bounce' || e.action === 'freeze') total += Math.max(1, e.amount ?? 1)
    else if (e.action === 'buff') total += (e.atk ?? 0) + (e.hp ?? 0)
    else if (e.action === 'heal' || e.action === 'armor') total += (e.amount ?? 0) / 2
  }
  return total
}

// 彈回己方生物的得失：重複戰吼、救回快死的生物，扣掉失去的增益與節奏
function bounceOwnScore(state: GameState, target: CardInstance): number {
  const card = state.cards[target.cardId]
  if (!card) return -10
  const dying = target.health < target.maxHealth && (target.health <= 2 || target.health * 2 <= target.maxHealth)
  const rescue = dying ? target.maxHealth - target.health : 0
  const lostBuff = Math.max(0, target.attack - (card.attack ?? 0)) + Math.max(0, target.maxHealth - (card.health ?? 0))
  return battlecryValue(card) + rescue - lostBuff - 1
}

function scorePlay(state: GameState, playerId: PlayerId, card: Card, a: PlayCardAction): number {
  const chosen = card.effects.find((e) => e.trigger === 'onPlay' && e.target.startsWith('chosen'))
  if (!chosen || a.targetId === undefined) return 0
  const target = minionById(state, a.targetId)
  const isEnemy = target ? target.owner !== playerId : a.targetId !== heroId(playerId)
  if (HARMFUL.has(chosen.action)) {
    if (!isEnemy && chosen.action === 'bounce' && target) return bounceOwnScore(state, target)
    if (!isEnemy) return -10
    if (!target) return chosen.action === 'damage' ? 1 : -1
    const kills = chosen.action === 'destroy' || (chosen.action === 'damage' && (chosen.amount ?? 0) >= target.health)
    return value(target) + (kills ? 5 : 0)
  }
  if (isEnemy) return -10
  if (chosen.action === 'heal') {
    const unit = target ?? state.players[playerId].hero
    return Math.min(chosen.amount ?? 0, unit.maxHealth - unit.health)
  }
  return target ? value(target) : 0
}

// 只加潮能的牌：能讓更貴的牌打得出來才使用
function manaCardUseful(state: GameState, playerId: PlayerId, card: Card): boolean {
  const gain = card.effects.filter((e) => e.action === 'gainMana').reduce((s, e) => s + (e.amount ?? 0), 0)
  const p = state.players[playerId]
  const left = p.mana - card.cost
  return p.hand.some((c) => {
    const cost = state.cards[c.cardId]?.cost ?? Infinity
    return c.cardId !== card.id && cost > left && cost <= left + gain
  })
}

function choosePlay(state: GameState, playerId: PlayerId, plays: PlayCardAction[], rng: () => number): Action | null {
  const byCard = new Map<string, PlayCardAction[]>()
  for (const a of plays) {
    const id = a.cardInstanceId as string
    byCard.set(id, [...(byCard.get(id) ?? []), a])
  }
  const options = [...byCard.values()]
    .map((actions) => ({ actions, card: cardOf(state, playerId, actions[0] as PlayCardAction) }))
    .filter((o): o is { actions: PlayCardAction[]; card: Card } => o.card !== undefined)
    .sort((x, y) => y.card.cost - x.card.cost)
  const boardLen = state.players[playerId].board.length
  for (const { actions, card } of options) {
    const onlyMana = card.effects.length > 0 && card.effects.every((e) => e.action === 'gainMana')
    if (onlyMana && !manaCardUseful(state, playerId, card)) continue
    const wantsMiddle = card.effects.some((e) => e.target === 'adjacent')
    const preferredPos = wantsMiddle ? Math.floor(boardLen / 2) : boardLen
    const pick = best(
      actions,
      (a) => scorePlay(state, playerId, card, a) + (a.position === undefined || a.position === preferredPos ? 0.5 : 0),
      rng,
    )
    if (!pick) continue
    if (card.type === 'spell' && pick.score < 0) continue
    return pick.item
  }
  return null
}

const hp = (m: CardInstance): number => m.health + (has(m, 'bubble') ? 1 : 0)

// 法術能解掉守護：消滅、彈回，或傷害後剩下的血量己方合力打得掉
function tauntRemoval(
  state: GameState,
  playerId: PlayerId,
  plays: PlayCardAction[],
  attackPower: number,
  rng: () => number,
): Action | null {
  const pick = best(
    plays.filter((a) => {
      const card = cardOf(state, playerId, a)
      const target = a.targetId === undefined ? undefined : minionById(state, a.targetId)
      if (!card || card.type !== 'spell' || !target || target.owner === playerId || !has(target, 'taunt')) return false
      const e = card.effects.find((x) => x.trigger === 'onPlay' && x.target.startsWith('chosen'))
      if (!e) return false
      if (e.action === 'destroy' || e.action === 'bounce') return true
      if (e.action !== 'damage') return false
      const left = has(target, 'bubble') ? target.health : target.health - (e.amount ?? 0)
      return left <= 0 || left <= attackPower
    }),
    (a) => {
      const target = minionById(state, a.targetId as string) as CardInstance
      return value(target) - (cardOf(state, playerId, a)?.cost ?? 0)
    },
    rng,
  )
  return pick ? pick.item : null
}

// 單隻打不贏的守護：合力打得掉且損失可接受時，先派最不值錢的攻擊者
function groupAttack(state: GameState, attacks: AttackAction[]): Action | null {
  const byTarget = new Map<string, AttackAction[]>()
  for (const a of attacks) byTarget.set(a.targetId, [...(byTarget.get(a.targetId) ?? []), a])
  let choice: { action: AttackAction; cost: number } | null = null
  for (const [targetId, list] of byTarget) {
    const defender = minionById(state, targetId)
    if (!defender || !has(defender, 'taunt')) continue
    const ranked = list
      .map((a) => ({ a, m: minionById(state, a.attackerId) as CardInstance }))
      .sort((x, y) => y.m.attack - x.m.attack)
    let need = hp(defender)
    let lost = 0
    const used: typeof ranked = []
    for (const r of ranked) {
      if (need <= 0) break
      used.push(r)
      need -= has(defender, 'bubble') && used.length === 1 ? 1 : r.m.attack
      if (defender.attack >= r.m.health && !has(r.m, 'bubble')) lost += value(r.m)
    }
    if (need > 0 || lost > value(defender) * 1.5 + 2) continue
    const first = [...used].sort((x, y) => value(x.m) - value(y.m))[0]
    if (first && (!choice || lost < choice.cost)) choice = { action: first.a, cost: lost }
  }
  return choice ? choice.action : null
}

function tradeScore(state: GameState, a: AttackAction): number {
  const attacker = minionById(state, a.attackerId)
  const defender = minionById(state, a.targetId)
  if (!attacker || !defender) return -Infinity
  const kills = attacker.attack >= defender.health && !has(defender, 'bubble')
  const survives = defender.attack < attacker.health || has(attacker, 'bubble')
  if (kills && survives) return 10 + value(defender)
  if (kills && value(defender) >= value(attacker)) return 5 + value(defender) - value(attacker)
  if (has(defender, 'taunt') && (kills || survives)) return 1
  return -Infinity
}

export function chooseAction(state: GameState, playerId: PlayerId, rng: () => number): Action {
  const legal = getLegalActions(state, playerId)
  if (legal.length <= 1 || state.actionsThisTurn >= MAX_ACTIONS_PER_TURN) return END
  const enemyId: PlayerId = playerId === 'p1' ? 'p2' : 'p1'
  const enemyHeroId = heroId(enemyId)
  const enemyHero = state.players[enemyId].hero
  const enemyHp = enemyHero.health + enemyHero.armor
  const attacks = legal.filter((a): a is AttackAction => a.type === 'attack')
  const plays = legal.filter((a): a is PlayCardAction => a.type === 'playCard')

  // ① 致命檢查
  const faceAttacks = attacks.filter((a) => a.targetId === enemyHeroId)
  const faceTotal = faceAttacks.reduce((s, a) => s + (minionById(state, a.attackerId)?.attack ?? 0), 0)
  const burn = best(
    plays,
    (a) => {
      const card = cardOf(state, playerId, a)
      return card ? faceDamage(card, a, enemyHeroId) : 0
    },
    rng,
  )
  if (burn && burn.score > 0 && burn.score >= enemyHp) return burn.item
  if (faceAttacks.length > 0 && faceTotal >= enemyHp) return faceAttacks[0] as Action
  if (burn && burn.score > 0 && faceTotal + burn.score >= enemyHp) return burn.item

  // ② 有利交換
  const trade = best(
    attacks.filter((a) => a.targetId !== enemyHeroId),
    (a) => tradeScore(state, a),
    rng,
  )
  if (trade && trade.score > -Infinity) return trade.item

  // ②-1 守護擋路：先用法術解，再評估合力攻擊
  const blocked = attacks.length > 0 && faceAttacks.length === 0
  if (blocked) {
    const attackPower = attacks
      .filter((a, i, xs) => xs.findIndex((x) => x.attackerId === a.attackerId) === i)
      .reduce((s, a) => s + (minionById(state, a.attackerId)?.attack ?? 0), 0)
    const removal = tauntRemoval(state, playerId, plays, attackPower, rng)
    if (removal) return removal
    const group = groupAttack(state, attacks)
    if (group) return group
  }

  // ③ 出最貴的牌
  const play = choosePlay(state, playerId, plays, rng)
  if (play) return play

  // ④ 打臉
  if (faceAttacks.length > 0) return faceAttacks[0] as Action

  return END
}

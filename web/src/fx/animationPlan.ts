// 事件 → 動畫指令：純函式，時長皆為 1x 速度下的毫秒
import type { Card, GameEvent } from '@/engine'
import type { SfxName } from './audio'

export type ShakeLevel = 'none' | 'light' | 'medium' | 'heavy'

export type AnimKind =
  | 'turnBanner'
  | 'draw'
  | 'burn'
  | 'fatigue'
  | 'mana'
  | 'cardPlayed'
  | 'summon'
  | 'attack'
  | 'damage'
  | 'heroDamage'
  | 'heal'
  | 'armor'
  | 'buff'
  | 'freeze'
  | 'unfreeze'
  | 'bubblePop'
  | 'bounce'
  | 'death'
  | 'gameOver'

export interface AnimCommand {
  kind: AnimKind
  event: GameEvent
  durationMs: number
  delayMs: number
  holdMs: number
  hitStopMs: number
  shake: ShakeLevel
  sfx: SfxName[]
}

export interface PlanContext {
  cards: Record<string, Card>
  attackOf: (instanceId: string) => number
  aiTurn: boolean
}

// ux.md 5.2 的時長規格
export const TIMING = {
  turnBanner: { in: 300, hold: 900, out: 250 },
  draw: { fly: 350, stagger: 120 },
  burn: { hold: 300, pop: 400 },
  fatigue: 900,
  play: { move: 300, holdSpell: 450, holdCreature: 250, dissolve: 300 },
  summon: { move: 250, drop: 180, bounce: 220 },
  attack: { windup: 150, dash: 180, rebound: 350 },
  damage: { pop: 200, hold: 600, fade: 300 },
  heal: 1100,
  armor: 600,
  buff: 500,
  freeze: 400,
  unfreeze: { crack: 200, fall: 300 },
  bubblePop: { swell: 80, burst: 400 },
  bounce: 400,
  death: { gray: 150, shrink: 450, particles: 600 },
  gameOver: 2600,
  aiThink: 400,
} as const

export const HIT_STOP = { summon: 40, attack: 80, attackHeavy: 120, freeze: 50, bubble: 60, hero: 100, finalBlow: 200 } as const

export function scaleMs(ms: number, speed: number): number {
  return Math.round(ms / speed)
}

export function attackShake(atk: number): ShakeLevel {
  if (atk >= 8) return 'heavy'
  if (atk >= 5) return 'medium'
  return atk >= 1 ? 'light' : 'none'
}

export function heroDamageShake(amount: number): ShakeLevel {
  if (amount >= 10) return 'heavy'
  if (amount >= 5) return 'medium'
  return amount >= 1 ? 'light' : 'none'
}

const isHero = (id: string) => id === 'p1-hero' || id === 'p2-hero'

function cmd(kind: AnimKind, event: GameEvent, durationMs: number, extra: Partial<AnimCommand> = {}): AnimCommand {
  return { kind, event, durationMs, delayMs: 0, holdMs: 0, hitStopMs: 0, shake: 'none', sfx: [], ...extra }
}

function summonCmd(event: GameEvent, card: Card | undefined): AnimCommand {
  const s = TIMING.summon
  const legendary = card?.rarity === 'legendary'
  const big = (card?.cost ?? 0) >= 7
  return cmd('summon', event, s.move + s.drop + s.bounce, {
    hitStopMs: HIT_STOP.summon,
    shake: legendary ? 'heavy' : big ? 'medium' : 'none',
    sfx: [legendary ? 'sfx_summon_legendary' : big ? 'sfx_summon_land_big' : 'sfx_summon_land'],
  })
}

const DAMAGE_TOTAL = TIMING.damage.pop + TIMING.damage.hold + TIMING.damage.fade

// 同一批並行播放：連續的傷害／治療／泡泡破、連續死亡、連續抽牌
type GroupKey = 'hit' | 'death' | 'draw' | null
function groupOf(e: GameEvent): GroupKey {
  if (e.type === 'damage' || e.type === 'heal' || e.type === 'bubblePop') return 'hit'
  if (e.type === 'death') return 'death'
  if (e.type === 'draw') return 'draw'
  return null
}

export function planEvents(events: GameEvent[], ctx: PlanContext): AnimCommand[][] {
  const batches: AnimCommand[][] = []
  let lastGroup: GroupKey = null
  let afterAttack = false
  let prev: GameEvent | undefined
  for (const e of events) {
    const group = groupOf(e)
    const cmds = planOne(e, ctx, prev, afterAttack && group === 'hit')
    if (group !== null && group === lastGroup && batches.length > 0) {
      const batch = batches[batches.length - 1]!
      for (const c of cmds) {
        if (group === 'draw') c.delayMs = batch.length * TIMING.draw.stagger
        batch.push(c)
      }
    } else {
      for (const c of cmds) batches.push([c])
    }
    if (e.type === 'attack') afterAttack = true
    else if (group !== 'hit') afterAttack = false
    lastGroup = group
    prev = e
  }
  return batches
}

function planOne(e: GameEvent, ctx: PlanContext, prev: GameEvent | undefined, afterAttack: boolean): AnimCommand[] {
  switch (e.type) {
    case 'turnStart': {
      const t = TIMING.turnBanner
      return [cmd('turnBanner', e, t.in + t.hold + t.out, { sfx: ['sfx_turn_start'] })]
    }
    case 'manaChange':
      return [cmd('mana', e, 0, { sfx: prev?.type === 'turnStart' ? ['sfx_mana_fill'] : [] })]
    case 'draw':
      return [cmd('draw', e, TIMING.draw.fly, { sfx: ['sfx_card_draw'] })]
    case 'burn':
      return [cmd('burn', e, TIMING.burn.hold + TIMING.burn.pop, { sfx: ['sfx_card_burn'] })]
    case 'fatigue':
      return [cmd('fatigue', e, TIMING.fatigue, { sfx: ['sfx_debuff'] })]
    case 'cardPlayed': {
      const card = ctx.cards[e.cardId]
      const p = TIMING.play
      const creature = card?.type === 'creature'
      const hold = (creature ? p.holdCreature : p.holdSpell) * (ctx.aiTurn ? 2 : 1)
      if (creature) {
        return [cmd('cardPlayed', e, p.move + hold, { holdMs: hold, sfx: ['sfx_card_play'] }), summonCmd(e, card)]
      }
      const faction = card?.faction ?? 'neutral'
      return [
        cmd('cardPlayed', e, p.move + hold + p.dissolve, {
          holdMs: hold,
          sfx: ['sfx_card_play', `sfx_spell_cast_${faction}`],
        }),
      ]
    }
    case 'summon':
      return [summonCmd(e, ctx.cards[e.cardId])]
    case 'attack': {
      const a = TIMING.attack
      const atk = ctx.attackOf(e.attackerId)
      const heavy = atk >= 5
      return [
        cmd('attack', e, a.windup + a.dash + a.rebound, {
          hitStopMs: heavy ? HIT_STOP.attackHeavy : HIT_STOP.attack,
          shake: attackShake(atk),
          sfx: ['sfx_attack_whoosh', heavy ? 'sfx_attack_hit_heavy' : 'sfx_attack_hit_light'],
        }),
      ]
    }
    case 'damage':
      if (isHero(e.targetId)) {
        return [
          cmd('heroDamage', e, DAMAGE_TOTAL, {
            hitStopMs: afterAttack ? 0 : HIT_STOP.hero,
            shake: afterAttack ? 'none' : heroDamageShake(e.amount),
            sfx: ['sfx_hero_hit'],
          }),
        ]
      }
      return [cmd('damage', e, DAMAGE_TOTAL, { sfx: ['sfx_damage_tick'] })]
    case 'heal':
      return [cmd('heal', e, TIMING.heal, { sfx: ['sfx_heal'] })]
    case 'armor':
      return [cmd('armor', e, TIMING.armor, { sfx: ['sfx_buff'] })]
    case 'buff':
      return [cmd('buff', e, TIMING.buff, { sfx: [e.atk < 0 || e.hp < 0 ? 'sfx_debuff' : 'sfx_buff'] })]
    case 'freeze':
      return [cmd('freeze', e, TIMING.freeze, { hitStopMs: HIT_STOP.freeze, shake: 'light', sfx: ['sfx_freeze'] })]
    case 'unfreeze':
      return [cmd('unfreeze', e, TIMING.unfreeze.crack + TIMING.unfreeze.fall, { sfx: ['sfx_unfreeze'] })]
    case 'bubblePop':
      return [
        cmd('bubblePop', e, TIMING.bubblePop.swell + TIMING.bubblePop.burst, {
          hitStopMs: HIT_STOP.bubble,
          shake: 'light',
          sfx: ['sfx_bubble_pop'],
        }),
      ]
    case 'bounce':
      return [cmd('bounce', e, TIMING.bounce, { sfx: ['sfx_card_return'] })]
    case 'death': {
      const d = TIMING.death
      return [cmd('death', e, d.gray + d.shrink + d.particles, { sfx: ['sfx_minion_death'] })]
    }
    case 'gameOver':
      return [cmd('gameOver', e, TIMING.gameOver, { hitStopMs: HIT_STOP.finalBlow, shake: 'heavy', sfx: ['sfx_final_blow'] })]
  }
}

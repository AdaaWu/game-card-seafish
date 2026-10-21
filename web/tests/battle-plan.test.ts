import { describe, expect, it } from 'vitest'
import type { Card, GameEvent } from '@/engine'
import { planEvents, scaleMs, TIMING, type PlanContext } from '@/fx/animationPlan'
import { card } from './engine/helpers'

const cards: Record<string, Card> = Object.fromEntries(
  [
    card({ id: 'small', cost: 2, attack: 2, health: 2 }),
    card({ id: 'big', cost: 7, attack: 7, health: 7, rarity: 'epic' }),
    card({ id: 'legend', cost: 5, attack: 5, health: 5, rarity: 'legendary' }),
    card({ id: 'wave', type: 'spell', faction: 'tide', cost: 2 }),
  ].map((c) => [c.id, c]),
)

const attacks: Record<string, number> = { a3: 3, a5: 5, a6: 6, a8: 8, a9: 9 }
const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  cards,
  attackOf: (id) => attacks[id] ?? 0,
  aiTurn: false,
  ...over,
})

const kinds = (events: GameEvent[], c = ctx()) => planEvents(events, c).map((b) => b.map((x) => x.kind))
const only = (e: GameEvent, c = ctx()) => {
  const batches = planEvents([e], c)
  expect(batches).toHaveLength(1)
  expect(batches[0]).toHaveLength(1)
  return batches[0]![0]!
}

const dmg = (targetId: string, amount: number): GameEvent => ({ type: 'damage', targetId, amount, armorAbsorbed: 0 })

describe('scaleMs 依速度倍率換算時長', () => {
  it('1x 不變、2x 減半、3x 四捨五入', () => {
    expect(scaleMs(400, 1)).toBe(400)
    expect(scaleMs(400, 2)).toBe(200)
    expect(scaleMs(400, 3)).toBe(133)
  })
})

describe('planEvents 事件對應動畫指令', () => {
  it('回合開始播大字與號角，緊接的潮能補滿播水滴聲', () => {
    const batches = planEvents(
      [
        { type: 'turnStart', playerId: 'p1', turn: 1 },
        { type: 'manaChange', playerId: 'p1', mana: 1, maxMana: 1 },
      ],
      ctx(),
    )
    expect(batches.map((b) => b.map((x) => x.kind))).toEqual([['turnBanner'], ['mana']])
    expect(batches[0]![0]!.sfx).toEqual(['sfx_turn_start'])
    expect(batches[0]![0]!.durationMs).toBe(1450)
    expect(batches[1]![0]!.sfx).toEqual(['sfx_mana_fill'])
  })

  it('出牌扣潮能不播水滴聲', () => {
    expect(only({ type: 'manaChange', playerId: 'p1', mana: 0, maxMana: 2 }).sfx).toEqual([])
  })

  it('單張抽牌 350ms 並播抽牌音效', () => {
    const c = only({ type: 'draw', playerId: 'p1', instanceId: 'i1', cardId: 'small' })
    expect(c).toMatchObject({ kind: 'draw', durationMs: 350, delayMs: 0, hitStopMs: 0, shake: 'none' })
    expect(c.sfx).toEqual(['sfx_card_draw'])
  })

  it('連續抽多張合成同一批，每張間隔 120ms', () => {
    const draw = (i: string): GameEvent => ({ type: 'draw', playerId: 'p1', instanceId: i, cardId: 'small' })
    const batches = planEvents([draw('a'), draw('b'), draw('c')], ctx())
    expect(batches).toHaveLength(1)
    expect(batches[0]!.map((x) => x.delayMs)).toEqual([0, 120, 240])
  })

  it('爆牌停留 300ms 再碎成泡泡 400ms', () => {
    const c = only({ type: 'burn', playerId: 'p1', instanceId: 'i1', cardId: 'small' })
    expect(c).toMatchObject({ kind: 'burn', durationMs: 700 })
    expect(c.sfx).toEqual(['sfx_card_burn'])
  })

  it('疲勞獨立成一批', () => {
    expect(only({ type: 'fatigue', playerId: 'p1', damage: 2 }).kind).toBe('fatigue')
  })

  it('打出法術展示 450ms 並播該陣營施法音效', () => {
    const c = only({ type: 'cardPlayed', playerId: 'p1', instanceId: 'i1', cardId: 'wave' })
    expect(c).toMatchObject({ kind: 'cardPlayed', holdMs: 450, durationMs: 1050 })
    expect(c.sfx).toEqual(['sfx_card_play', 'sfx_spell_cast_tide'])
  })

  it('AI 回合出牌展示時間與玩家相同', () => {
    const c = only({ type: 'cardPlayed', playerId: 'p2', instanceId: 'i1', cardId: 'wave' }, ctx({ aiTurn: true }))
    expect(c.holdMs).toBe(450)
    const m = planEvents([{ type: 'cardPlayed', playerId: 'p2', instanceId: 'i2', cardId: 'small', position: 0 }], ctx({ aiTurn: true }))
    expect(m[0]![0]!.holdMs).toBe(250)
  })

  it('AI 每步停頓 200ms', () => {
    expect(TIMING.aiThink).toBe(200)
  })

  it('打出生物拆成展示與召喚落地兩批', () => {
    const batches = planEvents([{ type: 'cardPlayed', playerId: 'p1', instanceId: 'i1', cardId: 'small', position: 0 }], ctx())
    expect(batches.map((b) => b.map((x) => x.kind))).toEqual([['cardPlayed'], ['summon']])
    expect(batches[0]![0]).toMatchObject({ holdMs: 250, durationMs: 550 })
    expect(batches[0]![0]!.sfx).toEqual(['sfx_card_play'])
    expect(batches[1]![0]).toMatchObject({ durationMs: 650, hitStopMs: 40, shake: 'none' })
    expect(batches[1]![0]!.sfx).toEqual(['sfx_summon_land'])
  })

  it('費用 7 以上的生物落地中震並播大型落地音效', () => {
    const c = only({ type: 'summon', playerId: 'p1', instanceId: 'i1', cardId: 'big', position: 0 })
    expect(c.shake).toBe('medium')
    expect(c.sfx).toEqual(['sfx_summon_land_big'])
  })

  it('傳說生物落地重震並播傳說音效', () => {
    const c = only({ type: 'summon', playerId: 'p1', instanceId: 'i1', cardId: 'legend', position: 0 })
    expect(c.shake).toBe('heavy')
    expect(c.sfx).toEqual(['sfx_summon_legendary'])
  })

  it('攻擊 1–4 hit stop 80ms 輕震、輕打擊聲', () => {
    const c = only({ type: 'attack', attackerId: 'a3', targetId: 'p2-hero' })
    expect(c).toMatchObject({ kind: 'attack', durationMs: 680, hitStopMs: 80, shake: 'light' })
    expect(c.sfx).toEqual(['sfx_attack_whoosh', 'sfx_attack_hit_light'])
  })

  it('攻擊 5 以上 hit stop 120ms、重打擊聲，5–7 中震', () => {
    for (const id of ['a5', 'a6']) {
      const c = only({ type: 'attack', attackerId: id, targetId: 'p2-hero' })
      expect(c).toMatchObject({ hitStopMs: 120, shake: 'medium' })
      expect(c.sfx).toEqual(['sfx_attack_whoosh', 'sfx_attack_hit_heavy'])
    }
  })

  it('攻擊 8 以上重震', () => {
    expect(only({ type: 'attack', attackerId: 'a8', targetId: 'p2-hero' }).shake).toBe('heavy')
    expect(only({ type: 'attack', attackerId: 'a9', targetId: 'p2-hero' }).shake).toBe('heavy')
  })

  it('攻擊後的傷害與反擊傷害同一批，不再重複 hit stop 與震動', () => {
    const batches = planEvents(
      [{ type: 'attack', attackerId: 'a3', targetId: 'x' }, dmg('x', 3), dmg('a3', 2)],
      ctx(),
    )
    expect(batches.map((b) => b.map((x) => x.kind))).toEqual([['attack'], ['damage', 'damage']])
    expect(batches[1]!.every((x) => x.hitStopMs === 0 && x.shake === 'none')).toBe(true)
  })

  it('攻擊打英雄的傷害改用英雄受傷指令且不重複震動', () => {
    const batches = planEvents([{ type: 'attack', attackerId: 'a3', targetId: 'p2-hero' }, dmg('p2-hero', 3)], ctx())
    expect(batches[1]![0]).toMatchObject({ kind: 'heroDamage', hitStopMs: 0, shake: 'none' })
    expect(batches[1]![0]!.sfx).toEqual(['sfx_hero_hit'])
  })

  it('法術直接打英雄：hit stop 100ms，震動依傷害量分級', () => {
    expect(only(dmg('p1-hero', 4))).toMatchObject({ kind: 'heroDamage', hitStopMs: 100, shake: 'light' })
    expect(only(dmg('p1-hero', 5)).shake).toBe('medium')
    expect(only(dmg('p1-hero', 9)).shake).toBe('medium')
    expect(only(dmg('p1-hero', 10)).shake).toBe('heavy')
  })

  it('生物受傷：彈出 200＋停留 600＋淡出 300，播數字音效', () => {
    const c = only(dmg('m1', 2))
    expect(c).toMatchObject({ kind: 'damage', durationMs: 1100, hitStopMs: 0, shake: 'none' })
    expect(c.sfx).toEqual(['sfx_damage_tick'])
  })

  it('同時發生的傷害與治療合成一批（AOE）', () => {
    expect(kinds([dmg('m1', 1), dmg('m2', 1), { type: 'heal', targetId: 'p1-hero', amount: 2 }])).toEqual([
      ['damage', 'damage', 'heal'],
    ])
  })

  it('治療播治療音效', () => {
    expect(only({ type: 'heal', targetId: 'm1', amount: 2 }).sfx).toEqual(['sfx_heal'])
  })

  it('泡泡破：膨脹 80＋飛散 400，hit stop 60ms 輕震', () => {
    const c = only({ type: 'bubblePop', targetId: 'm1' })
    expect(c).toMatchObject({ kind: 'bubblePop', durationMs: 480, hitStopMs: 60, shake: 'light' })
    expect(c.sfx).toEqual(['sfx_bubble_pop'])
  })

  it('冰凍 400ms、hit stop 50ms 輕震；解凍 500ms', () => {
    const f = only({ type: 'freeze', targetId: 'm1' })
    expect(f).toMatchObject({ kind: 'freeze', durationMs: 400, hitStopMs: 50, shake: 'light' })
    expect(f.sfx).toEqual(['sfx_freeze'])
    const u = only({ type: 'unfreeze', targetId: 'm1' })
    expect(u).toMatchObject({ kind: 'unfreeze', durationMs: 500 })
    expect(u.sfx).toEqual(['sfx_unfreeze'])
  })

  it('加成播加成音效，減益播減益音效', () => {
    expect(only({ type: 'buff', targetId: 'm1', atk: 1, hp: 1 }).sfx).toEqual(['sfx_buff'])
    expect(only({ type: 'buff', targetId: 'm1', atk: -1, hp: 0 }).sfx).toEqual(['sfx_debuff'])
  })

  it('獲得護甲獨立一批', () => {
    expect(only({ type: 'armor', playerId: 'p1', amount: 3 }).kind).toBe('armor')
  })

  it('彈回手牌播卡片滑回音效', () => {
    expect(only({ type: 'bounce', playerId: 'p1', instanceId: 'm1', cardId: 'small' }).sfx).toEqual(['sfx_card_return'])
  })

  it('死亡等受傷數字結束後才播，同時死亡合成一批', () => {
    const batches = planEvents(
      [
        dmg('m1', 5),
        { type: 'death', playerId: 'p2', instanceId: 'm1', cardId: 'small' },
        { type: 'death', playerId: 'p2', instanceId: 'm2', cardId: 'small' },
      ],
      ctx(),
    )
    expect(batches.map((b) => b.map((x) => x.kind))).toEqual([['damage'], ['death', 'death']])
    expect(batches[1]![0]).toMatchObject({ durationMs: 1200, hitStopMs: 0, shake: 'none' })
    expect(batches[1]![0]!.sfx).toEqual(['sfx_minion_death'])
  })

  it('勝負：致命一擊 hit stop 200ms 重震', () => {
    const c = only({ type: 'gameOver', winner: 'p1' })
    expect(c).toMatchObject({ kind: 'gameOver', hitStopMs: 200, shake: 'heavy' })
    expect(c.sfx).toEqual(['sfx_final_blow'])
  })

  it('所有事件依原順序出現在指令中', () => {
    const events: GameEvent[] = [
      { type: 'turnStart', playerId: 'p2', turn: 2 },
      { type: 'manaChange', playerId: 'p2', mana: 1, maxMana: 1 },
      { type: 'draw', playerId: 'p2', instanceId: 'd1', cardId: 'small' },
      { type: 'attack', attackerId: 'a5', targetId: 'm1' },
      dmg('m1', 5),
      dmg('a5', 1),
      { type: 'death', playerId: 'p1', instanceId: 'm1', cardId: 'small' },
      { type: 'freeze', targetId: 'a5' },
    ]
    const flat = planEvents(events, ctx()).flat().map((c) => c.event)
    expect(flat).toEqual(events)
  })
})

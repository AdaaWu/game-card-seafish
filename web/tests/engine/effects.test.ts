import { describe, expect, it } from 'vitest'
import { IllegalActionError, applyAction, getLegalActions } from '@/engine'
import { END, act, attack, boardIds, deckOf, handIds, minionOf, play, setup } from './helpers'

describe('effect action', () => {
  it('damage 對生物扣血', () => {
    const s = setup({ p1: { hand: ['bolt3'] }, p2: { board: ['v55'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(minionOf(state, 'p2-m0').health).toBe(2)
  })

  it('damage 對英雄先扣護甲', () => {
    const s = setup({ p1: { hand: ['bolt3'] }, p2: { armor: 2 } })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p2-hero' }))
    expect(state.players.p2.hero).toMatchObject({ health: 29, armor: 0 })
    expect(events).toContainEqual({ type: 'damage', targetId: 'p2-hero', amount: 1, armorAbsorbed: 2 })
  })

  it('heal 回復英雄', () => {
    const s = setup({ p1: { hand: ['heal5'], health: 22 } })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p1-hero' }))
    expect(state.players.p1.hero.health).toBe(27)
    expect(events).toContainEqual({ type: 'heal', targetId: 'p1-hero', amount: 5 })
  })

  it('heal 不超過上限', () => {
    const s = setup({ p1: { hand: ['heal5', 'heal5'], health: 28, board: [{ cardId: 'v55', health: 1 }] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p1-hero' }), play('p1-h1', { targetId: 'p1-m0' }))
    expect(state.players.p1.hero.health).toBe(30)
    expect(minionOf(state, 'p1-m0')).toMatchObject({ health: 5, maxHealth: 5 })
  })

  it('draw 從牌庫頂抽牌', () => {
    const s = setup({ p1: { hand: ['draw2'], deck: ['v11', 'v22', 'v33'] } })
    const { state, events } = act(s, play('p1-h0'))
    expect(handIds(state, 'p1')).toEqual(['v11', 'v22'])
    expect(state.players.p1.deck.map((c) => c.cardId)).toEqual(['v33'])
    expect(events).toContainEqual({ type: 'draw', playerId: 'p1', instanceId: 'p1-d0', cardId: 'v11' })
  })

  it('draw 的 self 代表己方', () => {
    const s = setup({ p1: { hand: ['selfDraw'], deck: ['v33'] } })
    const { state } = act(s, play('p1-h0'))
    expect(handIds(state, 'p1')).toEqual(['v33'])
  })

  it('buff 永久加攻加血並提高上限', () => {
    const s = setup({ p1: { hand: ['buff22'], board: ['v22'] } })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p1-m0' }))
    expect(minionOf(state, 'p1-m0')).toMatchObject({ attack: 4, health: 4, maxHealth: 4 })
    expect(events).toContainEqual({ type: 'buff', targetId: 'p1-m0', atk: 2, hp: 2 })
  })

  it('summon 在自身右側召喚', () => {
    const s = setup({ p1: { hand: ['summoner'], board: ['v11'] } })
    const { state, events } = act(s, play('p1-h0', { position: 0 }))
    expect(boardIds(state, 'p1')).toEqual(['summoner', 'token-fish', 'v11'])
    expect(events.filter((e) => e.type === 'summon')).toMatchObject([
      { type: 'summon', playerId: 'p1', cardId: 'token-fish', position: 1 },
    ])
  })

  it('summon 召喚的生物當回合不能攻擊', () => {
    const s = setup({ p1: { hand: ['summoner'] } })
    const { state } = act(s, play('p1-h0'))
    expect(getLegalActions(state, 'p1').filter((a) => a.type === 'attack')).toEqual([])
  })

  it('summon 場上滿 6 隻時略過', () => {
    const s = setup({ p1: { hand: ['summoner'], board: deckOf('v11', 5) } })
    const { state, events } = act(s, play('p1-h0'))
    expect(boardIds(state, 'p1')).toEqual([...deckOf('v11', 5), 'summoner'])
    expect(events.filter((e) => e.type === 'summon')).toEqual([])
  })

  it('armor 增加護甲', () => {
    const s = setup({ p1: { hand: ['armor5'], armor: 1 } })
    const { state, events } = act(s, play('p1-h0'))
    expect(state.players.p1.hero.armor).toBe(6)
    expect(events).toContainEqual({ type: 'armor', playerId: 'p1', amount: 5 })
  })

  it('bounce 送回擁有者手牌並重置數值', () => {
    const s = setup({
      p1: { hand: ['bounceOne'] },
      p2: { board: [{ cardId: 'v55', attack: 9, health: 2, frozen: true }] },
    })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(boardIds(state, 'p2')).toEqual([])
    const back = state.players.p2.hand.find((c) => c.cardId === 'v55')
    expect(back).toMatchObject({ attack: 5, health: 5, maxHealth: 5, frozen: false })
    expect(events).toContainEqual({ type: 'bounce', playerId: 'p2', instanceId: 'p2-m0', cardId: 'v55' })
  })

  it('bounce 時手牌已滿，該卡直接消失且不觸發死亡', () => {
    const s = setup({ p1: { hand: ['bounceOne'] }, p2: { hand: deckOf('v11', 10), board: ['deathSummon'] } })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(boardIds(state, 'p2')).toEqual([])
    expect(state.players.p2.hand).toHaveLength(10)
    expect(handIds(state, 'p2')).not.toContain('deathSummon')
    expect(events.filter((e) => e.type === 'death' || e.type === 'summon')).toEqual([])
  })

  it('destroy 直接消滅，無視 bubble', () => {
    const s = setup({ p1: { hand: ['destroyOne'] }, p2: { board: ['bubble23'] } })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(boardIds(state, 'p2')).toEqual([])
    expect(events).toContainEqual({ type: 'death', playerId: 'p2', instanceId: 'p2-m0', cardId: 'bubble23' })
  })

  it('gainMana 增加本回合潮能', () => {
    const s = setup({ p1: { hand: ['gainMana2'], mana: 3 } })
    const { state } = act(s, play('p1-h0'))
    expect(state.players.p1.mana).toBe(5)
  })

  it('gainMana 不超過 10', () => {
    const s = setup({ p1: { hand: ['gainMana2'], mana: 9 } })
    const { state } = act(s, play('p1-h0'))
    expect(state.players.p1.mana).toBe(10)
  })
})

describe('effect target', () => {
  it('allEnemyMinions 只打敵方生物', () => {
    const s = setup({ p1: { hand: ['aoe1'], board: ['v11'] }, p2: { board: ['v11', 'v22'] } })
    const { state } = act(s, play('p1-h0'))
    expect(boardIds(state, 'p2')).toEqual(['v22'])
    expect(minionOf(state, 'p2-m1').health).toBe(1)
    expect(boardIds(state, 'p1')).toEqual(['v11'])
  })

  it('allMinions 打雙方所有生物', () => {
    const s = setup({ p1: { hand: ['aoeAll2'], board: ['v11', 'v33'] }, p2: { board: ['v22', 'v55'] } })
    const { state } = act(s, play('p1-h0'))
    expect(boardIds(state, 'p1')).toEqual(['v33'])
    expect(boardIds(state, 'p2')).toEqual(['v55'])
    expect(minionOf(state, 'p1-m1').health).toBe(1)
    expect(minionOf(state, 'p2-m1').health).toBe(3)
  })

  it('allFriendlyMinions 加成己方全體', () => {
    const s = setup({ p1: { hand: ['teamBuff'], board: ['v11', 'v22'] }, p2: { board: ['v11'] } })
    const { state } = act(s, play('p1-h0'))
    expect(minionOf(state, 'p1-m0')).toMatchObject({ attack: 2, health: 2 })
    expect(minionOf(state, 'p1-m1')).toMatchObject({ attack: 3, health: 3 })
    expect(minionOf(state, 'p2-m0')).toMatchObject({ attack: 1, health: 1 })
  })

  it('all* 包含觸發效果的生物自身', () => {
    const s = setup({ p1: { hand: ['rallyFish'], board: ['v11'] } })
    const { state } = act(s, play('p1-h0'))
    expect(minionOf(state, 'p1-h0')).toMatchObject({ attack: 2, health: 2 })
    expect(minionOf(state, 'p1-m0')).toMatchObject({ attack: 2, health: 2 })
  })

  it('allEnemies 打敵方英雄與生物', () => {
    const s = setup({ p1: { hand: ['blast2'] }, p2: { board: ['v22', 'v33'] } })
    const { state } = act(s, play('p1-h0'))
    expect(state.players.p2.hero.health).toBe(28)
    expect(boardIds(state, 'p2')).toEqual(['v33'])
  })

  it('enemyHero 打敵方英雄', () => {
    const s = setup({ p1: { hand: ['fireball6'] } })
    const { state } = act(s, play('p1-h0'))
    expect(state.players.p2.hero.health).toBe(24)
  })

  it('randomEnemyMinion 只有一個候選時必中', () => {
    const s = setup({ p1: { hand: ['randomBolt'] }, p2: { board: ['v33'] } })
    const { state } = act(s, play('p1-h0'))
    expect(minionOf(state, 'p2-m0').health).toBe(1)
  })

  it('randomEnemyMinion 沒有候選時仍可施放且無效果', () => {
    const s = setup({ p1: { hand: ['randomBolt'] } })
    const { state, events } = act(s, play('p1-h0'))
    expect(state.players.p1.mana).toBe(9)
    expect(events.filter((e) => e.type === 'damage')).toEqual([])
  })

  it('randomEnemy 在敵方無生物時打英雄', () => {
    const s = setup({ p1: { hand: ['randomEnemy3'] } })
    const { state } = act(s, play('p1-h0'))
    expect(state.players.p2.hero.health).toBe(27)
  })

  it('randomFriendlyMinion 加成唯一的友方生物', () => {
    const s = setup({ p1: { hand: ['luckyBuff'], board: ['v11'] } })
    const { state } = act(s, play('p1-h0'))
    expect(minionOf(state, 'p1-m0')).toMatchObject({ attack: 2, health: 2 })
  })

  it('adjacent 加成左右相鄰', () => {
    const s = setup({ p1: { hand: ['adjBuffer'], board: ['v11', 'v22', 'v33'] } })
    const { state } = act(s, play('p1-h0', { position: 1 }))
    expect(boardIds(state, 'p1')).toEqual(['v11', 'adjBuffer', 'v22', 'v33'])
    expect(minionOf(state, 'p1-m0')).toMatchObject({ attack: 2, health: 2 })
    expect(minionOf(state, 'p1-h0')).toMatchObject({ attack: 1, health: 1 })
    expect(minionOf(state, 'p1-m1')).toMatchObject({ attack: 3, health: 3 })
    expect(minionOf(state, 'p1-m2')).toMatchObject({ attack: 3, health: 3 })
  })
})

describe('effect trigger', () => {
  it('onPlay 打出時觸發', () => {
    const s = setup({ p1: { hand: ['pinger'] }, p2: { board: ['v11'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(boardIds(state, 'p2')).toEqual([])
  })

  it('onDeath 死亡時在原位置召喚', () => {
    const s = setup({ p1: { hand: ['bolt3'] }, p2: { board: ['v11', 'deathSummon', 'v22'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p2-m1' }))
    expect(boardIds(state, 'p2')).toEqual(['v11', 'token-fish', 'token-fish', 'v22'])
  })

  it('onTurnStart 只在擁有者回合開始觸發', () => {
    const s = setup({ p1: { board: ['startArmor'] } })
    const r1 = act(s, END)
    expect(r1.state.players.p1.hero.armor).toBe(0)
    const r2 = act(r1.state, END)
    expect(r2.state.players.p1.hero.armor).toBe(2)
  })

  it('onTurnEnd 只在擁有者回合結束觸發', () => {
    const s = setup({ p1: { board: ['endHeal'], health: 20 } })
    const r1 = act(s, END)
    expect(r1.state.players.p1.hero.health).toBe(22)
    const r2 = act(r1.state, END)
    expect(r2.state.players.p1.hero.health).toBe(22)
  })

  it('onAttack 攻擊宣告時觸發，傷害前生效', () => {
    const s = setup({ p1: { board: ['attackBuff'] } })
    const { state } = act(s, attack('p1-m0', 'p2-hero'))
    expect(minionOf(state, 'p1-m0').attack).toBe(4)
    expect(state.players.p2.hero.health).toBe(26)
  })

  it('onDamaged 受傷存活時觸發', () => {
    const s = setup({ p1: { hand: ['bolt3'], board: ['damagedDraw'], deck: ['v22'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p1-m0' }))
    expect(minionOf(state, 'p1-m0').health).toBe(1)
    expect(handIds(state, 'p1')).toEqual(['v22'])
  })

  it('onDamaged 受傷死亡時不觸發', () => {
    const s = setup({ p1: { hand: ['bolt3'], board: [{ cardId: 'damagedDraw', health: 3 }], deck: ['v22'] } })
    const { state } = act(s, play('p1-h0', { targetId: 'p1-m0' }))
    expect(boardIds(state, 'p1')).toEqual([])
    expect(handIds(state, 'p1')).toEqual([])
  })
})

describe('死亡結算', () => {
  it('死亡效果連鎖直到穩定', () => {
    const s = setup({
      p1: { hand: ['bolt3'], board: ['deathBoom', 'v33'] },
      p2: { board: ['deathBoom', 'v22', 'v55'] },
    })
    const { state, events } = act(s, play('p1-h0', { targetId: 'p2-m0' }))
    expect(boardIds(state, 'p1')).toEqual(['v33'])
    expect(minionOf(state, 'p1-m1').health).toBe(1)
    expect(boardIds(state, 'p2')).toEqual(['v55'])
    expect(minionOf(state, 'p2-m2').health).toBe(3)
    expect(events.filter((e) => e.type === 'death').map((e) => (e.type === 'death' ? e.instanceId : ''))).toEqual([
      'p2-m0',
      'p1-m0',
      'p2-m1',
    ])
  })

  it('英雄歸零時遊戲結束並判定勝者', () => {
    const s = setup({ p1: { hand: ['fireball6'] }, p2: { health: 6 } })
    const { state, events } = act(s, play('p1-h0'))
    expect(state.winner).toBe('p1')
    expect(events).toContainEqual({ type: 'gameOver', winner: 'p1' })
    expect(() => applyAction(state, END)).toThrow(IllegalActionError)
    expect(getLegalActions(state, 'p1')).toEqual([])
    expect(getLegalActions(state, 'p2')).toEqual([])
  })

  it('疲勞致死也結束遊戲', () => {
    const s = setup({ p2: { deck: [], health: 1 } })
    const { state } = act(s, END)
    expect(state.winner).toBe('p1')
  })

  it('非法動作的錯誤訊息說明原因', () => {
    const s = setup({ p1: { hand: ['v33'], mana: 0 } })
    expect(() => applyAction(s, play('p1-h0'))).toThrow(/潮能/)
  })
})

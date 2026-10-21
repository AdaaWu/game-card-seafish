import { describe, expect, it } from 'vitest'
import { ContentError, parseCardsFile, parseStory } from '@/content/validate'
import { cardDb, decks, getCard, story } from '@/content'

const creature = {
  id: 'leaf-001',
  name: '葉羊小芽',
  faction: 'leaf',
  type: 'creature',
  cost: 1,
  attack: 1,
  health: 2,
  rarity: 'common',
  keywords: [],
  effects: [{ trigger: 'onTurnEnd', action: 'buff', target: 'self', atk: 0, hp: 1 }],
  text: '回合結束時：本身 +0/+1',
  flavor: '每天曬一點太陽',
  species: '葉羊海蛞蝓',
  artHint: 'tiny leaf sheep',
  collectible: true,
  phase: 1,
}

const spell = {
  ...creature,
  id: 'token-pearl',
  name: '珍珠',
  faction: 'neutral',
  type: 'spell',
  cost: 0,
  attack: undefined,
  health: undefined,
  effects: [{ trigger: 'onPlay', action: 'gainMana', target: 'self', amount: 1 }],
  collectible: false,
}

function cardsFile(overrides: Record<string, unknown> = {}) {
  return {
    cards: [creature],
    tokens: [spell],
    decks: { 'starter-leaf': ['leaf-001', 'leaf-001'] },
    ...overrides,
  }
}

const line = { speaker: '小葉', text: '午休到了' }
const battle = {
  id: 'ch1-b1',
  title: '送錯的飯糰',
  enemy: { name: '殼殼', species: '寄居蟹', faction: 'tide', portraitHint: 'hermit crab' },
  difficulty: 1,
  enemyHeroHp: 20,
  pre: [line],
  post: [line],
  defeat: [line],
}
function storyFile(battles: unknown[] = [battle]) {
  return {
    chapters: [{ id: 'ch1', title: '第 1 章', summary: '摘要', battles }],
    characters: [
      { id: 'xiaoye', name: '小葉', species: '葉羊', faction: 'leaf', description: '主角', portraitHint: 'x' },
    ],
  }
}

function errorOf(fn: () => unknown): Error {
  try {
    fn()
  } catch (e) {
    return e as Error
  }
  throw new Error('預期丟出錯誤但沒有')
}

describe('parseCardsFile', () => {
  it('合法資料回傳卡牌、衍生物與牌組', () => {
    const parsed = parseCardsFile(cardsFile())
    expect(parsed.cards.map((c) => c.id)).toEqual(['leaf-001'])
    expect(parsed.tokens.map((c) => c.id)).toEqual(['token-pearl'])
    expect(parsed.decks['starter-leaf']).toEqual(['leaf-001', 'leaf-001'])
  })

  it('根節點不是物件時丟 ContentError', () => {
    const err = errorOf(() => parseCardsFile(null, 'cards.json'))
    expect(err).toBeInstanceOf(ContentError)
    expect(err.message).toContain('cards.json')
  })

  it('缺少名稱時訊息含卡牌 id 與欄位名', () => {
    const err = errorOf(() => parseCardsFile(cardsFile({ cards: [{ ...creature, name: undefined }] })))
    expect(err).toBeInstanceOf(ContentError)
    expect(err.message).toContain('leaf-001')
    expect(err.message).toContain('name')
  })

  it('陣營不合法時訊息含錯誤值', () => {
    const err = errorOf(() => parseCardsFile(cardsFile({ cards: [{ ...creature, faction: 'fire' }] })))
    expect(err.message).toContain('faction')
    expect(err.message).toContain('fire')
  })

  it('生物缺少攻擊力時丟錯', () => {
    const err = errorOf(() => parseCardsFile(cardsFile({ cards: [{ ...creature, attack: undefined }] })))
    expect(err.message).toContain('attack')
  })

  it('法術不需要攻擊與生命', () => {
    const parsed = parseCardsFile(cardsFile({ cards: [{ ...spell, id: 'leaf-099' }], decks: {} }))
    expect(parsed.cards[0]?.type).toBe('spell')
  })

  it('卡牌 id 重複時丟錯', () => {
    const err = errorOf(() => parseCardsFile(cardsFile({ tokens: [{ ...spell, id: 'leaf-001' }] })))
    expect(err.message).toContain('leaf-001')
    expect(err.message).toContain('重複')
  })

  it('牌組引用不存在的卡時訊息含牌組名與卡牌 id', () => {
    const err = errorOf(() => parseCardsFile(cardsFile({ decks: { 'ai-tide': ['tide-404'] } })))
    expect(err.message).toContain('ai-tide')
    expect(err.message).toContain('tide-404')
  })

  it('效果缺少 trigger 時丟錯', () => {
    const err = errorOf(() =>
      parseCardsFile(cardsFile({ cards: [{ ...creature, effects: [{ action: 'buff', target: 'self' }] }] })),
    )
    expect(err.message).toContain('trigger')
  })
})

describe('parseStory', () => {
  it('合法資料回傳章節與角色', () => {
    const parsed = parseStory(storyFile())
    expect(parsed.chapters[0]?.battles[0]?.enemy.name).toBe('殼殼')
    expect(parsed.characters[0]?.id).toBe('xiaoye')
  })

  it('戰鬥缺少 enemy 時訊息含戰鬥 id', () => {
    const err = errorOf(() => parseStory(storyFile([{ ...battle, enemy: undefined }])))
    expect(err).toBeInstanceOf(ContentError)
    expect(err.message).toContain('ch1-b1')
    expect(err.message).toContain('enemy')
  })

  it('對話缺少 speaker 時丟錯', () => {
    const err = errorOf(() => parseStory(storyFile([{ ...battle, pre: [{ text: '嗨' }] }])))
    expect(err.message).toContain('speaker')
  })

  it('戰鬥 id 重複時丟錯', () => {
    const err = errorOf(() => parseStory(storyFile([battle, battle])))
    expect(err.message).toContain('重複')
  })
})

describe('content 模組', () => {
  it('cardDb 含收藏卡與衍生物', () => {
    expect(cardDb['token-pearl']?.type).toBe('spell')
    expect(getCard('leaf-001').name).toBeTruthy()
  })

  it('查不到卡牌時丟出含 id 的錯誤', () => {
    expect(() => getCard('nope-000')).toThrow('nope-000')
  })

  it('起始牌組為 30 張', () => {
    expect(decks['starter-leaf']).toHaveLength(30)
  })

  it('劇情為 3 章 9 場', () => {
    expect(story.chapters).toHaveLength(3)
    expect(story.chapters.flatMap((c) => c.battles)).toHaveLength(9)
  })
})

// 內容 JSON 的執行期驗證
import type { Card, CardsFile, DialogueLine, Effect, Faction, Story, StoryBattle, StoryChapter, StoryCharacter } from './types'

export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentError'
  }
}

const FACTIONS: readonly Faction[] = ['leaf', 'tide', 'frost', 'light', 'neutral']
const CARD_TYPES = ['creature', 'spell'] as const
const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const

type Obj = Record<string, unknown>

function fail(where: string, msg: string): never {
  throw new ContentError(`[content] ${where}：${msg}`)
}

function obj(v: unknown, where: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(where, '必須是物件')
  return v as Obj
}

function arr(o: Obj, key: string, where: string): unknown[] {
  const v = o[key]
  if (!Array.isArray(v)) fail(where, `欄位 ${key} 必須是陣列`)
  return v
}

function str(o: Obj, key: string, where: string): string {
  const v = o[key]
  if (typeof v !== 'string' || v === '') fail(where, `欄位 ${key} 必須是非空字串`)
  return v
}

function num(o: Obj, key: string, where: string): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(where, `欄位 ${key} 必須是數字（目前為 ${String(v)}）`)
  return v
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[], where: string): T {
  const v = o[key]
  if (!allowed.includes(v as T)) fail(where, `欄位 ${key} 的值 ${String(v)} 不合法，可用值：${allowed.join('/')}`)
  return v as T
}

function parseEffect(raw: unknown, where: string): Effect {
  const o = obj(raw, where)
  str(o, 'trigger', where)
  str(o, 'action', where)
  str(o, 'target', where)
  return o as unknown as Effect
}

function parseCard(raw: unknown, where: string): Card {
  const o = obj(raw, where)
  const id = str(o, 'id', where)
  const at = `${where}（${id}）`
  str(o, 'name', at)
  oneOf(o, 'faction', FACTIONS, at)
  const type = oneOf(o, 'type', CARD_TYPES, at)
  num(o, 'cost', at)
  oneOf(o, 'rarity', RARITIES, at)
  if (type === 'creature') {
    num(o, 'attack', at)
    num(o, 'health', at)
  }
  const keywords = arr(o, 'keywords', at)
  if (!keywords.every((k) => typeof k === 'string')) fail(at, '欄位 keywords 只能放字串')
  arr(o, 'effects', at).forEach((e, i) => parseEffect(e, `${at} effects[${i}]`))
  if (typeof o.text !== 'string') fail(at, '欄位 text 必須是字串')
  return o as unknown as Card
}

export function parseCardsFile(raw: unknown, source = 'cards'): CardsFile {
  const root = obj(raw, source)
  const cards = arr(root, 'cards', source).map((c, i) => parseCard(c, `${source} cards[${i}]`))
  const tokens = arr(root, 'tokens', source).map((c, i) => parseCard(c, `${source} tokens[${i}]`))
  const ids = new Set<string>()
  for (const c of [...cards, ...tokens]) {
    if (ids.has(c.id)) fail(source, `卡牌 id ${c.id} 重複`)
    ids.add(c.id)
  }
  const rawDecks = obj(root.decks ?? {}, `${source} decks`)
  const decks: Record<string, string[]> = {}
  for (const [name, list] of Object.entries(rawDecks)) {
    if (!Array.isArray(list)) fail(`${source} decks.${name}`, '必須是卡牌 id 陣列')
    for (const id of list) {
      if (typeof id !== 'string' || !ids.has(id)) fail(`${source} decks.${name}`, `引用不存在的卡牌 ${String(id)}`)
    }
    decks[name] = [...(list as string[])]
  }
  return { cards, tokens, decks }
}

function parseLines(o: Obj, key: string, where: string): DialogueLine[] {
  return arr(o, key, where).map((l, i) => {
    const at = `${where} ${key}[${i}]`
    const line = obj(l, at)
    return { speaker: str(line, 'speaker', at), text: str(line, 'text', at) }
  })
}

function parseBattle(raw: unknown, where: string): StoryBattle {
  const o = obj(raw, where)
  const id = str(o, 'id', where)
  const at = `${where}（${id}）`
  if (o.enemy === undefined) fail(at, '缺少欄位 enemy')
  const e = obj(o.enemy, `${at} enemy`)
  return {
    id,
    title: str(o, 'title', at),
    enemy: {
      name: str(e, 'name', `${at} enemy`),
      species: str(e, 'species', `${at} enemy`),
      faction: oneOf(e, 'faction', FACTIONS, `${at} enemy`),
      portraitHint: typeof e.portraitHint === 'string' ? e.portraitHint : '',
    },
    difficulty: num(o, 'difficulty', at),
    enemyHeroHp: num(o, 'enemyHeroHp', at),
    pre: parseLines(o, 'pre', at),
    post: parseLines(o, 'post', at),
    defeat: parseLines(o, 'defeat', at),
  }
}

function parseChapter(raw: unknown, where: string): StoryChapter {
  const o = obj(raw, where)
  const id = str(o, 'id', where)
  const at = `${where}（${id}）`
  return {
    id,
    title: str(o, 'title', at),
    summary: typeof o.summary === 'string' ? o.summary : '',
    battles: arr(o, 'battles', at).map((b, i) => parseBattle(b, `${at} battles[${i}]`)),
  }
}

function parseCharacter(raw: unknown, where: string): StoryCharacter {
  const o = obj(raw, where)
  const id = str(o, 'id', where)
  const at = `${where}（${id}）`
  return {
    id,
    name: str(o, 'name', at),
    species: str(o, 'species', at),
    faction: oneOf(o, 'faction', FACTIONS, at),
    description: typeof o.description === 'string' ? o.description : '',
    portraitHint: typeof o.portraitHint === 'string' ? o.portraitHint : '',
  }
}

export function parseStory(raw: unknown, source = 'story'): Story {
  const root = obj(raw, source)
  const chapters = arr(root, 'chapters', source).map((c, i) => parseChapter(c, `${source} chapters[${i}]`))
  const characters = arr(root, 'characters', source).map((c, i) => parseCharacter(c, `${source} characters[${i}]`))
  const ids = new Set<string>()
  for (const b of chapters.flatMap((c) => c.battles)) {
    if (ids.has(b.id)) fail(source, `戰鬥 id ${b.id} 重複`)
    ids.add(b.id)
  }
  return { chapters, characters }
}

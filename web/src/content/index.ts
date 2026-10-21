// 讀取並驗型根目錄 content/ 的 JSON
import rawCards from '@content/cards.phase1.json'
import rawStory from '@content/story.json'
import type { Card, StoryCharacter } from './types'
import { parseCardsFile, parseStory } from './validate'

export * from './types'
export { ContentError, parseCardsFile, parseStory } from './validate'

const cardsFile = parseCardsFile(rawCards, 'content/cards.phase1.json')

// 所有卡牌定義（含衍生物），key 為卡牌 id
export const cardDb: Record<string, Card> = Object.fromEntries(
  [...cardsFile.cards, ...cardsFile.tokens].map((c) => [c.id, c]),
)
export const collectibleCards: Card[] = cardsFile.cards.filter((c) => c.collectible)
export const tokens: Card[] = cardsFile.tokens
export const decks: Record<string, string[]> = cardsFile.decks
export const story = parseStory(rawStory, 'content/story.json')

export function getCard(id: string): Card {
  const card = cardDb[id]
  if (!card) throw new Error(`[content] 找不到卡牌 ${id}`)
  return card
}

export function characterByName(name: string): StoryCharacter | undefined {
  return story.characters.find((c) => c.name === name)
}

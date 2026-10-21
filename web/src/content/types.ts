// 劇情資料型別；卡牌型別沿用 engine
import type { Card, Faction } from '@/engine/types'

export type { Card, CardType, Effect, Faction, Rarity } from '@/engine/types'

export interface CardsFile {
  cards: Card[]
  tokens: Card[]
  decks: Record<string, string[]>
}

export interface DialogueLine {
  speaker: string
  text: string
}

export interface StoryEnemy {
  name: string
  species: string
  faction: Faction
  portraitHint: string
}

export interface StoryBattle {
  id: string
  title: string
  enemy: StoryEnemy
  difficulty: number
  enemyHeroHp: number
  pre: DialogueLine[]
  post: DialogueLine[]
  defeat: DialogueLine[]
}

export interface StoryChapter {
  id: string
  title: string
  summary: string
  battles: StoryBattle[]
}

export interface StoryCharacter {
  id: string
  name: string
  species: string
  faction: Faction
  description: string
  portraitHint: string
}

export interface Story {
  chapters: StoryChapter[]
  characters: StoryCharacter[]
}

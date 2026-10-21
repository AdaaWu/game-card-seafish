// 自由對戰與測試頁可選的 AI 對手
import { characterByName } from '@/content'

export interface FreeOpponent {
  deckId: string
  name: string
  label: string
  portraitId: string
}

export const FREE_OPPONENTS: FreeOpponent[] = [
  { deckId: 'ai-tide', name: '波波', label: '潮・波波', portraitId: 'bobo' },
  { deckId: 'ai-frost', name: '凍凍婆婆', label: '霜・凍凍婆婆', portraitId: 'dongdong' },
  { deckId: 'ai-light', name: '閃閃', label: '光・閃閃', portraitId: 'jiujiu' },
  { deckId: 'ai-boss', name: '鮟部長', label: '首領・鮟部長', portraitId: 'anbuzhang' },
]

export const FREE_HERO_HP = 30

export const PLAYER_PORTRAIT_ID = 'xiaoye'

// 劇情戰敵方頭像 id
export function storyPortraitId(enemyName: string): string | undefined {
  return characterByName(enemyName)?.id
}

// 自由對戰與測試頁可選的 AI 對手
export interface FreeOpponent {
  deckId: string
  name: string
  label: string
}

export const FREE_OPPONENTS: FreeOpponent[] = [
  { deckId: 'ai-tide', name: '波波', label: '潮・波波' },
  { deckId: 'ai-frost', name: '凍凍婆婆', label: '霜・凍凍婆婆' },
  { deckId: 'ai-light', name: '閃閃', label: '光・閃閃' },
  { deckId: 'ai-boss', name: '鮟部長', label: '首領・鮟部長' },
]

export const FREE_HERO_HP = 30

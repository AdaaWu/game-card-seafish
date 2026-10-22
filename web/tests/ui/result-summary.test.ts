import { describe, expect, it } from 'vitest'
import { resultActions, resultStats, resultTitle, rewardCardIds } from '@/components/battle/resultSummary'
import { resultFigureUrl } from '@/content/cardStyle'
import { assetUrls } from '@/content/assetUrls'
import { decks } from '@/content'

describe('結算畫面內容', () => {
  it('勝利列出回合數、總傷害與敵方牌組前 3 張不重複卡', () => {
    expect(resultTitle('win')).toBe('勝利！')
    expect(resultStats(7, 42)).toEqual([
      { testId: 'result-rounds', label: '回合數', value: 7 },
      { testId: 'result-damage', label: '總傷害', value: 42 },
    ])
    expect(rewardCardIds('win', ['a', 'a', 'b', 'a', 'c', 'd'])).toEqual(['a', 'b', 'c'])
    expect(rewardCardIds('win', decks['ai-tide']!)).toHaveLength(3)
    expect(resultActions('win', '回地圖')).toEqual([{ label: '繼續', variant: 'primary', emit: 'continue' }])
  })

  it('失敗不給獎勵，按鈕為重新挑戰加離開文字', () => {
    expect(resultTitle('lose')).toBe('再試一次')
    expect(rewardCardIds('lose', ['a', 'b', 'c'])).toEqual([])
    expect(resultActions('lose', '回選單')).toEqual([
      { label: '重新挑戰', variant: 'primary', emit: 'retry', testId: 'retry' },
      { label: '回選單', variant: 'secondary', emit: 'continue', testId: 'back-map' },
    ])
  })

  it('平手標題為平手且不給獎勵', () => {
    expect(resultTitle('draw')).toBe('平手')
    expect(rewardCardIds('draw', ['a', 'b', 'c'])).toEqual([])
  })

  it('總傷害為 0 也顯示 0', () => {
    expect(resultStats(1, 0).find((s) => s.testId === 'result-damage')?.value).toBe(0)
  })

  it('立繪：勝利用開心貼圖、失敗用沮喪貼圖，且檔案存在', () => {
    expect(resultFigureUrl('win')).toBe(assetUrls['stickers/role1-10.webp'])
    expect(resultFigureUrl('lose')).toBe(assetUrls['stickers/role1-07.webp'])
    expect(resultFigureUrl('win')).toBeTruthy()
    expect(resultFigureUrl('lose')).toBeTruthy()
  })
})

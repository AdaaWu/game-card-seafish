// 結算畫面的標題、數據列、按鈕與獎勵卡
export type ResultOutcome = 'win' | 'lose' | 'draw'

export interface ResultStat {
  testId: 'result-rounds' | 'result-damage'
  label: string
  value: number
}

export interface ResultAction {
  label: string
  variant: 'primary' | 'secondary'
  emit: 'continue' | 'retry'
  testId?: string
}

const TITLE: Record<ResultOutcome, string> = { win: '勝利！', lose: '再試一次', draw: '平手' }
const REWARD_COUNT = 3

export function resultTitle(result: ResultOutcome): string {
  return TITLE[result]
}

export function resultStats(rounds: number, damage: number): ResultStat[] {
  return [
    { testId: 'result-rounds', label: '回合數', value: rounds },
    { testId: 'result-damage', label: '總傷害', value: damage },
  ]
}

export function resultActions(result: ResultOutcome, exitLabel: string): ResultAction[] {
  if (result !== 'lose') return [{ label: '繼續', variant: 'primary', emit: 'continue' }]
  return [
    { label: '重新挑戰', variant: 'primary', emit: 'retry', testId: 'retry' },
    { label: exitLabel, variant: 'secondary', emit: 'continue', testId: 'back-map' },
  ]
}

// 獎勵只展示不入存檔：勝利時取敵方牌組前幾張不重複卡
export function rewardCardIds(result: ResultOutcome, enemyDeck: readonly string[]): string[] {
  if (result !== 'win') return []
  return [...new Set(enemyDeck)].slice(0, REWARD_COUNT)
}

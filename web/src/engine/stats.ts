// 對戰統計：由事件累加，純函式不改動輸入
import type { GameEvent, PlayerId } from './types'

export interface BattleStats {
  // 我方對敵方英雄與生物造成的傷害
  damageDealt: number
  // 生物 instanceId 對應擁有者
  owners: Record<string, PlayerId>
  // 下一筆傷害來自疲勞
  fatigueNext: boolean
}

export function initialStats(): BattleStats {
  return { damageDealt: 0, owners: {}, fatigueNext: false }
}

// 英雄 id 固定為 p1-hero／p2-hero，生物看出場紀錄
function ownerOf(stats: BattleStats, targetId: string): PlayerId | undefined {
  if (targetId === 'p1-hero') return 'p1'
  if (targetId === 'p2-hero') return 'p2'
  return stats.owners[targetId]
}

export function tallyEvent(stats: BattleStats, event: GameEvent): BattleStats {
  switch (event.type) {
    case 'cardPlayed':
      if (event.position === undefined) return stats
      return { ...stats, owners: { ...stats.owners, [event.instanceId]: event.playerId } }
    case 'summon':
      return { ...stats, owners: { ...stats.owners, [event.instanceId]: event.playerId } }
    case 'fatigue':
      return { ...stats, fatigueNext: true }
    case 'damage': {
      if (stats.fatigueNext) return { ...stats, fatigueNext: false }
      if (ownerOf(stats, event.targetId) !== 'p2') return stats
      return { ...stats, damageDealt: stats.damageDealt + event.amount + event.armorAbsorbed }
    }
    default:
      return stats
  }
}

// 劇情地圖節點、路徑與章節標題的外觀對應
import type { TitleFaction, TitlePrefix } from '@/components/ui/pageTitle'
import { characterByName } from '@/content'
import type { Faction } from '@/content/types'

export type NodeStatus = 'locked' | 'available' | 'cleared'

export interface NodeVisual {
  ringPath: string
  showLock: boolean
  checkBadge: boolean
  dimFace: boolean
  statusText: string
}

const STATUS_TEXT: Record<NodeStatus, string> = { locked: '未解鎖', available: '可挑戰', cleared: '已通關' }

// 切片路徑相對 assets/ui，不含 @2x 與副檔名
export function nodeVisual(status: NodeStatus, boss: boolean): NodeVisual {
  return {
    ringPath: boss ? 'map/node-boss' : `map/node-${status}`,
    showLock: status === 'locked',
    // 一般通關切片已含勾章，Boss 切片沒有
    checkBadge: boss && status === 'cleared',
    dimFace: status === 'locked',
    statusText: boss ? `Boss・${STATUS_TEXT[status]}` : STATUS_TEXT[status],
  }
}

// 每章最後一場是 Boss
export function isBossBattle(index: number, count: number): boolean {
  return count > 1 && index === count - 1
}

export function pathSlice(next: NodeStatus): string {
  return next === 'locked' ? 'map/path-locked' : 'map/path-open'
}

export function nodePortraitId(enemyName: string): string | undefined {
  return characterByName(enemyName)?.id
}

const CHAPTER_PREFIX: Record<Faction, TitlePrefix> = {
  leaf: 'leaf',
  tide: 'shell',
  frost: 'star',
  light: 'star',
  neutral: 'shell',
}

export function chapterTitleStyle(faction: Faction): { prefix: TitlePrefix; faction: TitleFaction } {
  return { prefix: CHAPTER_PREFIX[faction], faction }
}

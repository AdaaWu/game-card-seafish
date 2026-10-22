// 出牌預留卡位：插入位置換算成卡位與既有生物的格位（x 以場地中心為 0）
import type { BoardGeometry } from './battleLayout'

export interface SlotPos {
  x: number
  row: number
}

export interface InsertPreview {
  slot: SlotPos
  minions: SlotPos[]
}

type SlotGeo = Pick<BoardGeometry, 'spacing' | 'cols'>

// 第 index 格的位置：每排 cols 格、各排置中，row 0 為靠中線的前排
export function slotPos(index: number, count: number, geo: SlotGeo): SlotPos {
  const row = Math.floor(index / geo.cols)
  const inRow = Math.min(geo.cols, count - row * geo.cols)
  const col = index - row * geo.cols
  return { x: (col - (inRow - 1) / 2) * geo.spacing, row }
}

export function insertPreview(count: number, index: number, geo: SlotGeo, maxBoard: number): InsertPreview | null {
  if (count >= maxBoard) return null
  const at = Math.min(Math.max(index, 0), count)
  const n = count + 1
  return { slot: slotPos(at, n, geo), minions: Array.from({ length: count }, (_, i) => slotPos(i < at ? i : i + 1, n, geo)) }
}

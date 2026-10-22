// 收藏頁卡片欄數，數值來源 docs/art/audit-20261023-ui.md 第 5 節
const COMPACT_MAX_H = 500
const COMPACT_COLUMNS = 5
const CONTAINER_MAX = 1320
const PAGE_PADDING_X = 48
const GAP_X = 18
const COL_MIN = 160
const COL_MAX = 220
const COL_VW = 0.13

export function collectionColumns(viewW: number, viewH: number): number {
  if (viewH <= COMPACT_MAX_H) return COMPACT_COLUMNS
  const container = Math.min(CONTAINER_MAX, viewW - PAGE_PADDING_X)
  const col = Math.min(COL_MAX, Math.max(COL_MIN, viewW * COL_VW))
  return Math.max(1, Math.floor((container + GAP_X) / (col + GAP_X)))
}

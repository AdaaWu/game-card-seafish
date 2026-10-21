// 出牌預留卡位：插入位置換算成卡位與既有生物的 x（以場地中心為 0）
export interface InsertPreview {
  slotX: number
  minionX: number[]
}

export function insertPreview(count: number, index: number, spacing: number, maxBoard: number): InsertPreview | null {
  if (count >= maxBoard) return null
  const at = Math.min(Math.max(index, 0), count)
  const n = count + 1
  const x = (slot: number) => (slot - (n - 1) / 2) * spacing
  return { slotX: x(at), minionX: Array.from({ length: count }, (_, i) => x(i < at ? i : i + 1)) }
}

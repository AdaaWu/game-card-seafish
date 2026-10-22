// 教學說明框與提示字的擺放：避開高亮目標與重要按鈕（座標為對戰邏輯 px）
import type { Rect } from '@/render/battle/battleLayout'

export interface CalloutInput {
  holes: Rect[]
  avoid: Rect[]
  w: number
  h: number
  lw: number
  lh: number
}

export interface HintInput {
  w: number
  h: number
  preferY: number
  avoid: Rect[]
  lw: number
  lh: number
}

const EDGE = 40
const MARGIN = 20
// 與高亮目標的間距
const GAP = 28
// 與其他介面的間距
const AVOID_PAD = 12
const STEP = 20
const HINT_STEP = 10

const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 })

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h))
  return Math.hypot(dx, dy)
}

function steps(lo: number, hi: number, step: number): number[] {
  if (hi <= lo) return [lo]
  const out: number[] = []
  for (let v = lo; v < hi; v += step) out.push(v)
  out.push(hi)
  return out
}

// 掃過整個舞台：蓋到目標最重罰、蓋到其他介面次之，其餘挑最靠近目標的位置
// 沒有目標時預設水平置中、上方 16%，蓋到其他介面才另找最近的位置
export function placeCallout(o: CalloutInput): Rect {
  const w = Math.min(o.w, o.lw - EDGE * 2)
  const h = o.h
  const holes = o.holes.map((r) => grow(r, GAP))
  const avoid = o.avoid.map((r) => grow(r, AVOID_PAD))
  const home: Rect = { x: (o.lw - w) / 2, y: o.lh * 0.16, w, h }
  const anchors = o.holes.length > 0 ? o.holes : [home]
  if (o.holes.length === 0 && avoid.every((a) => overlapArea(home, a) === 0)) return home
  let best: Rect = { x: MARGIN, y: MARGIN, w, h }
  let bestCost = Infinity
  for (const y of steps(MARGIN, o.lh - h - MARGIN, STEP)) {
    for (const x of steps(MARGIN, o.lw - w - MARGIN, STEP)) {
      const r = { x, y, w, h }
      let cost = 0
      for (const hole of holes) cost += overlapArea(r, hole) * 100
      for (const a of avoid) cost += overlapArea(r, a) * 10
      cost += Math.min(...anchors.map((a) => gapBetween(r, a)))
      if (cost < bestCost) {
        bestCost = cost
        best = r
      }
    }
  }
  return best
}

// 水平置中，從預設高度往上下找最近的空位；都會重疊時挑重疊最少的
export function placeHint(o: HintInput): Rect {
  const x = (o.lw - o.w) / 2
  const avoid = o.avoid.map((r) => grow(r, 16))
  const maxY = o.lh - o.h - MARGIN
  const at = (y: number): Rect => ({ x, y, w: o.w, h: o.h })
  const overlapOf = (r: Rect) => avoid.reduce((sum, a) => sum + overlapArea(r, a), 0)
  let best = at(Math.min(Math.max(o.preferY, MARGIN), maxY))
  let bestOverlap = overlapOf(best)
  if (bestOverlap === 0) return best
  for (let d = HINT_STEP; d <= o.lh; d += HINT_STEP) {
    for (const y of [o.preferY - d, o.preferY + d]) {
      if (y < MARGIN || y > maxY) continue
      const r = at(y)
      const ov = overlapOf(r)
      if (ov === 0) return r
      if (ov < bestOverlap) {
        bestOverlap = ov
        best = r
      }
    }
  }
  return best
}

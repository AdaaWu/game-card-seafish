import { describe, expect, it } from 'vitest'
import type { Rect } from '@/render/battle/battleLayout'
import { placeCallout, placeHint } from '@/tutorial/calloutPlacement'

const LW = 1920
const LH = 1080
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= LW && r.y + r.h <= LH
// 兩矩形之間的最短距離，重疊為 0
const gapOf = (a: Rect, b: Rect) => {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h))
  return Math.hypot(dx, dy)
}

describe('教學說明框避讓', () => {
  it('第 7 步：目標橫跨敵方生物到手牌時，不蓋住右側的結束回合鈕', () => {
    const holes: Rect[] = [
      { x: 880, y: 330, w: 160, h: 200 },
      { x: 660, y: 860, w: 180, h: 220 },
    ]
    const endTurn = { x: 1700, y: 480, w: 180, h: 72 }
    const r = placeCallout({ holes, avoid: [endTurn], w: 760, h: 240, lw: LW, lh: LH })
    expect(inside(r)).toBe(true)
    expect(overlap(r, endTurn)).toBe(false)
    for (const h of holes) expect(overlap(r, h)).toBe(false)
  })

  it('第 1 步：高亮左下我方英雄時，不蓋住英雄上方的潮能條', () => {
    const hero = { x: 22, y: 860, w: 200, h: 220 }
    const mana = { x: 32, y: 760, w: 420, h: 80 }
    const r = placeCallout({ holes: [hero], avoid: [mana], w: 760, h: 260, lw: LW, lh: LH })
    expect(inside(r)).toBe(true)
    expect(overlap(r, mana)).toBe(false)
    expect(overlap(r, hero)).toBe(false)
  })

  it('空間足夠時貼著目標放，不跑到畫面另一端', () => {
    const hole = { x: 860, y: 440, w: 200, h: 200 }
    const r = placeCallout({ holes: [hole], avoid: [], w: 760, h: 240, lw: LW, lh: LH })
    expect(overlap(r, hole)).toBe(false)
    expect(gapOf(r, hole)).toBeLessThanOrEqual(60)
  })

  it('沒有目標時水平置中、放在上方 16%', () => {
    const r = placeCallout({ holes: [], avoid: [], w: 760, h: 240, lw: LW, lh: LH })
    expect(r.x).toBeCloseTo((LW - 760) / 2)
    expect(r.y).toBeCloseTo(LH * 0.16)
  })

  it('寬度超過舞台時縮到舞台寬扣兩側邊距', () => {
    const r = placeCallout({ holes: [], avoid: [], w: 760, h: 240, lw: 600, lh: LH })
    expect(r.w).toBe(520)
    expect(r.x).toBeCloseTo(40)
  })

  it('找不到完全不重疊的位置時，選重疊面積最小的，仍在舞台內', () => {
    const wall = { x: 0, y: 0, w: LW, h: LH - 100 }
    const r = placeCallout({ holes: [], avoid: [wall], w: 760, h: 240, lw: LW, lh: LH })
    expect(inside(r)).toBe(true)
    expect(r.y + r.h).toBeGreaterThanOrEqual(LH - 40)
  })
})

describe('「做得好！」提示避讓', () => {
  const size = { w: 300, h: 80 }

  it('沒有遮擋時放在預設高度、水平置中', () => {
    const r = placeHint({ ...size, preferY: 300, avoid: [], lw: LW, lh: LH })
    expect(r).toEqual({ x: (LW - 300) / 2, y: 300, w: 300, h: 80 })
  })

  it('預設位置疊到高亮目標時移到最近的空位', () => {
    const target = { x: 860, y: 280, w: 200, h: 200 }
    const r = placeHint({ ...size, preferY: 300, avoid: [target], lw: LW, lh: LH })
    expect(overlap(r, target)).toBe(false)
    expect(inside(r)).toBe(true)
    expect(Math.abs(r.y - 300)).toBeLessThanOrEqual(220)
  })

  it('同時避開說明框與目標', () => {
    const target = { x: 860, y: 280, w: 200, h: 200 }
    const callout = { x: 580, y: 500, w: 760, h: 240 }
    const r = placeHint({ ...size, preferY: 300, avoid: [target, callout], lw: LW, lh: LH })
    expect(overlap(r, target)).toBe(false)
    expect(overlap(r, callout)).toBe(false)
  })
})

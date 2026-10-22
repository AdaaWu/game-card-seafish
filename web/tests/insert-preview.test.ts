import { describe, expect, it } from 'vitest'
import { insertPreview, slotPos } from '@/render/battle/insertPreview'

const S = 168
const MAX = 6
// 橫向一排 6 格、直式每方 2 排 × 3 格
const ROW = { spacing: S, cols: 6 }
const GRID = { spacing: S, cols: 3 }
const at = (x: number, row = 0) => ({ x, row })

describe('出牌預留卡位位置', () => {
  it('場上沒有生物時卡位在正中間', () => {
    expect(insertPreview(0, 0, ROW, MAX)).toEqual({ slot: at(0), minions: [] })
  })

  it('一隻生物、插在左邊時生物往右讓出半格', () => {
    expect(insertPreview(1, 0, ROW, MAX)).toEqual({ slot: at(-84), minions: [at(84)] })
  })

  it('一隻生物、插在右邊時生物往左讓出半格', () => {
    expect(insertPreview(1, 1, ROW, MAX)).toEqual({ slot: at(84), minions: [at(-84)] })
  })

  it('兩隻生物插中間時左右各讓出半格', () => {
    expect(insertPreview(2, 1, ROW, MAX)).toEqual({ slot: at(0), minions: [at(-168), at(168)] })
  })

  it('三隻生物插最左邊時全部往右移', () => {
    expect(insertPreview(3, 0, ROW, MAX)).toEqual({ slot: at(-252), minions: [at(-84), at(84), at(252)] })
  })

  it('五隻生物插最右邊時排成 6 格且卡位在最右', () => {
    const p = insertPreview(5, 5, ROW, MAX)!
    expect(p.slot).toEqual(at(420))
    expect(p.minions).toEqual([at(-420), at(-252), at(-84), at(84), at(252)])
  })

  it('插入位置超出範圍時夾到兩端', () => {
    expect(insertPreview(2, 9, ROW, MAX)!.slot).toEqual(at(168))
    expect(insertPreview(2, -3, ROW, MAX)!.slot).toEqual(at(-168))
  })

  it('場地已滿 6 隻時不顯示卡位', () => {
    expect(insertPreview(6, 2, ROW, MAX)).toBeNull()
  })
})

describe('網格格位：每排 3 格，0 到 2 為前排、3 到 5 為後排', () => {
  it('一排 6 格時格位與舊版置中排法相同', () => {
    for (let n = 1; n <= 6; n++) {
      for (let i = 0; i < n; i++) expect(slotPos(i, n, ROW)).toEqual(at((i - (n - 1) / 2) * S))
    }
  })

  it('6 隻時前後兩排各 3 格且各自置中', () => {
    expect(Array.from({ length: 6 }, (_, i) => slotPos(i, 6, GRID))).toEqual([
      at(-S),
      at(0),
      at(S),
      at(-S, 1),
      at(0, 1),
      at(S, 1),
    ])
  })

  it('3 隻時插入第 4 格，卡位在後排置中', () => {
    expect(insertPreview(3, 3, GRID, MAX)).toEqual({ slot: at(0, 1), minions: [at(-S), at(0), at(S)] })
  })

  it('5 隻插在 index 2 時，原本第 3 隻之後跨排往後順移', () => {
    expect(insertPreview(5, 2, GRID, MAX)).toEqual({
      slot: at(S),
      minions: [at(-S), at(0), at(-S, 1), at(0, 1), at(S, 1)],
    })
  })

  it('網格已滿 6 隻時不顯示卡位', () => {
    expect(insertPreview(6, 0, GRID, MAX)).toBeNull()
  })
})

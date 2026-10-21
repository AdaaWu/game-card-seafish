import { describe, expect, it } from 'vitest'
import { insertPreview } from '@/render/battle/insertPreview'

const S = 168
const MAX = 6

describe('出牌預留卡位位置', () => {
  it('場上沒有生物時卡位在正中間', () => {
    expect(insertPreview(0, 0, S, MAX)).toEqual({ slotX: 0, minionX: [] })
  })

  it('一隻生物、插在左邊時生物往右讓出半格', () => {
    expect(insertPreview(1, 0, S, MAX)).toEqual({ slotX: -84, minionX: [84] })
  })

  it('一隻生物、插在右邊時生物往左讓出半格', () => {
    expect(insertPreview(1, 1, S, MAX)).toEqual({ slotX: 84, minionX: [-84] })
  })

  it('兩隻生物插中間時左右各讓出半格', () => {
    expect(insertPreview(2, 1, S, MAX)).toEqual({ slotX: 0, minionX: [-168, 168] })
  })

  it('三隻生物插最左邊時全部往右移', () => {
    expect(insertPreview(3, 0, S, MAX)).toEqual({ slotX: -252, minionX: [-84, 84, 252] })
  })

  it('五隻生物插最右邊時排成 6 格且卡位在最右', () => {
    const p = insertPreview(5, 5, S, MAX)!
    expect(p.slotX).toBe(420)
    expect(p.minionX).toEqual([-420, -252, -84, 84, 252])
  })

  it('插入位置超出範圍時夾到兩端', () => {
    expect(insertPreview(2, 9, S, MAX)!.slotX).toBe(168)
    expect(insertPreview(2, -3, S, MAX)!.slotX).toBe(-168)
  })

  it('場地已滿 6 隻時不顯示卡位', () => {
    expect(insertPreview(6, 2, S, MAX)).toBeNull()
  })
})

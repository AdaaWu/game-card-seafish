import { describe, expect, it } from 'vitest'
import { bubbleCount, bubbleSpecs } from '@/components/ui/bubbles'

describe('泡泡數量', () => {
  it('桌機 12 顆', () => {
    expect(bubbleCount({ width: 1440, height: 900, reducedMotion: false })).toBe(12)
  })

  it('手機橫式與直式減為 6 顆', () => {
    expect(bubbleCount({ width: 844, height: 390, reducedMotion: false })).toBe(6)
    expect(bubbleCount({ width: 390, height: 844, reducedMotion: false })).toBe(6)
  })

  it('減少動態時不出泡泡', () => {
    expect(bubbleCount({ width: 1440, height: 900, reducedMotion: true })).toBe(0)
  })
})

describe('泡泡參數', () => {
  it('數量與要求一致且參數固定', () => {
    const specs = bubbleSpecs(3)
    expect(specs).toHaveLength(3)
    expect(specs[0]).toEqual({ left: 37, size: 15, duration: 10.3, delay: -2 })
    expect(bubbleSpecs(3)).toEqual(specs)
  })

  it('位置落在畫面寬度內', () => {
    for (const b of bubbleSpecs(12)) {
      expect(b.left).toBeGreaterThanOrEqual(0)
      expect(b.left).toBeLessThan(100)
    }
  })
})

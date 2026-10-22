import { describe, expect, it } from 'vitest'
import { ratioOf, snapValue, stepByKey, valueFromRatio } from '@/components/ui/slider'

const VOL = { min: 0, max: 100, step: 5 }

describe('滑桿數值對齊', () => {
  it('對齊到最近的步進', () => {
    expect(snapValue(52, VOL)).toBe(50)
    expect(snapValue(53, VOL)).toBe(55)
  })

  it('超出範圍時夾在上下限', () => {
    expect(snapValue(-10, VOL)).toBe(0)
    expect(snapValue(130, VOL)).toBe(100)
  })

  it('最小值不是 0 時以最小值為步進起點', () => {
    expect(snapValue(4, { min: 1, max: 10, step: 3 })).toBe(4)
    expect(snapValue(5, { min: 1, max: 10, step: 3 })).toBe(4)
  })
})

describe('滑桿鍵盤操作', () => {
  it('右鍵與上鍵加一個步進', () => {
    expect(stepByKey(50, 'ArrowRight', VOL)).toBe(55)
    expect(stepByKey(50, 'ArrowUp', VOL)).toBe(55)
  })

  it('左鍵與下鍵減一個步進', () => {
    expect(stepByKey(50, 'ArrowLeft', VOL)).toBe(45)
    expect(stepByKey(50, 'ArrowDown', VOL)).toBe(45)
  })

  it('PageUp 與 PageDown 一次移動十個步進', () => {
    expect(stepByKey(20, 'PageUp', VOL)).toBe(70)
    expect(stepByKey(80, 'PageDown', VOL)).toBe(30)
  })

  it('Home 與 End 跳到上下限', () => {
    expect(stepByKey(35, 'Home', VOL)).toBe(0)
    expect(stepByKey(35, 'End', VOL)).toBe(100)
  })

  it('到邊界後不再超出', () => {
    expect(stepByKey(100, 'ArrowRight', VOL)).toBe(100)
    expect(stepByKey(0, 'ArrowLeft', VOL)).toBe(0)
    expect(stepByKey(95, 'PageUp', VOL)).toBe(100)
  })

  it('其他按鍵回傳 null，不攔截', () => {
    expect(stepByKey(50, 'Tab', VOL)).toBeNull()
    expect(stepByKey(50, 'a', VOL)).toBeNull()
  })
})

describe('滑桿比例換算', () => {
  it('數值換成軌道比例', () => {
    expect(ratioOf(0, VOL)).toBe(0)
    expect(ratioOf(80, VOL)).toBe(0.8)
    expect(ratioOf(100, VOL)).toBe(1)
  })

  it('軌道比例換成對齊後的數值', () => {
    expect(valueFromRatio(0.52, VOL)).toBe(50)
    expect(valueFromRatio(0.99, VOL)).toBe(100)
  })

  it('拖出軌道外時夾在上下限', () => {
    expect(valueFromRatio(-0.3, VOL)).toBe(0)
    expect(valueFromRatio(1.4, VOL)).toBe(100)
  })
})

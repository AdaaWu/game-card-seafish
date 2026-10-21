import { describe, expect, it } from 'vitest'
import { attackTone, hasEffectText, healthTone } from '@/content/cardStyle'

describe('攻擊變色', () => {
  it('高於原始值為綠', () => {
    expect(attackTone(4, 2)).toBe('up')
  })
  it('低於原始值為紅', () => {
    expect(attackTone(1, 2)).toBe('down')
  })
  it('等於原始值不變色', () => {
    expect(attackTone(2, 2)).toBe('same')
  })
})

describe('生命變色', () => {
  it('低於目前上限為紅', () => {
    expect(healthTone(2, 3, 3)).toBe('down')
  })
  it('上限被增益但受傷仍為紅', () => {
    expect(healthTone(4, 5, 3)).toBe('down')
  })
  it('上限被增益且滿血為綠', () => {
    expect(healthTone(5, 5, 3)).toBe('up')
  })
  it('未受傷且上限等於原始值不變色', () => {
    expect(healthTone(3, 3, 3)).toBe('same')
  })
  it('上限低於原始值但滿血不變色', () => {
    expect(healthTone(2, 2, 3)).toBe('same')
  })
})

describe('是否有關鍵字以外的效果', () => {
  it('只有關鍵字時為否', () => {
    expect(hasEffectText({ text: '守護' })).toBe(false)
    expect(hasEffectText({ text: '突進。泡泡盾' })).toBe(false)
  })
  it('沒有文字時為否', () => {
    expect(hasEffectText({ text: '' })).toBe(false)
  })
  it('關鍵字之外還有效果時為是', () => {
    expect(hasEffectText({ text: '泡泡盾。死亡時：抽 1 張牌' })).toBe(true)
    expect(hasEffectText({ text: '抽 2 張牌' })).toBe(true)
  })
})

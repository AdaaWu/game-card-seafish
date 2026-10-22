import { describe, expect, it } from 'vitest'
import { collectionColumns } from '@/views/collectionGrid'

describe('收藏頁欄數', () => {
  it('手機橫向（高 500 以下）固定 5 欄', () => {
    expect(collectionColumns(844, 390)).toBe(5)
    expect(collectionColumns(667, 375)).toBe(5)
  })

  it('剛好 500 高仍算手機橫向', () => {
    expect(collectionColumns(900, 500)).toBe(5)
  })

  it('1440 x 900 排 6 欄', () => {
    expect(collectionColumns(1440, 900)).toBe(6)
  })

  it('1920 寬時容器上限 1320，欄寬上限 220，排 5 欄', () => {
    expect(collectionColumns(1920, 1080)).toBe(5)
  })

  it('1024 x 768 欄寬下限 160，排 5 欄', () => {
    expect(collectionColumns(1024, 768)).toBe(5)
  })

  it('窄螢幕至少 1 欄', () => {
    expect(collectionColumns(200, 800)).toBe(1)
  })
})

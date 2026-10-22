import { describe, expect, it } from 'vitest'
import { pageTitleParts } from '@/components/ui/pageTitle'

describe('PageTitle 組件路徑', () => {
  it('頁標用 h1 與大標底飾', () => {
    const p = pageTitleParts({ level: 'page', faction: 'common', prefix: 'shell', divider: 'pearl' })
    expect(p).toEqual({
      tag: 'h1',
      prefixPath: 'titles/title-prefix-shell-base',
      underlayPath: 'titles/title-underlay-lg',
      dividerPath: 'titles/divider-pearl',
    })
  })

  it('區塊標題用 h2 與小標底飾', () => {
    const p = pageTitleParts({ level: 'section', faction: 'tide', prefix: 'star', divider: 'none' })
    expect(p.tag).toBe('h2')
    expect(p.underlayPath).toBe('titles/title-underlay-sm')
    expect(p.prefixPath).toBe('titles/title-prefix-star-tide')
    expect(p.dividerPath).toBeNull()
  })

  it('中立與通用都用 base 配色', () => {
    expect(pageTitleParts({ level: 'page', faction: 'neutral', prefix: 'leaf', divider: 'none' }).prefixPath).toBe(
      'titles/title-prefix-leaf-base',
    )
    expect(pageTitleParts({ level: 'page', faction: 'common', prefix: 'leaf', divider: 'none' }).prefixPath).toBe(
      'titles/title-prefix-leaf-base',
    )
  })

  it('海草分隔線對應 seaweed 切片', () => {
    expect(pageTitleParts({ level: 'page', faction: 'frost', prefix: 'leaf', divider: 'seagrass' }).dividerPath).toBe(
      'titles/divider-seaweed',
    )
  })
})

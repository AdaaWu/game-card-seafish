import { describe, expect, it } from 'vitest'
import { cardTypeLine } from '@/content/cardStyle'

describe('cardTypeLine 卡面副標', () => {
  it('法術卡去掉 species 開頭重複的（法術）', () => {
    expect(cardTypeLine({ type: 'spell', species: '（法術）光合作用' })).toBe('法術・光合作用')
  })

  it('法術卡 species 沒有前綴時照常顯示', () => {
    expect(cardTypeLine({ type: 'spell', species: '光合作用' })).toBe('法術・光合作用')
  })

  it('生物卡照常顯示', () => {
    expect(cardTypeLine({ type: 'creature', species: '綠色海兔' })).toBe('生物・綠色海兔')
  })

  it('生物卡的括號註記保留', () => {
    expect(cardTypeLine({ type: 'creature', species: '寄居蟹（珊瑚殼）' })).toBe('生物・寄居蟹（珊瑚殼）')
  })
})

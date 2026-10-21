import { describe, expect, it } from 'vitest'
import { cardPartUrls, withoutFailed } from '@/render/cardTexture'

describe('卡面切片載入失敗退回', () => {
  const urls = cardPartUrls('leaf', 'legendary')

  it('載入失敗的部件改為空，其他部件保留原網址', () => {
    const out = withoutFailed(urls, new Set(['frame', 'cost'] as const))
    expect(out.frame).toBeUndefined()
    expect(out.cost).toBeUndefined()
    expect(out.ribbon).toBe(urls.ribbon)
    expect(out.health).toBe(urls.health)
  })

  it('沒有失敗時全部保留', () => {
    expect(withoutFailed(urls, new Set())).toEqual(urls)
  })

  it('原本就沒有網址的部件維持空', () => {
    const out = withoutFailed({ ...urls, crown: undefined }, new Set())
    expect(out.crown).toBeUndefined()
  })
})

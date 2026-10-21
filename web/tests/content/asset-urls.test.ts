import { describe, expect, it } from 'vitest'
import { assetUrls } from '@/content/assetUrls'

describe('assetUrls', () => {
  it('只收 cards、portraits、stickers、ui、backgrounds 的 webp 與 video 的 mp4', () => {
    const keys = Object.keys(assetUrls)
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) expect(k).toMatch(/^(?:(?:cards|portraits|stickers|backgrounds)\/[^/]+\.webp|ui\/(?:[^/]+\/)?[^/]+\.webp|video\/[^/]+\.mp4)$/)
  })

  it('不收 _tests 與 _source', () => {
    expect(Object.keys(assetUrls).some((k) => k.startsWith('_'))).toBe(false)
  })

  it('舊的 png key 對到同名 webp', () => {
    expect(assetUrls['cards/leaf-001.png']).toBe(assetUrls['cards/leaf-001.webp'])
    expect(assetUrls['portraits/xiaoye.png']).toBe(assetUrls['portraits/xiaoye.webp'])
    expect(assetUrls['stickers/role1-01.png']).toBe(assetUrls['stickers/role1-01.webp'])
    expect(assetUrls['cards/leaf-001.png']).toBeTruthy()
  })

  it('找不到的 key 回傳 undefined', () => {
    expect(assetUrls['cards/not-exist.png']).toBeUndefined()
  })

  it('影片 key 照舊可用', () => {
    expect(assetUrls['video/opening.mp4']).toBeTruthy()
  })
})

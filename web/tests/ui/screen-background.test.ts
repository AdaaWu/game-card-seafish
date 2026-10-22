import { describe, expect, it } from 'vitest'
import { assetUrls } from '@/content/assetUrls'
import { backgroundKey, orientationOf, screenForRoute, type Screen } from '@/components/ui/screenBackground'

describe('畫面方向', () => {
  it('寬大於等於高為橫式', () => {
    expect(orientationOf(1440, 900)).toBe('landscape')
    expect(orientationOf(800, 800)).toBe('landscape')
  })

  it('高大於寬為直式', () => {
    expect(orientationOf(390, 844)).toBe('portrait')
  })
})

describe('背景檔名', () => {
  it('依畫面與方向組出檔名', () => {
    expect(backgroundKey('story', 'portrait')).toBe('backgrounds/bg-story-portrait.webp')
    expect(backgroundKey('battle', 'landscape')).toBe('backgrounds/bg-battle-landscape.webp')
  })

  it('每個畫面兩個方向的背景都已入庫', () => {
    const screens: Screen[] = ['title', 'menu', 'story', 'deck', 'picker', 'battle']
    for (const s of screens) {
      expect(assetUrls[backgroundKey(s, 'landscape')]).toBeTruthy()
      expect(assetUrls[backgroundKey(s, 'portrait')]).toBeTruthy()
    }
  })
})

describe('路由對應畫面', () => {
  it('各頁對應同名背景', () => {
    expect(screenForRoute('title')).toBe('title')
    expect(screenForRoute('menu')).toBe('menu')
    expect(screenForRoute('story')).toBe('story')
    expect(screenForRoute('deck')).toBe('deck')
  })

  it('對戰頁與測試場的選對手畫面用 picker', () => {
    expect(screenForRoute('battle')).toBe('picker')
    expect(screenForRoute('battle-sandbox')).toBe('picker')
  })

  it('其他路由與尚未解析時用 menu', () => {
    expect(screenForRoute('ui-kit')).toBe('menu')
    expect(screenForRoute(undefined)).toBe('menu')
  })
})

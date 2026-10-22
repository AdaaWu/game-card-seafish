import { describe, expect, it } from 'vitest'
import { PAGE_FADE_MS, pageTransition } from '@/components/ui/pageTransition'

describe('頁面轉場開關', () => {
  it('一般情況用淡入淡出，先出後進', () => {
    expect(pageTransition(false)).toEqual({ name: 'page-fade', css: true, mode: 'out-in' })
  })

  it('減少動態時關閉轉場', () => {
    expect(pageTransition(true)).toEqual({ name: 'page-fade', css: false, mode: 'out-in' })
  })

  it('淡入淡出時長落在 200 到 250ms', () => {
    expect(PAGE_FADE_MS).toBeGreaterThanOrEqual(200)
    expect(PAGE_FADE_MS).toBeLessThanOrEqual(250)
  })
})

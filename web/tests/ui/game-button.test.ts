import { describe, expect, it } from 'vitest'
import { buttonAttrs, buttonClasses, buttonSlicePaths, canActivate, type ButtonFlags } from '@/components/ui/gameButton'

const base: ButtonFlags = { variant: 'primary', size: 'md', disabled: false, loading: false, locked: false }

describe('GameButton class 計算', () => {
  it('一般狀態只帶變體與尺寸', () => {
    expect(buttonClasses(base)).toEqual(['gbtn', 'gbtn--primary', 'gbtn--md'])
  })

  it('停用、載入、鎖定各自加上狀態 class', () => {
    expect(buttonClasses({ ...base, disabled: true })).toContain('is-disabled')
    expect(buttonClasses({ ...base, loading: true })).toContain('is-loading')
    expect(buttonClasses({ ...base, locked: true })).toContain('is-locked')
  })

  it('圖示與主選單不帶尺寸 class', () => {
    expect(buttonClasses({ ...base, variant: 'icon', size: 'lg' })).toEqual(['gbtn', 'gbtn--icon'])
    expect(buttonClasses({ ...base, variant: 'menu', size: 'sm' })).toEqual(['gbtn', 'gbtn--menu'])
  })
})

describe('GameButton aria 狀態', () => {
  it('一般狀態不帶 aria-disabled 與 aria-busy', () => {
    expect(buttonAttrs(base)).toEqual({ disabled: false })
  })

  it('停用用原生 disabled', () => {
    expect(buttonAttrs({ ...base, disabled: true })).toEqual({ disabled: true, 'aria-disabled': 'true' })
  })

  it('鎖定只標 aria-disabled，保留點擊', () => {
    expect(buttonAttrs({ ...base, locked: true })).toEqual({ disabled: false, 'aria-disabled': 'true' })
  })

  it('載入中標 aria-busy', () => {
    expect(buttonAttrs({ ...base, loading: true })).toEqual({ disabled: false, 'aria-busy': 'true' })
  })
})

describe('GameButton 可否觸發點擊', () => {
  it('一般與鎖定可觸發', () => {
    expect(canActivate(base)).toBe(true)
    expect(canActivate({ ...base, locked: true })).toBe(true)
  })

  it('停用與載入中不觸發', () => {
    expect(canActivate({ ...base, disabled: true })).toBe(false)
    expect(canActivate({ ...base, loading: true })).toBe(false)
  })
})

describe('GameButton 切片路徑', () => {
  it('主要按鈕各狀態對應各自切片', () => {
    expect(buttonSlicePaths('primary')).toEqual({
      normal: 'buttons/btn-primary',
      hover: 'buttons/btn-primary-hover',
      pressed: 'buttons/btn-primary-pressed',
      disabled: 'buttons/btn-primary-disabled',
    })
  })

  it('次要按鈕 hover 換亮一階切片', () => {
    expect(buttonSlicePaths('secondary')?.hover).toBe('buttons/btn-secondary-hover')
  })

  it('主選單項目用 menu-item 切片', () => {
    expect(buttonSlicePaths('menu')?.disabled).toBe('buttons/menu-item-disabled')
  })

  it('文字按鈕沒有切片', () => {
    expect(buttonSlicePaths('text')).toBeNull()
  })
})

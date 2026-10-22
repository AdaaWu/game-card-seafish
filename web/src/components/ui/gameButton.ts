export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'icon' | 'menu'
export type ButtonSize = 'lg' | 'md' | 'sm'
export type SliceState = 'normal' | 'hover' | 'pressed' | 'disabled'

export interface ButtonFlags {
  variant: ButtonVariant
  size: ButtonSize
  disabled: boolean
  loading: boolean
  locked: boolean
}

export interface ButtonAttrs {
  disabled: boolean
  'aria-disabled'?: 'true'
  'aria-busy'?: 'true'
}

// 圖示與主選單尺寸固定，不吃 size
const FIXED_SIZE: ReadonlySet<ButtonVariant> = new Set(['icon', 'menu'])

const SLICE_BASE: Record<ButtonVariant, string | null> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  icon: 'btn-icon',
  menu: 'menu-item',
  text: null,
}

export function buttonClasses(f: ButtonFlags): string[] {
  const out = ['gbtn', `gbtn--${f.variant}`]
  if (!FIXED_SIZE.has(f.variant)) out.push(`gbtn--${f.size}`)
  if (f.disabled) out.push('is-disabled')
  if (f.loading) out.push('is-loading')
  if (f.locked) out.push('is-locked')
  return out
}

// 鎖定保留點擊，由呼叫端決定播錯誤音效或提示
export function buttonAttrs(f: ButtonFlags): ButtonAttrs {
  const out: ButtonAttrs = { disabled: f.disabled }
  if (f.disabled || f.locked) out['aria-disabled'] = 'true'
  if (f.loading) out['aria-busy'] = 'true'
  return out
}

export function canActivate(f: ButtonFlags): boolean {
  return !f.disabled && !f.loading
}

// 切片路徑相對 assets/ui，不含 @2x 與副檔名
export function buttonSlicePaths(variant: ButtonVariant): Record<SliceState, string> | null {
  const base = SLICE_BASE[variant]
  if (!base) return null
  return {
    normal: `buttons/${base}`,
    hover: `buttons/${base}-hover`,
    pressed: `buttons/${base}-pressed`,
    disabled: `buttons/${base}-disabled`,
  }
}

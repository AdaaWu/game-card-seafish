// 頁面轉場只改透明度，減少動態時關閉
export const PAGE_FADE_MS = 220

export interface PageTransitionProps {
  name: string
  css: boolean
  mode: 'out-in'
}

export function pageTransition(reduced: boolean): PageTransitionProps {
  return { name: 'page-fade', css: !reduced, mode: 'out-in' }
}

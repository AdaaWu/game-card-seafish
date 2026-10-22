export type Screen = 'title' | 'menu' | 'story' | 'deck' | 'picker' | 'battle'
export type Orientation = 'landscape' | 'portrait'

export function orientationOf(width: number, height: number): Orientation {
  return height > width ? 'portrait' : 'landscape'
}

// assetUrls 的 key
export function backgroundKey(screen: Screen, orientation: Orientation): string {
  return `backgrounds/bg-${screen}-${orientation}.webp`
}

// 對戰進行中由 BattleScreen 自己的 three.js 背景蓋住，路由層只需顯示選對手背景
const ROUTE_SCREEN: Record<string, Screen> = {
  title: 'title',
  menu: 'menu',
  story: 'story',
  deck: 'deck',
  battle: 'picker',
  'battle-sandbox': 'picker',
}

export function screenForRoute(name: string | symbol | null | undefined): Screen {
  return (typeof name === 'string' && ROUTE_SCREEN[name]) || 'menu'
}

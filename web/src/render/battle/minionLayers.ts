// 場上生物拱窗小卡：分層清單、狀態疊層、快取鍵（純邏輯，不碰 Canvas 與 three.js）
import type { Card, Faction } from '@/content/types'
import { KEYWORDS, attackTone, healthTone, type Rect, type StatTone } from '@/content/cardStyle'

// 切片畫布 288×352 的 2 倍；外框本體為四周各內縮 16
export const MINION_CANVAS = { w: 576, h: 704 }
const FRAME = { x: 32, y: 32, w: 512, h: 640 }

export interface BaseFlags {
  stealth: boolean
  exhausted: boolean
}

export type BaseLayer =
  | { kind: 'slice'; path: string; alpha: number }
  | { kind: 'art'; alpha: number; saturation: number }
  | { kind: 'keywords'; icons: string[]; more: number }

export interface MinionStatus {
  keywords: string[]
  frozen: boolean
  ready: boolean
  exhausted: boolean
}

export interface OverlayState {
  ready: boolean
  taunt: boolean
  frozen: boolean
  bubble: boolean
}

export interface StatLook {
  attack: number
  health: number
  maxHealth: number
}

// 狀態疊層的切片，所有生物共用一份材質
export const OVERLAY_SLICES = {
  ready: 'minion/minion-ready',
  taunt: 'minion/minion-taunt',
  frozen: 'minion/ov-frozen',
  bubble: 'minion/ov-bubble',
} as const

export const OVERLAY_ORDER = { ready: 8, taunt: 9, base: 10, frozen: 12, bubble: 13, stats: 14 } as const

export const STEALTH_ART_ALPHA = 0.65
export const EXHAUSTED_SATURATION = 0.35
const STEALTH_MIST_ALPHA = 0.85
const MAX_BOARD_ICONS = 2

// 有外觀疊層的關鍵字，場上不另外畫圖示
const VISUAL_KEYWORDS: ReadonlySet<string> = new Set(['taunt', 'bubble', 'stealth', 'freeze'])

export const TONE_COLOR: Record<StatTone, string> = { up: '#7EE29A', down: '#FF8F8B', same: '#FFFFFF' }

// 拱頂關鍵字圖示：最多 2 顆，超過時第 2 顆改成 +N
export function boardKeywordIcons(keywords: string[]): { icons: string[]; more: number } {
  const list = keywords.filter((k) => KEYWORDS[k] && !VISUAL_KEYWORDS.has(k))
  if (list.length <= MAX_BOARD_ICONS) return { icons: list, more: 0 }
  return { icons: list.slice(0, MAX_BOARD_ICONS - 1), more: list.length - (MAX_BOARD_ICONS - 1) }
}

// 底層貼圖由下到上的圖層
export function baseLayers(faction: Faction, flags: BaseFlags, keywords: string[]): BaseLayer[] {
  const layers: BaseLayer[] = [
    { kind: 'slice', path: `minion/minion-window-${faction}`, alpha: 1 },
    {
      kind: 'art',
      alpha: flags.stealth ? STEALTH_ART_ALPHA : 1,
      saturation: flags.exhausted ? EXHAUSTED_SATURATION : 1,
    },
  ]
  if (flags.exhausted) layers.push({ kind: 'slice', path: 'minion/minion-exhausted', alpha: 1 })
  if (flags.stealth) layers.push({ kind: 'slice', path: 'minion/ov-stealth', alpha: STEALTH_MIST_ALPHA })
  layers.push({ kind: 'slice', path: `minion/minion-frame-${faction}`, alpha: 1 })
  const kw = boardKeywordIcons(keywords)
  if (kw.icons.length > 0 || kw.more > 0) layers.push({ kind: 'keywords', ...kw })
  return layers
}

export function overlayState(s: MinionStatus): OverlayState {
  return {
    ready: s.ready && !s.exhausted && !s.frozen,
    taunt: s.keywords.includes('taunt'),
    frozen: s.frozen,
    bubble: s.keywords.includes('bubble'),
  }
}

function tones(card: Card, look: StatLook): { attack: StatTone; health: StatTone } {
  return { attack: attackTone(look.attack, card.attack ?? 0), health: healthTone(look.health, look.maxHealth, card.health ?? 0) }
}

export function statColors(card: Card, look: StatLook): { attack: string; health: string } {
  const t = tones(card, look)
  return { attack: TONE_COLOR[t.attack], health: TONE_COLOR[t.health] }
}

export function baseKey(cardId: string, flags: BaseFlags, keywords: string[]): string {
  const kw = boardKeywordIcons(keywords)
  return `${cardId}|${flags.stealth ? 's' : ''}${flags.exhausted ? 'x' : ''}|${kw.icons.join(',')}+${kw.more}`
}

export function statKey(card: Card, look: StatLook): string {
  const t = tones(card, look)
  return `${look.attack}:${t.attack}|${look.health}:${t.health}`
}

// 插畫放進拱窗：bounds 為角色不透明範圍（圖片 px），回傳 2 倍畫布上的繪製範圍
export function minionArtRect(bounds: Rect, imageW: number, imageH: number): Rect {
  const boxW = FRAME.w - 48
  const boxH = FRAME.h - 48
  const s = Math.min((boxW * 1.04) / bounds.w, (boxH * 0.8) / bounds.h)
  const top = FRAME.y + 60
  return {
    x: MINION_CANVAS.w / 2 - (bounds.x + bounds.w / 2) * s,
    y: top - bounds.y * s,
    w: imageW * s,
    h: imageH * s,
  }
}

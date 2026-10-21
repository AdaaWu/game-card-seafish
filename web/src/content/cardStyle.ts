// 卡面共用常數：DOM 卡面與 Canvas 卡面共用同一份版面、色票、圖示
import type { Card, Faction, Rarity } from './types'
import { assetUrls } from './assetUrls'

// 以 500×700 設計稿為座標
export const CARD_W = 500
export const CARD_H = 700

export const LAYOUT = {
  radius: 36,
  border: 12,
  art: { x: 40, y: 60, w: 420, h: 330, r: 24, overflowTop: 40 },
  ribbon: { x: 30, y: 380, w: 440, h: 64 },
  text: { x: 50, y: 456, w: 400, h: 190, r: 16, spellBottom: 680 },
  cost: { x: 8, y: 8, d: 96 },
  attack: { x: 8, y: 604, d: 88 },
  health: { x: 404, y: 604, d: 88 },
  gem: { cx: 250, cy: 444, d: 28 },
  font: { cost: 64, stat: 56, statWide: 48, name: 32, nameMin: 24, text: 24, textMin: 18, type: 18, lineHeight: 1.35 },
  nameMaxChars: 8,
  textMaxLines: 5,
} as const

export interface IconDef {
  d: string
  mode: 'fill' | 'stroke'
}

export interface FactionStyle {
  label: string
  main: string
  dark: string
  light: string
  icon: IconDef
}

// 霜改走冰白＋薰衣草藍紫，潮改走淡藍青，兩者色相拉開
export const FACTION_STYLE: Record<Faction, FactionStyle> = {
  leaf: {
    label: '葉',
    main: '#9CC79A',
    dark: '#5E9461',
    light: '#E3F1DC',
    icon: { d: 'M4 20C4 9 11 4 20 4c0 11-5 16-16 16zM4 20l9-9', mode: 'fill' },
  },
  tide: {
    label: '潮',
    main: '#86CCD6',
    dark: '#3F8E9F',
    light: '#DDF2F4',
    icon: { d: 'M2 14c3-4 6-4 9 0s6 4 11 0v7H2z', mode: 'fill' },
  },
  frost: {
    label: '霜',
    main: '#C9C6EE',
    dark: '#7F78C2',
    light: '#F4F3FC',
    icon: { d: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5', mode: 'stroke' },
  },
  light: {
    label: '光',
    main: '#F3DA8C',
    dark: '#C9A54A',
    light: '#FCF4D9',
    icon: { d: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z', mode: 'fill' },
  },
  neutral: {
    label: '中立',
    main: '#D9CFC5',
    dark: '#9C8F82',
    light: '#F4EFEA',
    icon: { d: 'M12 4C6 4 3 9 3 13l9 7 9-7c0-4-3-9-9-9zM12 4v15M7 6l3 13M17 6l-3 13', mode: 'fill' },
  },
}

export const RARITY_STYLE: Record<Rarity, { label: string; color: string; sides: 0 | 4 | 6 | 10 }> = {
  common: { label: '普通', color: '#EDE8E1', sides: 0 },
  rare: { label: '稀有', color: '#6FA8D6', sides: 4 },
  epic: { label: '史詩', color: '#A98BD4', sides: 6 },
  legendary: { label: '傳說', color: '#F0B45A', sides: 10 },
}

export interface KeywordInfo {
  label: string
  desc: string
  icon: IconDef
}

export const KEYWORDS: Record<string, KeywordInfo> = {
  taunt: {
    label: '守護',
    desc: '敵人必須先攻擊有守護的生物',
    icon: { d: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z', mode: 'fill' },
  },
  rush: {
    label: '突進',
    desc: '召喚當回合可以攻擊生物，不能攻擊英雄',
    icon: { d: 'M3 10h11V5l7 7-7 7v-5H3z', mode: 'fill' },
  },
  charge: {
    label: '疾行',
    desc: '召喚當回合就能攻擊任何目標',
    icon: { d: 'M2 6l8 6-8 6zM12 6l8 6-8 6z', mode: 'fill' },
  },
  bubble: {
    label: '泡泡盾',
    desc: '抵擋下一次受到的傷害',
    icon: { d: 'M12 3a9 9 0 1 0 0.01 0zM7.5 10a4.5 4.5 0 0 1 4.5-4.5', mode: 'stroke' },
  },
  lifesteal: {
    label: '共生',
    desc: '造成傷害時，為己方英雄回復等量生命',
    icon: { d: 'M4 16C4 9 8 5 13 5c0 7-4 11-9 11zM20 8c0 7-4 11-9 11 0-7 4-11 9-11z', mode: 'fill' },
  },
  stealth: {
    label: '潛藏',
    desc: '在攻擊前無法被敵人選為目標',
    icon: { d: 'M2 11c3 4 7 5 10 5s7-1 10-5M5 14l-1.5 2.5M12 16v3M19 14l1.5 2.5', mode: 'stroke' },
  },
  freeze: {
    label: '冰凍',
    desc: '下一次輪到時無法攻擊',
    icon: { d: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7', mode: 'stroke' },
  },
}

export const CARD_TYPE_LABEL = { creature: '生物', spell: '法術' } as const

// 稀有度寶石頂點（圓形回傳 null）
export function gemPoints(rarity: Rarity, cx: number, cy: number, r: number): [number, number][] | null {
  const sides = RARITY_STYLE[rarity].sides
  if (sides === 0) return null
  const pts: [number, number][] = []
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides
    const rr = sides === 10 && i % 2 === 1 ? r * 0.45 : r
    pts.push([cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)])
  }
  return pts
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const stickerKeys = Object.keys(assetUrls)
  .filter((k) => k.startsWith('stickers/'))
  .sort()

// 卡圖：正式圖 → 依 id 雜湊挑貼圖 → null（改畫陣營色塊）
export function cardArtUrl(cardId: string): string | null {
  const own = assetUrls[`cards/${cardId}.png`]
  if (own) return own
  if (stickerKeys.length === 0) return null
  return assetUrls[stickerKeys[hash(cardId) % stickerKeys.length]!] ?? null
}

// 頭像：正式頭像 → 主角用貼圖 → null（改畫陣營色塊）
export function portraitUrl(characterId: string | undefined): string | null {
  if (!characterId) return null
  const own = assetUrls[`portraits/${characterId}.png`]
  if (own) return own
  if (characterId === 'xiaoye') return assetUrls['stickers/role1-01.png'] ?? null
  return null
}

// 效果文字切段，關鍵字標記為粗體
export function splitKeywordText(text: string): { text: string; bold: boolean }[] {
  const labels = Object.values(KEYWORDS)
    .map((k) => k.label)
    .sort((a, b) => b.length - a.length)
  const re = new RegExp(`(${labels.join('|')})`, 'g')
  return text
    .split(re)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, bold: labels.includes(t) }))
}

export function cardKeywords(card: Card): KeywordInfo[] {
  return card.keywords.map((k) => KEYWORDS[k]).filter((k): k is KeywordInfo => Boolean(k))
}

// 數值徽章外形：費用水滴、攻擊珊瑚尖角、生命水滴愛心（各自 viewBox 為直徑大小）
export const SHAPES = {
  cost: 'M48 4C64 26 88 42 88 60A40 40 0 0 1 8 60C8 42 32 26 48 4Z',
  attack: 'M44 4L54 24L76 14L68 38L86 50L64 58L66 84L44 70L22 84L24 58L2 50L20 38L12 14L34 24Z',
  health: 'M44 84C20 66 6 52 6 34C6 20 16 10 28 10C36 10 41 14 44 20C47 14 52 10 60 10C72 10 82 20 82 34C82 52 68 66 44 84Z',
  sword: 'M60 22L66 28L42 52L36 46ZM34 48L40 54L34 60L28 54Z',
  crack: 'M30 30L40 42L34 48L46 60',
  crown:
    'M150 70L170 26L200 56L250 10L300 56L330 26L350 70Q250 50 150 70Z',
} as const

// 卡框邊緣花紋：潮為波浪、霜為冰晶，其餘陣營無
export function framePatternPath(faction: Faction): string {
  const inset = 20
  if (faction === 'tide') {
    let d = ''
    for (let x = 60; x < CARD_W - 60; x += 40) {
      d += `M${x} ${inset}q10 -8 20 0t20 0`
      d += `M${x} ${CARD_H - inset}q10 8 20 0t20 0`
    }
    return d
  }
  if (faction === 'frost') {
    let d = ''
    for (let x = 70; x < CARD_W - 60; x += 44) {
      d += `M${x} ${inset + 6}l8 -12l8 12M${x + 8} ${inset - 6}v18`
      d += `M${x} ${CARD_H - inset - 6}l8 12l8 -12M${x + 8} ${CARD_H - inset + 6}v-18`
    }
    return d
  }
  return ''
}

// 名稱字級：超過 8 字每字縮 2px，最小 24px
export function nameFontSize(name: string): number {
  const over = Math.max(0, [...name].length - LAYOUT.nameMaxChars)
  return Math.max(LAYOUT.font.nameMin, LAYOUT.font.name - over * 2)
}

// 效果文字字級：估算行數超過上限時每次縮 1px，最小 18px
export function textFontSize(text: string, boxWidth: number = LAYOUT.text.w - 32): number {
  let size: number = LAYOUT.font.text
  while (size > LAYOUT.font.textMin) {
    const perLine = Math.floor(boxWidth / size)
    if (Math.ceil([...text].length / perLine) <= LAYOUT.textMaxLines) break
    size -= 1
  }
  return size
}

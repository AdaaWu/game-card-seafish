// 卡面共用常數：DOM 卡面與 Canvas 卡面共用同一份版面、色票、圖示
import type { Card, Faction, Rarity } from './types'
import { assetUrls } from './assetUrls'

// 以 500×700 設計稿為座標
export const CARD_W = 500
export const CARD_H = 700

export const LAYOUT = {
  radius: 36,
  border: 12,
  inset: 6,
  // 插畫高度依文字框伸縮；角色高度 86%、寬度上限 108%、頂端往下 10%
  art: { x: 18, y: 18, w: 464, h: 504, r: 26, minH: 434, maxH: 548, shadowUp: 28, fitH: 0.86, fitW: 1.08, top: 0.1 },
  ribbon: { creature: { x: 96, w: 308 }, spell: { x: 50, w: 400 }, h: 52, gap: 4 },
  // 效果文字 4 行用 154、3 行 132、2 行以下 110
  text: { x: 18, w: 464, bottom: 682, r: 16, h4: 154, h3: 132, h2: 110, padX: 16, typeSpace: 26 },
  cost: { x: 10, y: 10, d: 70 },
  faction: { x: 420, y: 10, d: 70 },
  attack: { x: 14, d: 70, up: 2 },
  health: { x: 416, d: 70, up: 2 },
  gem: { cx: 250, d: 24 },
  keyword: { cx: 130, cy: 45, d: 48, gap: 56 },
  font: { cost: 46, stat: 40, statWide: 34, name: 32, nameMin: 24, text: 24, textMin: 18, type: 18, lineHeight: 1.35 },
  nameMaxChars: 8,
  textMaxLines: 4,
} as const

// 切片 1x 以 512 寬貼圖為準：設計稿 1 單位 = 1.024 px
export const SLICE_PX = 1.024

// 九宮格不拉伸區（1x px）
export const SLICE_INSET = {
  scrim: { t: 0, r: 28, b: 0, l: 28 },
  ribbon: { t: 0, r: 32, b: 0, l: 32 },
  textbox: { t: 20, r: 20, b: 20, l: 20 },
} as const

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function textBoxHeight(lines: number): number {
  const t = LAYOUT.text
  return lines >= 4 ? t.h4 : lines === 3 ? t.h3 : t.h2
}

// 依效果文字行數算出整張卡面版面
export function cardFaceLayout(type: Card['type'], textLines: number) {
  const L = LAYOUT
  const textH = textBoxHeight(textLines)
  const textY = L.text.bottom - textH
  const artH = Math.min(L.art.maxH, Math.max(L.art.minH, textY - L.inset - L.art.y))
  const artBottom = L.art.y + artH
  const rb = type === 'creature' ? L.ribbon.creature : L.ribbon.spell
  const ribbon = { x: rb.x, y: artBottom - L.ribbon.gap - L.ribbon.h, w: rb.w, h: L.ribbon.h }
  const corner = (c: { x: number; d: number; up: number }) => ({ x: c.x, y: artBottom - c.up - c.d, d: c.d })
  return {
    art: { x: L.art.x, y: L.art.y, w: L.art.w, h: artH, r: L.art.r },
    text: { x: L.text.x, y: textY, w: L.text.w, h: textH, r: L.text.r },
    ribbon,
    gem: { cx: L.gem.cx, cy: ribbon.y + ribbon.h, d: L.gem.d },
    cost: L.cost,
    faction: L.faction,
    attack: corner(L.attack),
    health: corner(L.health),
  }
}

// 角色插畫放置：bounds 為角色不透明範圍（圖片 px），回傳插畫在設計稿的繪製範圍
export function artPlacement(bounds: Rect, imageW: number, imageH: number, art: Rect): Rect {
  const A = LAYOUT.art
  const s = Math.min((art.h * A.fitH) / bounds.h, (art.w * A.fitW) / bounds.w)
  return {
    x: art.x + art.w / 2 - (bounds.x + bounds.w / 2) * s,
    y: art.y + art.h * A.top - bounds.y * s,
    w: imageW * s,
    h: imageH * s,
  }
}

// 卡面切片與四角圖示 URL，path 如 card-frame/card-frame-leaf、icons/icon-cost
export function uiImageUrl(path: string, hi = false): string | undefined {
  return assetUrls[`ui/${path}${hi ? '@2x' : ''}.webp`]
}

// 手牌精簡版型：放大角色圖、卡名與數值，不放效果文字
export const HAND_LAYOUT = {
  art: { x: 30, y: 30, w: 440, h: 420, r: 28 },
  ribbon: { x: 20, y: 456, w: 460, h: 96 },
  cost: { x: 0, y: 0, d: 128 },
  attack: { x: 0, y: 564, d: 132 },
  health: { x: 368, y: 564, d: 132 },
  mark: { x: 200, y: 584, w: 100, h: 80 },
  font: { cost: 84, costWide: 72, stat: 84, statWide: 72, name: 68 },
  kw: { d: 76, gap: 8, top: 14, right: 14 },
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

// 卡面副標
export function cardTypeLine(card: Pick<Card, 'type' | 'species'>): string {
  const label = CARD_TYPE_LABEL[card.type]
  const species = card.species.replace(new RegExp(`^（${label}）`), '')
  return `${label}・${species}`
}

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

// 名稱字級：超過 8 字每字縮 2px，最小 24px
export function nameFontSize(name: string): number {
  const over = Math.max(0, [...name].length - LAYOUT.nameMaxChars)
  return Math.max(LAYOUT.font.nameMin, LAYOUT.font.name - over * 2)
}

// 效果文字字級：估算行數超過上限時每次縮 1px，最小 18px
export function textFontSize(text: string, boxWidth: number = LAYOUT.text.w - LAYOUT.text.padX * 2): number {
  let size: number = LAYOUT.font.text
  while (size > LAYOUT.font.textMin) {
    const perLine = Math.floor(boxWidth / size)
    if (Math.ceil([...text].length / perLine) <= LAYOUT.textMaxLines) break
    size -= 1
  }
  return size
}

// 效果文字估算行數（DOM 卡面用，Canvas 以實際量測為準）
export function estimateTextLines(text: string, boxWidth: number = LAYOUT.text.w - LAYOUT.text.padX * 2): number {
  const len = [...text].length
  if (len === 0) return 0
  const perLine = Math.floor(boxWidth / textFontSize(text, boxWidth))
  return Math.min(LAYOUT.textMaxLines, Math.ceil(len / perLine))
}

export type StatTone = 'up' | 'down' | 'same'

// 攻擊變色：高於原始值為綠、低於原始值為紅
export function attackTone(attack: number, baseAttack: number): StatTone {
  if (attack === baseAttack) return 'same'
  return attack > baseAttack ? 'up' : 'down'
}

// 生命變色：低於目前上限為紅；上限高於原始值且滿血為綠
export function healthTone(health: number, maxHealth: number, baseHealth: number): StatTone {
  if (health < maxHealth) return 'down'
  return maxHealth > baseHealth ? 'up' : 'same'
}

// 效果文字扣掉關鍵字後仍有內容
export function hasEffectText(card: Pick<Card, 'text'>): boolean {
  const rest = Object.values(KEYWORDS).reduce((t, k) => t.split(k.label).join(''), card.text)
  return rest.replace(/[\s。、，．,.]/g, '') !== ''
}

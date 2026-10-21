// Canvas 2D 卡面，供 three.js CanvasTexture 使用
import type { Card, Faction, Rarity } from '@/content/types'
import {
  CARD_H,
  CARD_W,
  FACTION_STYLE,
  LAYOUT,
  SLICE_INSET,
  SLICE_PX,
  artPlacement,
  cardArtUrl,
  cardFaceLayout,
  cardKeywords,
  cardTypeLine,
  keywordRow,
  nameFontSize,
  splitKeywordText,
  uiImageUrl,
  type IconDef,
  type Rect,
} from '@/content/cardStyle'

export interface CardFaceValues {
  attack?: number
  health?: number
}

export const TEXTURE_WIDTH = 512
export const TEXTURE_HEIGHT = 717

const FONT_UI = '"jf-openhuninn-2.0", "jf open 粉圓", "Noto Sans TC", "M PLUS Rounded 1c", sans-serif'
const FONT_NUM = '"M PLUS Rounded 1c", "Baloo 2", "Noto Sans TC", sans-serif'
const INK = '#3E3550'
const NO_LINE_START = '，。、！？」）：；…'
const NO_LINE_END = '「（'

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

// 載入失敗回傳 null，不丟錯
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    imageCache.set(url, p)
  }
  return p
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: IconDef, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  const path = new Path2D(icon.d)
  if (icon.mode === 'fill') {
    ctx.fillStyle = color
    ctx.fill(path)
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(path)
  }
  ctx.restore()
}

function strokedNumber(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, fill: string, stroke: string) {
  ctx.font = `800 ${size}px ${FONT_NUM}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 8
  ctx.strokeStyle = stroke
  ctx.strokeText(text, cx, cy)
  ctx.fillStyle = fill
  ctx.fillText(text, cx, cy)
}

// 逐字換行，套用避頭尾
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const chars = [...text]
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    if (line && measure(line + ch) > maxWidth && !NO_LINE_START.includes(ch)) {
      const last = line.at(-1) ?? ''
      if (NO_LINE_END.includes(last)) {
        lines.push(line.slice(0, -1))
        line = last + ch
      } else {
        lines.push(line)
        line = ch
      }
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

type Drawable = HTMLImageElement | ImageBitmap

// 卡面用到的切片與圖示，缺圖時略過該層
export interface CardFaceParts {
  frame?: Drawable | null
  artwash?: Drawable | null
  scrim?: Drawable | null
  ribbon?: Drawable | null
  textbox?: Drawable | null
  gem?: Drawable | null
  crown?: Drawable | null
  keywordRing?: Drawable | null
  cost?: Drawable | null
  attack?: Drawable | null
  health?: Drawable | null
  faction?: Drawable | null
}

export function cardPartUrls(faction: Faction, rarity: Rarity, hi = false): Record<keyof CardFaceParts, string | undefined> {
  return {
    frame: uiImageUrl(`card-frame/card-frame-${faction}`, hi),
    artwash: uiImageUrl(`card-frame/card-artwash-${faction}`, hi),
    scrim: uiImageUrl('card-frame/card-scrim', hi),
    ribbon: uiImageUrl('card-frame/card-ribbon', hi),
    textbox: uiImageUrl('card-frame/card-textbox', hi),
    gem: uiImageUrl(`card-frame/card-gem-${rarity}`, hi),
    crown: uiImageUrl('card-frame/card-crown', hi),
    keywordRing: uiImageUrl('card-frame/card-keyword-ring', hi),
    cost: uiImageUrl('icons/icon-cost', hi),
    attack: uiImageUrl('icons/icon-attack', hi),
    health: uiImageUrl('icons/icon-health', hi),
    faction: uiImageUrl(`icons/icon-faction-${faction}`, hi),
  }
}

// 九宮格繪製：img 為 1x 切片，inset 為不拉伸區
function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  img: Drawable,
  inset: { t: number; r: number; b: number; l: number },
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const sx = [0, inset.l, img.width - inset.r, img.width]
  const sy = [0, inset.t, img.height - inset.b, img.height]
  const dx = [x, x + inset.l / SLICE_PX, x + w - inset.r / SLICE_PX, x + w]
  const dy = [y, y + inset.t / SLICE_PX, y + h - inset.b / SLICE_PX, y + h]
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const sw = sx[i + 1]! - sx[i]!
      const sh = sy[j + 1]! - sy[j]!
      const dw = dx[i + 1]! - dx[i]!
      const dh = dy[j + 1]! - dy[j]!
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) ctx.drawImage(img, sx[i]!, sy[j]!, sw, sh, dx[i]!, dy[j]!, dw, dh)
    }
}

const boundsCache = new WeakMap<object, Rect>()

// 角色不透明範圍（alpha > 16），以縮小取樣估算；讀不到像素時回傳整張圖
export function alphaBounds(img: Drawable): Rect {
  const cached = boundsCache.get(img)
  if (cached) return cached
  const full = { x: 0, y: 0, w: img.width, h: img.height }
  let result = full
  try {
    const scale = Math.min(1, 256 / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d', { willReadFrequently: true })
    if (cx) {
      cx.drawImage(img, 0, 0, w, h)
      const data = cx.getImageData(0, 0, w, h).data
      let minX = w
      let minY = h
      let maxX = -1
      let maxY = -1
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++)
          if (data[(yy * w + xx) * 4 + 3]! > 16) {
            if (xx < minX) minX = xx
            if (xx > maxX) maxX = xx
            if (yy < minY) minY = yy
            if (yy > maxY) maxY = yy
          }
      if (maxX >= 0) result = { x: minX / scale, y: minY / scale, w: (maxX - minX + 1) / scale, h: (maxY - minY + 1) / scale }
    }
  } catch {
    result = full
  }
  boundsCache.set(img, result)
  return result
}

function fitEffectText(ctx: CanvasRenderingContext2D, text: string, maxW: number): { size: number; lines: string[] } {
  const maxLines = LAYOUT.textMaxLines
  let size: number = LAYOUT.font.text
  let lines: string[] = []
  for (; size >= LAYOUT.font.textMin; size--) {
    ctx.font = `500 ${size}px ${FONT_UI}`
    lines = wrapText((s) => ctx.measureText(s).width, text, maxW)
    if (lines.length <= maxLines) break
  }
  size = Math.max(size, LAYOUT.font.textMin)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    lines[maxLines - 1] = `${lines[maxLines - 1]!.slice(0, -1)}…`
  }
  return { size, lines }
}

function drawEffectText(ctx: CanvasRenderingContext2D, card: Card, box: Rect, fit: { size: number; lines: string[] }) {
  const { size, lines } = fit
  const lh = size * LAYOUT.font.lineHeight
  const typeSpace = LAYOUT.text.typeSpace
  const top = box.y + (box.h - typeSpace - lh * lines.length) / 2 + lh / 2
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  lines.forEach((line, i) => {
    // 關鍵字粗體，與一般字分開量測
    const parts = splitKeywordText(line)
    const widthOf = (t: string, bold: boolean) => {
      ctx.font = `${bold ? 900 : 500} ${size}px ${FONT_UI}`
      return ctx.measureText(t).width
    }
    const total = parts.reduce((w, p) => w + widthOf(p.text, p.bold), 0)
    let x = box.x + (box.w - total) / 2
    ctx.textAlign = 'left'
    for (const p of parts) {
      ctx.font = `${p.bold ? 900 : 500} ${size}px ${FONT_UI}`
      ctx.fillText(p.text, x, top + i * lh)
      x += ctx.measureText(p.text).width
    }
  })
  ctx.font = `500 ${LAYOUT.font.type}px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6E6580'
  ctx.fillText(cardTypeLine(card), box.x + box.w / 2, box.y + box.h - 16)
}

// 同步繪製卡面到 500×700 座標系；image 為 null 時畫陣營圖示與物種名
export function drawCardFace(
  ctx: CanvasRenderingContext2D,
  card: Card,
  values: CardFaceValues = {},
  image: Drawable | null = null,
  parts: CardFaceParts = {},
): void {
  const f = FACTION_STYLE[card.faction]
  const isCreature = card.type === 'creature'
  ctx.clearRect(0, 0, CARD_W, CARD_H)

  const fit = fitEffectText(ctx, card.text, LAYOUT.text.w - LAYOUT.text.padX * 2)
  const L = cardFaceLayout(card.type, card.text ? fit.lines.length : 0)
  const a = L.art

  // ① 卡框底
  if (parts.frame) ctx.drawImage(parts.frame, 0, 0, CARD_W, CARD_H)

  // ② 插畫區：水彩底、陰影、角色、上下可讀性漸層，以圓角裁切
  ctx.save()
  roundRect(ctx, a.x, a.y, a.w, a.h, a.r)
  ctx.clip()
  if (parts.artwash) {
    const k = a.w / parts.artwash.width
    const sh = Math.min(parts.artwash.height, a.h / k)
    ctx.drawImage(parts.artwash, 0, 0, parts.artwash.width, sh, a.x, a.y, a.w, sh * k)
  }
  ctx.beginPath()
  ctx.ellipse(a.x + a.w / 2, a.y + a.h - LAYOUT.art.shadowUp, a.w * 0.25, 16, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(62,53,80,0.15)'
  ctx.fill()
  if (image) {
    const p = artPlacement(alphaBounds(image), image.width, image.height, a)
    ctx.drawImage(image, p.x, p.y, p.w, p.h)
  } else {
    drawIcon(ctx, f.icon, a.x + a.w / 2 - 60, a.y + a.h * 0.3, 120, f.dark)
    ctx.font = `700 28px ${FONT_UI}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = f.dark
    ctx.fillText(card.species, a.x + a.w / 2, a.y + a.h * 0.3 + 170, a.w - 40)
  }
  if (parts.scrim) {
    const sh = parts.scrim.height / SLICE_PX
    drawNineSlice(ctx, parts.scrim, SLICE_INSET.scrim, a.x, a.y, a.w, sh)
    ctx.save()
    ctx.translate(0, a.y + a.h)
    ctx.scale(1, -1)
    drawNineSlice(ctx, parts.scrim, SLICE_INSET.scrim, a.x, 0, a.w, sh)
    ctx.restore()
  }
  ctx.restore()

  // ③ 傳說花冠
  if (card.rarity === 'legendary' && parts.crown) {
    const w = parts.crown.width / SLICE_PX
    ctx.drawImage(parts.crown, (CARD_W - w) / 2, 0, w, parts.crown.height / SLICE_PX)
  }

  // ④ 名稱緞帶與稀有度寶石
  const r = L.ribbon
  if (parts.ribbon) drawNineSlice(ctx, parts.ribbon, SLICE_INSET.ribbon, r.x, r.y, r.w, r.h)
  ctx.font = `800 ${nameFontSize(card.name)}px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.fillText(card.name, r.x + r.w / 2, r.y + r.h / 2 + 2, r.w - 60)
  if (parts.gem) {
    const gw = parts.gem.width / SLICE_PX
    ctx.drawImage(parts.gem, L.gem.cx - gw / 2, L.gem.cy - gw / 2, gw, gw)
  }

  // ⑤ 效果文字框
  const t = L.text
  if (parts.textbox) drawNineSlice(ctx, parts.textbox, SLICE_INSET.textbox, t.x, t.y, t.w, t.h)
  drawEffectText(ctx, card, t, fit)

  // ⑥ 費用、攻擊、生命：數字疊在圖示中心
  const F = LAYOUT.font
  const icon = (img: Drawable | null | undefined, b: { x: number; y: number; d: number }) => {
    if (img) ctx.drawImage(img, b.x, b.y, b.d, b.d)
  }
  icon(parts.cost, L.cost)
  strokedNumber(ctx, String(card.cost), L.cost.x + L.cost.d / 2, L.cost.y + L.cost.d / 2, card.cost >= 10 ? F.statWide : F.cost, '#FFFFFF', '#234A6E')
  if (isCreature) {
    const atk = values.attack ?? card.attack ?? 0
    const hp = values.health ?? card.health ?? 0
    const color = (v: number, base: number | undefined) =>
      base === undefined || v === base ? '#FFFFFF' : v > base ? '#3E9E5C' : '#D9534F'
    const { attack: at, health: he } = L
    icon(parts.attack, at)
    strokedNumber(ctx, String(atk), at.x + at.d / 2, at.y + at.d / 2, atk >= 10 ? F.statWide : F.stat, color(atk, card.attack), INK)
    icon(parts.health, he)
    strokedNumber(ctx, String(hp), he.x + he.d / 2, he.y + he.d / 2, hp >= 10 ? F.statWide : F.stat, color(hp, card.health), INK)
    const arrow = (v: number, base: number | undefined, x: number, y: number) => {
      if (base === undefined || v === base) return
      ctx.font = `900 26px ${FONT_NUM}`
      ctx.lineWidth = 3
      ctx.strokeStyle = '#FFFFFF'
      ctx.strokeText(v > base ? '▲' : '▼', x, y)
      ctx.fillStyle = v > base ? '#3E9E5C' : '#D9534F'
      ctx.fillText(v > base ? '▲' : '▼', x, y)
    }
    arrow(atk, card.attack, at.x + at.d - 2, at.y + 4)
    arrow(hp, card.health, he.x + 2, he.y + 4)
  }

  // ⑦ 派系徽記與關鍵字圖示
  icon(parts.faction, L.faction)
  const K = keywordRow(card.rarity)
  cardKeywords(card).forEach((k, i) => {
    const cx = K.cx + i * K.gap
    if (parts.keywordRing) ctx.drawImage(parts.keywordRing, cx - K.d / 2, K.cy - K.d / 2, K.d, K.d)
    ctx.beginPath()
    ctx.arc(cx, K.cy, K.d / 2 - 1.5, 0, Math.PI * 2)
    ctx.lineWidth = 3
    ctx.strokeStyle = f.dark
    ctx.stroke()
    const size = K.d * 0.6
    drawIcon(ctx, k.icon, cx - size / 2, K.cy - size / 2, size, INK)
  })
}

// 建立 512×717 卡面 canvas：等字型就緒、載入卡圖與切片後繪製
export async function createCardCanvas(card: Card, values: CardFaceValues = {}): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  await document.fonts?.ready
  const url = cardArtUrl(card.id)
  const urls = cardPartUrls(card.faction, card.rarity)
  const [image, ...loaded] = await Promise.all([
    url ? loadImage(url) : null,
    ...Object.values(urls).map((u) => (u ? loadImage(u) : null)),
  ])
  const parts = Object.fromEntries(Object.keys(urls).map((k, i) => [k, loaded[i]])) as CardFaceParts
  ctx.scale(TEXTURE_WIDTH / CARD_W, TEXTURE_HEIGHT / CARD_H)
  drawCardFace(ctx, card, values, image, parts)
  return canvas
}

// 載入失敗的部件改為空，由卡面退回 CSS 底框與向量圖示
export function withoutFailed<K extends string>(
  urls: Record<K, string | undefined>,
  failed: ReadonlySet<NoInfer<K>>,
): Record<K, string | undefined> {
  const out = { ...urls }
  for (const k of failed) out[k] = undefined
  return out
}

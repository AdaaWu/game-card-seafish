// Canvas 2D 卡面，供 three.js CanvasTexture 使用
import type { Card } from '@/content/types'
import {
  CARD_H,
  CARD_W,
  FACTION_STYLE,
  LAYOUT,
  RARITY_STYLE,
  SHAPES,
  cardArtUrl,
  cardKeywords,
  cardTypeLine,
  framePatternPath,
  gemPoints,
  nameFontSize,
  splitKeywordText,
  type IconDef,
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

function drawShape(ctx: CanvasRenderingContext2D, d: string, x: number, y: number, fill: string, stroke: string, lw: number) {
  ctx.save()
  ctx.translate(x, y)
  const p = new Path2D(d)
  ctx.fillStyle = fill
  ctx.fill(p)
  ctx.strokeStyle = stroke
  ctx.lineWidth = lw
  ctx.lineJoin = 'round'
  ctx.stroke(p)
  ctx.restore()
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

function drawEffectText(ctx: CanvasRenderingContext2D, card: Card, box: { x: number; y: number; w: number; h: number }) {
  const maxW = box.w - 32
  const maxLines = LAYOUT.textMaxLines
  let size: number = LAYOUT.font.text
  let lines: string[] = []
  for (; size >= LAYOUT.font.textMin; size--) {
    ctx.font = `500 ${size}px ${FONT_UI}`
    lines = wrapText((s) => ctx.measureText(s).width, card.text, maxW)
    if (lines.length <= maxLines) break
  }
  size = Math.max(size, LAYOUT.font.textMin)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    lines[maxLines - 1] = `${lines[maxLines - 1]!.slice(0, -1)}…`
  }
  const lh = size * LAYOUT.font.lineHeight
  const typeSpace = 26
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

// 同步繪製卡面到 500×700 座標系；image 為 null 時畫陣營色塊與物種名
export function drawCardFace(
  ctx: CanvasRenderingContext2D,
  card: Card,
  values: CardFaceValues = {},
  image: HTMLImageElement | ImageBitmap | null = null,
): void {
  const f = FACTION_STYLE[card.faction]
  const L = LAYOUT
  const isCreature = card.type === 'creature'
  ctx.clearRect(0, 0, CARD_W, CARD_H)

  // ① 卡框底
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  bg.addColorStop(0, f.main)
  bg.addColorStop(0.55, f.light)
  bg.addColorStop(1, f.main)
  roundRect(ctx, L.border / 2, L.border / 2, CARD_W - L.border, CARD_H - L.border, L.radius)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.lineWidth = L.border
  ctx.strokeStyle = f.dark
  ctx.stroke()
  const pattern = framePatternPath(card.faction)
  if (pattern) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke(new Path2D(pattern))
    ctx.restore()
  }
  if (card.rarity === 'legendary') drawShape(ctx, SHAPES.crown, 0, -8, '#F0B45A', '#C98A2E', 3)

  // ② 插畫區背景
  const a = L.art
  const artBg = ctx.createRadialGradient(a.x + a.w / 2, a.y + a.h * 0.45, 10, a.x + a.w / 2, a.y + a.h / 2, a.w * 0.7)
  artBg.addColorStop(0, '#FFFFFF')
  artBg.addColorStop(0.6, f.light)
  artBg.addColorStop(1, f.main)
  roundRect(ctx, a.x, a.y, a.w, a.h, a.r)
  ctx.fillStyle = artBg
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(a.x + a.w / 2, a.y + a.h - 28, a.w * 0.25, 16, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(62,53,80,0.15)'
  ctx.fill()

  // ③ 角色圖（contain，可超出上緣）
  if (image) {
    const boxH = a.h + a.overflowTop - 10
    const scale = Math.min(a.w / image.width, boxH / image.height)
    const w = image.width * scale
    const h = image.height * scale
    ctx.drawImage(image, a.x + (a.w - w) / 2, a.y - a.overflowTop + (boxH - h), w, h)
  } else {
    drawIcon(ctx, f.icon, a.x + a.w / 2 - 60, a.y + 70, 120, f.dark)
    ctx.font = `700 28px ${FONT_UI}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = f.dark
    ctx.fillText(card.species, a.x + a.w / 2, a.y + 240, a.w - 40)
  }

  // ④ 名稱緞帶
  const r = L.ribbon
  ctx.beginPath()
  ctx.moveTo(r.x, r.y)
  ctx.lineTo(r.x + r.w, r.y)
  ctx.lineTo(r.x + r.w * 0.96, r.y + r.h / 2)
  ctx.lineTo(r.x + r.w, r.y + r.h)
  ctx.lineTo(r.x, r.y + r.h)
  ctx.lineTo(r.x + r.w * 0.04, r.y + r.h / 2)
  ctx.closePath()
  ctx.fillStyle = '#FFFDF7'
  ctx.fill()
  ctx.font = `800 ${nameFontSize(card.name)}px ${FONT_UI}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.fillText(card.name, r.x + r.w / 2, r.y + r.h / 2 + 2, r.w - 60)

  // ⑤ 效果文字框
  const t = L.text
  const tb = { x: t.x, y: t.y, w: t.w, h: isCreature ? t.h : t.spellBottom - t.y }
  roundRect(ctx, tb.x, tb.y, tb.w, tb.h, t.r)
  ctx.fillStyle = 'rgba(251,246,236,0.9)'
  ctx.fill()
  drawEffectText(ctx, card, tb)

  // ⑥ 費用、攻擊、生命
  drawShape(ctx, SHAPES.cost, L.cost.x, L.cost.y, '#A9D4EC', '#2F5F8A', 5)
  strokedNumber(ctx, String(card.cost), L.cost.x + 48, L.cost.y + 62, card.cost >= 10 ? 48 : L.font.cost, '#FFFFFF', '#234A6E')
  if (isCreature) {
    const atk = values.attack ?? card.attack ?? 0
    const hp = values.health ?? card.health ?? 0
    const color = (v: number, base: number | undefined) =>
      base === undefined || v === base ? '#FFFFFF' : v > base ? '#3E9E5C' : '#D9534F'
    drawShape(ctx, SHAPES.attack, L.attack.x, L.attack.y, '#F6E3A1', INK, 4)
    strokedNumber(ctx, String(atk), L.attack.x + 44, L.attack.y + 46, atk >= 10 ? 48 : L.font.stat, color(atk, card.attack), INK)
    drawShape(ctx, SHAPES.health, L.health.x, L.health.y, '#F2B8C6', INK, 4)
    strokedNumber(ctx, String(hp), L.health.x + 44, L.health.y + 44, hp >= 10 ? 48 : L.font.stat, color(hp, card.health), INK)
    const arrow = (v: number, base: number | undefined, x: number, y: number) => {
      if (base === undefined || v === base) return
      ctx.font = `900 26px ${FONT_NUM}`
      ctx.lineWidth = 3
      ctx.strokeStyle = '#FFFFFF'
      ctx.strokeText(v > base ? '▲' : '▼', x, y)
      ctx.fillStyle = v > base ? '#3E9E5C' : '#D9534F'
      ctx.fillText(v > base ? '▲' : '▼', x, y)
    }
    arrow(atk, card.attack, L.attack.x + 86, L.attack.y + 4)
    arrow(hp, card.health, L.health.x + 2, L.health.y + 4)
  }

  // ⑦ 稀有度寶石、陣營圖示、關鍵字圖示
  const g = L.gem
  const pts = gemPoints(card.rarity, g.cx, g.cy, g.d / 2 - 2)
  ctx.beginPath()
  if (pts) pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  else ctx.arc(g.cx, g.cy, g.d / 2 - 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = RARITY_STYLE[card.rarity].color
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(444, 50, 40, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFDF7'
  ctx.fill()
  drawIcon(ctx, f.icon, 444 - 25, 50 - 25, 50, f.dark)

  cardKeywords(card).forEach((k, i) => {
    const cx = 142 + i * 58
    ctx.beginPath()
    ctx.arc(cx, 40, 26, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFDF7'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = f.dark
    ctx.stroke()
    drawIcon(ctx, k.icon, cx - 17, 40 - 17, 34, INK)
  })
}

// 建立 512×717 卡面 canvas：等字型就緒、載入卡圖後繪製
export async function createCardCanvas(card: Card, values: CardFaceValues = {}): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  await document.fonts?.ready
  const url = cardArtUrl(card.id)
  const image = url ? await loadImage(url) : null
  ctx.scale(TEXTURE_WIDTH / CARD_W, TEXTURE_HEIGHT / CARD_H)
  drawCardFace(ctx, card, values, image)
  return canvas
}

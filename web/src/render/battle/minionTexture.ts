// 場上生物拱窗小卡：切片分層合成底層貼圖與攻血貼圖，同外觀共用（參照計數）
import * as THREE from 'three'
import type { Card, Faction } from '@/content/types'
import { FACTION_STYLE, KEYWORDS, uiImageUrl, type IconDef } from '@/content/cardStyle'
import { alphaBounds, loadImage } from '@/render/cardTexture'
import {
  MINION_CANVAS,
  OVERLAY_SLICES,
  baseKey,
  baseLayers,
  minionArtRect,
  statColors,
  statKey,
  type BaseFlags,
  type BaseLayer,
  type StatLook,
} from './minionLayers'

export type SliceImages = Map<string, HTMLImageElement | null>

const FACTIONS: Faction[] = ['leaf', 'tide', 'frost', 'light', 'neutral']
const FONT_NUM = '"M PLUS Rounded 1c", "Baloo 2", "Noto Sans TC", sans-serif'
const INK = '#3E3550'

// 攻血貼圖只取畫布下緣這一段（2 倍畫布座標）
export const STAT_STRIP = { y: 480, h: 224 }
const STATPLATE = { y: 568 }
const BADGE = { d: 224, cy: 604, ax: 120, hx: 456 }
// 拱頂關鍵字圖示
const KW = { d: 104, cy: 60, gap: 112 }

export function minionSlicePaths(): string[] {
  return [
    ...FACTIONS.flatMap((f) => [`minion/minion-window-${f}`, `minion/minion-frame-${f}`]),
    'minion/minion-exhausted',
    'minion/ov-stealth',
    'minion/minion-statplate',
    ...Object.values(OVERLAY_SLICES),
    'icons/icon-attack',
    'icons/icon-health',
  ]
}

// 切片以 @2x 預載一次，載入失敗記為 null
export async function loadMinionSlices(): Promise<SliceImages> {
  const map: SliceImages = new Map()
  await Promise.all(
    minionSlicePaths().map(async (p) => {
      const url = uiImageUrl(p, true)
      map.set(p, url ? await loadImage(url) : null)
    }),
  )
  return map
}

// 切片缺圖時的拱窗外形
function archPath(): Path2D {
  const p = new Path2D()
  const x0 = 40
  const x1 = MINION_CANVAS.w - 40
  const top = 40
  const bottom = MINION_CANVAS.h - 40
  const r = (x1 - x0) / 2
  p.moveTo(x0, bottom)
  p.lineTo(x0, top + r)
  p.arc((x0 + x1) / 2, top + r, r, Math.PI, 0)
  p.lineTo(x1, bottom)
  p.closePath()
  return p
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
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.stroke(path)
  }
  ctx.restore()
}

let artCanvas: HTMLCanvasElement | null = null

// 插畫用拱窗遮罩裁切，潛藏降透明度、已攻擊去飽和
function drawArt(
  ctx: CanvasRenderingContext2D,
  card: Card,
  layer: Extract<BaseLayer, { kind: 'art' }>,
  image: HTMLImageElement | null,
  mask: HTMLImageElement | null,
) {
  const { w, h } = MINION_CANVAS
  artCanvas ??= document.createElement('canvas')
  artCanvas.width = w
  artCanvas.height = h
  const a = artCanvas.getContext('2d')
  if (!a) return
  a.clearRect(0, 0, w, h)
  if (layer.saturation < 1) a.filter = `saturate(${layer.saturation}) brightness(0.92)`
  if (image) {
    const r = minionArtRect(alphaBounds(image), image.width, image.height)
    a.drawImage(image, r.x, r.y, r.w, r.h)
  } else {
    const f = FACTION_STYLE[card.faction]
    drawIcon(a, f.icon, w / 2 - 110, h / 2 - 150, 220, f.dark)
  }
  a.filter = 'none'
  a.globalCompositeOperation = 'destination-in'
  if (mask) a.drawImage(mask, 0, 0, w, h)
  else a.fill(archPath())
  a.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = layer.alpha
  ctx.drawImage(artCanvas, 0, 0)
  ctx.globalAlpha = 1
}

function drawKeywords(ctx: CanvasRenderingContext2D, faction: Faction, icons: string[], more: number) {
  const items: (string | number)[] = [...icons, ...(more > 0 ? [more] : [])]
  const x0 = MINION_CANVAS.w / 2 - ((items.length - 1) * KW.gap) / 2
  items.forEach((item, i) => {
    const cx = x0 + i * KW.gap
    ctx.beginPath()
    ctx.arc(cx, KW.cy, KW.d / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFDF7'
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = FACTION_STYLE[faction].dark
    ctx.stroke()
    if (typeof item === 'string') {
      const icon = KEYWORDS[item]?.icon
      if (icon) drawIcon(ctx, icon, cx - KW.d * 0.31, KW.cy - KW.d * 0.31, KW.d * 0.62, INK)
    } else {
      ctx.font = `800 ${KW.d * 0.42}px ${FONT_NUM}`
      ctx.fillStyle = INK
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`+${item}`, cx, KW.cy + 2)
    }
  })
}

// 底層：窗底、插畫、薄紗與霧紗、外框、拱頂關鍵字
export function drawMinionBase(
  ctx: CanvasRenderingContext2D,
  card: Card,
  flags: BaseFlags,
  keywords: string[],
  image: HTMLImageElement | null,
  slices: SliceImages,
) {
  const { w, h } = MINION_CANVAS
  const f = FACTION_STYLE[card.faction]
  ctx.clearRect(0, 0, w, h)
  const mask = slices.get(`minion/minion-window-${card.faction}`) ?? null
  for (const layer of baseLayers(card.faction, flags, keywords)) {
    if (layer.kind === 'art') drawArt(ctx, card, layer, image, mask)
    else if (layer.kind === 'keywords') drawKeywords(ctx, card.faction, layer.icons, layer.more)
    else {
      const img = slices.get(layer.path) ?? null
      if (img) {
        ctx.globalAlpha = layer.alpha
        ctx.drawImage(img, 0, 0, w, h)
        ctx.globalAlpha = 1
      } else if (layer.path.includes('window')) {
        ctx.fillStyle = f.light
        ctx.fill(archPath())
      } else if (layer.path.includes('frame')) {
        ctx.lineWidth = 16
        ctx.strokeStyle = f.dark
        ctx.stroke(archPath())
      }
    }
  }
}

function statNumber(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, color: string) {
  const size = BADGE.d * (n >= 10 ? 0.42 : 0.5)
  ctx.font = `800 ${size}px ${FONT_NUM}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = BADGE.d / 7
  ctx.strokeStyle = INK
  ctx.strokeText(String(n), cx, cy)
  ctx.fillStyle = color
  ctx.fillText(String(n), cx, cy)
}

// 攻血：底座、攻擊在左、生命在右，數字顏色沿用卡面 tone
export function drawMinionStats(ctx: CanvasRenderingContext2D, card: Card, look: StatLook, slices: SliceImages) {
  const { w } = MINION_CANVAS
  ctx.clearRect(0, 0, w, STAT_STRIP.h)
  ctx.save()
  ctx.translate(0, -STAT_STRIP.y)
  const plate = slices.get('minion/minion-statplate') ?? null
  if (plate) ctx.drawImage(plate, (w - plate.width) / 2, STATPLATE.y, plate.width, plate.height)
  const colors = statColors(card, look)
  const half = BADGE.d / 2
  const atk = slices.get('icons/icon-attack') ?? null
  const hp = slices.get('icons/icon-health') ?? null
  if (atk) ctx.drawImage(atk, BADGE.ax - half, BADGE.cy - half, BADGE.d, BADGE.d)
  if (hp) ctx.drawImage(hp, BADGE.hx - half, BADGE.cy - half, BADGE.d, BADGE.d)
  statNumber(ctx, look.attack, BADGE.ax, BADGE.cy, colors.attack)
  statNumber(ctx, look.health, BADGE.hx, BADGE.cy, colors.health)
  ctx.restore()
}

interface Entry {
  texture: THREE.CanvasTexture
  refs: number
}

export interface Lease {
  key: string
  texture: THREE.CanvasTexture
}

export class MinionTextureCache {
  private readonly entries = new Map<string, Entry>()
  private readonly cards: Record<string, Card>
  private readonly images: Map<string, HTMLImageElement | null>
  private readonly slices: SliceImages
  private readonly anisotropy: number

  constructor(cards: Record<string, Card>, images: Map<string, HTMLImageElement | null>, slices: SliceImages, anisotropy: number) {
    this.cards = cards
    this.images = images
    this.slices = slices
    this.anisotropy = anisotropy
  }

  private lease(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Lease {
    let entry = this.entries.get(key)
    if (!entry) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) draw(ctx)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = this.anisotropy
      entry = { texture, refs: 0 }
      this.entries.set(key, entry)
    }
    entry.refs++
    return { key, texture: entry.texture }
  }

  acquireBase(cardId: string, flags: BaseFlags, keywords: string[]): Lease {
    const card = this.cards[cardId]
    return this.lease(`base|${baseKey(cardId, flags, keywords)}`, MINION_CANVAS.w, MINION_CANVAS.h, (ctx) => {
      if (card) drawMinionBase(ctx, card, flags, keywords, this.images.get(cardId) ?? null, this.slices)
    })
  }

  acquireStats(cardId: string, look: StatLook): Lease {
    const card = this.cards[cardId]
    const key = card ? statKey(card, look) : `${cardId}|${look.attack}|${look.health}`
    return this.lease(`stat|${key}`, MINION_CANVAS.w, STAT_STRIP.h, (ctx) => {
      if (card) drawMinionStats(ctx, card, look, this.slices)
    })
  }

  release(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    entry.refs--
    if (entry.refs <= 0) {
      entry.texture.dispose()
      this.entries.delete(key)
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) e.texture.dispose()
    this.entries.clear()
  }
}

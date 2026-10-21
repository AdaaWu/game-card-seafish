// 場上生物外觀：橢圓頭像框＋角色圖＋攻擊／生命，同外觀共用貼圖（參照計數）
import * as THREE from 'three'
import type { Card } from '@/content/types'
import { FACTION_STYLE, KEYWORDS, SHAPES, attackTone, healthTone, type IconDef, type StatTone } from '@/content/cardStyle'

// 繪製座標維持 256×320，貼圖放大 1.5 倍供高 DPR 螢幕使用
const DRAW_W = 256
const DRAW_H = 320
const TEX_SCALE = 1.5
export const MINION_TEX_W = DRAW_W * TEX_SCALE
export const MINION_TEX_H = DRAW_H * TEX_SCALE

export interface MinionLook {
  attack: number
  health: number
  maxHealth: number
  keywords: string[]
}

const FONT_NUM = '"M PLUS Rounded 1c", "Baloo 2", "Noto Sans TC", sans-serif'
const INK = '#3E3550'
const TONE_COLOR: Record<StatTone, string> = { up: '#7EE29A', down: '#FF8F8B', same: '#FFFFFF' }

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

// 守護改為貝殼盾形外框，其餘為橢圓
function framePath(taunt: boolean): Path2D {
  const p = new Path2D()
  if (taunt) {
    p.moveTo(128, 22)
    p.bezierCurveTo(190, 22, 232, 44, 236, 70)
    p.bezierCurveTo(240, 170, 210, 240, 128, 292)
    p.bezierCurveTo(46, 240, 16, 170, 20, 70)
    p.bezierCurveTo(24, 44, 66, 22, 128, 22)
    p.closePath()
  } else {
    p.ellipse(128, 152, 104, 132, 0, 0, Math.PI * 2)
  }
  return p
}

function badge(ctx: CanvasRenderingContext2D, d: string, x: number, y: number, scale: number, fill: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  const p = new Path2D(d)
  ctx.fillStyle = fill
  ctx.fill(p)
  ctx.lineWidth = 4
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  ctx.stroke(p)
  ctx.restore()
}

function number(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, color: string) {
  ctx.font = `800 ${n >= 10 ? 40 : 48}px ${FONT_NUM}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 8
  ctx.strokeStyle = INK
  ctx.strokeText(String(n), cx, cy)
  ctx.fillStyle = color
  ctx.fillText(String(n), cx, cy)
}

export function drawMinion(ctx: CanvasRenderingContext2D, card: Card, look: MinionLook, image: HTMLImageElement | null) {
  const f = FACTION_STYLE[card.faction]
  const taunt = look.keywords.includes('taunt')
  ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0)
  ctx.clearRect(0, 0, DRAW_W, DRAW_H)
  const frame = framePath(taunt)
  const bg = ctx.createRadialGradient(128, 130, 10, 128, 150, 150)
  bg.addColorStop(0, '#FFFFFF')
  bg.addColorStop(0.6, f.light)
  bg.addColorStop(1, f.main)
  ctx.fillStyle = bg
  ctx.fill(frame)
  if (image) {
    ctx.save()
    ctx.clip(frame)
    const box = 230
    const s = Math.min(box / image.width, box / image.height)
    const w = image.width * s
    const h = image.height * s
    ctx.drawImage(image, 128 - w / 2, 165 - h / 2, w, h)
    ctx.restore()
  } else {
    drawIcon(ctx, f.icon, 78, 90, 100, f.dark)
  }
  ctx.lineWidth = taunt ? 14 : 10
  ctx.strokeStyle = taunt ? '#6E5F80' : f.dark
  ctx.stroke(frame)

  // 關鍵字圖示：最多 4 個，超過顯示 +N
  const kws = look.keywords.filter((k) => KEYWORDS[k])
  const shown = kws.slice(0, kws.length > 4 ? 3 : 4)
  const total = shown.length + (kws.length > 4 ? 1 : 0)
  const startX = 128 - ((total - 1) * 44) / 2
  shown.forEach((k, i) => {
    const cx = startX + i * 44
    ctx.beginPath()
    ctx.arc(cx, 26, 20, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFDF7'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = f.dark
    ctx.stroke()
    drawIcon(ctx, KEYWORDS[k]!.icon, cx - 13, 13, 26, INK)
  })
  if (kws.length > 4) {
    const cx = startX + 3 * 44
    ctx.beginPath()
    ctx.arc(cx, 26, 20, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFDF7'
    ctx.fill()
    ctx.font = `800 20px ${FONT_NUM}`
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+${kws.length - 3}`, cx, 27)
  }

  // 攻擊（左下）與生命（右下），變色規則與卡面共用
  const atkColor = TONE_COLOR[attackTone(look.attack, card.attack ?? 0)]
  const hpTone = healthTone(look.health, look.maxHealth, card.health ?? 0)
  const hurt = hpTone === 'down'
  const hpColor = TONE_COLOR[hpTone]
  badge(ctx, SHAPES.attack, 2, 226, 1.05, '#F6E3A1')
  number(ctx, look.attack, 48, 274, atkColor)
  badge(ctx, SHAPES.health, 160, 226, 1.05, '#F2B8C6')
  number(ctx, look.health, 206, 270, hpColor)
  if (hurt) {
    ctx.save()
    ctx.translate(222, 214)
    ctx.strokeStyle = INK
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke(new Path2D('M0 0L10 12L4 18L16 30'))
    ctx.restore()
  }
}

const lookKey = (cardId: string, l: MinionLook) => `${cardId}|${l.attack}|${l.health}|${l.maxHealth}|${l.keywords.join(',')}`

interface Entry {
  texture: THREE.CanvasTexture
  refs: number
}

export class MinionTextureCache {
  private readonly entries = new Map<string, Entry>()

  private readonly cards: Record<string, Card>
  private readonly images: Map<string, HTMLImageElement | null>
  private readonly anisotropy: number

  constructor(cards: Record<string, Card>, images: Map<string, HTMLImageElement | null>, anisotropy: number) {
    this.cards = cards
    this.images = images
    this.anisotropy = anisotropy
  }

  acquire(cardId: string, look: MinionLook): { key: string; texture: THREE.CanvasTexture } {
    const key = lookKey(cardId, look)
    let entry = this.entries.get(key)
    if (!entry) {
      const canvas = document.createElement('canvas')
      canvas.width = MINION_TEX_W
      canvas.height = MINION_TEX_H
      const ctx = canvas.getContext('2d')
      const card = this.cards[cardId]
      if (ctx && card) drawMinion(ctx, card, look, this.images.get(cardId) ?? null)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = this.anisotropy
      entry = { texture, refs: 0 }
      this.entries.set(key, entry)
    }
    entry.refs++
    return { key, texture: entry.texture }
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

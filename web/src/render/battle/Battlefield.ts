// three.js 戰場：海底背景、雙方 6 格場地、場上生物與特效；以版面的邏輯座標對外
import * as THREE from 'three'
import gsap from 'gsap'
import type { Card, PlayerId } from '@/engine'
import type { ShakeLevel } from '@/fx/animationPlan'
import type { ViewMinion } from './viewModel'
import { MinionTextureCache } from './minionTexture'
import { assetUrls } from '@/content/assetUrls'
import { DESIGN_H, DESIGN_W, LANE_W, MINION_H as MINION_LOGICAL_H, ROW_OFFSET } from './battleLayout'
import { insertPreview } from './insertPreview'

const FOV = 30
const CAM_Z = 30
const VISIBLE_H = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
// 邏輯 px 與世界單位固定比例；舞台變高時鏡頭拉遠，生物大小不變
const PX_PER_UNIT = DESIGN_H / VISIBLE_H

const px = (n: number) => n / PX_PER_UNIT
// 世界原點為潮汐分隔線中心
const ROW_Y: Record<PlayerId, number> = { p1: -px(ROW_OFFSET), p2: px(ROW_OFFSET) }
const SPACING = px(168)
const MINION_W = px(140)
const MINION_H = px(MINION_LOGICAL_H)
const BURST_POOL = 24
const MAX_BOARD = 6
// 預留卡位讓位動畫秒數
const MAKE_ROOM_S = 0.18
const BUBBLE_COUNT = 30
const SHAKE_PX: Record<ShakeLevel, [number, number]> = { none: [0, 0], light: [4, 120], medium: [8, 200], heavy: [14, 320] }

interface MinionObj {
  id: string
  pid: PlayerId
  root: THREE.Group
  // 事件動畫（受擊、選取、搖頭）用的子層，不做待機漂浮
  bob: THREE.Group
  card: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  ready: THREE.Mesh
  highlight: THREE.Mesh
  ice: THREE.Mesh
  bubble: THREE.Mesh
  key: string
  vm: ViewMinion
}

function radialTexture(inner: string, outer: string, size = 128, ring = false): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  if (ring) {
    const g = ctx.createRadialGradient(r, r, r * 0.55, r, r, r)
    g.addColorStop(0, 'rgba(255,255,255,0.05)')
    g.addColorStop(0.8, inner)
    g.addColorStop(0.92, outer)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    ctx.beginPath()
    ctx.ellipse(r * 0.7, r * 0.6, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fill()
  } else {
    const g = ctx.createRadialGradient(r, r, 0, r, r, r)
    g.addColorStop(0, inner)
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function iceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 160
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.roundRect(6, 6, 116, 148, 18)
  const g = ctx.createLinearGradient(0, 0, 128, 160)
  g.addColorStop(0, 'rgba(220,240,255,0.75)')
  g.addColorStop(1, 'rgba(160,200,240,0.55)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.stroke()
  ctx.strokeStyle = '#5B7FC2'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.translate(100, 28)
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3)
    ctx.beginPath()
    ctx.moveTo(-14, 0)
    ctx.lineTo(14, 0)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// 預留卡位：圓角卡形，fill 為奶白底、edge 為白色虛線外框（由材質上色）
function slotTexture(kind: 'fill' | 'edge'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 280
  c.height = 350
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.roundRect(8, 8, 264, 334, 30)
  if (kind === 'fill') {
    ctx.fillStyle = '#fffaf0'
    ctx.fill()
  } else {
    ctx.setLineDash([22, 14])
    ctx.lineWidth = 8
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// 場地底色：四邊淡出的柔邊橢圓漸層
function laneTexture(): THREE.CanvasTexture {
  const w = 256
  const h = 128
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.scale(1, h / w)
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
  g.addColorStop(0, 'rgba(242,250,251,0.22)')
  g.addColorStop(0.6, 'rgba(242,250,251,0.12)')
  g.addColorStop(1, 'rgba(242,250,251,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, w)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// 潮汐分隔線：兩端淡出的柔邊波紋
function dividerTexture(): THREE.CanvasTexture {
  const w = 1024
  const h = 16
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, 'rgba(242,250,251,0)')
  g.addColorStop(0.2, 'rgba(242,250,251,0.7)')
  g.addColorStop(0.8, 'rgba(242,250,251,0.7)')
  g.addColorStop(1, 'rgba(242,250,251,0)')
  ctx.strokeStyle = g
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(242,250,251,0.8)'
  ctx.shadowBlur = 4
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let x = 0; x <= w; x += 4) {
    const y = h / 2 + Math.sin((x / w) * Math.PI * 12) * 3
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function backgroundTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, '#E4F4F1')
  g.addColorStop(0.45, '#C6E4EE')
  g.addColorStop(0.8, '#B3D2E8')
  g.addColorStop(1, '#C8C1E6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class Battlefield {
  readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(FOV, DESIGN_W / DESIGN_H, 0.1, 200)
  private readonly rig = new THREE.Group()
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private readonly tmp = new THREE.Vector3()
  private readonly timer = new THREE.Timer()
  private readonly resizeObserver: ResizeObserver
  private readonly minions = new Map<string, MinionObj>()
  private readonly order: Record<PlayerId, string[]> = { p1: [], p2: [] }
  private readonly textures: MinionTextureCache
  private readonly disposables: { dispose(): void }[] = []

  private readonly cardGeo = new THREE.PlaneGeometry(MINION_W, MINION_H)
  private readonly ringGeo = new THREE.RingGeometry(0.92, 1.04, 48)
  private readonly iceGeo = new THREE.PlaneGeometry(MINION_W * 1.08, MINION_H * 1.02)
  private readonly bubbleGeo = new THREE.PlaneGeometry(MINION_W * 1.35, MINION_H * 1.2)
  // 可攻擊：腳下柔光
  private readonly readyGeo = new THREE.PlaneGeometry(1, 1)
  private readonly readyMat = new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(95,200,120,1)', 'rgba(127,216,143,0)'),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  private readonly highlightMat = new THREE.MeshBasicMaterial({ color: 0xf6e3a1, transparent: true, opacity: 0.9, depthWrite: false })
  private readonly selectedMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false })
  private readonly iceMat: THREE.MeshBasicMaterial
  private readonly bubbleMat: THREE.MeshBasicMaterial
  private readonly burstMat: THREE.SpriteMaterial
  private readonly burst: THREE.Sprite[] = []
  private burstCursor = 0
  private readonly slot = new THREE.Group()
  private readonly slotEdgeMat: THREE.MeshBasicMaterial
  private previewIndex: number | null = null
  private readonly ripple: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private readonly bubbles: THREE.Points
  private readonly bubbleSpeed = new Float32Array(BUBBLE_COUNT)
  private readonly spots: THREE.Sprite[] = []
  private selectedId: string | null = null
  private reducedMotion: boolean
  private lw = DESIGN_W
  private lh = DESIGN_H
  private boardCy = DESIGN_H / 2
  private readonly camBase = new THREE.Vector3(0, 0, CAM_Z)
  private bubbleHalf = { x: 15, y: 9 }

  private readonly container: HTMLElement
  // 對戰背景圖：載入前顯示漸層，依舞台長寬比切換橫式與直式
  private readonly bgFallback: THREE.CanvasTexture
  private readonly bgImages: Partial<Record<'landscape' | 'portrait', THREE.Texture>> = {}
  private disposed = false

  constructor(container: HTMLElement, cards: Record<string, Card>, images: Map<string, HTMLImageElement | null>) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)
    this.textures = new MinionTextureCache(cards, images, this.renderer.capabilities.getMaxAnisotropy())
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    this.camera.position.set(0, 0, CAM_Z)
    this.rig.add(this.camera)
    this.scene.add(this.rig)

    this.bgFallback = backgroundTexture()
    this.scene.background = this.bgFallback
    this.disposables.push(this.bgFallback)
    this.loadBackgrounds()

    const iceTex = iceTexture()
    this.iceMat = new THREE.MeshBasicMaterial({ map: iceTex, transparent: true, depthWrite: false })
    const bubbleTex = radialTexture('rgba(200,230,255,0.35)', 'rgba(255,220,250,0.9)', 128, true)
    this.bubbleMat = new THREE.MeshBasicMaterial({ map: bubbleTex, transparent: true, depthWrite: false, opacity: 0.85 })
    this.burstMat = new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false })
    const spotTex = radialTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)')
    this.disposables.push(iceTex, bubbleTex, spotTex)

    // 柔和光斑
    const spotMat = new THREE.SpriteMaterial({ map: spotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.08 })
    this.disposables.push(spotMat)
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(spotMat)
      const size = 6 + i * 1.5
      s.scale.set(size, size, 1)
      s.position.set(-11 + i * 5.5, 5 - (i % 2) * 7, -10)
      s.userData.phase = i * 1.3
      this.spots.push(s)
      this.scene.add(s)
    }

    // 少量氣泡粒子
    const positions = new Float32Array(BUBBLE_COUNT * 3)
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 17
      positions[i * 3 + 2] = -2 - Math.random() * 3
      this.bubbleSpeed[i] = 0.3 + Math.random() * 0.5
    }
    const bubbleGeo = new THREE.BufferGeometry()
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pointsMat = new THREE.PointsMaterial({ map: bubbleTex, size: 0.32, transparent: true, depthWrite: false, opacity: 0.8 })
    this.bubbles = new THREE.Points(bubbleGeo, pointsMat)
    this.scene.add(this.bubbles)
    this.disposables.push(bubbleGeo, pointsMat)

    // 潮汐分隔線
    const dividerTex = dividerTexture()
    const dividerGeo = new THREE.PlaneGeometry(px(LANE_W + 200), px(16))
    const dividerMat = new THREE.MeshBasicMaterial({ map: dividerTex, transparent: true, depthWrite: false })
    const divider = new THREE.Mesh(dividerGeo, dividerMat)
    divider.position.set(0, 0, -0.5)
    this.scene.add(divider)
    this.disposables.push(dividerTex, dividerGeo, dividerMat)

    // 雙方場地底色
    const laneTex = laneTexture()
    const laneGeo = new THREE.PlaneGeometry(px(LANE_W), px(210))
    const laneMat = new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, depthWrite: false })
    for (const pid of ['p1', 'p2'] as const) {
      const lane = new THREE.Mesh(laneGeo, laneMat)
      lane.position.set(0, ROW_Y[pid], -0.6)
      this.scene.add(lane)
    }
    this.disposables.push(laneTex, laneGeo, laneMat)

    const slotFill = slotTexture('fill')
    const slotEdge = slotTexture('edge')
    const slotFillMat = new THREE.MeshBasicMaterial({ map: slotFill, transparent: true, opacity: 0.4, depthWrite: false })
    this.slotEdgeMat = new THREE.MeshBasicMaterial({ map: slotEdge, transparent: true, opacity: 0.5, depthWrite: false })
    this.slot.add(new THREE.Mesh(this.cardGeo, slotFillMat), new THREE.Mesh(this.cardGeo, this.slotEdgeMat))
    this.slot.visible = false
    this.scene.add(this.slot)
    this.disposables.push(slotFill, slotEdge, slotFillMat, this.slotEdgeMat)

    const rippleGeo = new THREE.RingGeometry(0.8, 1, 48)
    const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
    this.ripple = new THREE.Mesh(rippleGeo, rippleMat)
    this.scene.add(this.ripple)
    this.disposables.push(rippleGeo, rippleMat)

    for (let i = 0; i < BURST_POOL; i++) {
      const s = new THREE.Sprite(this.burstMat)
      s.visible = false
      s.renderOrder = 20
      this.burst.push(s)
      this.scene.add(s)
    }

    this.disposables.push(
      this.cardGeo,
      this.ringGeo,
      this.iceGeo,
      this.bubbleGeo,
      this.readyGeo,
      this.readyMat.map!,
      this.readyMat,
      this.highlightMat,
      this.selectedMat,
      this.iceMat,
      this.bubbleMat,
      this.burstMat,
    )

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.fitBackground()
  }

  private loadBackgrounds(): void {
    const loader = new THREE.TextureLoader()
    for (const kind of ['landscape', 'portrait'] as const) {
      const url = assetUrls[`backgrounds/bg-battle-${kind}.webp`]
      if (!url) continue
      loader.load(url, (tex) => {
        if (this.disposed) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        this.bgImages[kind] = tex
        this.disposables.push(tex)
        this.fitBackground()
      })
    }
  }

  // cover 裁切：圖比舞台寬就裁左右，比舞台高就裁上下
  private fitBackground(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    const stage = w / h
    const tex = this.bgImages[stage >= 1 ? 'landscape' : 'portrait']
    if (!tex) return
    const img = tex.image as { width: number; height: number }
    const ratio = img.width / img.height
    if (ratio > stage) {
      tex.repeat.set(stage / ratio, 1)
      tex.offset.set((1 - stage / ratio) / 2, 0)
    } else {
      tex.repeat.set(1, ratio / stage)
      tex.offset.set(0, (1 - ratio / stage) / 2)
    }
    this.scene.background = tex
  }

  // 依版面的邏輯尺寸調整鏡頭距離與高度，讓分隔線落在 boardCy
  setView(lw: number, lh: number, boardCy: number): void {
    this.lw = lw
    this.lh = lh
    this.boardCy = boardCy
    this.camBase.set(0, px(boardCy - lh / 2), (CAM_Z * lh) / DESIGN_H)
    gsap.killTweensOf(this.camera.position)
    this.camera.position.copy(this.camBase)
    this.camera.aspect = lw / lh
    this.camera.updateProjectionMatrix()
    this.bubbleHalf = { x: px(lw) / 2, y: px(lh) / 2 + 1 }
    const pos = this.bubbles.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 2 * this.bubbleHalf.x
      arr[i * 3 + 1] = this.camBase.y + (Math.random() - 0.5) * 2 * this.bubbleHalf.y
    }
    pos.needsUpdate = true
  }

  // 重新開局：清空場上並把鏡頭歸位
  reset(): void {
    for (const id of [...this.minions.keys()]) this.destroyMinion(id)
    this.order.p1 = []
    this.order.p2 = []
    this.selectedId = null
    this.slot.visible = false
    this.previewIndex = null
    gsap.killTweensOf(this.camera.position)
    this.camera.position.copy(this.camBase)
  }

  private frame(): void {
    this.timer.update()
    const dt = Math.min(this.timer.getDelta(), 0.1)
    const t = this.timer.getElapsed()
    this.highlightMat.opacity = 0.6 + 0.35 * Math.sin(t * ((2 * Math.PI) / 1.2))
    // 預留卡位只做外框透明度脈動
    this.slotEdgeMat.opacity = 0.42 + 0.12 * Math.sin(t * ((2 * Math.PI) / 1.6))
    if (!this.reducedMotion) this.readyMat.opacity = 0.8 + 0.2 * Math.sin(t * ((2 * Math.PI) / 1.6))
    const pos = this.bubbles.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      arr[i * 3 + 1]! += this.bubbleSpeed[i]! * dt
      arr[i * 3]! += Math.sin(t + i) * 0.002
      if (arr[i * 3 + 1]! > this.camBase.y + this.bubbleHalf.y) arr[i * 3 + 1] = this.camBase.y - this.bubbleHalf.y
    }
    pos.needsUpdate = true
    for (const s of this.spots) {
      const p = s.userData.phase as number
      s.material.opacity = 0.08 + 0.03 * Math.sin(t * 0.4 + p)
      s.position.x += Math.sin(t * 0.1 + p) * 0.002
    }
    this.renderer.render(this.scene, this.camera)
  }

  // ---------- 座標 ----------

  logicalToWorld(x: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(px(x - this.lw / 2), px(this.boardCy - y), 0)
  }

  worldToLogical(v: THREE.Vector3): { x: number; y: number } {
    this.tmp.copy(v).project(this.camera)
    return { x: ((this.tmp.x + 1) / 2) * this.lw, y: ((1 - this.tmp.y) / 2) * this.lh }
  }

  minionLogical(id: string): { x: number; y: number } | null {
    const m = this.minions.get(id)
    if (!m) return null
    m.root.getWorldPosition(this.tmp)
    return this.worldToLogical(this.tmp)
  }

  homeX(index: number, count: number): number {
    return (index - (count - 1) / 2) * SPACING
  }

  pick(x: number, y: number): string | null {
    this.ndc.set((x / this.lw) * 2 - 1, -((y / this.lh) * 2 - 1))
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const meshes: THREE.Object3D[] = []
    for (const m of this.minions.values()) meshes.push(m.card)
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    return (hit?.object.userData.instanceId as string | undefined) ?? null
  }

  // 依 x 座標算出我方插入位置
  insertIndexAt(x: number): number {
    const wx = px(x - this.lw / 2)
    const ids = this.order.p1
    let index = 0
    ids.forEach((id, i) => {
      if (this.homeX(i, ids.length) < wx) index = i + 1
      void id
    })
    return index
  }

  isOverRow(pid: PlayerId, y: number): boolean {
    return Math.abs(px(this.boardCy - y) - ROW_Y[pid]) < MINION_H * 0.75
  }

  // 我方插入位置顯示預留卡位，左右生物讓位；null 或場地已滿時收起並滑回原位
  showInsertPreview(index: number | null, color?: string): void {
    const ids = this.order.p1
    const preview = index === null ? null : insertPreview(ids.length, index, SPACING, MAX_BOARD)
    if (!preview) {
      if (this.previewIndex !== null) this.layout('p1', MAKE_ROOM_S)
      this.previewIndex = null
      this.slot.visible = false
      return
    }
    if (color) this.slotEdgeMat.color.set(color)
    if (this.previewIndex === index && this.slot.visible) return
    this.previewIndex = index
    ids.forEach((id, i) => {
      const m = this.minions.get(id)
      if (m) gsap.to(m.root.position, { x: preview.minionX[i], duration: MAKE_ROOM_S, ease: 'power2.out', overwrite: 'auto' })
    })
    this.slot.position.set(preview.slotX, ROW_Y.p1, -0.05)
    this.slot.visible = true
  }

  // ---------- 狀態外觀 ----------

  setReady(ids: ReadonlySet<string>): void {
    for (const m of this.minions.values()) m.ready.visible = ids.has(m.id)
  }

  setHighlights(ids: ReadonlySet<string>): void {
    for (const m of this.minions.values()) m.highlight.visible = ids.has(m.id)
  }

  setSelected(id: string | null): void {
    if (this.selectedId === id) return
    const prev = this.selectedId ? this.minions.get(this.selectedId) : undefined
    if (prev) gsap.to(prev.bob.position, { z: 0, duration: 0.12 })
    this.selectedId = id
    const next = id ? this.minions.get(id) : undefined
    if (next) gsap.to(next.bob.position, { z: px(30), duration: 0.12 })
  }

  // ---------- 生物 ----------

  private createMinion(pid: PlayerId, vm: ViewMinion): MinionObj {
    const root = new THREE.Group()
    const bob = new THREE.Group()
    root.add(bob)
    const { key, texture } = this.textures.acquire(vm.cardId, vm)
    const card = new THREE.Mesh(this.cardGeo, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }))
    card.userData.instanceId = vm.instanceId
    card.renderOrder = 10
    const ready = new THREE.Mesh(this.readyGeo, this.readyMat)
    ready.scale.set(MINION_W * 1.2, MINION_H * 0.36, 1)
    ready.position.set(0, -MINION_H * 0.5, -0.02)
    ready.visible = false
    const highlight = new THREE.Mesh(this.ringGeo, this.highlightMat)
    highlight.scale.set(MINION_W * 0.64, MINION_H * 0.6, 1)
    highlight.position.z = -0.01
    highlight.visible = false
    const ice = new THREE.Mesh(this.iceGeo, this.iceMat)
    ice.position.z = 0.05
    ice.renderOrder = 12
    ice.visible = vm.frozen
    const bubble = new THREE.Mesh(this.bubbleGeo, this.bubbleMat)
    bubble.position.z = 0.08
    bubble.renderOrder = 13
    bubble.visible = vm.keywords.includes('bubble')
    bob.add(ready, highlight, card, ice, bubble)
    this.scene.add(root)
    const obj: MinionObj = { id: vm.instanceId, pid, root, bob, card, ready, highlight, ice, bubble, key, vm: { ...vm } }
    this.minions.set(vm.instanceId, obj)
    return obj
  }

  private destroyMinion(id: string): void {
    const m = this.minions.get(id)
    if (!m) return
    gsap.killTweensOf([m.root.position, m.root.scale, m.root.rotation, m.bob.position, m.bob.scale, m.card.material.color, m.card.material])
    this.scene.remove(m.root)
    m.card.material.dispose()
    this.textures.release(m.key)
    this.minions.delete(id)
    for (const pid of ['p1', 'p2'] as const) this.order[pid] = this.order[pid].filter((x) => x !== id)
    if (this.selectedId === id) this.selectedId = null
  }

  updateMinion(vm: ViewMinion): void {
    const m = this.minions.get(vm.instanceId)
    if (!m) return
    m.vm = { ...vm, keywords: [...vm.keywords] }
    const { key, texture } = this.textures.acquire(vm.cardId, vm)
    if (key !== m.key) {
      m.card.material.map = texture
      m.card.material.needsUpdate = true
      this.textures.release(m.key)
      m.key = key
    } else {
      this.textures.release(key)
    }
    m.bubble.visible = vm.keywords.includes('bubble')
    m.ice.visible = vm.frozen
  }

  layout(pid: PlayerId, seconds = 0.25, skip?: string): void {
    const ids = this.order[pid]
    ids.forEach((id, i) => {
      const m = this.minions.get(id)
      if (!m || id === skip) return
      const x = this.homeX(i, ids.length)
      if (seconds <= 0) m.root.position.set(x, ROW_Y[pid], 0)
      else gsap.to(m.root.position, { x, y: ROW_Y[pid], z: 0, duration: seconds, ease: 'power2.out', overwrite: 'auto' })
    })
  }

  // 以顯示狀態校正場上生物（動畫結束後同步用）
  sync(board: Record<PlayerId, ViewMinion[]>): void {
    const keep = new Set([...board.p1, ...board.p2].map((m) => m.instanceId))
    for (const id of [...this.minions.keys()]) if (!keep.has(id)) this.destroyMinion(id)
    for (const pid of ['p1', 'p2'] as const) {
      for (const vm of board[pid]) {
        const existing = this.minions.get(vm.instanceId)
        if (existing) this.updateMinion(vm)
        else {
          const m = this.createMinion(pid, vm)
          m.root.position.set(0, ROW_Y[pid], 0)
        }
      }
      this.order[pid] = board[pid].map((m) => m.instanceId)
      this.layout(pid, 0.25)
    }
  }

  // ---------- 動畫：皆回傳 timeline，由佇列控制速度 ----------

  tlSummon(pid: PlayerId, vm: ViewMinion, position: number, onLand: (resume: () => void) => void): gsap.core.Timeline {
    const m = this.createMinion(pid, vm)
    const ids = this.order[pid]
    ids.splice(Math.min(position, ids.length), 0, m.id)
    const x = this.homeX(ids.indexOf(m.id), ids.length)
    const y = ROW_Y[pid]
    this.layout(pid, 0.25, m.id)
    m.root.position.set(x * 0.4, pid === 'p1' ? -px(300) : px(300), px(80))
    m.root.scale.setScalar(1.25)
    m.card.material.opacity = 0
    const tl = gsap.timeline()
    tl.to(m.root.position, { x, y, z: px(80), duration: 0.25, ease: 'power2.inOut' })
    tl.to(m.card.material, { opacity: 1, duration: 0.2 }, 0)
    tl.to(m.root.scale, { x: 1, y: 1, z: 1, duration: 0.25, ease: 'power2.inOut' }, 0)
    tl.to(m.root.position, { z: 0, duration: 0.18, ease: 'power3.in' })
    tl.addPause('+=0', () => {
      this.rippleAt(x, y)
      onLand(() => tl.resume())
    })
    tl.to(m.root.scale, { x: 1.1, y: 0.85, duration: 0.06 })
    tl.to(m.root.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(2.5)' })
    return tl
  }

  private rippleAt(x: number, y: number): void {
    const r = this.ripple
    r.position.set(x, y - MINION_H * 0.35, -0.1)
    r.scale.set(0.5, 0.2, 1)
    r.material.opacity = 0.8
    gsap.to(r.scale, { x: 2.2, y: 0.8, duration: 0.4, ease: 'power2.out', overwrite: true })
    gsap.to(r.material, { opacity: 0, duration: 0.4, ease: 'power2.out', overwrite: true })
    this.burstAt(x, y - MINION_H * 0.4, 6, 0.8, 0.4)
  }

  private burstAt(x: number, y: number, count: number, spread: number, seconds: number, upward = 0): void {
    for (let i = 0; i < count; i++) {
      const s = this.burst[this.burstCursor]!
      this.burstCursor = (this.burstCursor + 1) % BURST_POOL
      gsap.killTweensOf([s.position, s.scale])
      const size = 0.15 + Math.random() * 0.25
      s.position.set(x, y, 0.5)
      s.scale.set(size, size, 1)
      s.visible = true
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      gsap.to(s.position, {
        x: x + Math.cos(angle) * spread * (0.6 + Math.random() * 0.6),
        y: y + Math.sin(angle) * spread * 0.7 + upward,
        duration: seconds,
        ease: 'power2.out',
        onComplete: () => {
          s.visible = false
        },
      })
      gsap.to(s.scale, { x: 0.01, y: 0.01, duration: seconds, ease: 'power1.in' })
    }
  }

  // 攻擊衝撞：命中時暫停，由 onImpact 處理 hit stop 後 resume
  tlAttack(attackerId: string, target: THREE.Vector3, onImpact: (resume: () => void) => void): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(attackerId)
    if (!m) return tl
    const from = m.root.position.clone()
    const dir = this.tmp.copy(target).sub(from)
    const dist = dir.length()
    dir.normalize()
    const stop = Math.max(0, dist - MINION_H * 0.55)
    const back = { x: from.x - dir.x * px(20), y: from.y - dir.y * px(20) }
    tl.to(m.root.position, { x: back.x, y: back.y, z: px(30), duration: 0.15, ease: 'power2.out' })
    tl.to(m.root.position, { x: from.x + dir.x * stop, y: from.y + dir.y * stop, z: px(20), duration: 0.18, ease: 'power4.in' })
    tl.addPause('+=0', () => onImpact(() => tl.resume()))
    tl.to(m.root.position, { x: from.x, y: from.y, z: 0, duration: 0.35, ease: 'back.out(1.2)' })
    return tl
  }

  flash(id: string): void {
    const m = this.minions.get(id)
    if (!m) return
    m.card.material.color.setScalar(3)
    gsap.to(m.card.material.color, { r: 1, g: 1, b: 1, duration: 0.06, delay: 0.03 })
  }

  tlHit(id: string): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    tl.to(m.bob.position, { x: px(6), duration: 0.025 })
    tl.to(m.bob.position, { x: -px(6), duration: 0.05, repeat: 2, yoyo: true })
    tl.to(m.bob.position, { x: 0, duration: 0.025 })
    return tl
  }

  tlPulse(id: string): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    tl.to(m.bob.scale, { x: 1.12, y: 1.12, duration: 0.15, ease: 'power2.out' })
    tl.to(m.bob.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' })
    return tl
  }

  tlShakeNo(id: string): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    tl.to(m.bob.rotation, { z: 0.12, duration: 0.05 })
    tl.to(m.bob.rotation, { z: -0.12, duration: 0.05, repeat: 2, yoyo: true })
    tl.to(m.bob.rotation, { z: 0, duration: 0.05 })
    return tl
  }

  tlDeath(id: string): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    tl.to(m.card.material.color, { r: 0.6, g: 0.6, b: 0.66, duration: 0.15 })
    tl.to(m.root.scale, { x: 0.35, y: 0.35, duration: 0.45, ease: 'power2.in' })
    tl.to(m.root.rotation, { z: THREE.MathUtils.degToRad(15), duration: 0.45, ease: 'power2.in' }, '<')
    tl.to(m.card.material, { opacity: 0, duration: 0.3 }, '-=0.2')
    tl.call(() => this.burstAt(m.root.position.x, m.root.position.y, 10, 0.9, 0.6, 1.2))
    tl.to({}, { duration: 0.6 })
    tl.call(() => {
      const pid = m.pid
      this.destroyMinion(id)
      this.layout(pid, 0.25)
    })
    return tl
  }

  tlFreeze(id: string, onFormed: (resume: () => void) => void): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    m.vm.frozen = true
    m.ice.visible = true
    m.ice.scale.set(1, 0.01, 1)
    m.ice.position.y = -MINION_H / 2
    tl.to(m.ice.scale, { y: 1, duration: 0.4, ease: 'power2.out' })
    tl.to(m.ice.position, { y: 0, duration: 0.4, ease: 'power2.out' }, '<')
    tl.addPause('+=0', () => onFormed(() => tl.resume()))
    return tl
  }

  tlUnfreeze(id: string): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    m.vm.frozen = false
    tl.to(m.ice.scale, { x: 1.06, duration: 0.05, repeat: 3, yoyo: true })
    tl.to(m.ice.position, { y: -px(60), duration: 0.3, ease: 'power2.in' })
    tl.to(m.ice.scale, { y: 0.01, duration: 0.3, ease: 'power2.in' }, '<')
    tl.call(() => {
      m.ice.visible = false
      m.ice.scale.set(1, 1, 1)
      m.ice.position.y = 0
    })
    return tl
  }

  tlBubblePop(id: string, onBurst: (resume: () => void) => void): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    m.bubble.visible = true
    tl.to(m.bubble.scale, { x: 1.15, y: 1.15, duration: 0.08 })
    tl.call(() => {
      m.bubble.visible = false
      m.bubble.scale.set(1, 1, 1)
      this.burstAt(m.root.position.x, m.root.position.y, 16, 1.6, 0.4)
    })
    tl.addPause('+=0', () => onBurst(() => tl.resume()))
    tl.to({}, { duration: 0.4 })
    return tl
  }

  tlBounce(id: string): gsap.core.Timeline {
    const tl = gsap.timeline()
    const m = this.minions.get(id)
    if (!m) return tl
    const down = m.pid === 'p1' ? -px(500) : px(500)
    tl.to(m.root.position, { y: m.root.position.y + down, z: px(60), duration: 0.4, ease: 'power2.in' })
    tl.to(m.card.material, { opacity: 0, duration: 0.3 }, '-=0.3')
    tl.call(() => {
      const pid = m.pid
      this.destroyMinion(id)
      this.layout(pid, 0.25)
    })
    return tl
  }

  setBubble(id: string, on: boolean): void {
    const m = this.minions.get(id)
    if (m) m.bubble.visible = on
  }

  shake(level: ShakeLevel, speed: number): void {
    if (this.reducedMotion || level === 'none') return
    const [amp, ms] = SHAKE_PX[level]
    const state = { k: 1 }
    gsap.killTweensOf(state)
    gsap.to(state, {
      k: 0,
      duration: ms / 1000 / speed,
      ease: 'power1.out',
      onUpdate: () => {
        const a = px(amp) * state.k
        this.rig.position.set((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a, 0)
      },
      onComplete: () => {
        this.rig.position.set(0, 0, 0)
      },
    })
  }

  // 致命一擊：鏡頭推近敗方英雄
  tlFinalPush(target: THREE.Vector3): gsap.core.Timeline {
    const tl = gsap.timeline()
    const b = this.camBase
    tl.to(this.camera.position, { x: target.x * 0.35, y: b.y + (target.y - b.y) * 0.35, z: b.z * 0.82, duration: 0.8, ease: 'power2.out' })
    tl.to(this.camera.position, { x: b.x, y: b.y, z: b.z, duration: 0.6, ease: 'power2.inOut' }, '+=0.4')
    return tl
  }

  dispose(): void {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.timer.dispose()
    this.resizeObserver.disconnect()
    for (const id of [...this.minions.keys()]) this.destroyMinion(id)
    gsap.killTweensOf([this.camera.position, this.ripple.scale, this.ripple.material, ...this.burst.flatMap((s) => [s.position, s.scale])])
    this.textures.dispose()
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

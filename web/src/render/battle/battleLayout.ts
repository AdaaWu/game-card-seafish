// 對戰版面：依舞台尺寸算出邏輯座標下各區塊位置，DOM 疊層與 three.js 戰場共用

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface HandGeometry {
  cx: number
  // 桌機扇形頂端；手機為展開時頂端
  top: number
  // 手機收合時的卡片頂端
  collapsedTop: number
  // 手機收合時被選取的卡升起後的頂端
  liftedTop: number
  expandedTop: number
  cardW: number
  cardH: number
  radius: number
  maxHalf: number
  expandedHalf: number
}

export interface BattleLayout {
  scale: number
  lw: number
  lh: number
  rotateHint: boolean
  compact: boolean
  arrangement: 'side' | 'stack'
  // 1 CSS px 換成邏輯 px
  cssPx: number
  minFont: number
  boardCy: number
  board: Rect
  heroP2: Rect
  heroP1: Rect
  portraitSize: number
  nameFont: number
  manaP2: Rect
  manaP1: Rect
  manaDrop: { p1: number; p2: number }
  manaFont: { p1: number; p2: number }
  enemyHand: Rect
  deckP2: Rect
  deckP1: Rect
  deckFont: number
  endTurn: Rect
  endTurnFont: number
  actions: Rect
  buttonH: number
  gear: Rect
  hand: HandGeometry
  handRest: Rect
  playLine: number
  detailCardW: number
}

export const DESIGN_W = 1920
export const DESIGN_H = 1080
const PORTRAIT_W = 1280

// 戰場幾何（邏輯 px）：兩排生物位於分隔線上下
export const ROW_OFFSET = 140
export const LANE_W = 1160
const BOARD_HALF_H = ROW_OFFSET + 110

const DESKTOP_MIN_FONT = 14
const MOBILE_MIN_FONT = 12
const COMPACT_MAX_H = 500
const GAP = 24

const ENEMY_BACK_W = 52
const ENEMY_BACK_H = 72
const ENEMY_BACK_STEP = 28
const MAX_HAND = 10

function manaSize(drop: number, font: number): { w: number; h: number } {
  const pad = 14
  const gap = Math.round(drop * 0.22)
  return { w: pad * 2 + drop * 10 + gap * 9 + 12 + font * 2.9, h: Math.max(drop * 1.3, font * 1.2) + 16 }
}

// 扇形手牌在 maxHalf 內排 n 張時的間距
export function handSpacing(n: number, cardW: number, maxHalf: number): number {
  if (n <= 1) return 0
  return Math.max(0, Math.min(cardW * 0.84, (maxHalf * 2 - cardW) / (n - 1)))
}

// 扇形總高：中央卡頂端到最低點
function fanHeight(cardW: number, cardH: number, radius: number, maxHalf: number): number {
  const dx = ((MAX_HAND - 1) / 2) * handSpacing(MAX_HAND, cardW, maxHalf)
  const drop = radius - Math.sqrt(radius * radius - dx * dx)
  return cardH + drop + (cardW / 2) * (dx / radius)
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })
const bottom = (r: Rect) => r.y + r.h
const right = (r: Rect) => r.x + r.w
const overlapX = (a: Rect, x0: number, x1: number) => a.x < x1 && x0 < a.x + a.w

export function computeLayout(w: number, h: number): BattleLayout {
  const portrait = h > w
  const rotateHint = portrait && w < 600
  const scale = portrait ? Math.min(w / PORTRAIT_W, h / DESIGN_H) : Math.min(w / DESIGN_W, h / DESIGN_H)
  const lw = w / scale
  const lh = h / scale
  const cssPx = 1 / scale
  const compact = !portrait && h < COMPACT_MAX_H
  const minFont = (compact ? MOBILE_MIN_FONT : DESKTOP_MIN_FONT) * cssPx
  const arrangement: 'side' | 'stack' = lw < 1700 ? 'stack' : 'side'
  const cx = lw / 2
  const mh = Math.max(32, 12 * cssPx)
  const mv = Math.max(28, 10 * cssPx)

  // 元件尺寸
  const portraitSize = Math.max(128, 52 * cssPx)
  const nameFont = Math.max(20, minFont)
  const nameH = Math.round(nameFont * 1.5)
  const heroW = portraitSize + 20
  const heroH = portraitSize + 12 + nameH
  const drop1 = Math.max(22, 8 * cssPx)
  const font1 = Math.max(36, 16 * cssPx)
  const drop2 = Math.max(16, 6 * cssPx)
  const font2 = Math.max(28, 14 * cssPx)
  const mana1 = manaSize(drop1, font1)
  const mana2 = manaSize(drop2, font2)
  const deckFont = Math.max(30, minFont * 1.2)
  const deckW = 44 + 10 + deckFont * 1.4
  const deckH = Math.max(66, deckFont * 1.3)
  const endW = Math.max(180, 96 * cssPx)
  const endH = Math.max(72, 52 * cssPx)
  const endTurnFont = Math.max(26, 16 * cssPx)
  const buttonH = Math.max(64, 48 * cssPx)
  const actW = Math.max(260, 140 * cssPx)
  const actH = buttonH * 2 + 12
  const gear = rect(lw - 76 * cssPx, 0, 76 * cssPx, 70 * cssPx)

  // 頂列：敵方手牌與牌庫在左上，敵方英雄置中，潮能在英雄右側
  const enemyHand = rect(mh, mv, ENEMY_BACK_STEP * (MAX_HAND - 1) + ENEMY_BACK_W, ENEMY_BACK_H)
  const deckP2 = rect(right(enemyHand) + GAP, mv, deckW, deckH)
  const heroP2 = rect(cx - heroW / 2, mv, heroW, heroH)
  const p2PortraitCy = heroP2.y + nameH + portraitSize / 2
  const manaP2 = rect(right(heroP2) + GAP, p2PortraitCy - mana2.h / 2, mana2.w, mana2.h)

  // 手牌
  const cardW = compact ? (lh * 0.35) / 1.4 : Math.max(150, 112 * cssPx)
  const cardH = cardW * 1.4
  const radius = cardW * 16

  let heroP1: Rect
  let manaP1: Rect
  let deckP1: Rect
  let endTurn: Rect
  let actions: Rect
  let maxHalf: number
  let handTop: number
  const below: Rect[] = []

  if (arrangement === 'side') {
    // 我方英雄在左下、潮能在英雄上方；牌庫在右下
    heroP1 = rect(mh, lh - mv - heroH, heroW, heroH)
    manaP1 = rect(mh, heroP1.y - 16 - mana1.h, mana1.w, mana1.h)
    deckP1 = rect(lw - mh - deckW, lh - mv - deckH, deckW, deckH)
    const leftBound = mh + Math.max(heroW, mana1.w) + GAP
    const rightBound = deckP1.x - GAP
    maxHalf = Math.min(cx - leftBound, rightBound - cx)
    handTop = compact ? 0 : lh - mv - fanHeight(cardW, cardH, radius, maxHalf)
    below.push(heroP1, manaP1, deckP1)
    endTurn = rect(0, 0, endW, endH)
    actions = rect(0, 0, actW, actH)
  } else {
    // 直向：手牌在底、我方英雄置中於手牌上方，牌庫在左、結束回合在右
    maxHalf = cx - mh
    handTop = lh - mv - fanHeight(cardW, cardH, radius, maxHalf)
    heroP1 = rect(cx - heroW / 2, handTop - 16 - heroH, heroW, heroH)
    const p1PortraitCy = heroP1.y + portraitSize / 2
    deckP1 = rect(heroP1.x - GAP * 2 - deckW, p1PortraitCy - deckH / 2, deckW, deckH)
    endTurn = rect(lw - mh - endW, p1PortraitCy - endH / 2, endW, endH)
    manaP1 = rect(cx - mana1.w / 2, heroP1.y - 16 - mana1.h, mana1.w, mana1.h)
    actions = rect(lw - mh - actW, endTurn.y - 20 - actH, actW, actH)
    below.push(heroP1, manaP1, deckP1, endTurn, actions)
  }

  const peek = Math.max(cardH * 0.15, 48 * cssPx)
  const collapsedTop = lh - peek
  const expandedHalf = cx - mh
  const expandedTop = lh - mv - fanHeight(cardW, cardH, radius, expandedHalf)
  const top = compact ? expandedTop : handTop
  const handRest = compact
    ? rect(cx - maxHalf, collapsedTop, maxHalf * 2, peek)
    : rect(cx - maxHalf, handTop, maxHalf * 2, lh - mv - handTop)
  below.push(handRest)

  // 戰場：夾在上下兩群之間，盡量置中
  const laneX0 = cx - LANE_W / 2
  const laneX1 = cx + LANE_W / 2
  const above = [heroP2, manaP2, enemyHand, deckP2]
  const lo = Math.max(...above.filter((r) => overlapX(r, laneX0, laneX1)).map(bottom)) + 12 + BOARD_HALF_H
  const hi = Math.min(...below.filter((r) => overlapX(r, laneX0, laneX1)).map((r) => r.y)) - 12 - BOARD_HALF_H
  const want = lh / 2 - 20
  const boardCy = lo > hi ? (lo + hi) / 2 : Math.min(Math.max(want, lo), hi)
  const board = rect(laneX0, boardCy - BOARD_HALF_H, LANE_W, BOARD_HALF_H * 2)

  if (arrangement === 'side') {
    endTurn = rect(lw - mh - endW, boardCy - endH / 2, endW, endH)
    actions = rect(lw - mh - actW, bottom(endTurn) + 20, actW, actH)
  }

  const playLine = compact ? collapsedTop - 40 : handTop - 10
  // 放大細節卡：效果文字（卡面 18/500）至少達最小字級，且不超出舞台高度
  const detailCardW = Math.min(Math.max(300, (minFont * 500) / 18), (lh - mv * 2) / 1.4)

  return {
    scale,
    lw,
    lh,
    rotateHint,
    compact,
    arrangement,
    cssPx,
    minFont,
    boardCy,
    board,
    heroP2,
    heroP1,
    portraitSize,
    nameFont,
    manaP2,
    manaP1,
    manaDrop: { p1: drop1, p2: drop2 },
    manaFont: { p1: font1, p2: font2 },
    enemyHand,
    deckP2,
    deckP1,
    deckFont,
    endTurn,
    endTurnFont,
    actions,
    buttonH,
    gear,
    hand: {
      cx,
      top,
      collapsedTop,
      liftedTop: lh - mv - cardH,
      expandedTop,
      cardW,
      cardH,
      radius,
      maxHalf,
      expandedHalf,
    },
    handRest,
    playLine,
    detailCardW,
  }
}

import { describe, expect, it } from 'vitest'
import { HAND_LAYOUT } from '@/content/cardStyle'
import { boardGeometry, computeLayout, type BattleLayout, type Rect } from '@/render/battle/battleLayout'

// 舞台尺寸 = 視窗扣掉 clamp(4px, 1.2vh, 16px) 的外框
const stage = (w: number, h: number): [number, number] => {
  const pad = Math.min(16, Math.max(4, h * 0.012))
  return [w - pad * 2, h - pad * 2]
}

const LANDSCAPE: [number, number][] = [
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [1024, 768],
  [844, 390],
]
const ALL: [number, number][] = [...LANDSCAPE, [768, 1024]]

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function restRects(l: BattleLayout): Record<string, Rect> {
  return {
    heroP2: l.heroP2,
    heroP1: l.heroP1,
    manaP2: l.manaP2,
    manaP1: l.manaP1,
    enemyHand: l.enemyHand,
    deckP2: l.deckP2,
    deckP1: l.deckP1,
    endTurn: l.endTurn,
    actions: l.actions,
    board: l.board,
    hand: l.handRest,
    gear: l.gear,
  }
}

describe('computeLayout 對戰版面', () => {
  it('16:9 維持 1920×1080 邏輯座標', () => {
    const l = computeLayout(1920, 1080)
    expect(l.lw).toBeCloseTo(1920)
    expect(l.lh).toBeCloseTo(1080)
    expect(l.scale).toBeCloseTo(1)
  })

  it('邏輯寬高乘上縮放等於舞台尺寸', () => {
    for (const [w, h] of ALL) {
      const [sw, sh] = stage(w, h)
      const l = computeLayout(sw, sh)
      expect(l.lw * l.scale).toBeCloseTo(sw)
      expect(l.lh * l.scale).toBeCloseTo(sh)
    }
  })

  it.each(ALL)('%i×%i 各區塊都在舞台內且互不重疊', (w, h) => {
    const l = computeLayout(...stage(w, h))
    const rects = restRects(l)
    for (const [name, r] of Object.entries(rects)) {
      if (name === 'hand' && l.compact) continue
      expect(r.w, name).toBeGreaterThan(0)
      expect(r.x, `${name} 左`).toBeGreaterThanOrEqual(0)
      expect(r.y, `${name} 上`).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w, `${name} 右`).toBeLessThanOrEqual(l.lw)
      expect(r.y + r.h, `${name} 下`).toBeLessThanOrEqual(l.lh)
    }
    const names = Object.keys(rects)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        expect(overlap(rects[names[i]!]!, rects[names[j]!]!), `${names[i]} 與 ${names[j]}`).toBe(false)
      }
    }
  })

  it.each(ALL)('%i×%i 敵方英雄與手牌區保留上下安全邊距', (w, h) => {
    const l = computeLayout(...stage(w, h))
    expect(l.heroP2.y * l.scale).toBeGreaterThanOrEqual(6)
    if (!l.compact) expect((l.lh - l.handRest.y - l.handRest.h) * l.scale).toBeGreaterThanOrEqual(6)
  })

  it('手機橫向手牌收合，只露出一排且可點範圍至少 44px 高', () => {
    const l = computeLayout(...stage(844, 390))
    expect(l.compact).toBe(true)
    const peek = (l.lh - l.hand.collapsedTop) * l.scale
    expect(peek).toBeGreaterThanOrEqual(44)
    expect(peek).toBeLessThan(l.hand.cardH * l.scale * 0.5)
    // 展開時卡片高度約螢幕 35%
    expect(l.hand.cardH / l.lh).toBeCloseTo(0.35, 1)
  })

  it('桌機不收合手牌', () => {
    for (const [w, h] of LANDSCAPE.filter(([, h]) => h >= 720)) expect(computeLayout(...stage(w, h)).compact).toBe(false)
  })

  it.each(ALL)('%i×%i 結束回合至少 88×48、英雄頭像至少 44×44（CSS px）', (w, h) => {
    const l = computeLayout(...stage(w, h))
    expect(l.endTurn.w * l.scale).toBeGreaterThanOrEqual(88)
    expect(l.endTurn.h * l.scale).toBeGreaterThanOrEqual(48)
    expect(l.portraitSize * l.scale).toBeGreaterThanOrEqual(44)
  })

  it.each(ALL)('%i×%i 最小字級：桌機 14px、手機 12px', (w, h) => {
    const l = computeLayout(...stage(w, h))
    const min = l.compact ? 12 : 14
    expect(l.minFont * l.scale).toBeCloseTo(Math.max(min, l.minFont * l.scale))
    expect(l.minFont * l.scale).toBeGreaterThanOrEqual(min - 0.01)
    expect(l.nameFont * l.scale).toBeGreaterThanOrEqual(min - 0.01)
    // 手牌精簡版型的卡名、費用與攻血（卡面 500 寬）
    const handPx = (f: number) => ((l.hand.cardW * f) / 500) * l.scale
    expect(handPx(HAND_LAYOUT.font.name)).toBeGreaterThanOrEqual(min - 0.01)
    expect(handPx(HAND_LAYOUT.font.costWide)).toBeGreaterThanOrEqual(min - 0.01)
    expect(handPx(HAND_LAYOUT.font.statWide)).toBeGreaterThanOrEqual(min - 0.01)
  })

  it('手機細節卡為橫向：左側精簡卡、右側文字區至少放得下 12 個最小字級的字', () => {
    const l = computeLayout(...stage(844, 390))
    expect(l.compact).toBe(true)
    expect(l.detailSideW).toBeGreaterThanOrEqual(l.minFont * 12)
    expect(l.detailCardW * 1.4).toBeLessThanOrEqual(l.lh - 40)
    expect(l.detailCardW + 12 + l.detailSideW).toBeLessThanOrEqual(l.lw - 40)
  })

  it.each(LANDSCAPE.filter(([, h]) => h >= 720))('%i×%i 桌機放大細節卡的效果文字至少 14px', (w, h) => {
    const l = computeLayout(...stage(w, h))
    expect(((l.detailCardW * 18) / 500) * l.scale).toBeGreaterThanOrEqual(14 - 0.01)
    expect(l.detailCardW * 1.4).toBeLessThanOrEqual(l.lh)
  })

  it('6 格戰場永遠完整在舞台內', () => {
    for (const [w, h] of ALL) {
      const l = computeLayout(...stage(w, h))
      expect(l.board.w).toBeGreaterThanOrEqual(1160)
      expect(l.board.x).toBeGreaterThanOrEqual(0)
      expect(l.board.x + l.board.w).toBeLessThanOrEqual(l.lw)
    }
  })

  it('手機直向只顯示轉向提示，平板直向照常顯示戰場', () => {
    expect(computeLayout(...stage(390, 844)).rotateHint).toBe(true)
    expect(computeLayout(...stage(768, 1024)).rotateHint).toBe(false)
    expect(computeLayout(...stage(768, 1024)).arrangement).toBe('stack')
    expect(computeLayout(...stage(1280, 720)).arrangement).toBe('side')
  })

  it.each(LANDSCAPE.filter(([w, h]) => computeLayout(...stage(w, h)).compact === false))(
    '%i×%i 桌機手牌上緣與我方生物下緣至少留 40',
    (w, h) => {
      const l = computeLayout(...stage(w, h))
      const g = l.boardGeo
      expect(l.hand.top).toBeGreaterThanOrEqual(l.boardCy + g.rowOffset + g.minionH / 2 + 40)
    },
  )

  it('出牌線在戰場下緣與手牌之間', () => {
    for (const [w, h] of ALL) {
      const l = computeLayout(...stage(w, h))
      expect(l.playLine).toBeGreaterThan(l.board.y + l.board.h - 60)
      expect(l.playLine).toBeLessThanOrEqual(l.compact ? l.hand.collapsedTop : l.hand.top)
    }
  })

  it('場上生物顯示寬度：桌機 1440 約 120px、手機 844 約 80px', () => {
    const desk = computeLayout(...stage(1440, 900))
    const phone = computeLayout(...stage(844, 390))
    expect(desk.boardGeo.minionW * desk.scale).toBeGreaterThanOrEqual(112)
    expect(desk.boardGeo.minionW * desk.scale).toBeLessThanOrEqual(124)
    expect(phone.boardGeo.minionW * phone.scale).toBeGreaterThanOrEqual(76)
    expect(phone.boardGeo.minionW * phone.scale).toBeLessThanOrEqual(84)
  })

  it('生物外形依 288×352 畫布比例，外框為畫布扣掉四周 16', () => {
    for (const compact of [false, true]) {
      const g = boardGeometry(compact)
      expect(g.minionH / g.minionW).toBeCloseTo(352 / 288)
      expect(g.frameW / g.minionW).toBeCloseTo(256 / 288)
      expect(g.frameH / g.minionH).toBeCloseTo(320 / 352)
    }
  })

  it.each(LANDSCAPE)('%i×%i 6 隻生物排得下：場地寬度容納 6 格且在舞台內', (w, h) => {
    const l = computeLayout(...stage(w, h))
    const g = l.boardGeo
    expect(g.spacing).toBeGreaterThan(g.frameW)
    expect(g.spacing * 5 + g.minionW).toBeLessThanOrEqual(l.board.w)
    expect(l.board.w).toBe(g.laneW)
  })

  it.each(ALL)('%i×%i 兩列生物上下不重疊，且不壓到頂列與手牌', (w, h) => {
    const l = computeLayout(...stage(w, h))
    const g = l.boardGeo
    // 兩列外框之間至少留 6px
    expect((g.rowOffset * 2 - g.frameH) * l.scale).toBeGreaterThanOrEqual(6)
    const enemyTop = l.boardCy - g.rowOffset - g.frameH / 2
    const myBottom = l.boardCy + g.rowOffset + g.frameH / 2
    expect(enemyTop).toBeGreaterThanOrEqual(l.board.y)
    expect(myBottom).toBeLessThanOrEqual(l.board.y + l.board.h)
    const handTop = l.compact ? l.hand.collapsedTop : l.hand.top
    expect(myBottom).toBeLessThan(handTop)
    for (const r of [l.heroP2, l.manaP2, l.enemyHand, l.deckP2]) {
      if (r.x < l.board.x + l.board.w && l.board.x < r.x + r.w) expect(enemyTop).toBeGreaterThan(r.y + r.h)
    }
  })

  it('英雄頭像：桌機 1440 約 120px、手機 844 約 64px', () => {
    const desk = computeLayout(...stage(1440, 900))
    const phone = computeLayout(...stage(844, 390))
    expect(desk.portraitSize * desk.scale).toBeGreaterThanOrEqual(116)
    expect(desk.portraitSize * desk.scale).toBeLessThanOrEqual(122)
    expect(phone.portraitSize * phone.scale).toBeGreaterThanOrEqual(62)
    expect(phone.portraitSize * phone.scale).toBeLessThanOrEqual(66)
  })

  it('出牌展示卡：桌機 1440 約 270px、手機 844 約 173px', () => {
    const desk = computeLayout(...stage(1440, 900))
    const phone = computeLayout(...stage(844, 390))
    expect(desk.showcaseW * desk.scale).toBeGreaterThanOrEqual(260)
    expect(desk.showcaseW * desk.scale).toBeLessThanOrEqual(272)
    expect(phone.showcaseW * phone.scale).toBeGreaterThanOrEqual(165)
    expect(phone.showcaseW * phone.scale).toBeLessThanOrEqual(176)
  })

  it('結算小葉立繪：桌機約 58% 高、上限 520px，手機約 70% 高', () => {
    const desk = computeLayout(...stage(1440, 900))
    const phone = computeLayout(...stage(844, 390))
    const deskPx = desk.resultFigureH * desk.scale
    expect(deskPx).toBeGreaterThanOrEqual(490)
    expect(deskPx).toBeLessThanOrEqual(520)
    expect(computeLayout(...stage(2560, 1440)).resultFigureH * computeLayout(...stage(2560, 1440)).scale).toBeLessThanOrEqual(520.01)
    expect(phone.resultFigureH * phone.scale).toBeGreaterThanOrEqual(262)
    expect(phone.resultFigureH * phone.scale).toBeLessThanOrEqual(275)
  })
})

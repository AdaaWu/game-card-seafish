import { describe, expect, it } from 'vitest'
import { CARD_H, CARD_W, CROWN, LAYOUT, artPlacement, cardFaceLayout, estimateTextLines, keywordRow } from '@/content/cardStyle'
import { getCard } from '@/content'

const LINES = [0, 1, 2, 3, 4]

describe('卡面新版面比例', () => {
  it('插畫高度佔卡高至少 62%', () => {
    for (const type of ['creature', 'spell'] as const)
      for (const n of LINES) expect(cardFaceLayout(type, n).art.h / CARD_H).toBeGreaterThanOrEqual(0.62)
  })

  it('外框邊寬不超過卡寬 3%', () => {
    expect(LAYOUT.border / CARD_W).toBeLessThanOrEqual(0.03)
  })

  it('文字框不超過卡高 22%', () => {
    for (const type of ['creature', 'spell'] as const)
      for (const n of LINES) expect(cardFaceLayout(type, n).text.h / CARD_H).toBeLessThanOrEqual(0.22)
  })

  it('插畫寬 464 且文字框底緣固定在 682', () => {
    const l = cardFaceLayout('creature', 3)
    expect(l.art.w).toBe(464)
    expect(l.text.y + l.text.h).toBe(682)
  })

  it('文字框高度依行數：4 行 154、3 行 132、2 行以下 110', () => {
    expect(cardFaceLayout('creature', 4).text.h).toBe(154)
    expect(cardFaceLayout('creature', 3).text.h).toBe(132)
    expect(cardFaceLayout('creature', 2).text.h).toBe(110)
    expect(cardFaceLayout('spell', 0).text.h).toBe(110)
  })

  it('4 行文字時插畫高 504，文字短時延伸到 548', () => {
    expect(cardFaceLayout('creature', 4).art.h).toBe(504)
    expect(cardFaceLayout('spell', 1).art.h).toBe(548)
  })

  it('緞帶、攻擊、生命疊在插畫下緣', () => {
    const l = cardFaceLayout('creature', 4)
    const bottom = l.art.y + l.art.h
    expect(l.ribbon.y + l.ribbon.h).toBe(bottom - 4)
    expect(l.attack.y + l.attack.d).toBe(bottom - 2)
    expect(l.health.y + l.health.d).toBe(bottom - 2)
    expect(l.gem.cy).toBe(l.ribbon.y + l.ribbon.h)
  })

  it('行數 0 時文字框只放類型列，高度 56，插畫高度拉到上限 602，插畫仍 ≥62% 卡高', () => {
    const l = cardFaceLayout('creature', 0)
    expect(l.text.h).toBe(56)
    expect(l.text.y + l.text.h).toBe(682)
    expect(l.art.h).toBe(602)
    expect(l.art.h / CARD_H).toBeGreaterThanOrEqual(0.62)
  })

  it('行數 0 時插畫下緣與文字框上緣間距 ≤ 8', () => {
    const l = cardFaceLayout('creature', 0)
    expect(l.text.y - (l.art.y + l.art.h)).toBeLessThanOrEqual(8)
  })

  it('行數 0 的緞帶與攻防位置跟著插畫下緣', () => {
    const l = cardFaceLayout('creature', 0)
    const bottom = l.art.y + l.art.h
    expect(bottom).toBe(620)
    expect(l.ribbon.y + l.ribbon.h).toBe(bottom - 4)
    expect(l.attack.y + l.attack.d).toBe(bottom - 2)
    expect(l.health.y + l.health.d).toBe(bottom - 2)
  })

  it('法術緞帶較寬', () => {
    expect(cardFaceLayout('spell', 2).ribbon).toMatchObject({ x: 50, w: 400 })
    expect(cardFaceLayout('creature', 2).ribbon).toMatchObject({ x: 96, w: 308 })
  })

  it('估算行數不超過 4 行', () => {
    expect(estimateTextLines('')).toBe(0)
    expect(estimateTextLines(getCard('tide-007').text)).toBeGreaterThanOrEqual(1)
    expect(estimateTextLines('字'.repeat(200))).toBe(4)
  })
})

describe('插畫裁切規則', () => {
  const art = { x: 18, y: 18, w: 464, h: 504 }

  it('高型角色高度為插畫區 86%，頂端在插畫區頂往下 10%，水平置中', () => {
    const p = artPlacement({ x: 412, y: 100, w: 200, h: 800 }, 1024, 1024, art)
    const s = p.w / 1024
    expect(800 * s).toBeCloseTo(504 * 0.86)
    expect(p.y + 100 * s).toBeCloseTo(18 + 504 * 0.1)
    expect(p.x + 512 * s).toBeCloseTo(18 + 464 / 2)
  })

  it('寬型角色寬度最多為插畫區 108%', () => {
    const p = artPlacement({ x: 0, y: 300, w: 1024, h: 400 }, 1024, 1024, art)
    expect(p.w).toBeCloseTo(464 * 1.08)
    expect(p.y + 300 * (p.w / 1024)).toBeCloseTo(18 + 504 * 0.1)
  })
})

describe('傳說花冠與關鍵字列', () => {
  it('傳說卡的關鍵字列整排在花冠下緣之下', () => {
    const k = keywordRow('legendary')
    expect(k.cy - k.d / 2).toBeGreaterThanOrEqual(CROWN.h)
  })

  it('非傳說卡的關鍵字列維持原位置', () => {
    for (const r of ['common', 'rare', 'epic'] as const) expect(keywordRow(r).cy).toBe(LAYOUT.keyword.cy)
  })
})

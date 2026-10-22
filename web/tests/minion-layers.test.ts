import { describe, expect, it } from 'vitest'
import type { Card } from '@/content/types'
import {
  MINION_CANVAS,
  OVERLAY_ORDER,
  baseKey,
  baseLayers,
  boardKeywordIcons,
  minionArtRect,
  overlayState,
  statColors,
  statKey,
} from '@/render/battle/minionLayers'

const card = { id: 'leaf-001', faction: 'leaf', attack: 2, health: 3 } as Card

describe('場上生物底層貼圖分層', () => {
  it('一般狀態由下到上：窗底、插畫、外框，沒有疊紗', () => {
    const layers = baseLayers('leaf', { stealth: false, exhausted: false }, [])
    expect(layers.map((l) => (l.kind === 'slice' ? l.path : l.kind))).toEqual([
      'minion/minion-window-leaf',
      'art',
      'minion/minion-frame-leaf',
    ])
    expect(layers[1]).toMatchObject({ kind: 'art', alpha: 1, saturation: 1 })
  })

  it('陣營決定外框與窗底切片', () => {
    const paths = baseLayers('frost', { stealth: false, exhausted: false }, []).flatMap((l) => (l.kind === 'slice' ? [l.path] : []))
    expect(paths).toEqual(['minion/minion-window-frost', 'minion/minion-frame-frost'])
  })

  it('潛藏：插畫透明度 65%，霧紗疊在插畫與外框之間', () => {
    const layers = baseLayers('light', { stealth: true, exhausted: false }, [])
    expect(layers.map((l) => (l.kind === 'slice' ? l.path : l.kind))).toEqual([
      'minion/minion-window-light',
      'art',
      'minion/ov-stealth',
      'minion/minion-frame-light',
    ])
    expect(layers[1]).toMatchObject({ kind: 'art', alpha: 0.65 })
  })

  it('已攻擊：插畫去飽和到 35%，灰紫薄紗疊在插畫與外框之間', () => {
    const layers = baseLayers('tide', { stealth: false, exhausted: true }, [])
    expect(layers.map((l) => (l.kind === 'slice' ? l.path : l.kind))).toEqual([
      'minion/minion-window-tide',
      'art',
      'minion/minion-exhausted',
      'minion/minion-frame-tide',
    ])
    expect(layers[1]).toMatchObject({ kind: 'art', saturation: 0.35 })
  })

  it('潛藏加已攻擊：薄紗在下、霧紗在上', () => {
    const paths = baseLayers('tide', { stealth: true, exhausted: true }, []).map((l) => (l.kind === 'slice' ? l.path : l.kind))
    expect(paths).toEqual(['minion/minion-window-tide', 'art', 'minion/minion-exhausted', 'minion/ov-stealth', 'minion/minion-frame-tide'])
  })

  it('沒有外觀的關鍵字畫在外框之上的拱頂', () => {
    const layers = baseLayers('leaf', { stealth: false, exhausted: false }, ['rush', 'taunt'])
    expect(layers.at(-1)).toEqual({ kind: 'keywords', icons: ['rush'], more: 0 })
  })
})

describe('場上關鍵字小圖示', () => {
  it('守護、泡泡盾、潛藏、冰凍有外觀，不另外畫圖示', () => {
    expect(boardKeywordIcons(['taunt', 'bubble', 'stealth', 'freeze'])).toEqual({ icons: [], more: 0 })
  })

  it('突進、共生、疾行這類沒有外觀的關鍵字保留圖示，順序照卡面', () => {
    expect(boardKeywordIcons(['lifesteal', 'taunt', 'rush'])).toEqual({ icons: ['lifesteal', 'rush'], more: 0 })
  })

  it('最多 2 顆：超過時第 2 顆改成 +N', () => {
    expect(boardKeywordIcons(['rush', 'lifesteal', 'charge'])).toEqual({ icons: ['rush'], more: 2 })
  })

  it('未知關鍵字不畫', () => {
    expect(boardKeywordIcons(['unknown'])).toEqual({ icons: [], more: 0 })
  })
})

describe('場上生物狀態疊層', () => {
  const status = { keywords: [] as string[], frozen: false, ready: false, exhausted: false }

  it('守護外環與泡泡盾依關鍵字顯示，冰凍依凍結狀態', () => {
    expect(overlayState({ ...status, keywords: ['taunt', 'bubble'], frozen: true })).toEqual({
      ready: false,
      taunt: true,
      frozen: true,
      bubble: true,
    })
  })

  it('可攻擊才亮光暈', () => {
    expect(overlayState({ ...status, ready: true }).ready).toBe(true)
  })

  it('已攻擊或冰凍時不亮可攻擊光暈', () => {
    expect(overlayState({ ...status, ready: true, exhausted: true }).ready).toBe(false)
    expect(overlayState({ ...status, ready: true, frozen: true }).ready).toBe(false)
  })

  it('疊層順序：光暈、守護在底層之下，冰凍、泡泡在上，攻血數字最上層', () => {
    const o = OVERLAY_ORDER
    expect(o.ready).toBeLessThan(o.base)
    expect(o.taunt).toBeLessThan(o.base)
    expect(o.base).toBeLessThan(o.frozen)
    expect(o.frozen).toBeLessThan(o.bubble)
    expect(o.bubble).toBeLessThan(o.stats)
  })
})

describe('攻血數字顏色沿用卡面 tone', () => {
  it('原始值為白、增益為綠、受傷為紅', () => {
    expect(statColors(card, { attack: 2, health: 3, maxHealth: 3 })).toEqual({ attack: '#FFFFFF', health: '#FFFFFF' })
    expect(statColors(card, { attack: 4, health: 5, maxHealth: 5 })).toEqual({ attack: '#7EE29A', health: '#7EE29A' })
    expect(statColors(card, { attack: 1, health: 2, maxHealth: 3 })).toEqual({ attack: '#FF8F8B', health: '#FF8F8B' })
  })
})

describe('貼圖快取鍵', () => {
  it('底層鍵不含攻血與有外觀的關鍵字，狀態改變才換鍵', () => {
    const a = baseKey('leaf-001', { stealth: false, exhausted: false }, ['taunt', 'bubble'])
    expect(baseKey('leaf-001', { stealth: false, exhausted: false }, [])).toBe(a)
    expect(baseKey('leaf-001', { stealth: true, exhausted: false }, [])).not.toBe(a)
    expect(baseKey('leaf-001', { stealth: false, exhausted: true }, [])).not.toBe(a)
    expect(baseKey('leaf-001', { stealth: false, exhausted: false }, ['rush'])).not.toBe(a)
    expect(baseKey('leaf-002', { stealth: false, exhausted: false }, [])).not.toBe(a)
  })

  it('攻血鍵只看數字與顏色，不同卡同數值共用', () => {
    const other = { ...card, id: 'tide-001' } as Card
    expect(statKey(card, { attack: 2, health: 3, maxHealth: 3 })).toBe(statKey(other, { attack: 2, health: 3, maxHealth: 3 }))
    expect(statKey(card, { attack: 2, health: 2, maxHealth: 3 })).not.toBe(statKey(card, { attack: 2, health: 3, maxHealth: 3 }))
  })
})

describe('插畫在拱窗內的位置', () => {
  it('畫布為 288×352 的 2 倍', () => {
    expect(MINION_CANVAS).toEqual({ w: 576, h: 704 })
  })

  it('直式角色以高度為準、水平置中、頂端在拱窗內', () => {
    const r = minionArtRect({ x: 0, y: 0, w: 100, h: 200 }, 100, 200)
    expect(r.h).toBeCloseTo(592 * 0.8)
    expect(r.x + r.w / 2).toBeCloseTo(288)
    expect(r.y).toBeCloseTo(92)
  })

  it('寬型角色以寬度為準，不超出窗寬 104%', () => {
    const r = minionArtRect({ x: 0, y: 0, w: 400, h: 100 }, 400, 100)
    expect(r.w).toBeCloseTo(464 * 1.04)
  })

  it('以不透明範圍置中，忽略透明留白', () => {
    const r = minionArtRect({ x: 100, y: 50, w: 100, h: 200 }, 300, 300)
    const s = r.w / 300
    expect(r.x + (100 + 50) * s).toBeCloseTo(288)
    expect(r.y + 50 * s).toBeCloseTo(92)
  })
})

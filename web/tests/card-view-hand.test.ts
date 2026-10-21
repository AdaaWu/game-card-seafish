import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import CardView from '@/components/CardView.vue'
import { getCard } from '@/content'

async function render(props: Record<string, unknown>): Promise<string> {
  return renderToString(createSSRApp(CardView, props))
}

const classLists = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1]!.split(' '))
// 有幾個元素同時帶有這些 class
const count = (html: string, ...cls: string[]) => classLists(html).filter((l) => cls.every((c) => l.includes(c))).length
// 帶有這些 class 的元素內第一個數字
function badgeNumber(html: string, ...cls: string[]): string | undefined {
  const at = [...html.matchAll(/class="([^"]*)"/g)].find((m) => cls.every((c) => m[1]!.split(' ').includes(c)))
  if (at?.index === undefined) return undefined
  return /class="num"[^>]*>\s*(\d+)\s*</.exec(html.slice(at.index))?.[1]
}

describe('手牌精簡版型', () => {
  it('生物顯示卡名、費用、攻擊、生命、關鍵字圖示與效果標記', async () => {
    const card = getCard('tide-007')
    const html = await render({ card, variant: 'hand' })
    expect(html).toContain(`>${card.name}<`)
    expect(badgeNumber(html, 'badge', 'cost')).toBe('2')
    expect(badgeNumber(html, 'badge', 'attack')).toBe('2')
    expect(badgeNumber(html, 'badge', 'health')).toBe('1')
    expect(count(html, 'kw')).toBe(1)
    expect(html).toContain('data-testid="effect-mark"')
  })

  it('不放完整效果文字與類型列', async () => {
    const html = await render({ card: getCard('tide-007'), variant: 'hand' })
    expect(count(html, 'effect')).toBe(0)
    // 可見文字不含效果內容（aria-label 保留完整敘述）
    expect(html.replace(/<[^>]*>/g, '')).not.toContain('死亡時')
    expect(count(html, 'type-label')).toBe(0)
  })

  it('只有關鍵字的生物不顯示效果標記', async () => {
    const html = await render({ card: getCard('neutral-001'), variant: 'hand' })
    expect(html).not.toContain('data-testid="effect-mark"')
    expect(count(html, 'kw')).toBe(1)
  })

  it('法術沒有攻擊與生命，仍顯示效果標記', async () => {
    const html = await render({ card: getCard('tide-003'), variant: 'hand' })
    expect(count(html, 'badge', 'attack')).toBe(0)
    expect(count(html, 'badge', 'health')).toBe(0)
    expect(html).toContain('data-testid="effect-mark"')
  })

  it('卡名單行顯示', async () => {
    const html = await render({ card: getCard('leaf-004'), variant: 'hand' })
    expect(count(html, 'name', 'single')).toBe(1)
  })

  it('完整版型保留效果文字', async () => {
    const html = await render({ card: getCard('tide-007') })
    expect(count(html, 'effect')).toBe(1)
    expect(html).toContain('死亡時')
  })
})

describe('卡面數值變色與場上規則一致', () => {
  it('上限被增益但受傷時生命為紅', async () => {
    const html = await render({ card: getCard('leaf-004'), attack: 2, health: 6, maxHealth: 7 })
    expect(count(html, 'badge', 'health', 'down')).toBe(1)
  })
  it('上限被增益且滿血時生命為綠', async () => {
    const html = await render({ card: getCard('leaf-004'), attack: 2, health: 7, maxHealth: 7 })
    expect(count(html, 'badge', 'health', 'up')).toBe(1)
  })
  it('攻擊低於原始值為紅', async () => {
    const html = await render({ card: getCard('leaf-004'), attack: 1, health: 5, maxHealth: 5 })
    expect(count(html, 'badge', 'attack', 'down')).toBe(1)
    expect(count(html, 'badge', 'health', 'same')).toBe(1)
  })
})

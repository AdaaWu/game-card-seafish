import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import HandFan from '@/components/battle/HandFan.vue'
import { cardDb } from '@/content'
import { computeLayout } from '@/render/battle/battleLayout'

function render(cards: { instanceId: string; cardId: string }[]): Promise<string> {
  const props = {
    cards,
    cardDb,
    playable: new Set<string>(),
    selectedId: null,
    draggingId: null,
    hoverId: null,
    dimOthers: false,
    geo: computeLayout(1366, 768).hand,
    state: 'fan',
  }
  return renderToString(createSSRApp(HandFan, props))
}

describe('手牌空狀態', () => {
  it('沒有手牌時顯示「手牌空了」', async () => {
    expect(await render([])).toContain('手牌空了')
  })

  it('有手牌時不顯示空狀態提示', async () => {
    expect(await render([{ instanceId: 'c1', cardId: 'leaf-001' }])).not.toContain('手牌空了')
  })
})

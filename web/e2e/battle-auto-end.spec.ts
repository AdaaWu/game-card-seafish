// 對戰中我方沒有任何可執行動作時自動結束回合
// 局面靠種子固定：seed 8 對 ai-tide，我方第 1 回合潮能 1，手上只有一張 1 費牌可出
import { expect, test, type Page } from '@playwright/test'

// 5173 被其他專案占用時，用 BATTLE_BASE 指定本專案的 dev server
const SANDBOX = `${process.env.BATTLE_BASE ?? ''}/#/battle-sandbox`
const SEED = '8'
const IDLE_HINT = '無可用動作'

// 從 pinia 讀引擎狀態，畫面上沒有回合數可讀
async function engine(page: Page): Promise<{ turn: number; active: string; legal: number }> {
  return page.evaluate(() => {
    const el = document.querySelector('#app') as unknown as { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } } } }
    const battle = el.__vue_app__.config.globalProperties.$pinia._s.get('battle') as {
      state: { turn: number; activePlayer: string }
      legal: unknown[]
    }
    return { turn: battle.state.turn, active: battle.state.activePlayer, legal: battle.legal.length }
  })
}

async function enterBattle(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill(SEED)
  await page.getByTestId('opponent-ai-tide').click()
  await waitMyTurn(page)
}

async function waitMyTurn(page: Page, timeout = 120_000) {
  const btn = page.getByTestId('end-turn')
  await expect(btn).toHaveText('結束回合', { timeout })
  await expect(btn).toBeEnabled({ timeout })
}

// 同 battle-sandbox.spec.ts：出一張可出的牌，生物放到場上，法術有目標就點敵方英雄
async function playOne(page: Page): Promise<boolean> {
  const card = page.locator('.hand-inner.playable').first()
  if ((await card.count()) === 0) return false
  await card.click()
  await page.waitForTimeout(150)
  const noTarget = page.getByTestId('play-no-target')
  if (await noTarget.count()) await noTarget.click()
  else if (await page.locator('svg.arrow').count()) await page.locator('[data-hero="p2"] .portrait-wrap').click({ force: true })
  else if (await page.locator('.hand-inner.selected').count()) {
    const box = await page.getByTestId('battle-ui').boundingBox()
    if (!box) throw new Error('找不到戰場')
    const s = box.width / 1920
    await page.mouse.click(box.x + 1300 * s, box.y + 640 * s)
  }
  return true
}

// 一直出牌到沒有可出的牌，再等動畫跑完
async function playUntilIdle(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (!(await playOne(page))) break
    await expect(page.locator('.ui.locked')).toHaveCount(0, { timeout: 30_000 })
  }
}

test('出完最後一張可出的牌後提示無可用動作並自動進入對手回合', async ({ page }) => {
  test.setTimeout(180_000)
  await enterBattle(page)
  expect((await engine(page)).legal).toBeGreaterThan(1)
  await playUntilIdle(page)
  // 前置條件：已出完牌且動畫結束，只剩結束回合
  expect((await engine(page)).legal).toBe(1)
  const idleAt = Date.now()
  await expect(page.getByText(IDLE_HINT)).toBeVisible({ timeout: 2_500 })
  const btn = page.getByTestId('end-turn')
  // 提示出現當下還沒結束回合，或已延遲至少 800ms
  const hintText = await btn.textContent()
  if (Date.now() - idleAt < 800) expect(hintText).toBe('結束回合')
  await expect(btn).toHaveText('對手回合', { timeout: 4_000 })
  await expect(btn).toHaveClass(/enemy/)
  // 延遲約 1 秒，不能立即結束也不能拖太久
  expect(Date.now() - idleAt).toBeLessThan(4_000)
  expect((await engine(page)).active).toBe('p2')
})

test('仍有可用動作時等 3 秒仍停在我方回合', async ({ page }) => {
  test.setTimeout(120_000)
  await enterBattle(page)
  const before = await engine(page)
  expect(before.legal).toBeGreaterThan(1)
  await page.waitForTimeout(3_000)
  await expect(page.getByTestId('end-turn')).toHaveText('結束回合')
  await expect(page.getByText(IDLE_HINT)).toHaveCount(0)
  const after = await engine(page)
  expect(after.turn).toBe(before.turn)
  expect(after.active).toBe('p1')
})

test('自動結束觸發的同時按結束回合鈕，回合數只前進 1', async ({ page }) => {
  test.setTimeout(180_000)
  await enterBattle(page)
  const start = (await engine(page)).turn
  await playUntilIdle(page)
  expect((await engine(page)).legal).toBe(1)
  await expect(page.getByText(IDLE_HINT)).toBeVisible({ timeout: 2_500 })
  await page.getByTestId('end-turn').click({ force: true })
  await expect(page.getByTestId('end-turn')).toHaveText('對手回合', { timeout: 3_000 })
  expect((await engine(page)).turn).toBe(start + 1)
  // 對手回合跑完回到我方：只前進 2（我方結束 1 次、對手結束 1 次）
  await waitMyTurn(page)
  await page.waitForTimeout(1_500)
  const now = await engine(page)
  expect(now.active).toBe('p1')
  expect(now.turn).toBe(start + 2)
})

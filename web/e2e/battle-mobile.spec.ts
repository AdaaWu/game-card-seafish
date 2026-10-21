// 手機情境：直式轉向提示可返回選單、系統中斷拖曳時手牌放回
import { expect, test } from '@playwright/test'

// 5173 被其他專案占用時，用 BATTLE_BASE 指定本專案的 dev server
const SANDBOX = `${process.env.BATTLE_BASE ?? ''}/#/battle-sandbox`

test('直式畫面的轉向提示可點返回選單', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('8')
  await page.getByTestId('opponent-ai-tide').click()
  const back = page.getByTestId('rotate-back')
  await expect(back).toBeVisible()
  const box = await back.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)
  await back.click()
  await expect(page).toHaveURL(/#\/menu$/)
})

test('拖曳手牌時收到 pointercancel 會放回手牌', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('8')
  await page.getByTestId('opponent-ai-tide').click()
  const end = page.getByTestId('end-turn')
  await expect(end).toHaveText('結束回合', { timeout: 120_000 })
  await expect(end).toBeEnabled({ timeout: 120_000 })
  const card = page.locator('.hand-inner').first()
  const box = await card.boundingBox()
  if (!box) throw new Error('找不到手牌')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(683, 330, { steps: 10 })
  await expect(page.locator('.drag-ghost')).toHaveCount(1)
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')))
  await expect(page.locator('.drag-ghost')).toHaveCount(0)
  await page.mouse.up()
  await expect(page.locator('.hand-inner')).toHaveCount(await page.locator('[data-hand]').count())
})

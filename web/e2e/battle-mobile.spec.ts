// 手機情境：直式版面可完整對戰、系統中斷拖曳時手牌放回
import { expect, test, type Page } from '@playwright/test'
import { computeLayout } from '../src/render/battle/battleLayout'
import { slotPos } from '../src/render/battle/insertPreview'

// 5173 被其他專案占用時，用 BATTLE_BASE 指定本專案的 dev server
const SANDBOX = `${process.env.BATTLE_BASE ?? ''}/#/battle-sandbox`

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}

// 從 pinia 讀引擎狀態
async function engine(page: Page): Promise<{ turn: number; active: string; myBoard: number; enemyHp: number }> {
  return page.evaluate(() => {
    const el = document.querySelector('#app') as unknown as { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } } } }
    const battle = el.__vue_app__.config.globalProperties.$pinia._s.get('battle') as {
      state: { turn: number; activePlayer: string; players: Record<string, { hero: { health: number }; board: unknown[] }> }
    }
    const s = battle.state
    return { turn: s.turn, active: s.activePlayer, myBoard: s.players.p1!.board.length, enemyHp: s.players.p2!.hero.health }
  })
}

async function waitMyTurn(page: Page, timeout = 120_000) {
  const btn = page.getByTestId('end-turn')
  await expect(btn).toHaveText('結束回合', { timeout })
  await expect(btn).toBeEnabled({ timeout })
}

// 我方第 index 格（共 count 隻）的頁面座標，依舞台尺寸重算版面
async function mySlot(page: Page, index: number, count: number): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('battle-ui').boundingBox()
  if (!box) throw new Error('找不到戰場')
  const l = computeLayout(box.width, box.height)
  const g = l.boardGeo
  const p = slotPos(index, count, g)
  const x = l.lw / 2 + p.x
  const y = l.boardCy + g.rowOffset + p.row * g.rowPitch
  return { x: box.x + x * l.scale, y: box.y + y * l.scale }
}

test('直式 390×844 直接顯示戰場，不出現轉向提示', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('8')
  await page.getByTestId('opponent-ai-tide').click()
  await expect(page.getByTestId('battle-ui')).toBeVisible()
  await waitMyTurn(page)
  await expect(page.getByTestId('rotate-back')).toHaveCount(0)
})

// seed 4 對 ai-tide：第 1 回合可出 1 費生物，且撐到第 3 回合
test('直式 390×844 可出牌、可攻擊、可結束回合', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('4')
  await page.getByTestId('opponent-ai-tide').click()
  await waitMyTurn(page)

  // 點手牌區展開，再點可出的牌、點我方前排中間
  await page.locator('.hand-inner').first().click()
  await expect(page.getByTestId('hand')).toHaveClass(/expanded/)
  await page.locator('.hand-inner.playable').first().click()
  await expect(page.locator('.hand-inner.selected')).toHaveCount(1)
  const slot = await mySlot(page, 0, 1)
  await page.mouse.click(slot.x, slot.y)
  await expect.poll(async () => (await engine(page)).myBoard, { timeout: 30_000 }).toBe(1)

  // 等到生物可攻擊的回合：點我方生物再點敵方英雄
  await expect.poll(async () => (await engine(page)).turn, { timeout: 120_000 }).toBeGreaterThanOrEqual(3)
  await waitMyTurn(page)
  expect((await engine(page)).myBoard).toBe(1)
  const hpBefore = (await engine(page)).enemyHp
  const me = await mySlot(page, 0, 1)
  await page.mouse.click(me.x, me.y)
  await expect(page.locator('svg.arrow')).toHaveCount(1)
  await page.locator('[data-hero="p2"] .portrait-wrap').click({ force: true })
  await expect.poll(async () => (await engine(page)).enemyHp, { timeout: 30_000 }).toBeLessThan(hpBefore)

  // 動畫結束後按結束回合，等對手回合結束再回到我方
  const turn = (await engine(page)).turn
  await waitMyTurn(page)
  await page.getByTestId('end-turn').click()
  await expect.poll(async () => (await engine(page)).turn, { timeout: 30_000 }).toBeGreaterThan(turn)
  await waitMyTurn(page)
  expect((await engine(page)).active).toBe('p1')
  expect(errors).toEqual([])
})

test('極小螢幕 300×600 顯示轉向提示，返回選單按鈕可點', async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 600 })
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

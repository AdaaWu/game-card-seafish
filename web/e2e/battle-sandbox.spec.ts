// 臨時 e2e：測試頁開打，出牌、結束回合、等 AI 回合，確認沒有 console error
import { expect, test, type Page } from '@playwright/test'
import { computeLayout } from '../src/render/battle/battleLayout'
import { slotPos } from '../src/render/battle/insertPreview'

const SHOTS = '/private/tmp/claude-501/battle-shots'
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

// 1920×1080 邏輯座標轉成頁面座標
async function clickLogical(page: Page, x: number, y: number) {
  const box = await page.getByTestId('battle-ui').boundingBox()
  if (!box) throw new Error('找不到戰場')
  const s = box.width / 1920
  await page.mouse.click(box.x + x * s, box.y + y * s)
}

async function waitMyTurn(page: Page, timeout = 120_000) {
  const btn = page.getByTestId('end-turn')
  await expect(btn).toHaveText('結束回合', { timeout })
  await expect(btn).toBeEnabled({ timeout })
}

// 出一張可出的牌：生物放到場上，法術有目標就點敵方英雄
async function playOne(page: Page): Promise<boolean> {
  const card = page.locator('.hand-inner.playable').first()
  if ((await card.count()) === 0) return false
  await card.click()
  await page.waitForTimeout(150)
  const arrow = page.locator('svg.arrow')
  const noTarget = page.getByTestId('play-no-target')
  if (await noTarget.count()) {
    await noTarget.click()
  } else if (await arrow.count()) {
    await page.locator('[data-hero="p2"] .portrait-wrap').click({ force: true })
    if (await arrow.count()) await clickLogical(page, 30, 520)
  } else if (await page.locator('.hand-inner.selected').count()) {
    await clickLogical(page, 1300, 640)
  }
  await page.waitForTimeout(200)
  await expect(page.getByTestId('end-turn')).toBeEnabled({ timeout: 60_000 })
  return true
}

// 掃過我方場地可能的位置：點到可攻擊的生物就打英雄，被守護擋住改打敵方生物
async function attackAll(page: Page) {
  const xs = Array.from({ length: 11 }, (_, k) => 960 + (k - 5) * 84)
  const endTurn = page.getByTestId('end-turn')
  const arrow = page.locator('svg.arrow')
  const busy = async () => !(await endTurn.isEnabled())
  for (let round = 0; round < 8; round++) {
    let attacked = false
    for (const x of xs) {
      await clickLogical(page, x, 665)
      await page.waitForTimeout(80)
      if (!(await arrow.count())) continue
      await page.locator('[data-hero="p2"] .portrait-wrap').click({ force: true })
      await page.waitForTimeout(150)
      attacked = await busy()
      for (const ex of xs) {
        if (attacked) break
        if (!(await arrow.count())) await clickLogical(page, x, 665)
        await page.waitForTimeout(80)
        if (!(await arrow.count())) break
        await clickLogical(page, ex, 375)
        await page.waitForTimeout(150)
        attacked = await busy()
      }
      if (!attacked && (await arrow.count())) await page.keyboard.press('Escape')
      if (attacked) {
        await expect(endTurn).toBeEnabled({ timeout: 60_000 }).catch(() => undefined)
        break
      }
    }
    if (!attacked || (await page.locator('.result').count())) return
  }
}

test('測試頁：出牌、結束回合、AI 回合，連續 3 回合無錯誤', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('7')
  await page.getByTestId('opponent-ai-tide').click()
  await waitMyTurn(page)
  await page.screenshot({ path: `${SHOTS}/01-start.png` })

  for (let turn = 1; turn <= 3; turn++) {
    for (let i = 0; i < 3; i++) if (!(await playOne(page))) break
    if (turn === 2) {
      await page.locator('.hand-inner').first().hover()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/02-hover.png` })
    }
    await page.getByTestId('end-turn').click({ force: true })
    await page.waitForTimeout(1200)
    if (turn === 3) await page.screenshot({ path: `${SHOTS}/03-ai-turn.png` })
    if (await page.locator('.result').count()) break
    await waitMyTurn(page)
  }
  await page.screenshot({ path: `${SHOTS}/04-after-3-turns.png` })
  expect(errors).toEqual([])
})

test('測試頁：完整打完一場並依戰果離開', async ({ page }) => {
  test.setTimeout(1_500_000)
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('3')
  await page.getByTestId('opponent-ai-frost').click()
  for (let turn = 0; turn < 60; turn++) {
    if (await page.locator('.result').count()) break
    try {
      await waitMyTurn(page, 20_000)
    } catch {
      if (await page.locator('.result').count()) break
      continue
    }
    for (let i = 0; i < 4; i++) if (!(await playOne(page))) break
    await attackAll(page)
    if (await page.locator('.result').count()) break
    // 播放中點畫面快轉
    await page.getByTestId('end-turn').click({ force: true })
    for (let k = 0; k < 4; k++) {
      await page.waitForTimeout(400)
      await clickLogical(page, 300, 520)
    }
  }
  // 勝利與平手按「繼續」，戰敗按「回選單」
  const result = page.locator('.result')
  await expect(result).toBeVisible({ timeout: 30_000 })
  const lost = await result.evaluate((el) => el.classList.contains('lose'))
  // 數據列：回合數與總傷害，勝利另有 3 張獎勵卡
  await expect(page.getByTestId('result-rounds')).toBeVisible()
  const damage = page.getByTestId('result-damage')
  await expect(damage).toBeVisible()
  expect(Number((await damage.textContent())?.match(/\d+/)?.[0])).toBeGreaterThanOrEqual(1)
  const won = await result.evaluate((el) => el.classList.contains('win'))
  if (won) await expect(page.getByTestId('result-rewards').getByTestId('result-reward')).toHaveCount(3)
  const exit = lost ? page.getByTestId('back-map') : page.getByRole('button', { name: '繼續' })
  await expect(exit).toBeVisible({ timeout: 30_000 })
  if (lost) await expect(exit).toHaveText('回選單')
  await page.screenshot({ path: `${SHOTS}/05-result.png` })
  await exit.click()
  await expect(page.getByTestId('last-result')).toBeVisible()
  expect(errors).toEqual([])
})

// 從 pinia 讀引擎狀態
async function engine(page: Page): Promise<{ turn: number; active: string; myBoard: number }> {
  return page.evaluate(() => {
    const el = document.querySelector('#app') as unknown as { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } } } }
    const battle = el.__vue_app__.config.globalProperties.$pinia._s.get('battle') as {
      state: { turn: number; activePlayer: string; players: Record<string, { board: unknown[] }> }
    }
    const s = battle.state
    return { turn: s.turn, active: s.activePlayer, myBoard: s.players.p1!.board.length }
  })
}

// 我方唯一一隻生物的頁面座標
async function myOnlyMinion(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('battle-ui').boundingBox()
  if (!box) throw new Error('找不到戰場')
  const l = computeLayout(box.width, box.height)
  const p = slotPos(0, 1, l.boardGeo)
  return { x: box.x + (l.lw / 2 + p.x) * l.scale, y: box.y + (l.boardCy + l.boardGeo.rowOffset) * l.scale }
}

// seed 4 對 ai-tide：第 1 回合出 1 費生物，第 3 回合把敵方英雄設為 1 血再攻擊
test('測試頁：固定勝利時結算顯示獲得卡片與 3 張獎勵', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(SANDBOX)
  await page.getByTestId('seed').fill('4')
  await page.getByTestId('opponent-ai-tide').click()
  await waitMyTurn(page)
  await playOne(page)
  await expect.poll(async () => (await engine(page)).myBoard, { timeout: 30_000 }).toBe(1)
  await expect.poll(async () => (await engine(page)).turn, { timeout: 120_000 }).toBeGreaterThanOrEqual(3)
  await waitMyTurn(page)
  expect((await engine(page)).myBoard).toBe(1)

  await page.evaluate(() => {
    const el = document.querySelector('#app') as unknown as { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } } } }
    const battle = el.__vue_app__.config.globalProperties.$pinia._s.get('battle') as {
      state: { players: Record<string, { hero: { health: number; armor: number } }> }
    }
    battle.state.players.p2!.hero.health = 1
    battle.state.players.p2!.hero.armor = 0
  })
  const me = await myOnlyMinion(page)
  await page.mouse.click(me.x, me.y)
  await expect(page.locator('svg.arrow')).toHaveCount(1)
  await page.locator('[data-hero="p2"] .portrait-wrap').click({ force: true })

  const result = page.locator('.result')
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result).toHaveClass(/win/)
  await expect(page.getByTestId('result-rewards-title')).toHaveText('獲得卡片')
  await expect(page.getByTestId('result-rewards').getByTestId('result-reward')).toHaveCount(3)
  expect(errors).toEqual([])
})

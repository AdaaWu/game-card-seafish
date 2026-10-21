// 新手教學 e2e 共用操作：從選單進 ch1-b1、依教學高亮位置操作
import { expect, type Page } from '@playwright/test'

// 5173 被其他專案占用時，用 BATTLE_BASE 指定本專案的 dev server
export const BASE = process.env.BATTLE_BASE ?? ''

export function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

// 從 pinia 讀資料，畫面上沒有存檔欄位可讀
export async function piniaValue<T>(page: Page, storeId: string, key: string): Promise<T> {
  return page.evaluate(
    ([id, k]) => {
      const el = document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } } }
      }
      const store = el.__vue_app__.config.globalProperties.$pinia._s.get(id!)
      const settings = store?.settings as Record<string, unknown> | undefined
      return (k!.startsWith('settings.') ? settings?.[k!.slice(9)] : store?.[k!]) as never
    },
    [storeId, key],
  )
}

async function skipOpeningIfShown(page: Page) {
  const opening = page.locator('.opening .skip')
  try {
    await opening.waitFor({ state: 'visible', timeout: 3_000 })
    await opening.click()
  } catch {
    // 看過開場時不會出現
  }
}

// 劇情地圖點第一場、跳過戰前對話進入對戰
export async function startCh1b1FromStory(page: Page) {
  await skipOpeningIfShown(page)
  await page.getByRole('button', { name: /送錯的飯糰/ }).click()
  await page.getByRole('button', { name: '開始', exact: true }).click()
  await page.locator('.tools button', { hasText: '跳過' }).click()
  await page.locator('.modal button', { hasText: '跳過' }).click()
  await expect(page.getByTestId('battle-ui')).toBeVisible({ timeout: 30_000 })
}

export async function enterCh1b1FromMenu(page: Page) {
  await page.goto(`${BASE}/#/`)
  await page.locator('main.title-page').click()
  await page.getByRole('button', { name: /劇情模式/ }).click()
  await startCh1b1FromStory(page)
}

export async function waitBeat(page: Page, id: string) {
  await expect(page.getByTestId('tutorial')).toHaveAttribute('data-beat', id, { timeout: 60_000 })
  await expect(page.getByTestId('tutorial-callout')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('tutorial-hole').first()).toBeVisible()
}

async function centerOf(page: Page, focus: string, nth = 0): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-testid="tutorial-hole"][data-focus="${focus}"]`).nth(nth).boundingBox()
  if (!box) throw new Error(`找不到高亮 ${focus}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

async function idle(page: Page) {
  await expect(page.locator('.ui.locked')).toHaveCount(0, { timeout: 60_000 })
}

// 手機橫向時手牌收合，第一下只展開
async function selectPlayable(page: Page) {
  const card = page.locator('.hand-inner.playable').first()
  await card.click()
  await page.waitForTimeout(350)
  if ((await page.locator('.hand-inner.selected').count()) === 0 && !(await page.locator('svg.arrow').count())) {
    await page.locator('.hand-inner.playable').first().click()
    await page.waitForTimeout(350)
  }
}

export async function next(page: Page) {
  await page.getByTestId('tutorial-next').click()
}

export async function playCreature(page: Page) {
  await selectPlayable(page)
  const at = await centerOf(page, 'myBoard')
  await page.mouse.click(at.x, at.y)
  await idle(page)
}

export async function endTurn(page: Page) {
  await page.getByTestId('end-turn').click()
}

export async function attack(page: Page, target: 'enemyMinions' | 'enemyHero') {
  await drag(page, await centerOf(page, 'myMinions'), await centerOf(page, target))
  await idle(page)
}

export async function castOnEnemyMinion(page: Page) {
  const target = await centerOf(page, 'enemyMinions')
  await selectPlayable(page)
  await page.mouse.click(target.x, target.y)
  await idle(page)
}

export async function hoverHandCard(page: Page) {
  const card = page.locator('.hand-inner').first()
  await page.mouse.move(5, 5)
  if (await page.locator('.hand.collapsed').count()) {
    await card.click()
    await page.mouse.move(5, 5)
    await page.waitForTimeout(350)
  }
  await page.locator('.hand-inner').first().hover()
}

// 依序走完全部教學；每個 beat 出現時呼叫 onBeat（截圖用）
export async function runWholeTutorial(page: Page, onBeat: (id: string) => Promise<void> = async () => {}) {
  const at = async (id: string) => {
    await waitBeat(page, id)
    await page.waitForTimeout(200)
    await onBeat(id)
  }
  for (const id of ['s1-hp', 's1-enemy', 's1-hand', 's2-mana', 's2-cost']) {
    await at(id)
    await next(page)
  }
  await at('s3-play')
  await playCreature(page)
  await at('s4-end')
  await endTurn(page)
  await expect(page.getByTestId('tutorial')).toHaveAttribute('data-beat', 's4-wait', { timeout: 30_000 })
  await onBeat('s4-wait')
  await at('s5-attack')
  await attack(page, 'enemyMinions')
  await at('s5-stats')
  await next(page)
  await at('s5-play')
  await playCreature(page)
  await at('s5-end')
  await endTurn(page)
  await at('s6-try')
  await drag(page, await centerOf(page, 'myMinions'), await centerOf(page, 'enemyHero'))
  await at('s6-taunt')
  await next(page)
  await at('s7-spell')
  await castOnEnemyMinion(page)
  await at('s8-detail')
  await hoverHandCard(page)
  await at('s9-face')
  await attack(page, 'enemyHero')
}

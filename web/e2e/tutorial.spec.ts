// 第一場劇情戰的新手教學：完整走完、跳過、重打不再觸發
import { expect, test, type Page } from '@playwright/test'
import { BASE, enterCh1b1FromMenu, piniaValue, runWholeTutorial, startCh1b1FromStory, trackErrors, waitBeat } from './tutorial-driver'

async function waitMyTurn(page: Page) {
  const btn = page.getByTestId('end-turn')
  await expect(btn).toHaveText('結束回合', { timeout: 120_000 })
  await expect(btn).toBeEnabled({ timeout: 120_000 })
}

async function skipTutorial(page: Page) {
  await page.getByTestId('tutorial-skip').click()
  await page.getByTestId('tutorial-skip-confirm').click()
  await expect(page.getByTestId('tutorial')).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
})

test('從選單進入第一場，走完全部教學步驟後繼續對戰', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = trackErrors(page)
  await enterCh1b1FromMenu(page)
  await runWholeTutorial(page)
  await expect(page.getByTestId('tutorial')).toHaveCount(0, { timeout: 30_000 })
  await expect.poll(() => piniaValue<boolean>(page, 'settings', 'settings.tutorialDone')).toBe(true)
  // 教學結束後恢復一般對戰：可以結束回合、對手回合跑完再輪回我方
  await waitMyTurn(page)
  await page.getByTestId('end-turn').click()
  await expect(page.getByTestId('end-turn')).toHaveText('對手回合', { timeout: 10_000 })
  await waitMyTurn(page)
  expect(errors).toEqual([])
})

test('跳過教學後恢復一般對戰並記錄完成', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = trackErrors(page)
  await enterCh1b1FromMenu(page)
  await waitBeat(page, 's1-hp')
  // 教學期間卡牌鎖住
  await expect(page.locator('.hand-inner.playable')).toHaveCount(0)
  await skipTutorial(page)
  await waitMyTurn(page)
  await expect(page.locator('.hand-inner.playable').first()).toBeVisible()
  await expect.poll(() => piniaValue<boolean>(page, 'settings', 'settings.tutorialDone')).toBe(true)
  await page.getByTestId('end-turn').click()
  await expect(page.getByTestId('end-turn')).toHaveText('對手回合', { timeout: 10_000 })
  await waitMyTurn(page)
  expect(errors).toEqual([])
})

test('完成過教學後重打第一場不再觸發', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = trackErrors(page)
  await enterCh1b1FromMenu(page)
  await waitBeat(page, 's1-hp')
  await skipTutorial(page)
  await expect.poll(() => piniaValue<boolean>(page, 'settings', 'settings.tutorialDone')).toBe(true)
  // 重新載入後從章節地圖再打一次
  await page.goto(`${BASE}/#/story`)
  await startCh1b1FromStory(page)
  await waitMyTurn(page)
  await page.waitForTimeout(1_000)
  await expect(page.getByTestId('tutorial')).toHaveCount(0)
  expect(errors).toEqual([])
})

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ProgressRepository } from '@/persistence'
import { useProgressStore } from '@/stores/progress'

async function freshStore(repo = new ProgressRepository(null)) {
  setActivePinia(createPinia())
  const store = useProgressStore()
  await store.init(repo)
  return store
}

async function win(store: ReturnType<typeof useProgressStore>, id: string) {
  store.startBattle(id)
  return store.reportBattleResult(id, 'win')
}

describe('progress store 解鎖邏輯', () => {
  let store: ReturnType<typeof useProgressStore>
  beforeEach(async () => {
    store = await freshStore()
  })

  it('新存檔只開放 ch1-b1，其餘鎖定', () => {
    expect(store.statusOf('ch1-b1')).toBe('available')
    expect(store.statusOf('ch1-b2')).toBe('locked')
    expect(store.statusOf('ch2-b1')).toBe('locked')
  })

  it('通關 ch1-b1 後標為已通關並解鎖 ch1-b2', async () => {
    const outcome = await win(store, 'ch1-b1')
    expect(store.statusOf('ch1-b1')).toBe('cleared')
    expect(store.statusOf('ch1-b2')).toBe('available')
    expect(store.statusOf('ch1-b3')).toBe('locked')
    expect(outcome).toEqual({ battleId: 'ch1-b1', result: 'win', newlyUnlockedId: 'ch1-b2' })
  })

  it('落敗不改變進度且不解鎖', async () => {
    store.startBattle('ch1-b1')
    const outcome = await store.reportBattleResult('ch1-b1', 'lose')
    expect(store.statusOf('ch1-b1')).toBe('available')
    expect(store.statusOf('ch1-b2')).toBe('locked')
    expect(outcome.newlyUnlockedId).toBeNull()
    expect(store.pendingOutcome).toEqual({ battleId: 'ch1-b1', result: 'lose', newlyUnlockedId: null })
  })

  it('章節最後一場通關後解鎖下一章第一場', async () => {
    await win(store, 'ch1-b1')
    await win(store, 'ch1-b2')
    expect(store.statusOf('ch2-b1')).toBe('locked')
    const outcome = await win(store, 'ch1-b3')
    expect(store.statusOf('ch2-b1')).toBe('available')
    expect(outcome.newlyUnlockedId).toBe('ch2-b1')
  })

  it('最終戰通關時沒有新解鎖', async () => {
    for (const id of ['ch1-b1', 'ch1-b2', 'ch1-b3', 'ch2-b1', 'ch2-b2', 'ch2-b3', 'ch3-b1', 'ch3-b2']) {
      await win(store, id)
    }
    const outcome = await win(store, 'ch3-b3')
    expect(store.statusOf('ch3-b3')).toBe('cleared')
    expect(outcome.newlyUnlockedId).toBeNull()
  })

  it('重打已通關場次勝利時沒有新解鎖', async () => {
    await win(store, 'ch1-b1')
    const outcome = await win(store, 'ch1-b1')
    expect(outcome.newlyUnlockedId).toBeNull()
    expect(store.clearedBattleIds).toEqual(['ch1-b1'])
  })

  it('鎖定的場次不能開打', () => {
    expect(() => store.startBattle('ch1-b2')).toThrow('ch1-b2')
  })

  it('不存在的場次回報結果時丟錯', async () => {
    await expect(store.reportBattleResult('ch9-b9', 'win')).rejects.toThrow('ch9-b9')
  })

  it('startBattle 後 currentBattle 帶章節、對手與牌組', () => {
    store.startBattle('ch1-b1')
    const b = store.currentBattle
    expect(b?.id).toBe('ch1-b1')
    expect(b?.chapterId).toBe('ch1')
    expect(b?.enemy.name).toBe('殼殼')
    expect(b?.enemyHeroHp).toBe(20)
    expect(b?.enemyDeckId).toBe('ai-tide')
    expect(b?.playerDeckId).toBe('starter-leaf')
    expect(b?.isChapterFinal).toBe(false)
  })

  it('章節最後一場標為 isChapterFinal，中立對手使用 boss 牌組', async () => {
    for (const id of ['ch1-b1', 'ch1-b2', 'ch1-b3', 'ch2-b1', 'ch2-b2', 'ch2-b3', 'ch3-b1', 'ch3-b2']) {
      await win(store, id)
    }
    store.startBattle('ch3-b3')
    expect(store.currentBattle?.isChapterFinal).toBe(true)
    expect(store.currentBattle?.enemyDeckId).toBe('ai-boss')
  })
})

describe('progress store 存檔', () => {
  it('通關紀錄寫入 Repository，重新載入後還原', async () => {
    const repo = new ProgressRepository(null)
    const first = await freshStore(repo)
    await win(first, 'ch1-b1')
    const second = await freshStore(repo)
    expect(second.statusOf('ch1-b1')).toBe('cleared')
    expect(second.statusOf('ch1-b2')).toBe('available')
  })
})

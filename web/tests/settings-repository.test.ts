import { describe, expect, it } from 'vitest'
import { SettingsRepository, type SettingsData } from '@/persistence'

describe('SettingsRepository 開場影片紀錄', () => {
  it('新存檔預設尚未看過開場', async () => {
    const repo = new SettingsRepository(null)
    expect((await repo.load()).seenOpening).toBe(false)
  })

  it('沒有 seenOpening 的舊存檔讀成尚未看過，其他設定保留', async () => {
    const repo = new SettingsRepository(null)
    const legacy = { masterVolume: 50, musicVolume: 40, sfxVolume: 30, speed: 2, skipTutorial: true }
    await repo.save(legacy as unknown as SettingsData)
    const loaded = await repo.load()
    expect(loaded.seenOpening).toBe(false)
    expect(loaded.masterVolume).toBe(50)
    expect(loaded.skipTutorial).toBe(true)
  })

  it('存入看過開場後讀回 true', async () => {
    const repo = new SettingsRepository(null)
    await repo.save({ ...(await repo.load()), seenOpening: true })
    expect((await repo.load()).seenOpening).toBe(true)
  })
})

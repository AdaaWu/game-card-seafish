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

describe('SettingsRepository 動畫速度', () => {
  it('新存檔預設 2 倍速', async () => {
    const repo = new SettingsRepository(null)
    expect((await repo.load()).speed).toBe(2)
  })

  it('存檔選 1 倍速的玩家讀回 1 倍速', async () => {
    const repo = new SettingsRepository(null)
    await repo.save({ ...(await repo.load()), speed: 1 })
    expect((await repo.load()).speed).toBe(1)
  })

  it('存檔沒有速度欄位時讀成 2 倍速', async () => {
    const repo = new SettingsRepository(null)
    const legacy = { masterVolume: 50, musicVolume: 40, sfxVolume: 30, skipTutorial: false }
    await repo.save(legacy as unknown as SettingsData)
    expect((await repo.load()).speed).toBe(2)
  })
})

describe('SettingsRepository 新手教學完成紀錄', () => {
  it('新存檔預設尚未完成教學', async () => {
    const repo = new SettingsRepository(null)
    expect((await repo.load()).tutorialDone).toBe(false)
  })

  it('沒有 tutorialDone 的舊存檔讀成未完成，其他設定保留', async () => {
    const repo = new SettingsRepository(null)
    const legacy = { masterVolume: 50, musicVolume: 40, sfxVolume: 30, speed: 1, skipTutorial: true, seenOpening: true }
    await repo.save(legacy as unknown as SettingsData)
    const loaded = await repo.load()
    expect(loaded.tutorialDone).toBe(false)
    expect(loaded.skipTutorial).toBe(true)
    expect(loaded.seenOpening).toBe(true)
    expect(loaded.speed).toBe(1)
  })

  it('存入完成教學後讀回 true', async () => {
    const repo = new SettingsRepository(null)
    await repo.save({ ...(await repo.load()), tutorialDone: true })
    expect((await repo.load()).tutorialDone).toBe(true)
  })

  it('tutorialDone 不是布林值時讀成未完成', async () => {
    const repo = new SettingsRepository(null)
    await repo.save({ ...(await repo.load()), tutorialDone: 'yes' } as unknown as SettingsData)
    expect((await repo.load()).tutorialDone).toBe(false)
  })
})

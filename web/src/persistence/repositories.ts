// 劇情進度與設定的 Repository
import { SaveSlot, type GameDb } from './db'

export const PROGRESS_SAVE_VERSION = 1
export const SETTINGS_SAVE_VERSION = 1

export interface ProgressData {
  clearedBattleIds: string[]
}

export type GameSpeed = 1 | 2

export interface SettingsData {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  speed: GameSpeed
  skipTutorial: boolean
  seenOpening: boolean
  tutorialDone: boolean
}

export const DEFAULT_SETTINGS: SettingsData = {
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 80,
  speed: 2,
  skipTutorial: false,
  seenOpening: false,
  tutorialDone: false,
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function clampVolume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback
}

export class ProgressRepository {
  private readonly slot: SaveSlot

  constructor(db: GameDb | null) {
    this.slot = new SaveSlot(db, 'progress')
  }

  // 讀不到、版本較新或格式不符時回傳 null
  async load(): Promise<ProgressData | null> {
    const record = await this.slot.read()
    if (!record || record.saveVersion > PROGRESS_SAVE_VERSION) return null
    const data = record.data as Partial<ProgressData> | null
    if (!data || !isStringArray(data.clearedBattleIds)) return null
    return { clearedBattleIds: [...data.clearedBattleIds] }
  }

  async save(data: ProgressData): Promise<void> {
    await this.slot.write(PROGRESS_SAVE_VERSION, { clearedBattleIds: [...data.clearedBattleIds] })
  }
}

export class SettingsRepository {
  private readonly slot: SaveSlot

  constructor(db: GameDb | null) {
    this.slot = new SaveSlot(db, 'settings')
  }

  // 缺漏或不合法的欄位補預設值
  async load(): Promise<SettingsData> {
    const record = await this.slot.read()
    if (!record || record.saveVersion > SETTINGS_SAVE_VERSION) return { ...DEFAULT_SETTINGS }
    const d = (record.data ?? {}) as Partial<Record<keyof SettingsData, unknown>>
    return {
      masterVolume: clampVolume(d.masterVolume, DEFAULT_SETTINGS.masterVolume),
      musicVolume: clampVolume(d.musicVolume, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clampVolume(d.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      speed: d.speed === 1 || d.speed === 2 ? d.speed : DEFAULT_SETTINGS.speed,
      skipTutorial: d.skipTutorial === true,
      seenOpening: d.seenOpening === true,
      tutorialDone: d.tutorialDone === true,
    }
  }

  async save(data: SettingsData): Promise<void> {
    await this.slot.write(SETTINGS_SAVE_VERSION, { ...data })
  }
}

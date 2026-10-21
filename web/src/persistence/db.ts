// Dexie 資料庫與存檔讀寫
import Dexie, { type Table } from 'dexie'

export const DB_NAME = 'seafish'
export const DB_SCHEMA_VERSION = 1

export interface SaveRecord {
  key: string
  saveVersion: number
  data: unknown
  updatedAt: number
}

export class GameDb extends Dexie {
  saves!: Table<SaveRecord, string>

  constructor(name = DB_NAME) {
    super(name)
    this.version(DB_SCHEMA_VERSION).stores({ saves: 'key' })
  }
}

// IndexedDB 不可用時回傳 null，由 Repository 改用記憶體
export function openGameDb(): GameDb | null {
  if (typeof indexedDB === 'undefined') return null
  try {
    return new GameDb()
  } catch {
    return null
  }
}

// 單一存檔鍵的讀寫，資料庫失敗時退回記憶體
export class SaveSlot {
  private memory: SaveRecord | null = null
  private db: GameDb | null
  private readonly key: string

  constructor(db: GameDb | null, key: string) {
    this.db = db
    this.key = key
  }

  async read(): Promise<SaveRecord | null> {
    if (this.db) {
      try {
        return (await this.db.saves.get(this.key)) ?? null
      } catch (e) {
        this.fallback(e)
      }
    }
    return this.memory
  }

  async write(saveVersion: number, data: unknown): Promise<void> {
    const record: SaveRecord = { key: this.key, saveVersion, data, updatedAt: Date.now() }
    this.memory = record
    if (!this.db) return
    try {
      await this.db.saves.put(record)
    } catch (e) {
      this.fallback(e)
    }
  }

  private fallback(e: unknown): void {
    console.warn(`[persistence] IndexedDB 無法使用，改用記憶體存檔（${this.key}）`, e)
    this.db = null
  }
}

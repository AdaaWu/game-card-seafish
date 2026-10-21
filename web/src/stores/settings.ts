// 使用者設定：音量、動畫速度、跳過教學
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { audio } from '@/fx/audio'
import { DEFAULT_SETTINGS, openGameDb, SettingsRepository, type SettingsData } from '@/persistence'

let defaultRepo: SettingsRepository | null = null

export const useSettingsStore = defineStore('settings', () => {
  let repo: SettingsRepository | null = null
  const settings = ref<SettingsData>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  async function init(customRepo?: SettingsRepository): Promise<void> {
    repo = customRepo ?? (defaultRepo ??= new SettingsRepository(openGameDb()))
    settings.value = await repo.load()
    audio.setVolumes(settings.value)
    loaded.value = true
  }

  async function update(patch: Partial<SettingsData>): Promise<void> {
    settings.value = { ...settings.value, ...patch }
    audio.setVolumes(settings.value)
    await repo?.save(settings.value)
  }

  return { settings, loaded, init, update }
})

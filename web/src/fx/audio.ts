// 音效管理器：有音檔走 Howler，沒有音檔用 Web Audio 合成暫代音
import { Howl, Howler } from 'howler'

export const SFX_NAMES = [
  'sfx_card_draw',
  'sfx_card_burn',
  'sfx_card_hover',
  'sfx_card_play',
  'sfx_card_return',
  'sfx_spell_cast_leaf',
  'sfx_spell_cast_tide',
  'sfx_spell_cast_frost',
  'sfx_spell_cast_light',
  'sfx_spell_cast_neutral',
  'sfx_summon_land',
  'sfx_summon_land_big',
  'sfx_summon_legendary',
  'sfx_attack_whoosh',
  'sfx_attack_hit_light',
  'sfx_attack_hit_heavy',
  'sfx_damage_tick',
  'sfx_heal',
  'sfx_buff',
  'sfx_debuff',
  'sfx_minion_death',
  'sfx_freeze',
  'sfx_unfreeze',
  'sfx_bubble_gain',
  'sfx_bubble_pop',
  'sfx_stealth',
  'sfx_symbiosis',
  'sfx_hero_hit',
  'sfx_turn_start',
  'sfx_turn_end',
  'sfx_mana_fill',
  'sfx_final_blow',
  'sfx_ui_click',
  'sfx_ui_hover',
  'sfx_ui_back',
  'sfx_error',
  'sfx_unlock',
  'sfx_dialog_next',
  'sfx_text_blip',
] as const

export const BGM_NAMES = [
  'bgm_title',
  'bgm_map',
  'bgm_battle_normal',
  'bgm_battle_boss',
  'bgm_story_calm',
  'bgm_story_tense',
  'bgm_victory',
  'bgm_defeat',
] as const

export type SfxName = (typeof SFX_NAMES)[number]
export type BgmName = (typeof BGM_NAMES)[number]

export interface VolumeSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
}

const MAX_INSTANCES = 3
const QUIET_SFX: ReadonlySet<string> = new Set(['sfx_card_hover', 'sfx_ui_hover', 'sfx_text_blip'])

// assets/audio/ 底下的音檔，key 為不含副檔名的檔名
const audioModules = import.meta.glob<string>('@assets/audio/**/*.{webm,mp3,ogg,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const audioFiles = new Map<string, string[]>()
for (const [path, url] of Object.entries(audioModules)) {
  const name = path.replace(/^.*\//, '').replace(/\.[^.]+$/, '')
  audioFiles.set(name, [...(audioFiles.get(name) ?? []), url])
}

type Voice = 'blip' | 'whoosh' | 'thump' | 'chimeUp' | 'chimeDown' | 'sparkle' | 'error'

// 依名稱類別挑合成音色
function voiceFor(name: string): Voice {
  if (name === 'sfx_error') return 'error'
  if (/hit|hero_hit|land_big|final_blow/.test(name)) return 'thump'
  if (/whoosh|draw|return|burn|stealth|tide/.test(name)) return 'whoosh'
  if (/death|debuff|unfreeze|defeat/.test(name)) return 'chimeDown'
  if (/freeze|frost|bubble/.test(name)) return 'sparkle'
  if (/heal|buff|unlock|mana|turn_start|legendary|light|leaf|symbiosis|victory/.test(name)) return 'chimeUp'
  return 'blip'
}

class Synth {
  private ctx: AudioContext | null = null

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
    if (!Ctor) return null
    try {
      this.ctx = new Ctor()
    } catch {
      return null
    }
    return this.ctx
  }

  resume(): void {
    void this.context()?.resume().catch(() => undefined)
  }

  play(voice: Voice, volume: number): number {
    const ctx = this.context()
    if (!ctx || volume <= 0) return 0
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.value = volume * 0.35
    out.connect(ctx.destination)
    const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', endFreq?: number) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t + start)
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + start + dur)
      g.gain.setValueAtTime(0.0001, t + start)
      g.gain.exponentialRampToValueAtTime(1, t + start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur)
      osc.connect(g).connect(out)
      osc.start(t + start)
      osc.stop(t + start + dur + 0.02)
    }
    switch (voice) {
      case 'blip':
        tone(880, 0, 0.08, 'triangle')
        return 0.1
      case 'error':
        tone(220, 0, 0.12, 'sine', 160)
        tone(180, 0.1, 0.14, 'sine', 120)
        return 0.26
      case 'thump':
        tone(140, 0, 0.22, 'sine', 45)
        return 0.24
      case 'chimeUp':
        ;[660, 880, 1320].forEach((f, i) => tone(f, i * 0.07, 0.3, 'sine'))
        return 0.5
      case 'chimeDown':
        ;[880, 660, 440].forEach((f, i) => tone(f, i * 0.08, 0.3, 'sine'))
        return 0.55
      case 'sparkle':
        ;[1760, 2350].forEach((f, i) => tone(f, i * 0.05, 0.18, 'triangle'))
        return 0.25
      case 'whoosh': {
        const len = Math.floor(ctx.sampleRate * 0.25)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
        const src = ctx.createBufferSource()
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(400, t)
        filter.frequency.exponentialRampToValueAtTime(2400, t + 0.25)
        src.buffer = buf
        src.connect(filter).connect(out)
        src.start(t)
        return 0.25
      }
    }
  }
}

class AudioManager {
  private volumes: VolumeSettings = { masterVolume: 80, musicVolume: 60, sfxVolume: 80 }
  private readonly howls = new Map<string, Howl>()
  private readonly brokenFiles = new Set<string>()
  private readonly active = new Map<string, number>()
  private readonly synth = new Synth()
  private bgm: { name: BgmName; howl: Howl | null } | null = null

  // 第一次使用者手勢時呼叫，解鎖瀏覽器音訊
  unlock(): void {
    this.synth.resume()
    try {
      void Howler.ctx?.resume()
    } catch {
      // 無音訊環境時略過
    }
  }

  setVolumes(v: VolumeSettings): void {
    this.volumes = { ...v }
    this.bgm?.howl?.volume(this.musicGain())
  }

  play(name: SfxName): void {
    try {
      if ((this.active.get(name) ?? 0) >= MAX_INSTANCES) return
      const gain = this.sfxGain() * (QUIET_SFX.has(name) ? 0.3 : 1)
      if (gain <= 0) return
      const howl = this.howlFor(name, false)
      if (howl) {
        howl.volume(gain)
        this.track(name, howl.duration() || 0.5)
        howl.play()
        return
      }
      this.track(name, this.synth.play(voiceFor(name), gain))
    } catch (e) {
      console.warn(`[audio] 播放 ${name} 失敗`, e)
    }
  }

  // 沒有音檔時只有勝負短曲用合成音暫代，其餘背景音樂靜音
  playBgm(name: BgmName): void {
    try {
      if (this.bgm?.name === name) return
      this.stopBgm()
      const loop = name !== 'bgm_victory' && name !== 'bgm_defeat'
      const howl = this.howlFor(name, loop)
      this.bgm = { name, howl }
      if (howl) {
        howl.volume(this.musicGain())
        howl.play()
      } else if (!loop) {
        this.synth.play(name === 'bgm_victory' ? 'chimeUp' : 'chimeDown', this.musicGain())
      }
    } catch (e) {
      console.warn(`[audio] 播放 ${name} 失敗`, e)
    }
  }

  stopBgm(): void {
    try {
      this.bgm?.howl?.stop()
    } catch {
      // 忽略
    }
    this.bgm = null
  }

  private sfxGain(): number {
    return (this.volumes.masterVolume / 100) * (this.volumes.sfxVolume / 100)
  }

  private musicGain(): number {
    return (this.volumes.masterVolume / 100) * (this.volumes.musicVolume / 100)
  }

  private track(name: string, seconds: number): void {
    if (seconds <= 0) return
    this.active.set(name, (this.active.get(name) ?? 0) + 1)
    setTimeout(() => this.active.set(name, Math.max(0, (this.active.get(name) ?? 1) - 1)), seconds * 1000)
  }

  private howlFor(name: string, loop: boolean): Howl | null {
    const src = audioFiles.get(name)
    if (!src || this.brokenFiles.has(name)) return null
    let howl = this.howls.get(name)
    if (!howl) {
      howl = new Howl({
        src,
        loop,
        onloaderror: () => this.brokenFiles.add(name),
        onplayerror: () => this.brokenFiles.add(name),
      })
      this.howls.set(name, howl)
    }
    return howl
  }
}

export const audio = new AudioManager()

// 動畫佇列：事件依序轉成動畫批次播放，同批並行；速度倍率與快轉在此控制
import type { GameEvent } from '@/engine'
import { planEvents, type AnimCommand, type PlanContext } from './animationPlan'

export const FAST_FORWARD = 3

export interface Pace {
  readonly speed: number
  // 以目前倍率播放 timeline，回傳播完的 Promise
  run(tl: gsap.core.Timeline): Promise<void>
  wait(ms: number): Promise<void>
}

export interface AnimationStage {
  // 依指令播放動畫與音效；需要更新顯示狀態時呼叫 apply
  run(cmd: AnimCommand, pace: Pace, apply: () => void): Promise<void>
}

export interface AnimatorOptions {
  getSpeed: () => number
  applyEvent: (event: GameEvent) => void
}

// 播放後才套用顯示狀態的事件（生物還要留在場上播完）
const APPLY_AFTER = new Set<GameEvent['type']>(['death', 'bounce'])

export class Animator {
  private boostFactor = 1
  private readonly active = new Set<gsap.core.Timeline>()
  private disposed = false

  private readonly stage: AnimationStage
  private readonly options: AnimatorOptions

  constructor(stage: AnimationStage, options: AnimatorOptions) {
    this.stage = stage
    this.options = options
  }

  get speed(): number {
    return this.options.getSpeed() * this.boostFactor
  }

  // 播放中點擊畫面：剩餘佇列改 3x，不跳過
  boost(): void {
    this.boostFactor = FAST_FORWARD / Math.max(1, this.options.getSpeed())
    for (const tl of this.active) tl.timeScale(this.speed)
  }

  resetBoost(): void {
    this.boostFactor = 1
  }

  private readonly pace: Pace = (() => {
    const self = this
    return {
      get speed() {
        return self.speed
      },
      run: (tl: gsap.core.Timeline) => self.runTimeline(tl),
      wait: (ms: number) => self.wait(ms),
    }
  })()

  private runTimeline(tl: gsap.core.Timeline): Promise<void> {
    if (this.disposed) {
      tl.kill()
      return Promise.resolve()
    }
    tl.timeScale(this.speed)
    this.active.add(tl)
    return new Promise((resolve) => {
      tl.eventCallback('onComplete', () => {
        this.active.delete(tl)
        resolve()
      })
      if (tl.totalDuration() === 0 || tl.progress() === 1) {
        this.active.delete(tl)
        resolve()
      }
    })
  }

  wait(ms: number): Promise<void> {
    if (this.disposed || ms <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, ms / this.speed))
  }

  async play(events: GameEvent[], ctx: PlanContext): Promise<void> {
    for (const batch of planEvents(events, ctx)) {
      if (this.disposed) return
      await Promise.all(batch.map((cmd) => this.runCommand(cmd, this.pace)))
    }
  }

  private async runCommand(cmd: AnimCommand, pace: Pace): Promise<void> {
    if (cmd.delayMs > 0) await this.wait(cmd.delayMs)
    if (this.disposed) return
    let applied = false
    // 生物出牌的落地指令與展示指令共用同一事件，只套用一次
    if (cmd.kind === 'summon' && cmd.event.type === 'cardPlayed') applied = true
    const apply = () => {
      if (applied) return
      applied = true
      this.options.applyEvent(cmd.event)
    }
    try {
      if (!APPLY_AFTER.has(cmd.event.type) && cmd.kind !== 'summon') apply()
      await this.stage.run(cmd, pace, apply)
    } catch (e) {
      console.warn('[animator] 動畫失敗', cmd.kind, e)
    }
    try {
      apply()
    } catch (e) {
      console.warn('[animator] 顯示狀態更新失敗', cmd.kind, e)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const tl of this.active) tl.kill()
    this.active.clear()
  }
}

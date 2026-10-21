// 動畫指令 → three.js 與 DOM 演出
import gsap from 'gsap'
import { nextTick } from 'vue'
import type { Card, PlayerId } from '@/engine'
import { audio } from '@/fx/audio'
import type { AnimationStage, Pace } from '@/fx/animator'
import type { AnimCommand } from '@/fx/animationPlan'
import type { Battlefield } from '@/render/battle/Battlefield'
import type { BattleView, ViewMinion } from '@/render/battle/viewModel'

export interface StageFx {
  banner: { text: string; key: number } | null
  showcase: { cardId: string; from: PlayerId; key: number } | null
  lowSaturation: boolean
}

export interface StageDeps {
  field: () => Battlefield | null
  view: () => BattleView | null
  cards: Record<string, Card>
  fx: StageFx
  root: () => HTMLElement | null
  fxLayer: () => HTMLElement | null
  scale: () => number
  onGameOver: () => void
}

const heroPid = (id: string): PlayerId | null => (id === 'p1-hero' ? 'p1' : id === 'p2-hero' ? 'p2' : null)

export function createBattleStage(deps: StageDeps): AnimationStage {
  let key = 0
  const q = <T extends HTMLElement>(sel: string) => deps.root()?.querySelector<T>(sel) ?? null

  // 元素中心的 1920×1080 邏輯座標
  function centerOf(el: Element | null): { x: number; y: number } | null {
    const root = deps.root()
    if (!el || !root) return null
    const r = el.getBoundingClientRect()
    const base = root.getBoundingClientRect()
    const s = deps.scale()
    return { x: (r.left + r.width / 2 - base.left) / s, y: (r.top + r.height / 2 - base.top) / s }
  }

  function targetPoint(id: string): { x: number; y: number } | null {
    const pid = heroPid(id)
    if (pid) return centerOf(q(`[data-hero="${pid}"] .portrait-wrap`))
    return deps.field()?.minionLogical(id) ?? null
  }

  function minionVm(id: string): ViewMinion | undefined {
    const v = deps.view()
    return v?.players.p1.board.find((m) => m.instanceId === id) ?? v?.players.p2.board.find((m) => m.instanceId === id)
  }

  function refresh(id: string) {
    const vm = minionVm(id)
    if (vm) deps.field()?.updateMinion(vm)
  }

  // 浮動數字或文字
  function floatText(text: string, at: { x: number; y: number } | null, cls: string, rise = 30): gsap.core.Timeline {
    const tl = gsap.timeline()
    const layer = deps.fxLayer()
    if (!layer || !at) return tl
    const el = document.createElement('div')
    el.className = `float-text ${cls}`
    el.textContent = text
    el.style.left = `${at.x}px`
    el.style.top = `${at.y}px`
    layer.appendChild(el)
    tl.fromTo(el, { scale: 0, opacity: 1, xPercent: -50, yPercent: -50 }, { scale: 1.2, duration: 0.12, ease: 'back.out(3)' })
    tl.to(el, { scale: 1, duration: 0.08 })
    tl.to(el, { y: -rise, opacity: 0, duration: 0.3, ease: 'power1.in' }, '+=0.6')
    tl.call(() => el.remove())
    return tl
  }

  async function hitStop(cmd: AnimCommand, pace: Pace): Promise<void> {
    deps.field()?.shake(cmd.shake, pace.speed)
    if (cmd.hitStopMs > 0) await pace.wait(cmd.hitStopMs)
  }

  const sfx = (cmd: AnimCommand, i: number) => {
    const name = cmd.sfx[i]
    if (name) audio.play(name)
  }

  function heroShake(pid: PlayerId): gsap.core.Timeline {
    const tl = gsap.timeline()
    const el = q(`[data-hero="${pid}"] .portrait-wrap`)
    if (!el) return tl
    tl.to(el, { rotation: pid === 'p1' ? 6 : -6, y: pid === 'p1' ? 10 : -10, duration: 0.06 })
    tl.to(el, { x: 6, duration: 0.04, repeat: 3, yoyo: true })
    tl.to(el, { rotation: 0, x: 0, y: 0, duration: 0.11 })
    return tl
  }

  function hpPulse(pid: PlayerId): void {
    const el = q(`[data-hero="${pid}"] .hp-badge`)
    if (el) gsap.fromTo(el, { scale: 1.3 }, { scale: 1, duration: 0.2 * 2, ease: 'elastic.out(1, 0.5)' })
  }

  async function run(cmd: AnimCommand, pace: Pace, apply: () => void): Promise<void> {
    const field = deps.field()
    const e = cmd.event
    switch (cmd.kind) {
      case 'turnBanner': {
        if (e.type !== 'turnStart') return
        sfx(cmd, 0)
        deps.fx.banner = { text: e.playerId === 'p1' ? '你的回合' : '對手回合', key: ++key }
        await nextTick()
        const el = q('.banner')
        if (!el) return
        const tl = gsap.timeline()
        tl.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' })
        tl.to(el, { opacity: 0, duration: 0.25 }, '+=0.9')
        await pace.run(tl)
        deps.fx.banner = null
        return
      }
      case 'mana':
        sfx(cmd, 0)
        return
      case 'draw': {
        if (e.type !== 'draw') return
        sfx(cmd, 0)
        await nextTick()
        const el = e.playerId === 'p1' ? q(`[data-hand="${e.instanceId}"] .hand-inner`) : q('.enemy-hand .back:last-child')
        const from = centerOf(q(`[data-deck="${e.playerId}"]`))
        const to = centerOf(el)
        if (!el || !from || !to) return
        const tl = gsap.timeline()
        tl.fromTo(el, { x: from.x - to.x, y: from.y - to.y, scale: 0.5, rotationY: 180, transformPerspective: 800 }, { x: 0, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' })
        tl.to(el, { rotationY: 0, duration: 0.35 * 0.3, ease: 'sine.inOut' }, 0.35 * 0.4)
        await pace.run(tl)
        return
      }
      case 'burn': {
        if (e.type !== 'burn') return
        sfx(cmd, 0)
        const name = deps.cards[e.cardId]?.name ?? ''
        const at = centerOf(q(`[data-deck="${e.playerId}"]`))
        await pace.run(floatText(`爆牌：${name}`, at && { x: at.x - 160, y: at.y }, 'float-info'))
        return
      }
      case 'fatigue': {
        if (e.type !== 'fatigue') return
        sfx(cmd, 0)
        await pace.run(floatText(`疲勞！${e.damage}`, targetPoint(`${e.playerId}-hero`), 'float-info'))
        return
      }
      case 'cardPlayed': {
        if (e.type !== 'cardPlayed') return
        sfx(cmd, 0)
        deps.fx.showcase = { cardId: e.cardId, from: e.playerId, key: ++key }
        await nextTick()
        const el = q('.showcase')
        if (!el) return
        const tl = gsap.timeline()
        tl.fromTo(
          el,
          { y: e.playerId === 'p1' ? 420 : -360, scale: 0.5, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' },
        )
        tl.to({}, { duration: cmd.holdMs / 1000 })
        const spell = deps.cards[e.cardId]?.type === 'spell'
        if (spell) {
          tl.call(() => sfx(cmd, 1))
          tl.to(el, { scale: 1.4, opacity: 0, filter: 'blur(6px)', duration: 0.3, ease: 'power2.in' })
        }
        await pace.run(tl)
        if (spell) deps.fx.showcase = null
        return
      }
      case 'summon': {
        if (e.type !== 'summon' && e.type !== 'cardPlayed') return
        const showcase = q('.showcase')
        if (showcase) {
          gsap.to(showcase, {
            scale: 0.4,
            opacity: 0,
            duration: 0.25 / pace.speed,
            ease: 'power2.in',
            onComplete: () => {
              deps.fx.showcase = null
            },
          })
        }
        if (!field) return
        const card = deps.cards[e.cardId]
        const hp = card?.health ?? 0
        const vm: ViewMinion = minionVm(e.instanceId) ?? {
          instanceId: e.instanceId,
          cardId: e.cardId,
          attack: card?.attack ?? 0,
          health: hp,
          maxHealth: hp,
          keywords: [...(card?.keywords ?? [])],
          frozen: false,
        }
        const tl = field.tlSummon(e.playerId, vm, e.position ?? 0, (resume) => {
          sfx(cmd, 0)
          apply()
          void hitStop(cmd, pace).then(resume)
        })
        await pace.run(tl)
        return
      }
      case 'attack': {
        if (e.type !== 'attack' || !field) return
        const to = targetPoint(e.targetId)
        if (!to) return
        sfx(cmd, 0)
        const tl = field.tlAttack(e.attackerId, field.logicalToWorld(to.x, to.y), (resume) => {
          sfx(cmd, 1)
          field.flash(e.attackerId)
          const pid = heroPid(e.targetId)
          if (pid) {
            const el = q(`[data-hero="${pid}"] .portrait-wrap`)
            if (el) gsap.fromTo(el, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)', duration: 0.12 })
          } else field.flash(e.targetId)
          void hitStop(cmd, pace).then(resume)
        })
        await pace.run(tl)
        return
      }
      case 'damage': {
        if (e.type !== 'damage') return
        sfx(cmd, 0)
        refresh(e.targetId)
        const at = targetPoint(e.targetId)
        const tl = gsap.timeline()
        tl.add(floatText(`-${e.amount}`, at, 'float-damage'), 0)
        if (field) tl.add(field.tlHit(e.targetId), 0)
        await pace.run(tl)
        return
      }
      case 'heroDamage': {
        if (e.type !== 'damage') return
        const pid = heroPid(e.targetId)
        if (!pid) return
        sfx(cmd, 0)
        await hitStop(cmd, pace)
        hpPulse(pid)
        const tl = gsap.timeline()
        const label = e.armorAbsorbed > 0 ? `-${e.amount}（護甲 ${e.armorAbsorbed}）` : `-${e.amount}`
        tl.add(floatText(label, targetPoint(e.targetId), 'float-damage float-hero'), 0)
        tl.add(heroShake(pid), 0)
        const vignette = q('.vignette')
        if (vignette) tl.fromTo(vignette, { opacity: 0 }, { opacity: 1, duration: 0.15, yoyo: true, repeat: 1 }, 0)
        await pace.run(tl)
        return
      }
      case 'heal': {
        if (e.type !== 'heal') return
        sfx(cmd, 0)
        refresh(e.targetId)
        const pid = heroPid(e.targetId)
        if (pid) hpPulse(pid)
        await pace.run(floatText(`+${e.amount}`, targetPoint(e.targetId), 'float-heal', 60))
        return
      }
      case 'armor': {
        if (e.type !== 'armor') return
        sfx(cmd, 0)
        await pace.run(floatText(`+${e.amount} 護甲`, targetPoint(`${e.playerId}-hero`), 'float-buff', 40))
        return
      }
      case 'buff': {
        if (e.type !== 'buff') return
        sfx(cmd, 0)
        refresh(e.targetId)
        const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
        const tl = gsap.timeline()
        tl.add(floatText(`${sign(e.atk)}/${sign(e.hp)}`, targetPoint(e.targetId), e.atk < 0 || e.hp < 0 ? 'float-damage' : 'float-buff'), 0)
        if (field) tl.add(field.tlPulse(e.targetId), 0)
        await pace.run(tl)
        return
      }
      case 'freeze': {
        if (e.type !== 'freeze' || !field) return
        await pace.run(
          field.tlFreeze(e.targetId, (resume) => {
            sfx(cmd, 0)
            void hitStop(cmd, pace).then(resume)
          }),
        )
        return
      }
      case 'unfreeze': {
        if (e.type !== 'unfreeze' || !field) return
        sfx(cmd, 0)
        await pace.run(field.tlUnfreeze(e.targetId))
        return
      }
      case 'bubblePop': {
        if (e.type !== 'bubblePop' || !field) return
        floatText('擋下', targetPoint(e.targetId), 'float-info')
        await pace.run(
          field.tlBubblePop(e.targetId, (resume) => {
            sfx(cmd, 0)
            void hitStop(cmd, pace).then(resume)
          }),
        )
        refresh(e.targetId)
        return
      }
      case 'bounce': {
        if (e.type !== 'bounce' || !field) return
        sfx(cmd, 0)
        await pace.run(field.tlBounce(e.instanceId))
        return
      }
      case 'death': {
        if (e.type !== 'death' || !field) return
        sfx(cmd, 0)
        await pace.run(field.tlDeath(e.instanceId))
        return
      }
      case 'gameOver': {
        if (e.type !== 'gameOver') return
        sfx(cmd, 0)
        await hitStop(cmd, pace)
        const loser: PlayerId | null = e.winner === 'p1' ? 'p2' : e.winner === 'p2' ? 'p1' : null
        const tl = gsap.timeline()
        if (loser && field) {
          const at = targetPoint(`${loser}-hero`)
          if (at) tl.add(field.tlFinalPush(field.logicalToWorld(at.x, at.y)), 0)
          // 頭像與名牌一起淡出
          const el = deps.root()?.querySelectorAll(`[data-hero="${loser}"] .portrait-wrap, [data-hero="${loser}"] .hero-name`)
          if (el?.length) {
            tl.to(el, { x: 4, duration: 0.05, repeat: 5, yoyo: true }, 0.3)
            tl.to(el, { scale: 1.25, opacity: 0, filter: 'blur(4px)', duration: 1, ease: 'power2.in' }, 0.6)
          }
        }
        if (e.winner !== 'p1') {
          tl.call(() => {
            deps.fx.lowSaturation = true
          }, [], 0.6)
        }
        await pace.run(tl)
        deps.onGameOver()
        return
      }
    }
  }

  return { run }
}

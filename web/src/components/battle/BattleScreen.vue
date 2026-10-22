<script setup lang="ts">
// 對戰畫面：玩家（p1）對 AI（p2）；three.js 戰場＋DOM 疊層，事件依序播放動畫
import gsap from 'gsap'
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import CardView from '@/components/CardView.vue'
import { chooseAction, MAX_ACTIONS_PER_TURN } from '@/ai'
import { characterByName, cardDb, tokens } from '@/content'
import { cardArtUrl, FACTION_STYLE, KEYWORDS } from '@/content/cardStyle'
import { createRng, hasNoActions, MAX_BOARD, type Action, type Card, type GameEvent, type PlayerId } from '@/engine'
import { Animator } from '@/fx/animator'
import { TIMING } from '@/fx/animationPlan'
import { audio, type BgmName } from '@/fx/audio'
import { loadImage } from '@/render/cardTexture'
import { Battlefield } from '@/render/battle/Battlefield'
import { computeLayout, DESIGN_H, DESIGN_W, type Rect } from '@/render/battle/battleLayout'
import { loadMinionSlices, type SliceImages } from '@/render/battle/minionTexture'
import { roundsOf } from '@/render/battle/viewModel'
import { useBattleStore } from '@/stores/battle'
import { useSettingsStore } from '@/stores/settings'
import {
  advance,
  createTutorial,
  currentBeat,
  isAllowed,
  isRunning,
  signalOf,
  skipTutorial,
  TUTORIAL_TOTAL_STEPS,
  type Focus,
  type Signal,
  type TutorialState,
} from '@/tutorial/tutorialFlow'
import { scriptedEnemyAction, tutorialSetup } from '@/tutorial/tutorialScript'
import { placeCallout, placeHint } from '@/tutorial/calloutPlacement'
import BubbleLayer from '@/components/ui/BubbleLayer.vue'
import GameButton from '@/components/ui/GameButton.vue'
import TutorialOverlay, { type Hole } from './TutorialOverlay.vue'
import BattleResult from './BattleResult.vue'
import CardDetail from './CardDetail.vue'
import HandFan from './HandFan.vue'
import HeroPanel from './HeroPanel.vue'
import ManaBar from './ManaBar.vue'
import TargetArrow from './TargetArrow.vue'
import { createBattleStage, type StageFx } from './battleStage'
import { PLAYER_PORTRAIT_ID } from './opponents'

type Outcome = 'win' | 'lose' | 'draw'

const props = withDefaults(
  defineProps<{
    playerDeck: string[]
    enemyDeck: string[]
    enemyName: string
    enemyHeroHp: number
    enemyPortraitId?: string
    seed?: number
    // 重新挑戰時恢復的對戰音樂
    bgm?: BgmName
    // 戰敗時離開按鈕的文字
    exitLabel?: string
    // 以新手教學開局
    tutorial?: boolean
  }>(),
  { seed: undefined, enemyPortraitId: undefined, bgm: 'bgm_battle_normal', exitLabel: '回地圖', tutorial: false },
)
const emit = defineEmits<{ finished: [result: Outcome]; tutorialEnd: [] }>()

const PLAYER_NAME = '小葉'
const END: Action = { type: 'endTurn' }
const EMPTY: ReadonlySet<string> = new Set<string>()
// CardView lg 的原始寬度
const SHOWCASE_BASE_W = 300

const store = useBattleStore()
const settings = useSettingsStore()
const router = useRouter()
const cards: Record<string, Card> = cardDb
const enemyFaction = computed(() => characterByName(props.enemyName)?.faction ?? 'tide')
const view = computed(() => store.view)
const speed = computed(() => settings.settings.speed)

const stageEl = ref<HTMLElement | null>(null)
const glEl = ref<HTMLElement | null>(null)
const uiEl = ref<HTMLElement | null>(null)
const fxEl = ref<HTMLElement | null>(null)
const layout = shallowRef(computeLayout(DESIGN_W, DESIGN_H))
const scale = computed(() => layout.value.scale)
const playLine = computed(() => layout.value.playLine)
const loading = ref(true)
const portrait = computed(() => layout.value.rotateHint)
// 手機橫向：手牌預設收合，點手牌區展開
const handOpen = ref(false)
const handState = computed(() => (!layout.value.compact ? 'fan' : handOpen.value ? 'expanded' : 'collapsed'))
const boosted = ref(false)
const outcome = ref<Outcome | null>(null)
const fx = reactive<StageFx>({ banner: null, showcase: null, lowSaturation: false })
const hint = ref<{ text: string; key: number } | null>(null)
const endLocked = ref(false)

let field: Battlefield | null = null
let animator: Animator | null = null
let disposed = false
let hintTimer: ReturnType<typeof setTimeout> | undefined
let autoEndTimer: ReturnType<typeof setTimeout> | undefined
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | null = null
let battleSeed = props.seed ?? (Date.now() >>> 0)
let aiRng = createRng((battleSeed ^ 0x5bd1e995) >>> 0)

// ---------- 互動狀態 ----------
type Source = { type: 'play'; id: string; position?: number } | { type: 'attack'; id: string }
type Mode =
  | { kind: 'idle' }
  | { kind: 'card'; id: string }
  | { kind: 'target'; source: Source; targets: string[]; optional?: boolean }

const mode = shallowRef<Mode>({ kind: 'idle' })
const pointer = reactive({ x: 0, y: 0 })
const drag = shallowRef<{ id: string; sx: number; sy: number; active: boolean } | null>(null)
const attackDrag = shallowRef<{ id: string; sx: number; sy: number } | null>(null)
const handHover = ref<string | null>(null)
const minionHover = ref<string | null>(null)
const detail = shallowRef<{
  card: Card
  // 場上生物：數值隨顯示狀態即時更新
  minionId?: string
  x: number
  y: number
  side: 'left' | 'right'
} | null>(null)
const detailView = computed(() => {
  const d = detail.value
  if (!d) return null
  const l = layout.value
  const base = { card: d.card, x: d.x, y: d.y, side: d.side, cardW: l.detailCardW, sideW: l.detailSideW, minFont: l.minFont, compact: l.compact }
  if (!d.minionId) return base
  const pid = ownerOf(d.minionId)
  const vm = pid ? view.value?.players[pid].board.find((m) => m.instanceId === d.minionId) : undefined
  if (!vm) return null
  return { ...base, attack: vm.attack, health: vm.health, maxHealth: vm.maxHealth, keywords: vm.keywords }
})
const detailW = computed(() => layout.value.detailCardW + 12 + layout.value.detailSideW)
const rounds = computed(() => roundsOf(view.value?.turn ?? 1))

const locked = computed(() => store.busy || loading.value || outcome.value !== null)

// ---------- 新手教學 ----------
const tut = shallowRef<TutorialState | null>(props.tutorial ? createTutorial() : null)
const tutOn = computed(() => isRunning(tut.value))
const beat = computed(() => (tut.value ? currentBeat(tut.value) : null))
const tutHoles = shallowRef<Hole[]>([])
const nudgeKey = ref(0)
const guideVisible = computed(
  () => tutOn.value && !loading.value && outcome.value === null && (beat.value?.kind === 'wait' || !store.busy),
)
const tutKeyword = computed(() => {
  const k = beat.value?.keyword
  const info = k ? KEYWORDS[k] : undefined
  return info ? { label: info.label, desc: info.desc } : null
})
const skipAt = computed<Rect>(() => {
  const g = layout.value.gear
  return { x: g.x - 24, y: g.y + 14, w: 0, h: 0 }
})

// 說明框與提示字不蓋住頭像、潮能、牌庫、結束回合、手牌與跳過鈕
const CALLOUT_W = 760
const calloutH = ref(320)
const hudRects = computed<Rect[]>(() => {
  const l = layout.value
  const skip = skipAt.value
  const skipW = 520
  return [
    l.heroP1,
    l.heroP2,
    l.manaP1,
    l.manaP2,
    l.deckP1,
    l.deckP2,
    l.enemyHand,
    l.endTurn,
    l.handRest,
    { x: skip.x - skipW, y: skip.y, w: skipW, h: l.buttonH },
  ]
})
const calloutRect = computed(() => {
  const l = layout.value
  return placeCallout({ holes: tutHoles.value, avoid: hudRects.value, w: CALLOUT_W, h: calloutH.value, lw: l.lw, lh: l.lh })
})
const hintTop = computed(() => {
  const h = hint.value
  const l = layout.value
  const preferY = l.board.y + 20
  if (!h) return preferY
  const font = Math.max(32, l.minFont)
  const avoid = tutOn.value
    ? [...tutHoles.value, ...hudRects.value, ...minionRects('p1'), ...minionRects('p2'), ...(guideVisible.value ? [calloutRect.value] : [])]
    : []
  return placeHint({ w: [...h.text].length * font + 56, h: font * 1.4 + 20, preferY, avoid, lw: l.lw, lh: l.lh }).y
})

// 教學進行中只留目前步驟允許的動作
const legal = computed<Action[]>(() => {
  const t = tut.value
  const s = store.state
  if (!t || !s || !isRunning(t)) return store.legal
  return store.legal.filter((a) => isAllowed(t, a, s))
})
// 示範非法目標的步驟可以選攻擊者，實際攻擊仍由 commit 擋下
const attackSource = computed(() => (beat.value?.selectAttackers ? store.legal : legal.value))
const playable = computed(() => {
  const set = new Set<string>()
  for (const a of legal.value) if (a.type === 'playCard' && a.cardInstanceId) set.add(a.cardInstanceId)
  return set
})
const canAttack = computed(() => {
  const set = new Set<string>()
  for (const a of attackSource.value) if (a.type === 'attack') set.add(a.attackerId)
  return set
})
const onlyEndTurn = computed(() => legal.value.length === 1)
const targets = computed(() => new Set(mode.value.kind === 'target' ? mode.value.targets : []))
const selectedHand = computed(() => {
  const m = mode.value
  if (m.kind === 'card') return m.id
  if (m.kind === 'target' && m.source.type === 'play') return m.source.id
  return null
})
const enemyTurn = computed(() => view.value?.activePlayer === 'p2')
const endState = computed(() => {
  if (enemyTurn.value) return 'enemy'
  if (onlyEndTurn.value && !locked.value) return 'done'
  return 'normal'
})

const hoverTarget = computed(() => {
  if (mode.value.kind !== 'target') return null
  const id = hitTarget(pointer.x, pointer.y)
  return id
})
const arrow = computed(() => {
  const m = mode.value
  if (m.kind !== 'target') return null
  let from: { x: number; y: number } | null = null
  if (m.source.type === 'attack') from = field?.minionLogical(m.source.id) ?? null
  else
    from = centerOfEl(uiEl.value?.querySelector(`[data-hand="${m.source.id}"] .hand-inner`) ?? null) ?? {
      x: layout.value.lw / 2,
      y: layout.value.playLine,
    }
  if (!from) return null
  const over = hoverTarget.value
  const snapped = over !== null && targets.value.has(over)
  const to = snapped ? pointOf(over) ?? { ...pointer } : { x: pointer.x, y: pointer.y }
  return { from, to, kind: m.source.type === 'attack' ? ('attack' as const) : ('spell' as const), snapped, invalid: over !== null && !snapped }
})

// 拿著生物卡移到場上但場地已滿時，游標旁提示
const boardFullTip = computed(() => {
  const m = mode.value
  const id = drag.value?.active ? drag.value.id : m.kind === 'card' ? m.id : null
  if (!id || cardOfHand(id)?.type !== 'creature' || pointer.y >= playLine.value) return false
  return (view.value?.players.p1.board.length ?? 0) >= MAX_BOARD
})

const dragGhost = computed(() => {
  const d = drag.value
  if (!d?.active || !view.value) return null
  const c = view.value.players.p1.hand.find((h) => h.instanceId === d.id)
  const card = c ? cards[c.cardId] : undefined
  if (!card) return null
  return { card, small: pointer.y < playLine.value }
})

// ---------- 座標 ----------
function toLogical(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const r = uiEl.value?.getBoundingClientRect()
  if (!r) return { x: 0, y: 0 }
  return { x: (e.clientX - r.left) / scale.value, y: (e.clientY - r.top) / scale.value }
}

function centerOfEl(el: Element | null): { x: number; y: number } | null {
  const base = uiEl.value?.getBoundingClientRect()
  if (!el || !base) return null
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2 - base.left) / scale.value, y: (r.top + r.height / 2 - base.top) / scale.value }
}

function pointOf(id: string): { x: number; y: number } | null {
  if (id === 'p1-hero' || id === 'p2-hero') {
    return centerOfEl(uiEl.value?.querySelector(`[data-hero="${id.slice(0, 2)}"] .portrait-wrap`) ?? null)
  }
  return field?.minionLogical(id) ?? null
}

// 游標下的生物或英雄
function hitTarget(x: number, y: number): string | null {
  const id = field?.pick(x, y)
  if (id) return id
  for (const pid of ['p1', 'p2'] as const) {
    const c = pointOf(`${pid}-hero`)
    if (c && Math.hypot(c.x - x, c.y - y) < layout.value.portraitSize / 2 + 12) return `${pid}-hero`
  }
  return null
}

function ownerOf(id: string): PlayerId | null {
  const v = view.value
  if (!v) return null
  if (v.players.p1.board.some((m) => m.instanceId === id)) return 'p1'
  if (v.players.p2.board.some((m) => m.instanceId === id)) return 'p2'
  return null
}

function boost(): void {
  animator?.boost()
  boosted.value = true
}

function resetBoost(): void {
  animator?.resetBoost()
  boosted.value = false
}

// ---------- 提示 ----------
function friendly(reason: string): string {
  if (reason.startsWith('不能攻擊')) return '這個目標不能攻擊'
  return reason.split(/[：，]/)[0] ?? reason
}

function showHint(text: string, error = true): void {
  if (error) audio.play('sfx_error')
  hint.value = { text, key: Date.now() }
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => (hint.value = null), 1200)
}

// ---------- 教學推進 ----------
function tutSignal(signal: Signal): void {
  const t = tut.value
  if (!t || !isRunning(t)) return
  const next = advance(t, signal)
  if (next === t) return
  const done = currentBeat(t)
  tut.value = next
  // 下一步不看手牌時收合，避免手機展開的手牌蓋住場上
  const focus = currentBeat(next)?.focus ?? []
  if (!focus.some((f) => f === 'hand' || f.startsWith('card:') || f.startsWith('cost:'))) handOpen.value = false
  if (!isRunning(next)) endTutorial('教學完成！把對手打倒吧')
  else if (done?.kind === 'do') showHint('做得好！', false)
}

function endTutorial(message: string): void {
  showHint(message, false)
  tutHoles.value = []
  emit('tutorialEnd')
}

function onTutorialSkip(): void {
  const t = tut.value
  if (!t || !isRunning(t)) return
  audio.play('sfx_ui_click')
  tut.value = skipTutorial(t)
  cancelMode()
  endTutorial('已跳過教學')
  scheduleAutoEnd()
}

// 不允許的操作不報錯，只讓高亮外框再閃一次
function nudge(): void {
  nudgeKey.value += 1
}

function rectOfEl(el: Element | null): Rect | null {
  const base = uiEl.value?.getBoundingClientRect()
  if (!el || !base) return null
  const r = el.getBoundingClientRect()
  const s = scale.value
  return { x: (r.left - base.left) / s, y: (r.top - base.top) / s, w: r.width / s, h: r.height / s }
}

function unionOf(rects: (Rect | null)[]): Rect | null {
  const rs = rects.filter((r): r is Rect => r !== null && r.w > 0 && r.h > 0)
  if (rs.length === 0) return null
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}

function minionRects(pid: PlayerId): Rect[] {
  const g = layout.value.boardGeo
  return (view.value?.players[pid].board ?? []).flatMap((m) => {
    const c = field?.minionLogical(m.instanceId)
    return c ? [{ x: c.x - g.frameW / 2, y: c.y - g.frameH / 2, w: g.frameW, h: g.frameH }] : []
  })
}

function handEl(cardId: string, part: string): Element | null {
  const c = view.value?.players.p1.hand.find((h) => h.cardId === cardId)
  return c ? (uiEl.value?.querySelector(`[data-hand="${c.instanceId}"] ${part}`) ?? null) : null
}

// 高亮目標換算成邏輯座標：DOM 用 getBoundingClientRect，場上生物用戰場投影
function focusRects(f: Focus): Rect[] {
  const ui = uiEl.value
  const l = layout.value
  const one = (r: Rect | null) => (r ? [r] : [])
  if (f === 'heroP1') return one(rectOfEl(ui?.querySelector('[data-hero="p1"]') ?? null))
  if (f === 'heroP2' || f === 'enemyHero') return one(rectOfEl(ui?.querySelector('[data-hero="p2"]') ?? null))
  if (f === 'mana') return one(rectOfEl(ui?.querySelector('.mana-p1') ?? null))
  if (f === 'endTurn') return one(rectOfEl(ui?.querySelector('[data-testid="end-turn"]') ?? null))
  if (f === 'hand') return one(unionOf([...(ui?.querySelectorAll('[data-hand] .hand-inner') ?? [])].map(rectOfEl)))
  if (f === 'myBoard') {
    const g = l.boardGeo
    return [{ x: (l.lw - g.laneW) / 2, y: l.boardCy + g.rowOffset - g.frameH / 2 - 20, w: g.laneW, h: g.frameH + 40 }]
  }
  if (f === 'myMinions') return minionRects('p1')
  if (f === 'enemyMinions') return minionRects('p2')
  if (f.startsWith('card:')) return one(rectOfEl(handEl(f.slice(5), '.hand-inner')))
  if (f.startsWith('cost:')) return one(rectOfEl(handEl(f.slice(5), '.badge.cost')))
  return []
}

const HOLE_PAD = 10

function refreshHoles(): void {
  const b = beat.value
  if (!b || !guideVisible.value) {
    if (tutHoles.value.length) tutHoles.value = []
    return
  }
  const holes = b.focus.flatMap((f) =>
    focusRects(f).map((r) => ({
      focus: f,
      x: Math.round(r.x - HOLE_PAD),
      y: Math.round(r.y - HOLE_PAD),
      w: Math.round(r.w + HOLE_PAD * 2),
      h: Math.round(r.h + HOLE_PAD * 2),
    })),
  )
  if (JSON.stringify(holes) !== JSON.stringify(tutHoles.value)) tutHoles.value = holes
}

// 手牌展開、生物移位都會改變位置，教學期間定時重算
let holeTimer: ReturnType<typeof setInterval> | undefined
watch(guideVisible, (on) => {
  clearInterval(holeTimer)
  refreshHoles()
  if (on) holeTimer = setInterval(refreshHoles, 150)
})

// 我方無可用動作時提示後自動結束回合
const AUTO_END = { delayMs: 1000, hint: '無可用動作' } as const

function canAutoEnd(): boolean {
  const s = store.state
  // 教學期間不自動結束回合
  return !!s && !tutOn.value && hasNoActions(s, 'p1') && !locked.value && !enemyTurn.value
}

function scheduleAutoEnd(): void {
  // unmount 後 commit 的 finally 仍會呼叫，不對新對戰排計時器
  if (disposed) return
  clearTimeout(autoEndTimer)
  if (!canAutoEnd()) return
  showHint(AUTO_END.hint, false)
  autoEndTimer = setTimeout(() => {
    if (canAutoEnd()) endTurn()
  }, AUTO_END.delayMs)
}

function shakeHand(id: string): void {
  const el = uiEl.value?.querySelector(`[data-hand="${id}"] .hand-inner`)
  if (el) gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.2, ease: 'elastic.out(1, 0.3)' })
}

// ---------- 指令 ----------
function cancelMode(): void {
  if (mode.value.kind !== 'idle') audio.play('sfx_card_return')
  mode.value = { kind: 'idle' }
  attackDrag.value = null
  field?.setSelected(null)
  field?.showInsertPreview(null)
}

function planContext(aiTurn: boolean) {
  const atk = new Map<string, number>()
  for (const pid of ['p1', 'p2'] as const) for (const m of view.value?.players[pid].board ?? []) atk.set(m.instanceId, m.attack)
  // 剛打出的生物不在顯示狀態裡，用卡面攻擊力
  const s = store.state
  if (s) for (const pid of ['p1', 'p2'] as const) for (const m of s.players[pid].board) if (!atk.has(m.instanceId)) atk.set(m.instanceId, m.attack)
  return { cards, attackOf: (id: string) => atk.get(id) ?? 0, aiTurn }
}

async function runEvents(events: GameEvent[], aiTurn: boolean): Promise<void> {
  if (!animator || disposed) return
  store.busy = true
  await animator.play(events, planContext(aiTurn))
  if (disposed) return
  store.sync()
  // 英雄倒下時引擎立即結束，場上可能留有生命歸零且沒有死亡事件的生物
  const alive = (pid: PlayerId) => view.value?.players[pid].board.filter((m) => m.health > 0) ?? []
  if (view.value) field?.sync({ p1: alive('p1'), p2: alive('p2') })
}

async function runAi(): Promise<void> {
  for (let step = 0; !disposed; step++) {
    const s = store.state
    if (!s || s.winner !== null || s.activePlayer !== 'p2') break
    await animator?.wait(TIMING.aiThink)
    // 安全上限：40 步後強制結束回合；教學期間照劇本
    const action = step >= MAX_ACTIONS_PER_TURN ? END : tutOn.value ? scriptedEnemyAction(s) : chooseAction(s, 'p2', aiRng)
    let r = store.act(action)
    if (!r.ok) r = store.act(END)
    if (!r.ok) break
    await runEvents(r.events, true)
  }
}

async function commit(action: Action): Promise<void> {
  if (locked.value) return
  const t = tut.value
  const before = store.state
  if (t && before && isRunning(t) && !isAllowed(t, action, before)) {
    cancelMode()
    nudge()
    return
  }
  const signal = t && before && isRunning(t) ? signalOf(action, before) : null
  mode.value = { kind: 'idle' }
  attackDrag.value = null
  field?.setSelected(null)
  field?.showInsertPreview(null)
  detail.value = null
  const r = store.act(action)
  if (!r.ok) {
    showHint(friendly(r.reason))
    return
  }
  try {
    await runEvents(r.events, false)
    if (signal && !disposed) tutSignal(signal)
    if (!disposed && store.state?.winner === null && store.state.activePlayer === 'p2') await runAi()
    if (!disposed && store.state?.winner === null && store.state.activePlayer === 'p1') tutSignal({ type: 'playerTurn' })
  } finally {
    resetBoost()
    store.busy = false
    scheduleAutoEnd()
  }
}

function playActions(id: string) {
  return legal.value.filter((a): a is Extract<Action, { type: 'playCard' }> => a.type === 'playCard' && a.cardInstanceId === id)
}

function cardOfHand(id: string): Card | undefined {
  const c = view.value?.players.p1.hand.find((h) => h.instanceId === id)
  return c ? cards[c.cardId] : undefined
}

function place(id: string, position: number): void {
  const actions = playActions(id).filter((a) => a.position === position)
  const ts = actions.flatMap((a) => (a.targetId ? [a.targetId] : []))
  // 戰吼可不選目標時，選目標狀態下另提供「直接打出」
  const optional = actions.some((a) => a.targetId === undefined)
  if (ts.length > 0) mode.value = { kind: 'target', source: { type: 'play', id, position }, targets: ts, optional }
  else if (actions.length > 0) void commit({ type: 'playCard', cardInstanceId: id, position })
}

function castOrTarget(id: string, immediate: boolean): void {
  const ts = playActions(id).flatMap((a) => (a.targetId ? [a.targetId] : []))
  if (ts.length > 0) mode.value = { kind: 'target', source: { type: 'play', id }, targets: ts }
  else if (immediate) void commit({ type: 'playCard', cardInstanceId: id })
  else mode.value = { kind: 'card', id }
}

function rejectCard(id: string): boolean {
  if (playable.value.has(id)) return false
  if (tutOn.value) {
    nudge()
    return true
  }
  const reason = store.reasonFor({ type: 'playCard', cardInstanceId: id })
  showHint(friendly(reason ?? '現在不能出這張牌'))
  shakeHand(id)
  return true
}

function onHandClick(id: string): void {
  if (selectedHand.value === id) {
    cancelMode()
    return
  }
  if (rejectCard(id)) return
  field?.setSelected(null)
  handOpen.value = false
  const card = cardOfHand(id)
  if (card?.type === 'creature') mode.value = { kind: 'card', id }
  else castOrTarget(id, false)
}

function onHandRelease(id: string): void {
  if (rejectCard(id)) return
  const card = cardOfHand(id)
  if (card?.type === 'creature') place(id, field?.insertIndexAt(pointer.x) ?? 0)
  else castOrTarget(id, true)
}

function playWithoutTarget(): void {
  const m = mode.value
  if (m.kind !== 'target' || m.source.type !== 'play' || !m.optional) return
  void commit({ type: 'playCard', cardInstanceId: m.source.id, position: m.source.position })
}

function commitTarget(targetId: string): void {
  const m = mode.value
  if (m.kind !== 'target') return
  if (!m.targets.includes(targetId)) {
    showHint(m.source.type === 'attack' ? '這個目標不能攻擊' : '不是合法目標')
    if (m.source.type === 'attack' && targetId === 'p2-hero') tutSignal({ type: 'heroAttackBlocked' })
    return
  }
  if (m.source.type === 'attack') void commit({ type: 'attack', attackerId: m.source.id, targetId })
  else void commit({ type: 'playCard', cardInstanceId: m.source.id, position: m.source.position, targetId })
}

function startAttack(id: string, x: number, y: number): void {
  if (!canAttack.value.has(id)) {
    if (tutOn.value) {
      nudge()
      return
    }
    const reason = store.reasonFor({ type: 'attack', attackerId: id, targetId: 'p2-hero' })
    showHint(friendly(reason ?? '現在不能攻擊'))
    if (field) gsap.timeline().add(field.tlShakeNo(id))
    return
  }
  const ts = attackSource.value.flatMap((a) => (a.type === 'attack' && a.attackerId === id ? [a.targetId] : []))
  mode.value = { kind: 'target', source: { type: 'attack', id }, targets: ts }
  attackDrag.value = { id, sx: x, sy: y }
  field?.setSelected(id)
  audio.play('sfx_ui_click')
}

// ---------- 指標事件 ----------
function onHandDown(id: string, e: PointerEvent): void {
  audio.unlock()
  if (e.button === 2) return
  if (locked.value) {
    if (store.busy) boost()
    return
  }
  // 收合中先展開，不選牌
  if (handState.value === 'collapsed' && selectedHand.value !== id) {
    handOpen.value = true
    detail.value = null
    return
  }
  const p = toLogical(e)
  pointer.x = p.x
  pointer.y = p.y
  drag.value = { id, sx: p.x, sy: p.y, active: false }
}

function onRootDown(e: PointerEvent): void {
  audio.unlock()
  if (store.busy) {
    boost()
    return
  }
  if (locked.value) return
  if (e.button === 2) {
    cancelMode()
    return
  }
  // 點手牌區外收合
  if (handOpen.value) {
    handOpen.value = false
    if (mode.value.kind === 'idle') return
  }
  const p = toLogical(e)
  pointer.x = p.x
  pointer.y = p.y
  const id = field?.pick(p.x, p.y) ?? null
  const m = mode.value
  if (m.kind === 'target') {
    if (id) commitTarget(id)
    else cancelMode()
    return
  }
  if (m.kind === 'card') {
    const card = cardOfHand(m.id)
    if (p.y >= playLine.value) cancelMode()
    else if (card?.type === 'creature') place(m.id, field?.insertIndexAt(p.x) ?? 0)
    else void commit({ type: 'playCard', cardInstanceId: m.id })
    return
  }
  if (id && ownerOf(id) === 'p1') startAttack(id, p.x, p.y)
}

function onHeroPick(pid: PlayerId): void {
  audio.unlock()
  if (store.busy) {
    boost()
    return
  }
  if (locked.value) return
  const m = mode.value
  if (m.kind === 'target') commitTarget(`${pid}-hero`)
  else if (m.kind === 'card' && cardOfHand(m.id)?.type !== 'creature') void commit({ type: 'playCard', cardInstanceId: m.id })
}

function onMove(e: PointerEvent): void {
  const p = toLogical(e)
  pointer.x = p.x
  pointer.y = p.y
  const d = drag.value
  if (d && !d.active && Math.hypot(p.x - d.sx, p.y - d.sy) > 6) {
    drag.value = { ...d, active: true }
    handOpen.value = false
    handHover.value = null
    detail.value = null
  }
  const m = mode.value
  const draggingCard = drag.value?.active ? drag.value.id : m.kind === 'card' ? m.id : null
  if (draggingCard && cardOfHand(draggingCard)?.type === 'creature' && p.y < playLine.value && playable.value.has(draggingCard)) {
    field?.showInsertPreview(field.insertIndexAt(p.x), FACTION_STYLE[cardOfHand(draggingCard)!.faction].main)
  } else field?.showInsertPreview(null)
  if (!drag.value?.active) updateMinionHover(p.x, p.y)
}

function onUp(e: PointerEvent): void {
  const p = toLogical(e)
  const d = drag.value
  if (d) {
    drag.value = null
    field?.showInsertPreview(null)
    if (!d.active) onHandClick(d.id)
    else if (p.y < playLine.value) onHandRelease(d.id)
    else audio.play('sfx_card_return')
    return
  }
  const a = attackDrag.value
  if (a && Math.hypot(p.x - a.sx, p.y - a.sy) > 12) {
    attackDrag.value = null
    const over = hitTarget(p.x, p.y)
    if (over && targets.value.has(over)) commitTarget(over)
    else {
      // 教學中拖到非法目標時說明原因
      if (over && tutOn.value) commitTarget(over)
      cancelMode()
    }
  } else if (a) attackDrag.value = null
}

// 系統中斷指標時視同放回手牌
function onCancel(): void {
  const d = drag.value
  if (d) {
    drag.value = null
    field?.showInsertPreview(null)
    if (d.active) audio.play('sfx_card_return')
    return
  }
  if (attackDrag.value) {
    attackDrag.value = null
    cancelMode()
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') cancelMode()
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    if (store.busy) boost()
    else endTurn()
  }
}

function endTurn(): void {
  if (locked.value || enemyTurn.value || endLocked.value) return
  if (tutOn.value && !legal.value.some((a) => a.type === 'endTurn')) {
    nudge()
    return
  }
  clearTimeout(autoEndTimer)
  endLocked.value = true
  setTimeout(() => (endLocked.value = false), 500)
  audio.play('sfx_turn_end')
  void commit(END)
}

// ---------- hover 細節 ----------
function onHandEnter(id: string): void {
  if (drag.value?.active) return
  handHover.value = id
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    const card = cardOfHand(id)
    const c = centerOfEl(uiEl.value?.querySelector(`[data-hand="${id}"]`) ?? null)
    if (!card || !c || handState.value === 'collapsed') return
    const l = layout.value
    const h = l.detailCardW * 1.4
    const x = clamp(c.x - l.detailCardW / 2, 20, l.lw - detailW.value - 20)
    const y = clamp(l.playLine - h - 20, 20, l.lh - h - 20)
    detail.value = { card, x, y, side: 'right' }
  }, 250)
}

function onHandLeave(id: string): void {
  if (handHover.value === id) handHover.value = null
  clearTimeout(hoverTimer)
  detail.value = null
}

function updateMinionHover(x: number, y: number): void {
  if (handHover.value) return
  const id = field?.pick(x, y) ?? null
  if (id === minionHover.value) return
  minionHover.value = id
  clearTimeout(hoverTimer)
  detail.value = null
  if (!id) return
  hoverTimer = setTimeout(() => {
    const pid = ownerOf(id)
    const vm = pid ? view.value?.players[pid].board.find((m) => m.instanceId === id) : undefined
    const at = field?.minionLogical(id)
    const card = vm ? cards[vm.cardId] : undefined
    if (!vm || !at || !card) return
    const l = layout.value
    const h = l.detailCardW * 1.4
    const side = at.x < l.lw / 2 ? 'right' : 'left'
    const off = l.boardGeo.frameW / 2 + 20
    const x = clamp(side === 'right' ? at.x + off : at.x - off - detailW.value, 20, l.lw - detailW.value - 20)
    const y = clamp(at.y - h / 2, 20, l.lh - h - 20)
    detail.value = { card, minionId: id, x, y, side }
  }, 250)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi))
}

// 看卡牌細節步驟：進入該步之後新出現的細節框才算完成
watch(detail, (d) => {
  if (d) tutSignal({ type: 'detailShown' })
})

// ---------- 場上外觀同步 ----------
const fieldReady = ref(false)
// 我方回合中本回合已攻擊過的生物
const attacked = computed<ReadonlySet<string>>(() => {
  const s = store.state
  if (!s || s.activePlayer !== 'p1' || store.busy) return EMPTY
  return new Set(s.players.p1.board.filter((m) => m.attacksThisTurn >= 1).map((m) => m.instanceId))
})
watchEffect(() => {
  if (!fieldReady.value || !field) return
  const showReady = !locked.value && mode.value.kind === 'idle'
  field.setReady(showReady ? canAttack.value : new Set())
  field.setExhausted(attacked.value)
  field.setHighlights(targets.value)
})

function onContinue(): void {
  audio.play('sfx_ui_click')
  if (outcome.value) emit('finished', outcome.value)
}

// 重新挑戰：同一場換新的種子重開
async function onRetry(): Promise<void> {
  if (!animator || disposed) return
  audio.play('sfx_ui_click')
  battleSeed = (Date.now() ^ (battleSeed * 2654435761)) >>> 0
  aiRng = createRng((battleSeed ^ 0x5bd1e995) >>> 0)
  outcome.value = null
  mode.value = { kind: 'idle' }
  detail.value = null
  hint.value = null
  handOpen.value = false
  fx.banner = null
  fx.showcase = null
  fx.lowSaturation = false
  const heroes = uiEl.value?.querySelectorAll('[data-hero] .portrait-wrap, [data-hero] .hero-name')
  if (heroes?.length) gsap.set(heroes, { clearProps: 'all' })
  field?.reset()
  audio.playBgm(props.bgm)
  await startBattle()
}

async function startBattle(): Promise<void> {
  if (!animator) return
  const t = tutOn.value ? tutorialSetup(props.playerDeck, props.enemyDeck) : null
  const events = store.start({
    playerDeck: t?.playerDeck ?? props.playerDeck,
    enemyDeck: t?.enemyDeck ?? props.enemyDeck,
    enemyHeroHp: t?.enemyHeroHp ?? props.enemyHeroHp,
    seed: battleSeed,
    ...(t ? { shuffle: t.shuffle } : {}),
  })
  loading.value = false
  await runEvents(events, false)
  resetBoost()
  store.busy = false
  scheduleAutoEnd()
}

function onGameOver(): void {
  clearTimeout(autoEndTimer)
  const w = store.state?.winner
  outcome.value = w === 'p1' ? 'win' : w === 'p2' ? 'lose' : 'draw'
  audio.playBgm(outcome.value === 'win' ? 'bgm_victory' : 'bgm_defeat')
}

function fit(): void {
  const stage = stageEl.value
  if (!stage) return
  const w = Math.max(1, stage.clientWidth)
  const h = Math.max(1, stage.clientHeight)
  const l = computeLayout(w, h)
  layout.value = l
  if (!l.compact) handOpen.value = false
  field?.setView(l.lw, l.lh, l.boardCy, l.boardGeo)
}

async function preloadImages(): Promise<{ images: Map<string, HTMLImageElement | null>; slices: SliceImages }> {
  const t = tutOn.value ? tutorialSetup(props.playerDeck, props.enemyDeck) : null
  const ids = new Set([...props.playerDeck, ...props.enemyDeck, ...(t ? [...t.playerDeck, ...t.enemyDeck] : []), ...tokens.map((c) => c.id)])
  const map = new Map<string, HTMLImageElement | null>()
  let slices: SliceImages = new Map()
  const timeout = new Promise<void>((r) => setTimeout(r, 8000))
  await Promise.race([
    Promise.all([
      ...[...ids].map(async (id) => {
        const url = cardArtUrl(id)
        map.set(id, url ? await loadImage(url) : null)
      }),
      loadMinionSlices().then((s) => (slices = s)),
    ]),
    timeout,
  ])
  return { images: map, slices }
}

onMounted(async () => {
  fit()
  resizeObserver = new ResizeObserver(fit)
  if (stageEl.value) resizeObserver.observe(stageEl.value)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
  const { images, slices } = await preloadImages()
  if (disposed || !glEl.value) return
  field = new Battlefield(glEl.value, cards, images, slices)
  field.setView(layout.value.lw, layout.value.lh, layout.value.boardCy, layout.value.boardGeo)
  fieldReady.value = true
  animator = new Animator(
    createBattleStage({
      field: () => field,
      view: () => store.view,
      cards,
      fx,
      root: () => uiEl.value,
      fxLayer: () => fxEl.value,
      scale: () => scale.value,
      onGameOver,
    }),
    { getSpeed: () => speed.value, applyEvent: (e) => store.applyEvent(e) },
  )
  await startBattle()
})

onUnmounted(() => {
  disposed = true
  clearTimeout(hintTimer)
  clearTimeout(autoEndTimer)
  clearTimeout(hoverTimer)
  clearInterval(holeTimer)
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  window.removeEventListener('keydown', onKey)
  animator?.dispose()
  field?.dispose()
  field = null
  store.reset()
})

const pos = (r: Rect) => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
// 對戰疊層整體縮放，按鈕 token 改用邏輯 px
const uiStyle = computed(() => {
  const l = layout.value
  const md = Math.max(24, l.minFont * 1.1)
  const sm = Math.max(22, l.minFont)
  return {
    width: `${l.lw}px`,
    height: `${l.lh}px`,
    transform: `scale(${l.scale})`,
    '--min-font': `${l.minFont}px`,
    '--btn-h': `${l.buttonH}px`,
    '--btn-h-lg': `${l.endTurn.h}px`,
    '--btn-fs-lg': `${l.endTurnFont}px`,
    '--btn-pad-lg': `${l.endTurnFont * 1.4}px`,
    '--btn-h-md': `${l.buttonH}px`,
    '--btn-fs-md': `${md}px`,
    '--btn-pad-md': `${md * 1.3}px`,
    '--btn-h-sm': `${l.buttonH * 0.8}px`,
    '--btn-fs-sm': `${sm}px`,
    '--btn-pad-sm': `${sm * 1.2}px`,
  }
})
</script>


<template>
  <div class="battle-outer" @contextmenu.prevent>
    <div v-if="portrait" class="rotate-hint" role="alert">
      <span class="rotate-icon" aria-hidden="true">⟳</span>
      請將裝置轉為橫向
      <GameButton variant="secondary" data-testid="rotate-back" @click="router.push('/menu')">返回選單</GameButton>
    </div>
    <div ref="stageEl" class="stage" :class="{ gray: fx.lowSaturation, hidden: portrait }">
      <div ref="glEl" class="gl" />
      <BubbleLayer />
      <div
        ref="uiEl"
        class="ui"
        :class="{ locked, compact: layout.compact }"
        :style="uiStyle"
        data-testid="battle-ui"
        @pointerdown="onRootDown"
      >
        <template v-if="view">
          <!-- 敵方 -->
          <HeroPanel
            pid="p2"
            class="hero-p2"
            :style="pos(layout.heroP2)"
            :name="enemyName"
            :portrait-id="enemyPortraitId"
            :faction="enemyFaction"
            :hp="view.players.p2.hp"
            :armor="view.players.p2.armor"
            :targetable="targets.has('p2-hero')"
            :dimmed="mode.kind === 'target' && !targets.has('p2-hero')"
            :size="layout.portraitSize"
            :name-font="layout.nameFont"
            @pick="onHeroPick('p2')"
          />
          <ManaBar
            class="mana mana-p2"
            :style="pos(layout.manaP2)"
            :mana="view.players.p2.mana"
            :max-mana="view.players.p2.maxMana"
            :drop="layout.manaDrop.p2"
            :font="layout.manaFont.p2"
          />
          <div class="enemy-hand" :style="pos(layout.enemyHand)" :aria-label="`對手手牌 ${view.players.p2.hand.length} 張`">
            <span v-for="c in view.players.p2.hand" :key="c.instanceId" class="back" />
          </div>
          <div
            class="deck deck-p2"
            :style="[pos(layout.deckP2), { '--count': `${layout.deckFont}px` }]"
            data-deck="p2"
            :class="{ few: view.players.p2.deckCount <= 5, empty: view.players.p2.deckCount === 0 }"
          >
            <span class="pile" />
            <span class="count">{{ view.players.p2.deckCount }}</span>
          </div>

          <!-- 我方 -->
          <HeroPanel
            pid="p1"
            class="hero-p1"
            :style="pos(layout.heroP1)"
            :name="PLAYER_NAME"
            :portrait-id="PLAYER_PORTRAIT_ID"
            faction="leaf"
            :hp="view.players.p1.hp"
            :armor="view.players.p1.armor"
            :targetable="targets.has('p1-hero')"
            :dimmed="mode.kind === 'target' && !targets.has('p1-hero')"
            :size="layout.portraitSize"
            :name-font="layout.nameFont"
            @pick="onHeroPick('p1')"
          />
          <ManaBar
            class="mana mana-p1"
            :style="pos(layout.manaP1)"
            :mana="view.players.p1.mana"
            :max-mana="view.players.p1.maxMana"
            :preview="selectedHand ? (cardOfHand(selectedHand)?.cost ?? 0) : 0"
            :drop="layout.manaDrop.p1"
            :font="layout.manaFont.p1"
          />
          <div
            class="deck deck-p1"
            :style="[pos(layout.deckP1), { '--count': `${layout.deckFont}px` }]"
            data-deck="p1"
            :class="{ few: view.players.p1.deckCount <= 5, empty: view.players.p1.deckCount === 0 }"
          >
            <span class="pile" />
            <span class="count">{{ view.players.p1.deckCount }}</span>
          </div>

          <GameButton
            class="end-turn"
            :class="endState"
            :style="pos(layout.endTurn)"
            variant="primary"
            size="lg"
            :disabled="enemyTurn || locked || endLocked"
            :loading="enemyTurn"
            data-testid="end-turn"
            @pointerdown.stop
            @click="endTurn"
          >
            {{ enemyTurn ? '對手回合' : '結束回合' }}
          </GameButton>

          <HandFan
            :cards="view.players.p1.hand"
            :card-db="cards"
            :playable="locked ? EMPTY : playable"
            :selected-id="selectedHand"
            :dragging-id="drag?.active ? drag.id : null"
            :hover-id="handHover"
            :dim-others="selectedHand !== null"
            :geo="layout.hand"
            :state="handState"
            @down="onHandDown"
            @enter="onHandEnter"
            @leave="onHandLeave"
          />
        </template>

        <TargetArrow v-if="arrow" v-bind="arrow" />
        <div v-if="mode.kind === 'target' && mode.optional" class="target-actions" :style="pos(layout.actions)" @pointerdown.stop>
          <GameButton variant="primary" data-testid="play-no-target" @click="playWithoutTarget">不選目標，直接打出</GameButton>
          <GameButton variant="secondary" @click="cancelMode">取消</GameButton>
        </div>
        <div v-else-if="mode.kind !== 'idle'" class="target-actions" :style="pos(layout.actions)">
          <GameButton class="cancel-float" variant="secondary" data-testid="cancel" @pointerdown.stop @click="cancelMode">取消</GameButton>
        </div>
        <div
          v-if="store.busy && enemyTurn && !outcome"
          class="speed-tip"
          :class="{ on: boosted }"
          :style="pos(layout.actions)"
          role="status"
          data-testid="speed-tip"
        >
          <span>{{ boosted ? '加速中 ▶▶' : '點擊畫面可加速 ▶▶' }}</span>
        </div>

        <div v-if="boardFullTip" class="board-full-tip" :style="{ left: `${pointer.x + 36}px`, top: `${pointer.y - 70}px` }" data-testid="board-full-tip">
          場地已滿
        </div>
        <div v-if="dragGhost" class="drag-ghost" :class="{ small: dragGhost.small }" :style="{ left: `${pointer.x}px`, top: `${pointer.y}px` }">
          <CardView :card="dragGhost.card" size="sm" variant="hand" />
        </div>

        <div
          v-if="fx.showcase && cards[fx.showcase.cardId]"
          :key="fx.showcase.key"
          class="showcase"
          :style="{
            left: `${layout.lw / 2 - layout.showcaseW / 2}px`,
            top: `${layout.boardCy - (layout.showcaseW * 1.4) / 2}px`,
            width: `${layout.showcaseW}px`,
            height: `${layout.showcaseW * 1.4}px`,
          }"
        >
          <div class="showcase-scale" :style="{ transform: `scale(${layout.showcaseW / SHOWCASE_BASE_W})` }">
            <CardView :card="cards[fx.showcase.cardId]!" size="lg" />
          </div>
        </div>

        <CardDetail v-if="detailView && !drag?.active" v-bind="detailView" />

        <div ref="fxEl" class="fx-layer" />
        <div class="vignette" />
        <div v-if="fx.banner" :key="fx.banner.key" class="banner" :style="{ top: `${layout.boardCy - 40}px` }">{{ fx.banner.text }}</div>
        <div v-if="hint" :key="hint.key" class="hint" :style="{ top: `${hintTop}px` }" role="status">{{ hint.text }}</div>
        <TutorialOverlay
          v-if="tutOn"
          :beat="beat"
          :show-guide="guideVisible"
          :holes="tutHoles"
          :total="TUTORIAL_TOTAL_STEPS"
          :lw="layout.lw"
          :lh="layout.lh"
          :skip-at="skipAt"
          :callout="calloutRect"
          :nudge-key="nudgeKey"
          :keyword="tutKeyword"
          @next="tutSignal({ type: 'next' })"
          @skip="onTutorialSkip"
          @measure="calloutH = $event"
        />
        <div v-if="loading" class="loading">潛入海底中…</div>
      </div>
      <!-- 結算：毛玻璃放在縮放層外，避免 backdrop-filter 在縮放容器內取樣越界 -->
      <template v-if="outcome">
        <div class="result-veil" aria-hidden="true" />
        <div class="result-layer" :style="uiStyle">
          <BattleResult
            :result="outcome"
            :speed="speed"
            :rounds="rounds"
            :exit-label="exitLabel"
            :figure-h="layout.resultFigureH"
            @continue="onContinue"
            @retry="onRetry"
            @pointerdown.stop
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.battle-outer {
  --gutter: clamp(4px, 1.2dvh, 16px);
  position: fixed;
  inset: 0;
  z-index: 5;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  box-sizing: border-box;
  padding: max(env(safe-area-inset-top), var(--gutter)) max(env(safe-area-inset-right), var(--gutter))
    max(env(safe-area-inset-bottom), var(--gutter)) max(env(safe-area-inset-left), var(--gutter));
  background: linear-gradient(180deg, #e4f4f1 0%, #c6e4ee 45%, #b3d2e8 80%, #c8c1e6 100%);
  overflow: clip;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
  overscroll-behavior: none;
}
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: clip;
  border-radius: clamp(0px, 1.2dvh, 14px);
}
.stage.hidden {
  visibility: hidden;
}
/* 降飽和只套畫面內容，結算層維持原色 */
.stage.gray .gl,
.stage.gray .ui > * {
  filter: saturate(0.35);
}
.result-veil {
  position: absolute;
  inset: 0;
  background: rgba(62, 53, 80, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.result-layer {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  font-family: var(--font-ui);
  color: var(--c-ink);
}
.gl {
  position: absolute;
  inset: 0;
  transition: filter 0.6s;
}
.ui {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  font-family: var(--font-ui);
  color: var(--c-ink);
}
.ui.locked {
  cursor: default;
}
.mana {
  position: absolute;
}
.enemy-hand {
  position: absolute;
  display: flex;
}
.back {
  flex: none;
  width: 52px;
  height: 72px;
  margin-left: -24px;
  box-sizing: border-box;
  border-radius: 9px;
  background: #8d74c2 url('@assets/ui/card-back.webp') center / cover;
  border: 3px solid #fffdf7;
  box-shadow: 0 3px 8px rgba(62, 53, 80, 0.2);
}
.back:first-child {
  margin-left: 0;
}
.deck {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 10px;
}
.pile {
  flex: none;
  width: 44px;
  height: 60px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #8d74c2 url('@assets/ui/card-back.webp') center / cover;
  border: 3px solid #fffdf7;
  box-shadow:
    3px 3px 0 #fffdf7,
    6px 6px 0 #d8cdea;
}
.count {
  padding: 2px 12px;
  border-radius: 999px;
  background: rgba(46, 39, 66, 0.82);
  box-shadow: inset 0 0 0 2px rgba(169, 212, 236, 0.55);
  font: 800 var(--count) var(--font-num);
  line-height: 1;
  color: #fff;
  white-space: nowrap;
}
.deck.few .count {
  color: #f0a04b;
}
.deck.few .count::after {
  content: '!';
  margin-left: 2px;
}
/* 牌庫空：卡堆改空盒虛線框 */
.deck.empty .pile {
  background: transparent;
  border: 3px dashed #fffdf7;
  box-shadow: none;
}
.deck.empty .count {
  color: #ffb4b4;
}
.end-turn {
  position: absolute;
}
/* 已無可出牌：外圈鵝黃光暈只改透明度，不縮放 */
.end-turn.done::after {
  content: '';
  position: absolute;
  top: -6px;
  bottom: -6px;
  left: calc(var(--hh) / -2 - 6px);
  right: calc(var(--hh) / -2 - 6px);
  border-radius: 999px;
  pointer-events: none;
  box-shadow:
    0 0 0 6px rgba(246, 227, 161, 0.85),
    0 0 26px 10px rgba(246, 227, 161, 0.75);
  animation: end-glow 1.6s ease-in-out infinite;
}
.target-actions {
  position: absolute;
  z-index: 36;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 12px;
}
.speed-tip {
  position: absolute;
  z-index: 36;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  pointer-events: none;
}
.speed-tip span {
  padding: 0.4em 1em;
  border-radius: 999px;
  background: rgba(46, 39, 66, 0.85);
  color: #fff;
  font-size: max(22px, calc(var(--min-font) * 1.15));
  font-weight: 800;
  white-space: nowrap;
  box-shadow: var(--shadow);
}
.speed-tip.on span {
  background: var(--c-lavender-deep);
}
.board-full-tip {
  position: absolute;
  z-index: 37;
  pointer-events: none;
  padding: 0.3em 0.9em;
  border-radius: 999px;
  background: rgba(46, 39, 66, 0.88);
  color: #fff;
  font-size: max(26px, calc(var(--min-font) * 1.2));
  font-weight: 800;
  white-space: nowrap;
}
.drag-ghost {
  position: absolute;
  z-index: 35;
  pointer-events: none;
  transform: translate(-50%, -60%) scale(1.1) rotate(-3deg);
  transition: transform 0.12s;
}
.drag-ghost.small {
  transform: translate(-50%, -50%) scale(0.8);
}
.showcase {
  position: absolute;
  z-index: 38;
  pointer-events: none;
  filter: drop-shadow(0 12px 30px rgba(62, 53, 80, 0.35));
}
.showcase-scale {
  width: 300px;
  transform-origin: 0 0;
}
.fx-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 45;
}
.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 44;
  opacity: 0;
  box-shadow: inset 0 0 160px 60px rgba(224, 96, 122, 0.2);
}
.banner {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 50;
  pointer-events: none;
  font-size: 64px;
  font-weight: 900;
  color: #fff;
  -webkit-text-stroke: 4px var(--c-lavender-deep);
  paint-order: stroke fill;
}
.hint {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 51;
  pointer-events: none;
  padding: 10px 28px;
  border-radius: 999px;
  background: rgba(255, 253, 247, 0.95);
  box-shadow: var(--shadow);
  font-size: max(32px, var(--min-font));
  font-weight: 800;
  white-space: nowrap;
}
.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 40px;
  font-weight: 800;
  color: var(--c-lavender-deep);
  background: rgba(251, 246, 236, 0.6);
  z-index: 70;
}
.rotate-hint {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--c-cream);
  font-size: 22px;
  font-weight: 800;
}
.rotate-icon {
  font-size: 56px;
  line-height: 1;
  color: var(--c-lavender-deep);
}
:deep(.float-text) {
  position: absolute;
  font: 800 48px var(--font-num);
  color: #fff;
  -webkit-text-stroke: 3px var(--c-ink);
  paint-order: stroke fill;
  white-space: nowrap;
  padding: 2px 18px;
  border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
}
:deep(.float-damage) {
  background: var(--c-damage);
}
:deep(.float-hero) {
  font-size: 64px;
}
:deep(.float-heal) {
  background: var(--c-heal);
  border-radius: 60% 0;
}
:deep(.float-buff) {
  background: var(--c-buff);
  font-size: 40px;
}
:deep(.float-info) {
  font-family: var(--font-ui);
  font-size: max(32px, var(--min-font));
  background: rgba(127, 120, 194, 0.9);
  border-radius: 999px;
}
@keyframes end-glow {
  50% {
    opacity: 0.35;
  }
}
</style>

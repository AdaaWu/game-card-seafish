<script setup lang="ts">
// 對戰畫面：玩家（p1）對 AI（p2）；three.js 戰場＋DOM 疊層，事件依序播放動畫
import gsap from 'gsap'
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watchEffect } from 'vue'
import CardView from '@/components/CardView.vue'
import { chooseAction, MAX_ACTIONS_PER_TURN } from '@/ai'
import { characterByName, cardDb, tokens } from '@/content'
import { cardArtUrl } from '@/content/cardStyle'
import { createRng, hasNoActions, type Action, type Card, type GameEvent, type PlayerId } from '@/engine'
import { Animator } from '@/fx/animator'
import { TIMING } from '@/fx/animationPlan'
import { audio, type BgmName } from '@/fx/audio'
import { loadImage } from '@/render/cardTexture'
import { Battlefield } from '@/render/battle/Battlefield'
import { computeLayout, DESIGN_H, DESIGN_W, type Rect } from '@/render/battle/battleLayout'
import { roundsOf } from '@/render/battle/viewModel'
import { useBattleStore } from '@/stores/battle'
import { useSettingsStore } from '@/stores/settings'
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
  }>(),
  { seed: undefined, enemyPortraitId: undefined, bgm: 'bgm_battle_normal' },
)
const emit = defineEmits<{ finished: [result: Outcome] }>()

const PLAYER_NAME = '小葉'
const END: Action = { type: 'endTurn' }
const EMPTY: ReadonlySet<string> = new Set<string>()

const store = useBattleStore()
const settings = useSettingsStore()
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
  const base = { card: d.card, x: d.x, y: d.y, side: d.side, cardW: layout.value.detailCardW, minFont: layout.value.minFont }
  if (!d.minionId) return base
  const pid = ownerOf(d.minionId)
  const vm = pid ? view.value?.players[pid].board.find((m) => m.instanceId === d.minionId) : undefined
  if (!vm) return null
  return { ...base, attack: vm.attack, health: vm.health, keywords: vm.keywords }
})
const detailW = computed(() => layout.value.detailCardW + 12 + Math.max(230, layout.value.minFont * 11))
const rounds = computed(() => roundsOf(view.value?.turn ?? 1))

const locked = computed(() => store.busy || loading.value || outcome.value !== null)
const legal = computed(() => store.legal)
const playable = computed(() => {
  const set = new Set<string>()
  for (const a of legal.value) if (a.type === 'playCard' && a.cardInstanceId) set.add(a.cardInstanceId)
  return set
})
const canAttack = computed(() => {
  const set = new Set<string>()
  for (const a of legal.value) if (a.type === 'attack') set.add(a.attackerId)
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

// 我方無可用動作時提示後自動結束回合
const AUTO_END = { delayMs: 1000, hint: '無可用動作' } as const

function canAutoEnd(): boolean {
  const s = store.state
  return !!s && hasNoActions(s, 'p1') && !locked.value && !enemyTurn.value
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
  field?.showSeam(null)
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
    // 安全上限：40 步後強制結束回合
    const action = step >= MAX_ACTIONS_PER_TURN ? END : chooseAction(s, 'p2', aiRng)
    let r = store.act(action)
    if (!r.ok) r = store.act(END)
    if (!r.ok) break
    await runEvents(r.events, true)
  }
}

async function commit(action: Action): Promise<void> {
  if (locked.value) return
  mode.value = { kind: 'idle' }
  attackDrag.value = null
  field?.setSelected(null)
  field?.showSeam(null)
  detail.value = null
  const r = store.act(action)
  if (!r.ok) {
    showHint(friendly(r.reason))
    return
  }
  try {
    await runEvents(r.events, false)
    if (!disposed && store.state?.winner === null && store.state.activePlayer === 'p2') await runAi()
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
    return
  }
  if (m.source.type === 'attack') void commit({ type: 'attack', attackerId: m.source.id, targetId })
  else void commit({ type: 'playCard', cardInstanceId: m.source.id, position: m.source.position, targetId })
}

function startAttack(id: string, x: number, y: number): void {
  if (!canAttack.value.has(id)) {
    const reason = store.reasonFor({ type: 'attack', attackerId: id, targetId: 'p2-hero' })
    showHint(friendly(reason ?? '現在不能攻擊'))
    if (field) gsap.timeline().add(field.tlShakeNo(id))
    return
  }
  const ts = legal.value.flatMap((a) => (a.type === 'attack' && a.attackerId === id ? [a.targetId] : []))
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
    field?.showSeam(field.insertIndexAt(p.x))
  } else field?.showSeam(null)
  if (!drag.value?.active) updateMinionHover(p.x, p.y)
}

function onUp(e: PointerEvent): void {
  const p = toLogical(e)
  const d = drag.value
  if (d) {
    drag.value = null
    field?.showSeam(null)
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
    else cancelMode()
  } else if (a) attackDrag.value = null
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
    const x = clamp(side === 'right' ? at.x + 90 : at.x - 90 - detailW.value, 20, l.lw - detailW.value - 20)
    const y = clamp(at.y - h / 2, 20, l.lh - h - 20)
    detail.value = { card, minionId: id, x, y, side }
  }, 250)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi))
}

// ---------- 場上外觀同步 ----------
const fieldReady = ref(false)
watchEffect(() => {
  if (!fieldReady.value || !field) return
  const showReady = !locked.value && mode.value.kind === 'idle'
  field.setReady(showReady ? canAttack.value : new Set())
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
  const heroes = uiEl.value?.querySelectorAll('[data-hero] .portrait-wrap')
  if (heroes?.length) gsap.set(heroes, { clearProps: 'all' })
  field?.reset()
  audio.playBgm(props.bgm)
  await startBattle()
}

async function startBattle(): Promise<void> {
  if (!animator) return
  const events = store.start({
    playerDeck: props.playerDeck,
    enemyDeck: props.enemyDeck,
    enemyHeroHp: props.enemyHeroHp,
    seed: battleSeed,
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
  field?.setView(l.lw, l.lh, l.boardCy)
}

async function preloadImages(): Promise<Map<string, HTMLImageElement | null>> {
  const ids = new Set([...props.playerDeck, ...props.enemyDeck, ...tokens.map((t) => t.id)])
  const map = new Map<string, HTMLImageElement | null>()
  const timeout = new Promise<void>((r) => setTimeout(r, 8000))
  await Promise.race([
    Promise.all(
      [...ids].map(async (id) => {
        const url = cardArtUrl(id)
        map.set(id, url ? await loadImage(url) : null)
      }),
    ),
    timeout,
  ])
  return map
}

onMounted(async () => {
  fit()
  resizeObserver = new ResizeObserver(fit)
  if (stageEl.value) resizeObserver.observe(stageEl.value)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('keydown', onKey)
  const images = await preloadImages()
  if (disposed || !glEl.value) return
  field = new Battlefield(glEl.value, cards, images)
  field.setView(layout.value.lw, layout.value.lh, layout.value.boardCy)
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
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('keydown', onKey)
  animator?.dispose()
  field?.dispose()
  field = null
  store.reset()
})

const pos = (r: Rect) => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
const uiStyle = computed(() => {
  const l = layout.value
  return {
    width: `${l.lw}px`,
    height: `${l.lh}px`,
    transform: `scale(${l.scale})`,
    '--min-font': `${l.minFont}px`,
    '--btn-h': `${l.buttonH}px`,
  }
})
</script>


<template>
  <div class="battle-outer" @contextmenu.prevent>
    <div v-if="portrait" class="rotate-hint" role="alert">
      <span class="rotate-icon" aria-hidden="true">⟳</span>
      請將裝置轉為橫向
    </div>
    <div ref="stageEl" class="stage" :class="{ gray: fx.lowSaturation, hidden: portrait }">
      <div ref="glEl" class="gl" />
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
            :class="{ few: view.players.p2.deckCount <= 5 }"
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
            :class="{ few: view.players.p1.deckCount <= 5 }"
          >
            <span class="pile" />
            <span class="count">{{ view.players.p1.deckCount }}</span>
          </div>

          <button
            class="end-turn"
            :class="endState"
            :style="[pos(layout.endTurn), { fontSize: `${layout.endTurnFont}px` }]"
            type="button"
            :disabled="enemyTurn || locked || endLocked"
            data-testid="end-turn"
            @pointerdown.stop
            @click="endTurn"
          >
            {{ enemyTurn ? '對手回合' : '結束回合' }}
          </button>

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
          <button class="btn" type="button" data-testid="play-no-target" @click="playWithoutTarget">不選目標，直接打出</button>
          <button class="btn ghost" type="button" @click="cancelMode">取消</button>
        </div>
        <div v-else-if="mode.kind !== 'idle'" class="target-actions" :style="pos(layout.actions)">
          <button class="btn ghost cancel-float" type="button" data-testid="cancel" @pointerdown.stop @click="cancelMode">取消</button>
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

        <div v-if="dragGhost" class="drag-ghost" :class="{ small: dragGhost.small }" :style="{ left: `${pointer.x}px`, top: `${pointer.y}px` }">
          <CardView :card="dragGhost.card" size="sm" />
        </div>

        <div
          v-if="fx.showcase && cards[fx.showcase.cardId]"
          :key="fx.showcase.key"
          class="showcase"
          :style="{ left: `${layout.lw / 2 - 150}px`, top: `${layout.boardCy - 210}px` }"
        >
          <CardView :card="cards[fx.showcase.cardId]!" size="lg" />
        </div>

        <CardDetail v-if="detailView && !drag?.active" v-bind="detailView" />

        <div ref="fxEl" class="fx-layer" />
        <div class="vignette" />
        <div v-if="fx.banner" :key="fx.banner.key" class="banner" :style="{ top: `${layout.boardCy - 40}px` }">{{ fx.banner.text }}</div>
        <div v-if="hint" :key="hint.key" class="hint" :style="{ top: `${layout.board.y + 20}px` }" role="status">{{ hint.text }}</div>
        <div v-if="loading" class="loading">潛入海底中…</div>

        <BattleResult
          v-if="outcome"
          :result="outcome"
          :speed="speed"
          :rounds="rounds"
          @continue="onContinue"
          @retry="onRetry"
          @pointerdown.stop
        />
      </div>
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
  transition: filter 0.6s;
}
.stage.hidden {
  visibility: hidden;
}
.stage.gray {
  filter: saturate(0.35);
}
.gl {
  position: absolute;
  inset: 0;
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
  background:
    radial-gradient(circle at 50% 50%, #fff 0 8px, transparent 9px),
    linear-gradient(135deg, #b9a6db, #8d74c2);
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
  background: linear-gradient(135deg, #b9a6db, #8d74c2);
  border: 3px solid #fffdf7;
  box-shadow:
    3px 3px 0 #fffdf7,
    6px 6px 0 #d8cdea;
}
.count {
  font: 800 var(--count) var(--font-num);
  line-height: 1;
  color: #fff;
  -webkit-text-stroke: 2px var(--c-ink);
  paint-order: stroke fill;
  white-space: nowrap;
}
.deck.few .count {
  color: #f0a04b;
}
.deck.few .count::after {
  content: '!';
  margin-left: 2px;
}
.end-turn {
  position: absolute;
  box-sizing: border-box;
  border: none;
  border-radius: 20px;
  font-weight: 800;
  color: #fff;
  background: var(--c-lavender);
  box-shadow:
    0 5px 0 var(--c-lavender-deep),
    var(--shadow);
  cursor: pointer;
  text-shadow: 0 1px 2px rgba(62, 53, 80, 0.4);
  transition: transform 0.1s;
}
.end-turn:hover:not(:disabled) {
  transform: scale(1.05);
}
.end-turn:active:not(:disabled) {
  transform: scale(0.95);
}
.end-turn.done {
  background: var(--c-butter);
  color: var(--c-ink);
  text-shadow: none;
  box-shadow:
    0 5px 0 #d9c17a,
    var(--shadow);
  animation: glow 1.6s ease-in-out infinite;
}
.end-turn.enemy,
.end-turn:disabled {
  background: var(--c-disabled);
  box-shadow: none;
  cursor: default;
}
.target-actions {
  position: absolute;
  z-index: 36;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 12px;
}
.target-actions .btn {
  min-height: var(--btn-h);
  font-size: max(22px, var(--min-font));
  padding: 0 20px;
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
/* 可以結束回合：外框光暈脈動，不縮放 */
@keyframes glow {
  50% {
    box-shadow:
      0 5px 0 #d9c17a,
      0 0 0 6px rgba(246, 227, 161, 0.7),
      var(--shadow);
  }
}
</style>

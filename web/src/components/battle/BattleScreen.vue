<script setup lang="ts">
// 對戰畫面：玩家（p1）對 AI（p2）；three.js 戰場＋DOM 疊層，事件依序播放動畫
import gsap from 'gsap'
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watchEffect } from 'vue'
import CardView from '@/components/CardView.vue'
import { chooseAction, MAX_ACTIONS_PER_TURN } from '@/ai'
import { characterByName, cardDb, tokens } from '@/content'
import { cardArtUrl } from '@/content/cardStyle'
import { createRng, type Action, type Card, type GameEvent, type PlayerId } from '@/engine'
import { Animator } from '@/fx/animator'
import { TIMING } from '@/fx/animationPlan'
import { audio } from '@/fx/audio'
import { loadImage } from '@/render/cardTexture'
import { Battlefield, LOGICAL_H, LOGICAL_W } from '@/render/battle/Battlefield'
import { useBattleStore } from '@/stores/battle'
import { useSettingsStore } from '@/stores/settings'
import BattleResult from './BattleResult.vue'
import CardDetail from './CardDetail.vue'
import HandFan from './HandFan.vue'
import HeroPanel from './HeroPanel.vue'
import ManaBar from './ManaBar.vue'
import TargetArrow from './TargetArrow.vue'
import { createBattleStage, type StageFx } from './battleStage'

type Outcome = 'win' | 'lose' | 'draw'

const props = withDefaults(
  defineProps<{
    playerDeck: string[]
    enemyDeck: string[]
    enemyName: string
    enemyHeroHp: number
    seed?: number
  }>(),
  { seed: undefined },
)
const emit = defineEmits<{ finished: [result: Outcome] }>()

const PLAYER_NAME = '小葉'
const PLAY_LINE = LOGICAL_H * 0.72
const END: Action = { type: 'endTurn' }
const EMPTY: ReadonlySet<string> = new Set<string>()

const store = useBattleStore()
const settings = useSettingsStore()
const cards: Record<string, Card> = cardDb
const enemyFaction = computed(() => characterByName(props.enemyName)?.faction ?? 'tide')
const view = computed(() => store.view)
const speed = computed(() => settings.settings.speed)

const outerEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const glEl = ref<HTMLElement | null>(null)
const uiEl = ref<HTMLElement | null>(null)
const fxEl = ref<HTMLElement | null>(null)
const scale = ref(1)
const loading = ref(true)
const portrait = ref(false)
const outcome = ref<Outcome | null>(null)
const fx = reactive<StageFx>({ banner: null, showcase: null, lowSaturation: false })
const hint = ref<{ text: string; key: number } | null>(null)
const endLocked = ref(false)

let field: Battlefield | null = null
let animator: Animator | null = null
let disposed = false
let hintTimer: ReturnType<typeof setTimeout> | undefined
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | null = null
const battleSeed = props.seed ?? (Date.now() >>> 0)
const aiRng = createRng((battleSeed ^ 0x5bd1e995) >>> 0)

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
  attack?: number
  health?: number
  keywords?: string[]
  x: number
  y: number
  side: 'left' | 'right'
} | null>(null)

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
  else from = centerOfEl(uiEl.value?.querySelector(`[data-hand="${m.source.id}"] .hand-inner`) ?? null) ?? { x: 960, y: 800 }
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
  return { card, small: pointer.y < PLAY_LINE }
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
    if (c && Math.hypot(c.x - x, c.y - y) < 80) return `${pid}-hero`
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
    animator?.resetBoost()
    store.busy = false
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
    if (store.busy) animator?.boost()
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
    animator?.boost()
    return
  }
  if (locked.value) return
  if (e.button === 2) {
    cancelMode()
    return
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
    if (p.y >= PLAY_LINE) cancelMode()
    else if (card?.type === 'creature') place(m.id, field?.insertIndexAt(p.x) ?? 0)
    else void commit({ type: 'playCard', cardInstanceId: m.id })
    return
  }
  if (id && ownerOf(id) === 'p1') startAttack(id, p.x, p.y)
}

function onHeroPick(pid: PlayerId): void {
  audio.unlock()
  if (store.busy) {
    animator?.boost()
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
    handHover.value = null
    detail.value = null
  }
  const m = mode.value
  const draggingCard = drag.value?.active ? drag.value.id : m.kind === 'card' ? m.id : null
  if (draggingCard && cardOfHand(draggingCard)?.type === 'creature' && p.y < PLAY_LINE && playable.value.has(draggingCard)) {
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
    else if (p.y < PLAY_LINE) onHandRelease(d.id)
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
    if (store.busy) animator?.boost()
    else endTurn()
  }
}

function endTurn(): void {
  if (locked.value || enemyTurn.value || endLocked.value) return
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
    if (!card || !c) return
    const x = Math.min(Math.max(c.x - 150, 20), LOGICAL_W - 560)
    detail.value = { card, x, y: 440, side: 'right' }
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
    const side = at.x < LOGICAL_W / 2 ? 'right' : 'left'
    const x = side === 'right' ? at.x + 90 : at.x - 90 - 542
    const y = Math.min(Math.max(at.y - 210, 20), LOGICAL_H - 440)
    detail.value = { card, attack: vm.attack, health: vm.health, keywords: vm.keywords, x, y, side }
  }, 250)
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

function onGameOver(): void {
  const w = store.state?.winner
  outcome.value = w === 'p1' ? 'win' : w === 'p2' ? 'lose' : 'draw'
  audio.playBgm(outcome.value === 'win' ? 'bgm_victory' : 'bgm_defeat')
}

function fit(): void {
  const outer = outerEl.value
  if (!outer) return
  const w = outer.clientWidth
  const h = outer.clientHeight
  portrait.value = h > w
  const sw = Math.min(w, (h * 16) / 9)
  scale.value = sw / LOGICAL_W
  if (stageEl.value) {
    stageEl.value.style.width = `${sw}px`
    stageEl.value.style.height = `${(sw * 9) / 16}px`
  }
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
  if (outerEl.value) resizeObserver.observe(outerEl.value)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('keydown', onKey)
  const images = await preloadImages()
  if (disposed || !glEl.value) return
  field = new Battlefield(glEl.value, cards, images)
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
  const events = store.start({
    playerDeck: props.playerDeck,
    enemyDeck: props.enemyDeck,
    enemyHeroHp: props.enemyHeroHp,
    seed: battleSeed,
  })
  loading.value = false
  await runEvents(events, false)
  animator.resetBoost()
  store.busy = false
})

onUnmounted(() => {
  disposed = true
  clearTimeout(hintTimer)
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
</script>

<template>
  <div ref="outerEl" class="battle-outer" @contextmenu.prevent>
    <div v-if="portrait" class="rotate-hint">請將裝置轉為橫向</div>
    <div ref="stageEl" class="stage" :class="{ gray: fx.lowSaturation }">
      <div ref="glEl" class="gl" />
      <div
        ref="uiEl"
        class="ui"
        :class="{ locked }"
        :style="{ transform: `scale(${scale})` }"
        data-testid="battle-ui"
        @pointerdown="onRootDown"
      >
        <template v-if="view">
          <!-- 敵方 -->
          <HeroPanel
            pid="p2"
            class="hero-p2"
            :name="enemyName"
            :faction="enemyFaction"
            :hp="view.players.p2.hp"
            :armor="view.players.p2.armor"
            :targetable="targets.has('p2-hero')"
            :dimmed="mode.kind === 'target' && !targets.has('p2-hero')"
            @pick="onHeroPick('p2')"
          />
          <ManaBar class="mana-p2" :mana="view.players.p2.mana" :max-mana="view.players.p2.maxMana" small />
          <div class="enemy-hand" :aria-label="`對手手牌 ${view.players.p2.hand.length} 張`">
            <span v-for="c in view.players.p2.hand" :key="c.instanceId" class="back" />
          </div>
          <div class="deck deck-p2" data-deck="p2" :class="{ few: view.players.p2.deckCount <= 5 }">
            <span class="pile" />
            <span class="count">{{ view.players.p2.deckCount }}</span>
          </div>

          <!-- 我方 -->
          <HeroPanel
            pid="p1"
            class="hero-p1"
            :name="PLAYER_NAME"
            faction="leaf"
            :hp="view.players.p1.hp"
            :armor="view.players.p1.armor"
            :targetable="targets.has('p1-hero')"
            :dimmed="mode.kind === 'target' && !targets.has('p1-hero')"
            @pick="onHeroPick('p1')"
          />
          <ManaBar
            class="mana-p1"
            :mana="view.players.p1.mana"
            :max-mana="view.players.p1.maxMana"
            :preview="selectedHand ? cardOfHand(selectedHand)?.cost ?? 0 : 0"
          />
          <div class="deck deck-p1" data-deck="p1" :class="{ few: view.players.p1.deckCount <= 5 }">
            <span class="pile" />
            <span class="count">{{ view.players.p1.deckCount }}</span>
          </div>

          <button
            class="end-turn"
            :class="endState"
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
            @down="onHandDown"
            @enter="onHandEnter"
            @leave="onHandLeave"
          />
        </template>

        <TargetArrow v-if="arrow" v-bind="arrow" />
        <div v-if="mode.kind === 'target' && mode.optional" class="target-actions" @pointerdown.stop>
          <button class="btn" type="button" data-testid="play-no-target" @click="playWithoutTarget">不選目標，直接打出</button>
          <button class="btn ghost" type="button" @click="cancelMode">取消</button>
        </div>
        <button
          v-else-if="mode.kind !== 'idle'"
          class="btn ghost cancel-float"
          type="button"
          @pointerdown.stop
          @click="cancelMode"
        >
          取消
        </button>

        <div v-if="dragGhost" class="drag-ghost" :class="{ small: dragGhost.small }" :style="{ left: `${pointer.x}px`, top: `${pointer.y}px` }">
          <CardView :card="dragGhost.card" size="sm" />
        </div>

        <div v-if="fx.showcase && cards[fx.showcase.cardId]" :key="fx.showcase.key" class="showcase">
          <CardView :card="cards[fx.showcase.cardId]!" size="lg" />
        </div>

        <CardDetail v-if="detail && !drag?.active" v-bind="detail" />

        <div ref="fxEl" class="fx-layer" />
        <div class="vignette" />
        <div v-if="fx.banner" :key="fx.banner.key" class="banner">{{ fx.banner.text }}</div>
        <div v-if="hint" :key="hint.key" class="hint" role="status">{{ hint.text }}</div>
        <div v-if="loading" class="loading">潛入海底中…</div>

        <BattleResult v-if="outcome" :result="outcome" :speed="speed" @continue="onContinue" @pointerdown.stop />
      </div>
    </div>
  </div>
</template>

<style scoped>
.battle-outer {
  position: fixed;
  inset: 0;
  z-index: 5;
  background: #bcd9ea;
  display: grid;
  place-items: center;
  overflow: clip;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.stage {
  position: relative;
  overflow: clip;
  transition: filter 0.6s;
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
  width: 1920px;
  height: 1080px;
  transform-origin: 0 0;
  font-family: var(--font-ui);
  color: var(--c-ink);
}
.ui.locked {
  cursor: default;
}
.hero-p2 {
  left: 880px;
  top: 50px;
}
.hero-p1 {
  left: 880px;
  top: 750px;
}
.mana-p2 {
  position: absolute;
  left: 1070px;
  top: 112px;
}
.mana-p1 {
  position: absolute;
  left: 1070px;
  top: 820px;
}
.enemy-hand {
  position: absolute;
  left: 1250px;
  top: -40px;
  display: flex;
}
.back {
  width: 70px;
  height: 98px;
  margin-left: -34px;
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 50%, #fff 0 10px, transparent 11px),
    linear-gradient(135deg, #b9a6db, #8d74c2);
  border: 3px solid #fffdf7;
  box-shadow: var(--shadow);
}
.deck {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
}
.deck-p2 {
  left: 1500px;
  top: 150px;
}
.deck-p1 {
  left: 1640px;
  top: 860px;
}
.pile {
  width: 44px;
  height: 60px;
  border-radius: 8px;
  background: linear-gradient(135deg, #b9a6db, #8d74c2);
  border: 3px solid #fffdf7;
  box-shadow:
    3px 3px 0 #fffdf7,
    6px 6px 0 #d8cdea;
}
.count {
  font: 800 30px var(--font-num);
  color: #fff;
  -webkit-text-stroke: 2px var(--c-ink);
  paint-order: stroke fill;
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
  left: 1700px;
  top: 484px;
  width: 160px;
  height: 72px;
  border: none;
  border-radius: 20px;
  font-size: 24px;
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
  animation: breathe 1.6s ease-in-out infinite;
}
.end-turn.enemy,
.end-turn:disabled {
  background: var(--c-disabled);
  box-shadow: none;
  cursor: default;
}
.target-actions {
  position: absolute;
  left: 1640px;
  top: 600px;
  z-index: 36;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 240px;
}
.cancel-float {
  position: absolute;
  left: 40px;
  top: 960px;
  z-index: 36;
  min-width: 96px;
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
  left: 810px;
  top: 150px;
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
  top: 470px;
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
  top: 300px;
  transform: translateX(-50%);
  z-index: 51;
  pointer-events: none;
  padding: 10px 28px;
  border-radius: 999px;
  background: rgba(255, 253, 247, 0.95);
  box-shadow: var(--shadow);
  font-size: 32px;
  font-weight: 800;
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
  display: grid;
  place-items: center;
  background: var(--c-cream);
  font-size: 22px;
  font-weight: 800;
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
  font-size: 32px;
  background: rgba(127, 120, 194, 0.9);
  border-radius: 999px;
}
@keyframes breathe {
  50% {
    transform: scale(1.05);
  }
}
</style>

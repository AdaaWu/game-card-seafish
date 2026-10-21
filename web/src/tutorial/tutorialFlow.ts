// 新手教學步驟狀態機：目前步驟、允許的動作、完成條件、跳過
import { heroId } from '@/engine'
import type { Action, GameState } from '@/engine'

export const TUTORIAL_BATTLE_ID = 'ch1-b1'
export const TUTORIAL_TOTAL_STEPS = 9

// 高亮目標；card:/cost: 後接卡牌 id，指手牌中的那張卡
export type Focus =
  | 'heroP1'
  | 'heroP2'
  | 'hand'
  | 'mana'
  | 'endTurn'
  | 'myBoard'
  | 'myMinions'
  | 'enemyMinions'
  | 'enemyHero'
  | `card:${string}`
  | `cost:${string}`

export type Allow =
  | { type: 'play'; cardId: string; target?: 'enemyMinion' }
  | { type: 'attack'; target: 'minion' | 'hero' }
  | { type: 'endTurn' }

export type Signal =
  | { type: 'next' }
  | { type: 'played'; cardId: string }
  | { type: 'attacked'; target: 'minion' | 'hero' }
  | { type: 'endTurn' }
  | { type: 'playerTurn' }
  | { type: 'heroAttackBlocked' }
  | { type: 'detailShown' }

export interface Beat {
  id: string
  step: number
  title: string
  text: string
  // info：點擊前進；do：做指定動作；wait：對手回合
  kind: 'info' | 'do' | 'wait'
  focus: Focus[]
  dim: 'dark' | 'light' | 'none'
  allow: Allow | null
  until: Signal
  // 可以選取攻擊者但不能真的攻擊，用來示範非法目標
  selectAttackers?: boolean
  // 自動顯示的關鍵字說明
  keyword?: string
}

export type TutorialStatus = 'running' | 'done' | 'skipped'

export interface TutorialState {
  index: number
  status: TutorialStatus
}

const TITLES = [
  '認識戰場',
  '看懂潮能',
  '打出第一張生物',
  '結束回合',
  '用生物攻擊',
  '遇到守護',
  '施放指定目標法術',
  '看卡牌細節',
  '攻擊英雄獲勝',
] as const

const NEXT: Signal = { type: 'next' }
const END: Allow = { type: 'endTurn' }

type BeatSpec = Omit<Beat, 'title' | 'dim' | 'allow'> & { allow?: Allow | null; dim?: Beat['dim'] }

function beat(spec: BeatSpec): Beat {
  const dim = spec.dim ?? (spec.kind === 'wait' ? 'none' : 'dark')
  return { ...spec, title: TITLES[spec.step - 1] ?? '', dim, allow: spec.allow ?? null }
}

export const TUTORIAL_BEATS: readonly Beat[] = [
  beat({ id: 's1-hp', step: 1, kind: 'info', focus: ['heroP1'], text: '這是你的生命，歸零就輸了', until: NEXT }),
  beat({ id: 's1-enemy', step: 1, kind: 'info', focus: ['heroP2'], text: '這是對手的生命，打到 0 就贏了', until: NEXT }),
  beat({ id: 's1-hand', step: 1, kind: 'info', focus: ['hand'], text: '下面這排是你的手牌', until: NEXT }),
  beat({ id: 's2-mana', step: 2, kind: 'info', focus: ['mana'], text: '這是潮能。每回合會加 1，最多 10', until: NEXT }),
  beat({ id: 's2-cost', step: 2, kind: 'info', focus: ['cost:leaf-002'], text: '卡片左上的數字，是打出它需要的潮能', until: NEXT }),
  beat({
    id: 's3-play',
    step: 3,
    kind: 'do',
    focus: ['card:leaf-002', 'myBoard'],
    text: '把海兔小護士拖到戰場上。也可以點一下卡片，再點戰場',
    allow: { type: 'play', cardId: 'leaf-002' },
    until: { type: 'played', cardId: 'leaf-002' },
  }),
  beat({
    id: 's4-end',
    step: 4,
    kind: 'do',
    focus: ['endTurn'],
    text: '剛召喚的生物要等下一回合才能攻擊。按「結束回合」',
    allow: END,
    until: { type: 'endTurn' },
  }),
  beat({ id: 's4-wait', step: 4, kind: 'wait', focus: [], text: '對手的回合，看看殼殼做了什麼', until: { type: 'playerTurn' } }),
  beat({
    id: 's5-attack',
    step: 5,
    kind: 'do',
    focus: ['myMinions', 'enemyMinions'],
    text: '拖動海兔小護士，去攻擊對手的小丑魚斥候',
    allow: { type: 'attack', target: 'minion' },
    until: { type: 'attacked', target: 'minion' },
  }),
  beat({ id: 's5-stats', step: 5, kind: 'info', focus: ['myMinions'], text: '左下是攻擊、右下是生命。互相攻擊時，雙方都會受傷', until: NEXT }),
  beat({
    id: 's5-play',
    step: 5,
    kind: 'do',
    focus: ['card:neutral-002', 'myBoard'],
    text: '再打出一張 2 費的海星寶寶',
    allow: { type: 'play', cardId: 'neutral-002' },
    until: { type: 'played', cardId: 'neutral-002' },
  }),
  beat({ id: 's5-end', step: 5, kind: 'do', focus: ['endTurn'], text: '按「結束回合」', allow: END, until: { type: 'endTurn' } }),
  beat({ id: 's5-wait', step: 5, kind: 'wait', focus: [], text: '對手的回合', until: { type: 'playerTurn' } }),
  beat({
    id: 's6-try',
    step: 6,
    kind: 'do',
    focus: ['myMinions', 'enemyHero'],
    text: '試試看，拖動你的生物去攻擊對手英雄',
    selectAttackers: true,
    until: { type: 'heroAttackBlocked' },
  }),
  beat({ id: 's6-taunt', step: 6, kind: 'info', focus: ['enemyMinions'], text: '有守護的生物在，要先打倒牠', keyword: 'taunt', until: NEXT }),
  beat({
    id: 's7-spell',
    step: 7,
    kind: 'do',
    focus: ['card:light-009', 'enemyMinions'],
    text: '把陽光直射拖出來，指定小寄居蟹。亮起來的是可以選的目標，灰色斜線的不行',
    allow: { type: 'play', cardId: 'light-009', target: 'enemyMinion' },
    until: { type: 'played', cardId: 'light-009' },
  }),
  beat({ id: 's8-detail', step: 8, kind: 'do', focus: ['hand'], text: '把游標停在卡片上（手機長按），可以看完整說明', until: { type: 'detailShown' } }),
  beat({
    id: 's9-face',
    step: 9,
    kind: 'do',
    dim: 'light',
    focus: ['myMinions', 'enemyHero'],
    text: '守護不見了！用生物攻擊對手英雄',
    allow: { type: 'attack', target: 'hero' },
    until: { type: 'attacked', target: 'hero' },
  }),
]

export function createTutorial(): TutorialState {
  return { index: 0, status: 'running' }
}

export function isRunning(t: TutorialState | null): boolean {
  return t?.status === 'running'
}

export function currentBeat(t: TutorialState): Beat | null {
  return t.status === 'running' ? (TUTORIAL_BEATS[t.index] ?? null) : null
}

function matches(want: Signal, got: Signal): boolean {
  if (want.type !== got.type) return false
  if (want.type === 'played' && got.type === 'played') return want.cardId === got.cardId
  if (want.type === 'attacked' && got.type === 'attacked') return want.target === got.target
  return true
}

export function advance(t: TutorialState, signal: Signal): TutorialState {
  const b = currentBeat(t)
  if (!b || !matches(b.until, signal)) return t
  const index = t.index + 1
  return index >= TUTORIAL_BEATS.length ? { index, status: 'done' } : { index, status: 'running' }
}

export function skipTutorial(t: TutorialState): TutorialState {
  return t.status === 'running' ? { ...t, status: 'skipped' } : t
}

function handCardId(action: Action, game: GameState): string | undefined {
  if (action.type !== 'playCard') return undefined
  const hand = game.players.p1.hand
  const inst =
    action.cardInstanceId !== undefined ? hand.find((c) => c.instanceId === action.cardInstanceId) : hand[action.handIndex ?? -1]
  return inst?.cardId
}

const isEnemyMinion = (game: GameState, id: string | undefined) =>
  id !== undefined && game.players.p2.board.some((m) => m.instanceId === id)

// 教學進行中只允許目前步驟要求的動作
export function isAllowed(t: TutorialState, action: Action, game: GameState): boolean {
  if (!isRunning(t)) return true
  const allow = currentBeat(t)?.allow
  if (!allow) return false
  switch (allow.type) {
    case 'endTurn':
      return action.type === 'endTurn'
    case 'attack':
      if (action.type !== 'attack') return false
      return allow.target === 'hero' ? action.targetId === heroId('p2') : isEnemyMinion(game, action.targetId)
    case 'play':
      if (action.type !== 'playCard' || handCardId(action, game) !== allow.cardId) return false
      return allow.target === 'enemyMinion' ? isEnemyMinion(game, action.targetId) : true
  }
}

// 用套用前的盤面推出動作對應的訊號
export function signalOf(action: Action, game: GameState): Signal {
  if (action.type === 'endTurn') return { type: 'endTurn' }
  if (action.type === 'attack') return { type: 'attacked', target: action.targetId === heroId('p1') || action.targetId === heroId('p2') ? 'hero' : 'minion' }
  return { type: 'played', cardId: handCardId(action, game) ?? '' }
}

export interface TriggerInput {
  battleId: string | null
  skipTutorial: boolean
  tutorialDone: boolean
  // 舊存檔已通關第一場
  cleared: boolean
}

export function shouldStartTutorial(input: TriggerInput): boolean {
  return input.battleId === TUTORIAL_BATTLE_ID && !input.skipTutorial && !input.tutorialDone && !input.cleared
}

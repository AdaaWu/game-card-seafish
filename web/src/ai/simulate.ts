// headless 雙 AI 對戰，超過回合上限判平手
import { applyAction, createGame, createRng } from '@/engine'
import type { CardDb, Winner } from '@/engine'
import { chooseAction } from './ai'

export const MAX_TURNS = 60

export interface SimulateResult {
  winner: Winner
  turns: number
  // 撞到回合上限而判平手
  timeout: boolean
}

export function simulate(deckA: string[], deckB: string[], cardDb: CardDb, seed: number): SimulateResult {
  let state = createGame({ cardDb, decks: { p1: deckA, p2: deckB }, seed })
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0)
  while (state.winner === null) {
    if (state.turn > MAX_TURNS) return { winner: 'draw', turns: MAX_TURNS, timeout: true }
    state = applyAction(state, chooseAction(state, state.activePlayer, rng)).state
  }
  return { winner: state.winner, turns: state.turn, timeout: false }
}

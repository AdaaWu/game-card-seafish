import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initialStats } from '@/engine'
import { decks } from '@/content'
import { useBattleStore } from '@/stores/battle'
import { attack, setup } from './engine/helpers'

const deck = decks['ai-tide']!

describe('battle store 接統計', () => {
  let store: ReturnType<typeof useBattleStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useBattleStore()
  })

  it('act 成功後累加我方造成的傷害', () => {
    store.state = setup({ p1: { board: ['v33'] } })
    expect(store.act(attack('p1-m0', 'p2-hero')).ok).toBe(true)
    expect(store.stats.damageDealt).toBe(3)
  })

  it('AI 打我方英雄不計', () => {
    store.state = setup({ p2: { board: ['v33'] }, active: 'p2' })
    expect(store.act(attack('p2-m0', 'p1-hero')).ok).toBe(true)
    expect(store.stats.damageDealt).toBe(0)
  })

  it('不合法的 act 不改統計', () => {
    store.state = setup({ p1: { board: ['v33'] } })
    store.act(attack('p1-m0', 'p2-hero'))
    expect(store.act(attack('p1-m0', 'p2-hero')).ok).toBe(false)
    expect(store.stats.damageDealt).toBe(3)
  })

  it('start 重開時統計歸零', () => {
    store.state = setup({ p1: { board: ['v33'] } })
    store.act(attack('p1-m0', 'p2-hero'))
    store.start({ playerDeck: deck, enemyDeck: deck, seed: 5 })
    expect(store.stats.damageDealt).toBe(0)
  })

  it('reset 回到初始統計', () => {
    store.state = setup({ p1: { board: ['v33'] } })
    store.act(attack('p1-m0', 'p2-hero'))
    store.reset()
    expect(store.stats).toEqual(initialStats())
  })
})

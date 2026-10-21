import { describe, expect, it } from 'vitest'
import { FREE_OPPONENTS, PLAYER_PORTRAIT_ID, storyPortraitId } from '@/components/battle/opponents'
import { characterByName, story } from '@/content'

describe('對戰英雄頭像', () => {
  it('我方固定用小葉', () => {
    expect(PLAYER_PORTRAIT_ID).toBe('xiaoye')
  })

  it('劇情戰依對手名字找到角色 id', () => {
    expect(storyPortraitId('殼殼')).toBe('keke')
    expect(storyPortraitId('凍凍婆婆')).toBe('dongdong')
    expect(storyPortraitId('不存在的角色')).toBeUndefined()
  })

  it('自由對戰依牌組用陣營代表', () => {
    const byDeck = Object.fromEntries(FREE_OPPONENTS.map((o) => [o.deckId, o.portraitId]))
    expect(byDeck).toEqual({ 'ai-tide': 'bobo', 'ai-frost': 'dongdong', 'ai-light': 'shanshan', 'ai-boss': 'anbuzhang' })
  })

  it('自由對戰頭像與顯示名字是同一個角色', () => {
    for (const o of FREE_OPPONENTS) expect(o.portraitId, o.name).toBe(characterByName(o.name)?.id)
  })

  it('頭像 id 都是 story.json 裡的角色', () => {
    const ids = new Set(story.characters.map((c) => c.id))
    for (const o of FREE_OPPONENTS) expect(ids.has(o.portraitId), o.portraitId).toBe(true)
    expect(ids.has(PLAYER_PORTRAIT_ID)).toBe(true)
  })
})

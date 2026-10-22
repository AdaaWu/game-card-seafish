import { describe, expect, it } from 'vitest'
import { chapterTitleStyle, isBossBattle, nodePortraitId, nodeVisual, pathSlice } from '@/views/storyMap'

describe('劇情地圖節點外觀', () => {
  it('一般可挑戰節點用 available 切片、不顯示鎖頭', () => {
    expect(nodeVisual('available', false)).toEqual({
      ringPath: 'map/node-available',
      showLock: false,
      checkBadge: false,
      dimFace: false,
      statusText: '可挑戰',
    })
  })

  it('一般已通關節點用 cleared 切片，勾章已在切片內', () => {
    const v = nodeVisual('cleared', false)
    expect(v.ringPath).toBe('map/node-cleared')
    expect(v.checkBadge).toBe(false)
    expect(v.statusText).toBe('已通關')
  })

  it('一般未解鎖節點用 locked 切片、疊鎖頭、頭像變灰', () => {
    const v = nodeVisual('locked', false)
    expect(v.ringPath).toBe('map/node-locked')
    expect(v.showLock).toBe(true)
    expect(v.dimFace).toBe(true)
    expect(v.statusText).toBe('未解鎖')
  })

  it('Boss 節點不論狀態都用 boss 切片，狀態字加 Boss', () => {
    expect(nodeVisual('available', true).ringPath).toBe('map/node-boss')
    expect(nodeVisual('locked', true).ringPath).toBe('map/node-boss')
    expect(nodeVisual('locked', true).statusText).toBe('Boss・未解鎖')
    expect(nodeVisual('available', true).statusText).toBe('Boss・可挑戰')
  })

  it('Boss 未解鎖也疊鎖頭與灰階頭像', () => {
    const v = nodeVisual('locked', true)
    expect(v.showLock).toBe(true)
    expect(v.dimFace).toBe(true)
  })

  it('Boss 已通關另外疊勾章，保留通關記號', () => {
    expect(nodeVisual('cleared', true).checkBadge).toBe(true)
    expect(nodeVisual('available', true).checkBadge).toBe(false)
  })
})

describe('劇情地圖 Boss 判定', () => {
  it('每章最後一場是 Boss', () => {
    expect(isBossBattle(2, 3)).toBe(true)
    expect(isBossBattle(1, 3)).toBe(false)
    expect(isBossBattle(0, 3)).toBe(false)
  })

  it('只有一場的章節不算 Boss', () => {
    expect(isBossBattle(0, 1)).toBe(false)
  })
})

describe('劇情地圖珍珠路徑', () => {
  it('通往已解鎖節點的路徑用 open', () => {
    expect(pathSlice('available')).toBe('map/path-open')
    expect(pathSlice('cleared')).toBe('map/path-open')
  })

  it('通往未解鎖節點的路徑用 locked', () => {
    expect(pathSlice('locked')).toBe('map/path-locked')
  })
})

describe('劇情地圖節點頭像', () => {
  it('依對手名字找到立繪 id', () => {
    expect(nodePortraitId('殼殼')).toBe('keke')
    expect(nodePortraitId('鮟部長')).toBe('anbuzhang')
  })

  it('找不到角色時回傳 undefined', () => {
    expect(nodePortraitId('不存在的人')).toBeUndefined()
  })
})

describe('章節標題前綴', () => {
  it('潮用貝殼、霜與光用海星，配該陣營色', () => {
    expect(chapterTitleStyle('tide')).toEqual({ prefix: 'shell', faction: 'tide' })
    expect(chapterTitleStyle('frost')).toEqual({ prefix: 'star', faction: 'frost' })
    expect(chapterTitleStyle('light')).toEqual({ prefix: 'star', faction: 'light' })
  })

  it('葉用葉片，中立用貝殼', () => {
    expect(chapterTitleStyle('leaf')).toEqual({ prefix: 'leaf', faction: 'leaf' })
    expect(chapterTitleStyle('neutral')).toEqual({ prefix: 'shell', faction: 'neutral' })
  })
})

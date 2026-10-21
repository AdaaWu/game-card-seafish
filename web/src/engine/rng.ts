// 種子亂數 mulberry32：狀態放在 GameState，結果可重現

// 回傳 [0, 1) 的亂數與下一個狀態
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    const [value, next] = nextRandom(state)
    state = next
    return value
  }
}

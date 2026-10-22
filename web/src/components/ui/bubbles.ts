export interface BubbleSpec {
  left: number
  size: number
  duration: number
  delay: number
}

const DESKTOP_COUNT = 12
const PHONE_COUNT = 6

// 短邊 500 以下或寬 768 以下視為手機
export function bubbleCount(o: { width: number; height: number; reducedMotion: boolean }): number {
  if (o.reducedMotion) return 0
  const phone = Math.min(o.width, o.height) <= 500 || o.width <= 768
  return phone ? PHONE_COUNT : DESKTOP_COUNT
}

// 固定公式散佈，每次渲染位置一致；left 為 %，size 為 px，duration 與 delay 為秒
export function bubbleSpecs(count: number): BubbleSpec[] {
  return Array.from({ length: count }, (_, k) => {
    const i = k + 1
    return {
      left: (i * 37) % 100,
      size: 8 + ((i * 7) % 14),
      duration: Math.round((9 + i * 1.3) * 10) / 10,
      delay: -((i * 53) % 17),
    }
  })
}

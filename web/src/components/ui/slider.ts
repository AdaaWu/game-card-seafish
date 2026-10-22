// 滑桿數值、鍵盤與拖曳換算
export interface SliderRange {
  min: number
  max: number
  step: number
}

const PAGE_STEPS = 10

export function snapValue(v: number, o: SliderRange): number {
  const snapped = o.min + Math.round((v - o.min) / o.step) * o.step
  return Math.min(o.max, Math.max(o.min, snapped))
}

// 非滑桿按鍵回傳 null，交給瀏覽器預設行為
export function stepByKey(value: number, key: string, o: SliderRange): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return snapValue(value + o.step, o)
    case 'ArrowLeft':
    case 'ArrowDown':
      return snapValue(value - o.step, o)
    case 'PageUp':
      return snapValue(value + o.step * PAGE_STEPS, o)
    case 'PageDown':
      return snapValue(value - o.step * PAGE_STEPS, o)
    case 'Home':
      return o.min
    case 'End':
      return o.max
    default:
      return null
  }
}

export function ratioOf(v: number, o: SliderRange): number {
  return o.max === o.min ? 0 : (v - o.min) / (o.max - o.min)
}

export function valueFromRatio(r: number, o: SliderRange): number {
  return snapValue(o.min + r * (o.max - o.min), o)
}

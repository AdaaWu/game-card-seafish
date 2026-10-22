export type TitleLevel = 'page' | 'section'
export type TitleFaction = 'leaf' | 'tide' | 'frost' | 'light' | 'neutral' | 'common'
export type TitlePrefix = 'leaf' | 'shell' | 'star'
export type TitleDivider = 'pearl' | 'seagrass' | 'none'

export interface TitleParts {
  tag: 'h1' | 'h2'
  prefixPath: string
  underlayPath: string
  dividerPath: string | null
}

// 中立與通用共用 base 配色
const PREFIX_TONE: Record<TitleFaction, string> = {
  leaf: 'leaf',
  tide: 'tide',
  frost: 'frost',
  light: 'light',
  neutral: 'base',
  common: 'base',
}

const DIVIDER_FILE: Record<TitleDivider, string | null> = {
  pearl: 'divider-pearl',
  seagrass: 'divider-seaweed',
  none: null,
}

// 切片路徑相對 assets/ui，不含 @2x 與副檔名
export function pageTitleParts(o: {
  level: TitleLevel
  faction: TitleFaction
  prefix: TitlePrefix
  divider: TitleDivider
}): TitleParts {
  const divider = DIVIDER_FILE[o.divider]
  return {
    tag: o.level === 'page' ? 'h1' : 'h2',
    prefixPath: `titles/title-prefix-${o.prefix}-${PREFIX_TONE[o.faction]}`,
    underlayPath: o.level === 'page' ? 'titles/title-underlay-lg' : 'titles/title-underlay-sm',
    dividerPath: divider ? `titles/${divider}` : null,
  }
}

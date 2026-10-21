// 根目錄 assets/ 底下的卡圖、頭像、貼圖與影片 URL，key 為相對 assets/ 的路徑（如 cards/xxx.webp）
const modules = import.meta.glob<string>(
  ['@assets/cards/*.webp', '@assets/portraits/*.webp', '@assets/stickers/*.webp', '@assets/video/*.mp4'],
  { eager: true, query: '?url', import: 'default' },
)

const table: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.replace(/^.*\/assets\//, ''), url]),
)

// 舊的 png key 對到同名 webp
function resolveKey(key: string): string {
  return key in table ? key : key.replace(/\.png$/, '.webp')
}

export const assetUrls: Record<string, string> = new Proxy(table, {
  get: (t, key) => (typeof key === 'string' ? t[resolveKey(key)] : undefined),
  has: (t, key) => (typeof key === 'string' ? resolveKey(key) in t : false),
})

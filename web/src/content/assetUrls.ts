// 根目錄 assets/ 底下所有圖片與影片的 URL，key 為相對 assets/ 的路徑（如 cards/xxx.png）
const modules = import.meta.glob<string>('@assets/**/*.{png,jpg,jpeg,webp,svg,mp4}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const assetUrls: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.replace(/^.*\/assets\//, ''), url]),
)

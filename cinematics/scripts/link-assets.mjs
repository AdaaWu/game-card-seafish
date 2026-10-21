// 在 public/ 建立指向根目錄 assets/ 的 symlink
import { existsSync, lstatSync, mkdirSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const publicDir = join(root, 'public')
mkdirSync(publicDir, { recursive: true })

for (const name of ['portraits', 'cards']) {
  const link = join(publicDir, name)
  if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) continue
  symlinkSync(join('..', '..', 'assets', name), link, 'dir')
  console.log(`linked public/${name} -> ../../assets/${name}`)
}

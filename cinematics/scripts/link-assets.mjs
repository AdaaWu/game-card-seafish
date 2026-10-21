// 在 public/ 建立指向根目錄 assets/_source/ PNG 母檔的 symlink
import { existsSync, lstatSync, mkdirSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const publicDir = join(root, 'public')
mkdirSync(publicDir, { recursive: true })

for (const name of ['portraits', 'cards']) {
  const link = join(publicDir, name)
  if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) continue
  symlinkSync(join('..', '..', 'assets', '_source', name), link, 'dir')
  console.log(`linked public/${name} -> ../../assets/_source/${name}`)
}

// Markdown 往復の見た目確認用。入れ子のリストと表を白紙の教科書に書き込み、描画されたブロックを撮る。
// 先に `npm run build && npm run preview -- --port 4173` を起動しておく。
// 使い方: node scripts/md_shots.mjs <出力フォルダ>（既定: docs/images）
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'docs/images'
mkdirSync(out, { recursive: true })
const base = 'http://localhost:4173/jibun_textbook/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' })
const page = await ctx.newPage()

await page.goto(base)
await page.getByRole('button', { name: '白紙から作る' }).click()
await page.getByRole('button', { name: '自分で書き始める' }).click()

const cases = [
  ['md_nested_list', '- 親\n  - 子\n    - 孫\n- 親2\n\n1. 一\n   - 一の子\n   - 一の子2\n2. 二'],
  ['md_table', '| BPM | 30fps | 60fps |\n|:--|:-:|--:|\n| 120 | 15 | 30 |\n| 90 | 20 | 40 |'],
]
for (const [name, md] of cases) {
  await page.locator('#note').fill(md)
  await page.getByRole('button', { name: '書き込む' }).click()
  const block = page.locator('.doc [data-by="me"]').last()
  await block.waitFor()
  // 一度フォーカスして外し、確定（往復）後の描画を撮る
  await block.locator('.blk-body').click()
  await page.locator('h1').click()
  await block.screenshot({ path: `${out}/${name}.png` })
  console.log('saved', `${out}/${name}.png`)
}
await browser.close()

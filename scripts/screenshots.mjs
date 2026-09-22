// 目視確認用の画面キャプチャ。先に `npm run build && npm run preview -- --port 4173` を起動しておく。
// 使い方: node scripts/screenshots.mjs <出力フォルダ>
import { chromium, devices } from '@playwright/test'

const out = process.argv[2] ?? 'test-results/shots'
const base = 'http://localhost:4173/jibun_textbook/'
const browser = await chromium.launch()

for (const [name, opts] of [['pc', { viewport: { width: 1280, height: 900 } }], ['phone', devices['Pixel 7']]]) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const shot = (n) => page.screenshot({ path: `${out}/${name}_${n}.png`, fullPage: true })
  await page.goto(base)
  await page.getByRole('button', { name: 'AIと新しく作る' }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('短い秒数に編集技術を詰め込んだ動画を作れるようになりたい')
  await page.locator('#can').fill('カット編集はできる')
  await page.getByRole('button', { name: '調べてコース設計を作る' }).click()
  await page.getByRole('button', { name: 'スキップ' }).click()
  await page.getByText('Step 2 コース設計案').waitFor()
  await shot('2_create')
  await page.getByRole('button', { name: 'この設計で始める' }).click()
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
  await page.locator('.doc [data-by="ai"]').first().waitFor()
  await page.locator('#note').fill('実際にやってみた。お手本を10本集めたら、共通点は「最初の1秒で動きがある」ことだった。')
  await page.getByRole('button', { name: '書き込む' }).click()
  await page.getByLabel('あとで再確認').check()
  await shot('4_lesson')
  await page.getByRole('button', { name: /次へ/ }).click()
  await page.locator('#note').fill('二つ目の節のメモ。')
  await page.getByRole('button', { name: '書き込む' }).click()
  await page.getByLabel('完了', { exact: true }).check()
  await page.getByRole('button', { name: 'ロードマップ', exact: true }).click()
  await page.getByRole('button', { name: '設計を直す' }).click()
  await page.locator('#redotext').fill('実践を先に')
  await page.getByRole('button', { name: '変更案を出してもらう' }).click()
  await page.locator('.diff li').first().waitFor()
  await shot('3_roadmap')
  await page.getByRole('tab', { name: /教科書/ }).click()
  await shot('5_book')
  await page.getByRole('tab', { name: /本棚/ }).click()
  await shot('1_shelf')
  await ctx.close()
}
await browser.close()
console.log('done', out)

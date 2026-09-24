import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #63: 資料をひとつ渡して節の資料を生成する（ファイル1つ／貼り付け・「この資料だけから作る」）
const md = (name: string, body: string) => ({ name, mimeType: 'text/markdown', buffer: Buffer.from(body) })

test('レッスン: ファイルを渡して「この資料だけから作る」で生成すると、本文に反映され、元にした資料が残る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  await page.getByRole('button', { name: L.material }).click()
  // デモ応答は資料の先頭 40 字を本文に写す。それより後ろの文で「JSON に本文が入らない」ことを確かめる
  await page
    .locator('#materialfile')
    .setInputFiles(md('notes.md', '# 自分のメモ\nRust の所有権について。ここまでは見本の本文に写る。\nこの行は教科書のJSONには入らない'))
  await expect(page.getByLabel('渡す資料')).toContainText('notes.md')
  await page.locator('#sourceonly').check()
  await page.getByRole('button', { name: L.generate }).click()
  await expect(page.locator('.doc [data-by="ai"]').first()).toContainText('渡された資料: notes.md')
  await expect(page.getByText('元にした資料: notes.md')).toBeVisible()
  // JSON には資料の本文は入らない（名前だけ）
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('tab', { name: /本棚/ })
      .click()
      .then(() => page.getByRole('button', { name: 'JSON書出' }).first().click()),
  ])
  const json = (await import('node:fs')).readFileSync((await dl.path()) as string, 'utf8')
  expect(json).toContain('notes.md')
  expect(json).not.toContain('JSONには入らない')
})

test('ロードマップ: 文字を貼り付けて生成できる', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.material }).click()
  await page.locator('#materialtext').fill('YouTube の字幕をここに貼る')
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]').first()).toContainText('渡された資料: 貼り付けた文')
  await expect(page.getByText('元にした資料: 貼り付けた文')).toBeVisible()
})

test('渡せない種類や大きすぎるファイルは理由つきで断る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.material }).click()
  await page.locator('#materialfile').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([1, 2, 3]) })
  await expect(page.getByRole('alert')).toContainText('渡せない種類')
  await page.locator('#materialfile').setInputFiles({ name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(200 * 1024 + 1, 0x61) })
  await expect(page.getByRole('alert')).toContainText('200KB')
  // 何も渡していないので「この資料だけから作る」は選べない
  await expect(page.locator('#sourceonly')).toBeDisabled()
  // 貼り付けも上限を超えると理由が出て、生成は始まらない
  await page.locator('#materialtext').fill('a'.repeat(200 * 1024 + 1))
  await expect(page.getByRole('alert').filter({ hasText: '貼り付けた文' })).toContainText('大きすぎて')
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.toast')).toContainText('貼り付けた文は大きすぎて')
  await expect(page.getByRole('button', { name: L.generating })).toHaveCount(0)
})

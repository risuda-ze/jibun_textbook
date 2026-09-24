import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { busyButton, demoBook, nav } from './helpers'

// #63: 資料をひとつ渡して節の資料を生成する（ファイル1つ／貼り付け・「この資料だけから作る」）
// #69: 複数のファイルと貼り付けをまとめて渡す。合計の上限（20MB）を超えると理由つきで断る
const md = (name: string, body: string) => ({ name, mimeType: 'text/markdown', buffer: Buffer.from(body) })
const pdf = (name: string, size: number) => ({ name, mimeType: 'application/pdf', buffer: Buffer.alloc(size, 0x25) })
const MB = 1024 * 1024

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
    nav(page, /本棚/)
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
  await expect(busyButton(page)).toHaveCount(0)
})

test('レッスン: ファイルを2つと貼り付けを渡して生成すると、全部の名前が本文と元にした資料に出る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  await page.getByRole('button', { name: L.material }).click()
  await page.locator('#materialfile').setInputFiles([md('notes.md', '# 自分のメモ\n所有権'), md('slides.md', '# 講義の資料\n借用')])
  const list = page.getByRole('list', { name: '選んだファイル' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list).toContainText('notes.md')
  await expect(list).toContainText('slides.md')
  await page.locator('#materialtext').fill('YouTube の字幕')
  await expect(page.getByLabel('渡す資料')).toContainText('資料の合計')
  // 外して足し直せる
  await page.getByRole('button', { name: 'slides.md を外す' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await page.locator('#materialfile').setInputFiles([md('slides.md', '# 講義の資料\n借用')])
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await page.locator('#sourceonly').check()
  await page.getByRole('button', { name: L.generate }).click()
  const body = page.locator('.doc [data-by="ai"]').first()
  await expect(body).toContainText('渡された資料: notes.md')
  await expect(body).toContainText('slides.md')
  await expect(body).toContainText('貼り付けた文')
  await expect(body).toContainText('この資料だけから作る')
  await expect(page.getByText('元にした資料: notes.md、slides.md、貼り付けた文')).toBeVisible()
})

test('合計が上限を超えるファイルは足せず、貼り付けで超えたら生成の前に断る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.material }).click()
  // 10MB の PDF は2つまで（合計 20MB ちょうど）。3つ目は足せない
  await page.locator('#materialfile').setInputFiles([pdf('a.pdf', 10 * MB), pdf('b.pdf', 10 * MB), pdf('c.pdf', 1)])
  const list = page.getByRole('list', { name: '選んだファイル' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(page.getByRole('alert')).toContainText('「c.pdf」を足すと合計が大きすぎて渡せません')
  await expect(page.getByLabel('渡す資料')).toContainText('資料の合計 20.0 MB')
  // 貼り付けを足すと合計が超える。生成は始まらない
  await page.locator('#materialtext').fill('a')
  await expect(page.getByRole('alert').filter({ hasText: '資料の合計が大きすぎて' })).toBeVisible()
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.toast')).toContainText('資料の合計が大きすぎて渡せません')
  await expect(busyButton(page)).toHaveCount(0)
})

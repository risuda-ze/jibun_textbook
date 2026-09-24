import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { busyButton, demoBook } from './helpers'

// #69: 複数のファイルと貼り付けをまとめて渡す。合計の上限（20MB）を超えると理由つきで断る
const md = (name: string, body: string) => ({ name, mimeType: 'text/markdown', buffer: Buffer.from(body) })
const pdf = (name: string, size: number) => ({ name, mimeType: 'application/pdf', buffer: Buffer.alloc(size, 0x25) })
const MB = 1024 * 1024

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

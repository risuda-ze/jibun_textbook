import { expect, test } from '@playwright/test'
import { PNG, lessonWithDraft, nav, writeNote } from './helpers'

// 画像の説明（alt）（#13）: 入力欄で書く → レッスンと通読に <img alt> と figcaption が出る → 保存後にクリックで書き換える
test('画像の説明: 入力時に書け、保存後にも書き換えられ、通読にも出る', async ({ page }) => {
  await lessonWithDraft(page)

  await page.locator('#imgf').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.locator('.atts').getByPlaceholder('この画像の説明（任意）').fill('エラー画面')
  await writeNote(page, '説明つきの画像')

  const note = page.locator('.doc [data-by="me"]').filter({ hasText: '説明つきの画像' })
  await expect(note.locator('img[alt="エラー画面"]')).toHaveCount(1)
  await expect(note.locator('figcaption')).toHaveText('エラー画面')
  await expect(page.locator('#note')).toHaveValue('')

  // 通読でも同じ
  await nav(page, /教科書/).click()
  const book = page.locator('article.book')
  await expect(book.locator('img[alt="エラー画面"]')).toHaveCount(1)
  await expect(book.locator('figcaption')).toHaveText('エラー画面')
  await book.getByRole('button', { name: 'このページに書く' }).first().click()

  // 保存済みの画像をクリックして書き換える。Enter で確定
  await note.getByRole('button', { name: 'エラー画面' }).click()
  const alt = note.getByPlaceholder('この画像の説明（任意）')
  await expect(alt).toHaveValue('エラー画面')
  await alt.fill('直したあとの画面')
  await alt.press('Enter')
  await expect(alt).toHaveCount(0)
  await expect(note.locator('img[alt="直したあとの画面"]')).toHaveCount(1)
  await expect(note.locator('figcaption')).toHaveText('直したあとの画面')

  // 空にすると figcaption は出ず、alt は既定の文に戻る
  await note.getByRole('button', { name: '直したあとの画面' }).click()
  await note.getByPlaceholder('この画像の説明（任意）').fill('')
  await page.locator('h1').click()
  await expect(note.locator('figcaption')).toHaveCount(0)
  await expect(note.locator('img[alt="自分で入れた画像"]')).toHaveCount(1)
})

import { expect, test } from '@playwright/test'
import { L } from '../src/ui/labels'
import { PNG, lessonWithDraft, nav } from './helpers'

// 画像を本文の中に置く（#125）: 入力欄で「文中に置く」→ レッスンではチップ、通読では本文の途中に <img>（下には出ない）
// → 見たまま編集で前に文を足しても残る → 入力欄の × は本文の参照も消す
test('画像を文中に置く: 入力欄のカーソル位置に入り、通読で本文の途中に出て、編集しても残る', async ({ page }) => {
  await lessonWithDraft(page)
  await page.locator('#imgf').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  const note = page.locator('#note')
  await note.fill('前の文\n\n後の文')
  await note.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5))
  const put = page.locator('.atts').getByRole('button', { name: /を文中に置く$/ })
  await put.click()
  await expect(note).toHaveValue(/^前の文\n\n!\[\]\(img:[0-9a-f-]+\)後の文$/)
  // 1つの画像は1回だけ
  await expect(put).toBeDisabled()
  await page.getByRole('button', { name: L.write }).click()

  // レッスン（見たまま編集）ではチップ。参照した画像は下に出ない
  const row = page.locator('.doc [data-by="me"]').filter({ hasText: '前の文' })
  await expect(row.locator('.blk-body .imgref')).toHaveCount(1)
  await expect(row.locator('figure')).toHaveCount(0)

  // 通読では本文の2つ目の段落に <img>。下には出ない
  await nav(page, /教科書/).click()
  const book = page.locator('article.book')
  await expect(book.locator('.blk-body p:nth-of-type(2) img')).toHaveAttribute('src', /^data:image\//)
  await expect(book.locator('.blk-body img')).toHaveCount(1)
  await expect(book.locator('figure img')).toHaveCount(0)
  await book.getByRole('button', { name: 'このページに書く' }).first().click()

  // 見たまま編集でチップの前に文を足して確定しても画像は残る
  await row.locator('.blk-body').click()
  await page.keyboard.press('Control+Home')
  await page.keyboard.type('追記した。')
  await page.locator('h1').click()
  await expect(row.locator('.blk-body')).toContainText('追記した。')
  await expect(row.locator('.blk-body .imgref')).toHaveCount(1)
  await expect(row.locator('figure')).toHaveCount(0)

  // 入力欄で × を押すと本文の参照も消える
  await page.locator('#imgf').setInputFiles({ name: 'shot2.png', mimeType: 'image/png', buffer: PNG })
  await page
    .locator('.atts')
    .getByRole('button', { name: /を文中に置く$/ })
    .click()
  await expect(note).toHaveValue(/img:/)
  await page.locator('.atts').getByRole('button', { name: 'この画像を外す' }).click()
  await expect(page.locator('.atts img')).toHaveCount(0)
  await expect(note).toHaveValue('')
})

test('保存済みの画像を文中に置く: 編集していなければ末尾に、見たまま編集中ならカーソル位置に入る', async ({ page }) => {
  await lessonWithDraft(page)
  await page.locator('#imgf').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.locator('#imgf').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(2)
  await page.locator('#note').fill('本文だけ')
  await page.getByRole('button', { name: L.write }).click()
  const row = page.locator('.doc [data-by="me"]').filter({ hasText: '本文だけ' })
  await expect(row.locator('figure img')).toHaveCount(2)

  // 編集していない → 本文の末尾に付く（自分のノートなので「自分で修正」は出ない）
  await row
    .locator('figure')
    .first()
    .getByRole('button', { name: /を文中に置く$/ })
    .click()
  await expect(row.locator('.blk-body .imgref')).toHaveCount(1)
  await expect(row.locator('figure img')).toHaveCount(1)
  await expect(row.locator('.blk-body')).toContainText('本文だけ')

  // 見たまま編集中 → カーソル位置（先頭）にチップが入り、確定すると2つ目も下から消える
  await row.locator('.blk-body').click()
  await page.keyboard.press('Control+Home')
  await row
    .locator('figure')
    .first()
    .getByRole('button', { name: /を文中に置く$/ })
    .click()
  await expect(row.locator('.blk-body .imgref')).toHaveCount(2)
  await page.locator('h1').click()
  await expect(row.locator('figure')).toHaveCount(0)
  await expect(row.locator('.blk-body p').first().locator('.imgref')).toHaveCount(1)

  // 通読では2枚とも本文の中
  await nav(page, /教科書/).click()
  const body = page.locator('article.book [data-by="me"] .blk-body')
  await expect(body.locator('img')).toHaveCount(2)
  await expect(page.locator('article.book figure')).toHaveCount(0)
})

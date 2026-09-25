import { expect, test } from '@playwright/test'
import { lessonWithDraft } from './helpers'

// 見たまま編集中に文字で打った記法は Markdown として扱う（#76 #145 → #147）。リンク・太字・コード・見出しで確かめる
test('見たまま編集: [文](https://…) と打って確定するとリンクになる', async ({ page }) => {
  await lessonWithDraft(page)

  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' [ツール](https://example.com/palette) を使う。')
  await page.locator('h1').click()

  const link = first.locator('.blk-body a[href="https://example.com/palette"]')
  await expect(link).toHaveText('ツール')
  await expect(first.locator('.blk-body')).not.toContainText('[ツール]')
})

test('見たまま編集: 段落の先頭に # を打つと見出しになる（入力欄と同じ規則）', async ({ page }) => {
  await lessonWithDraft(page)

  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('# 自分の見出し')
  await page.locator('h1').click()

  await expect(first.locator('.blk-body h1', { hasText: '自分の見出し' })).toHaveCount(1)
})

// 文字で打った **強調** と `コード` も確定後に整形される（#145）
test('見たまま編集: **強調** と `コード` を打って確定すると整形される', async ({ page }) => {
  await lessonWithDraft(page)

  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' **パンク・膨張**：`Alt` で動かす。')
  await page.locator('h1').click()

  await expect(first.locator('.blk-body strong', { hasText: 'パンク・膨張' })).toHaveCount(1)
  await expect(first.locator('.blk-body code', { hasText: 'Alt' })).toHaveCount(1)
  await expect(first.locator('.blk-body')).not.toContainText('**')
})

// Enter は行、空行は段落（入力欄と同じ規則 #148）。1行ずつ Enter で打った表が確定後に表になり、Enter 2回で段落が分かれる
test('見たまま編集: Enter で1行ずつ打った表が確定後に表になる', async ({ page }) => {
  await lessonWithDraft(page)

  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('|a|b|')
  await page.keyboard.press('Enter')
  await page.keyboard.type('|-|-|')
  await page.keyboard.press('Enter')
  await page.keyboard.type('|1|2|')
  await page.locator('h1').click()

  await expect(first.locator('.blk-body table')).toHaveCount(1)
  await expect(first.locator('.blk-body th', { hasText: 'a' })).toHaveCount(1)
})

test('見たまま編集: Enter を2回打つと段落が分かれる', async ({ page }) => {
  await lessonWithDraft(page)

  const first = page.locator('.doc [data-by="ai"]').first()
  const before = await first.locator('.blk-body p').count()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('新しい段落')
  await page.locator('h1').click()

  await expect(first.locator('.blk-body p')).toHaveCount(before + 1)
  await expect(first.locator('.blk-body p', { hasText: '新しい段落' })).toHaveCount(1)
})

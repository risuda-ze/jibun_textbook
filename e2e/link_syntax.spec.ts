import { expect, test } from '@playwright/test'
import { L } from '../src/ui/labels'
import { demoBook } from './helpers'

// 見たまま編集中に文字で打ったリンクの記法 [文](URL) が、確定後にリンクになる（#76）
test('見たまま編集: [文](https://…) と打って確定するとリンクになる', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)

  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' [ツール](https://example.com/palette) を使う。')
  await page.locator('h1').click()

  const link = first.locator('.blk-body a[href="https://example.com/palette"]')
  await expect(link).toHaveText('ツール')
  await expect(first.locator('.blk-body')).not.toContainText('[ツール]')
})

test('見たまま編集: URL でないものはリンクにしない', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)

  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' [メモ](後で)')
  await page.locator('h1').click()

  await expect(first.locator('.blk-body')).toContainText('[メモ](後で)')
  await expect(first.locator('.blk-body a')).toHaveCount(0)
})

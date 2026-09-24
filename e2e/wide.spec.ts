import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { blankBook, isPhone } from './helpers'

test('レッスンの表示領域を広げる／戻す。設定は端末に残る（#53）', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  const btn = page.getByRole('button', { name: '広げる' })
  if (isPhone(page)) {
    await expect(btn).toBeHidden()
    return
  }
  const app = page.locator('.app')
  const before = (await app.boundingBox())!.width
  await btn.click()
  await expect(app).toHaveClass(/wide/)
  await expect(page.getByRole('button', { name: '幅を戻す' })).toHaveAttribute('aria-pressed', 'true')
  expect((await app.boundingBox())!.width).toBeGreaterThan(before)

  // 通読にも効き、再読み込み後も残る
  await page.getByRole('tab', { name: /教科書/ }).click()
  await expect(app).toHaveClass(/wide/)
  await page.reload()
  await page.getByRole('button', { name: '開く' }).click()
  await page.getByRole('button', { name: L.startWriting }).click()
  await expect(app).toHaveClass(/wide/)

  // 戻す。本棚では元から効かない
  await page.getByRole('button', { name: '幅を戻す' }).click()
  await expect(app).not.toHaveClass(/wide/)
  await page.getByRole('tab', { name: /本棚/ }).click()
  await expect(app).not.toHaveClass(/wide/)
})

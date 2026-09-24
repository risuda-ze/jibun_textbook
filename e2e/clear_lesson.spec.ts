import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #104: 「資料を消す」で節の資料をまっさらにし、元に戻せる。消したあとは「資料を生成」でまた生成できる
test('資料を消す → 元に戻す → ロードマップからも消して生成し直す', async ({ page }) => {
  await demoBook(page)
  // 資料が無い節にはボタンが出ない
  await expect(page.getByRole('button', { name: L.clearLesson })).toHaveCount(0)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)

  page.on('dialog', (d) => d.accept())
  // レッスン画面の右レールで消す
  await page.getByRole('button', { name: L.clearLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(0)
  await expect(page.getByText('この節はまだ資料がありません')).toBeVisible()
  await expect(page.getByRole('button', { name: L.generate })).toBeVisible()
  await expect(page.getByRole('button', { name: L.clearLesson })).toHaveCount(0)

  // 元に戻す
  await expect(page.getByText('資料を消しました')).toBeVisible()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(page.getByRole('button', { name: L.generate })).toHaveCount(0)

  // ロードマップの「選択中の節」からも消せて、そのまま生成し直せる
  await page.getByRole('main').getByRole('button', { name: L.roadmap, exact: true }).click()
  await page.getByRole('button', { name: L.clearLesson }).click()
  await expect(page.getByRole('button', { name: L.generateLesson })).toBeVisible()
  await expect(page.getByRole('button', { name: L.clearLesson })).toHaveCount(0)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(page.getByRole('button', { name: L.clearLesson })).toBeVisible()
})

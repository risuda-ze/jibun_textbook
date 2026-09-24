import { expect, test } from '@playwright/test'
import { L } from '../src/ui/labels'
import { demoBook } from './helpers'

// #87: 生成の途中で別の画面を見に行っても止まらない。止まるのは「やめる」だけ
test('ロードマップで生成を始めて教科書タブへ移り、戻ってきても生成は続いていて、終わると本文が入る', async ({ page }) => {
  await demoBook(page, { demoDelay: 1500 })
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.getByRole('button', { name: L.stop })).toBeVisible()
  // 別の画面へ
  await page.getByRole('tab', { name: /教科書/ }).click()
  await expect(page.getByRole('tab', { name: /教科書/ })).toHaveAttribute('aria-selected', 'true')
  // 戻ると、まだ進行中
  await page.getByRole('tab', { name: /ロードマップ/ }).click()
  await expect(page.getByRole('button', { name: L.generating })).toBeVisible()
  await expect(page.getByRole('button', { name: L.stop })).toBeVisible()
  // 終わると本文が入る（画面を離れていたので自動でレッスンには移らない。自分で開く）
  await expect(page.getByRole('button', { name: L.generating })).toHaveCount(0, { timeout: 15_000 })
  await page.getByRole('button', { name: 'レッスンを開く' }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
})

test('別の節を選び直しても生成は続く', async ({ page }) => {
  await demoBook(page, { demoDelay: 1500 })
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.getByRole('button', { name: L.stop })).toBeVisible()
  // 章構成の一覧から別の節を選ぶ（進行中でない節では生成ボタンは押せない）
  await page.locator('.lessonlist button').locator('visible=true').nth(1).click()
  await expect(page.getByRole('button', { name: L.generateLesson })).toBeDisabled()
  // 元の節に戻ると進行中の表示が続いている
  await page.locator('.lessonlist button').locator('visible=true').nth(0).click()
  await expect(page.getByRole('button', { name: L.generating })).toBeVisible()
  await expect(page.getByRole('button', { name: L.generating })).toHaveCount(0, { timeout: 15_000 })
})

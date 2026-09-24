import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { busyButton, demoBook } from './helpers'

// #77: 進行中は「{現状}・{N秒}」がボタンの中に出て、幅は押す前と変わらない。「やめる」は脇に残る
test('資料を生成: 進行中のボタンは幅が変わらず、文は中に、「やめる」は脇に出る', async ({ page }) => {
  await demoBook(page, { demoDelay: 3000 })
  const before = page.getByRole('button', { name: L.generateLesson })
  const w0 = (await before.boundingBox())?.width ?? 0
  expect(w0).toBeGreaterThan(0)
  await before.click()
  const busy = busyButton(page)
  await expect(busy).toHaveClass(/gauge/)
  await expect(busy.getByRole('status')).toHaveText(/^デモ応答中…・\d+秒$/)
  // ボタンの名前（読み上げ）にも中の文が入る
  await expect(page.getByRole('button', { name: /^デモ応答中…・\d+秒$/ })).toBeVisible()
  // 幅は押す前のまま（小数の丸めだけ許す）
  const w1 = (await busy.boundingBox())?.width ?? 0
  expect(Math.abs(w1 - w0)).toBeLessThan(1)
  // 「やめる」はボタンの中ではなく脇にある
  const stop = page.getByRole('button', { name: L.stop })
  await expect(stop).toBeVisible()
  await expect(busy.getByRole('button')).toHaveCount(0)
  // 段階が進んで文が変わっても幅は同じ
  await expect(busy.getByRole('status')).toHaveText(/^資料を作成中…・\d+秒$/, { timeout: 10_000 })
  const w2 = (await busy.boundingBox())?.width ?? 0
  expect(Math.abs(w2 - w0)).toBeLessThan(1)
  await stop.click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
  await expect(page.getByRole('button', { name: L.generateLesson })).toBeEnabled()
})

test('つくる: 設計の進行中も文はボタンの中に出て幅が変わらない', async ({ page }) => {
  await page.goto('./?demoDelay=3000')
  await page.getByRole('button', { name: L.newWithAi }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('幅の確認')
  const design = page.getByRole('button', { name: L.design })
  const w0 = (await design.boundingBox())?.width ?? 0
  await design.click()
  await page.getByRole('button', { name: 'スキップ' }).click()
  const busy = busyButton(page)
  await expect(busy.getByRole('status')).toHaveText(/^分解中…・\d+秒$/)
  const w1 = (await busy.boundingBox())?.width ?? 0
  expect(Math.abs(w1 - w0)).toBeLessThan(1)
  await expect(page.locator('.working')).toHaveCount(1)
  await expect(page.getByRole('button', { name: L.stop })).toBeVisible()
  await page.getByRole('button', { name: L.stop }).click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
})

import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #14: 生成の途中で「やめる」。教科書は変わらず、短い知らせが出る
test('ロードマップ・レッスン: 資料の生成を途中でやめると教科書は変わらない', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
  await page.getByRole('button', { name: 'やめる' }).click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
  await expect(page.getByRole('button', { name: 'この節の資料を生成' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'やめる' })).toHaveCount(0)
  // レッスンを開いても本文は入っていない
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(0)
  // レッスン画面でも同じ
  await page.getByRole('button', { name: '資料を生成' }).click()
  await page.getByRole('button', { name: 'やめる' }).click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '資料を生成' })).toBeEnabled()
})

test('つくる: 設計の途中でやめると設計は作られない', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'AIと新規作成' }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('やめるの確認')
  await page.getByRole('button', { name: '調べてコース設計を作る' }).click()
  await page.getByRole('button', { name: 'スキップ' }).click()
  await page.getByRole('button', { name: 'やめる' }).click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
  await expect(page.getByText('Step 2 コース設計案')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '調べてコース設計を作る' })).toBeEnabled()
})

test('設計を直す: 途中でやめると案は出ない', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: '設計を直す' }).click()
  const redo = page.getByLabel('設計を直す', { exact: true })
  await redo.getByRole('button', { name: '変更案を出してもらう' }).click()
  await redo.getByRole('button', { name: 'やめる' }).click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
  await expect(redo.getByRole('button', { name: '変更案を出してもらう' })).toBeEnabled()
  await expect(redo.getByRole('button', { name: '別の案を出す' })).toHaveCount(0)
})

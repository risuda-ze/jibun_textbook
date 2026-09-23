/**
 * e2e の共通処理。機能ごとの spec はここを import する。
 * spec を機能ごとに分けるのは、1つのファイルの末尾に足し続けると PR どうしが毎回競合するため。
 */
import { expect, type Page } from '@playwright/test'

// 1x1 の PNG
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 820

export async function blankBook(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: '白紙から作る' }).click()
  await expect(page.getByLabel('教科書の名前')).toHaveValue('新しい教科書')
}

export async function demoBook(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'AIと新規作成' }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('Rustで自分用の小さなツールを書けるようになりたい')
  await page.locator('#env').fill('Windows、VS Code')
  await page.getByRole('button', { name: '調べてコース設計を作る' }).click()
  await expect(page.getByText('AIからの確認')).toBeVisible()
  await page.getByRole('button', { name: 'スキップ' }).click()
  await expect(page.getByText('Step 2 コース設計案')).toBeVisible()
  await page.getByRole('button', { name: 'この設計で始める' }).click()
  await expect(page.getByLabel('教科書の名前')).toBeVisible()
}

export async function writeNote(page: Page, text: string) {
  await page.locator('#note').fill(text)
  await page.getByRole('button', { name: '書き込む' }).click()
  await expect(page.locator('.doc [data-by="me"]').filter({ hasText: text })).toBeVisible()
}

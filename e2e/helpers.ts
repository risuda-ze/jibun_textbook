/**
 * e2e の共通処理。機能ごとの spec はここを import する。
 * spec を機能ごとに分けるのは、1つのファイルの末尾に足し続けると PR どうしが毎回競合するため。
 */
import { expect, type Page } from '@playwright/test'
import { L } from '../src/ui/labels'

// 1x1 の PNG
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 820

/** 進行中のボタン（#77）。中の文は「{現状}・{N秒}」なので名前では探さず aria-busy で探す */
export const busyButton = (page: Page) => page.locator('button[aria-busy="true"]')

export async function blankBook(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: '白紙から作る' }).click()
  await expect(page.getByLabel('教科書の名前')).toHaveValue('新しい教科書')
}

/**
 * デモ応答で教科書を1冊作ってロードマップに立つ。
 * `demoDelay` はデモ応答の1段階の待ち時間（ms）。「やめる」を押す前に終わる競走を避けるときに長くする（#84）。
 * 教科書は通常の速さで作り、その後に待ち時間つきの URL で開き直す（作る段階まで遅くすると expect の上限を超えるため）
 */
export async function demoBook(page: Page, opts: { demoDelay?: number } = {}) {
  await page.goto('./')
  await page.getByRole('button', { name: L.newWithAi }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('Rustで自分用の小さなツールを書けるようになりたい')
  await page.locator('#env').fill('Windows、VS Code')
  await page.getByRole('button', { name: L.design }).click()
  await expect(page.getByText('AIからの確認')).toBeVisible()
  await page.getByRole('button', { name: 'スキップ' }).click()
  await expect(page.getByText('Step 2 コース設計案')).toBeVisible()
  await page.getByRole('button', { name: 'この設計で始める' }).click()
  await expect(page.getByLabel('教科書の名前')).toBeVisible()
  if (opts.demoDelay !== undefined) {
    await page.goto(`./?demoDelay=${opts.demoDelay}`)
    await page.getByRole('button', { name: '開く' }).click()
    await expect(page.getByLabel('教科書の名前')).toBeVisible()
  }
}

export async function writeNote(page: Page, text: string) {
  await page.locator('#note').fill(text)
  await page.getByRole('button', { name: L.write }).click()
  await expect(page.locator('.doc [data-by="me"]').filter({ hasText: text })).toBeVisible()
}

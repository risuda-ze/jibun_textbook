import { expect, test } from '@playwright/test'
import { blankBook, writeNote } from './helpers'

// #16: 書き出し忘れの知らせをレッスン画面にも出す。書き出すと消え、閉じるとその日は出ない
test('ノートを書くとレッスン画面に書き出しの知らせが出て、書き出すと消える', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  const notice = page.getByLabel('書き出しの知らせ')
  // 自分の書き込みが無いうちは出ない
  await expect(notice).toHaveCount(0)
  await writeNote(page, '自分で確かめたこと')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('まだ一度も書き出していません')
  // その場で書き出すと消える
  await Promise.all([page.waitForEvent('download'), notice.getByRole('button', { name: 'JSON書出' }).click()])
  await expect(notice).toHaveCount(0)
  // 本棚の知らせも出ていない
  await page.getByRole('tab', { name: /本棚/ }).click()
  await expect(page.getByText('まだ一度も書き出していません')).toHaveCount(0)
})

test('知らせを閉じると、その日は再読み込みしても出ない', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  await writeNote(page, '閉じる確認')
  const notice = page.getByLabel('書き出しの知らせ')
  await expect(notice).toBeVisible()
  await notice.getByRole('button', { name: '閉じる' }).click()
  await expect(notice).toHaveCount(0)
  // 端末内設定の保存（IndexedDB）を待ってから読み込み直す
  await page.waitForTimeout(500)
  await page.reload()
  await page.getByRole('tab', { name: /本棚/ }).click()
  await page.getByRole('button', { name: '開く' }).click()
  await page.getByRole('button', { name: /続きから 1-1/ }).click()
  await expect(page.locator('.doc [data-by="me"]')).toBeVisible()
  await expect(notice).toHaveCount(0)
  // 本棚の知らせはそのまま（閉じるのはレッスン画面だけ）
  await page.getByRole('tab', { name: /本棚/ }).click()
  await expect(page.getByText('まだ一度も書き出していません')).toBeVisible()
})

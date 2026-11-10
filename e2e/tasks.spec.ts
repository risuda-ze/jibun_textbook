import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { blankBook } from './helpers'

/** 「手を動かす」に1件追加する */
async function addTask(page: import('@playwright/test').Page, text: string) {
  await page.locator('#newtask').fill(text)
  await page.getByRole('button', { name: L.addTask, exact: true }).click()
  await expect(page.getByRole('checkbox', { name: text })).toBeVisible()
}

test('手を動かす: 追加 → 消す → 元に戻す。消してもチェックが隣にずれない（#143）', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  await addTask(page, '環境を入れる')
  await addTask(page, '最初の一歩を書く')
  await page.getByRole('checkbox', { name: '環境を入れる' }).check()

  // 別の項目を消しても、残った項目のチェックはそのまま
  await page.getByRole('button', { name: '「最初の一歩を書く」を消す' }).click()
  await expect(page.getByRole('status')).toContainText('やることを消しました')
  await expect(page.getByRole('checkbox', { name: '最初の一歩を書く' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: '環境を入れる' })).toBeChecked()

  // 消した項目は元に戻せる
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByRole('checkbox', { name: '最初の一歩を書く' })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: '環境を入れる' })).toBeChecked()

  // 全部消すと空の案内に戻る
  await page.getByRole('button', { name: '「環境を入れる」を消す' }).click()
  await page.getByRole('button', { name: '「最初の一歩を書く」を消す' }).click()
  await expect(page.getByText('まだありません。', { exact: true })).toBeVisible()
})

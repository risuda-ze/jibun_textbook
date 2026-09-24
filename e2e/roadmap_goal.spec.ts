import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { demoBook, nav } from './helpers'

test('コースと節の狙いをロードマップで書き換えられ、保存され、資料の生成に入る（#103）', async ({ page }) => {
  await demoBook(page)
  const goal = page.getByLabel('教科書の狙い')
  await expect(goal).toHaveValue('Rustで自分用の小さなツールを書けるようになりたい')
  await goal.fill('自分の道具を自分で直せるようになる')
  const summary = page.getByLabel('節の狙い')
  await expect(summary).toHaveAttribute('placeholder', 'この節の狙い')
  await expect(page.locator('.detail').getByText('まだ資料がありません。')).toBeVisible()
  await summary.fill('狙いを書き換えた節')
  await summary.blur()

  // 本棚にも出る（状態に入った）。再読み込みしても残る（IndexedDB に入った）
  await nav(page, /本棚/).click()
  await expect(page.getByText('自分の道具を自分で直せるようになる')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '開く' }).click()
  await expect(page.getByLabel('教科書の狙い')).toHaveValue('自分の道具を自分で直せるようになる')
  await expect(page.getByLabel('節の狙い')).toHaveValue('狙いを書き換えた節')

  // 書き換えた狙いが、その節の資料の生成に入る（デモ応答は狙いを本文の先頭に写す）
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]').first()).toContainText('狙いを書き換えた節')
})

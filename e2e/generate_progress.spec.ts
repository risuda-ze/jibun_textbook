import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { busyButton, demoBook } from './helpers'

// #55: 「資料を生成」も、押したボタンが進行中の表示（灰色→進んだ分だけ青）になり、終わると元に戻る
// #77: 今していることと経過秒数はボタンの中に「{現状}・{N秒}」で出て、脇には出ない
test('資料を生成の間はボタンが進行中の色になり、今していることと経過秒数がボタンの中に出る（ロードマップ・レッスン）', async ({ page }) => {
  await demoBook(page)

  // ロードマップ: 「この節の資料を生成」
  await page.getByRole('button', { name: L.generateLesson }).click()
  const making = busyButton(page)
  await expect(making).toHaveClass(/gauge/)
  await expect(making.getByRole('status')).toContainText(/中…・\d+秒$/)
  // 脇には出ない（進行中の文はボタンの中の1つだけ）
  await expect(page.locator('.working')).toHaveCount(1)
  // 終わるとレッスン画面に移り、本文が入る
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(busyButton(page)).toHaveCount(0)

  // レッスン: まだ資料が無い次の節で「資料を生成」
  await page.getByRole('button', { name: /次へ/ }).click()
  await expect(page.getByRole('button', { name: L.generate })).toBeVisible()
  await page.getByRole('button', { name: L.generate }).click()
  const making2 = busyButton(page)
  await expect(making2).toHaveClass(/gauge/)
  await expect(making2.getByRole('status')).toContainText(/中…・\d+秒$/)
  await expect(page.locator('.working')).toHaveCount(1)
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  // 資料が入ると生成のカードごと消える
  await expect(busyButton(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: L.generate })).toHaveCount(0)
})

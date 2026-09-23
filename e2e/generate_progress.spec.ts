import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #55: 「資料を生成」も、押したボタンが進行中の表示（灰色→進んだ分だけ青）になり、終わると元に戻る
test('資料を生成の間はボタンが進行中の色になり、今していることと経過秒数が出る（ロードマップ・レッスン）', async ({ page }) => {
  await demoBook(page)

  // ロードマップ: 「この節の資料を生成」
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
  const making = page.getByRole('button', { name: '生成中…' })
  await expect(making).toHaveClass(/gauge/)
  await expect(making).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.working')).toContainText(/秒/)
  // 終わるとレッスン画面に移り、本文が入る
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(page.getByRole('button', { name: '生成中…' })).toHaveCount(0)

  // レッスン: まだ資料が無い次の節で「資料を生成」
  await page.getByRole('button', { name: /次へ/ }).click()
  await expect(page.getByRole('button', { name: '資料を生成' })).toBeVisible()
  await page.getByRole('button', { name: '資料を生成' }).click()
  const making2 = page.getByRole('button', { name: '生成中…' })
  await expect(making2).toHaveClass(/gauge/)
  await expect(page.locator('.working')).toContainText(/秒/)
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  // 資料が入ると生成のカードごと消える
  await expect(page.getByRole('button', { name: '生成中…' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '資料を生成' })).toHaveCount(0)
})

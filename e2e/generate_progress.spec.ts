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
  // 終わるとレッスン画面に移り、本文と参考情報が入る（完了条件2）
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(busyButton(page)).toHaveCount(0)
  await expect(page.locator('.doc table')).toBeVisible()
  const clues = page.getByLabel('参考情報')
  await expect(clues.locator('a.qchip').first()).toHaveAttribute('href', /google\.com\/search\?q=/)
  await expect(clues.getByText('本文の例を自分の環境で再現する')).toBeVisible()
  await expect(page.locator('.rail').getByText('例を自分の環境で試す')).toBeVisible()

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

// #141: 生成中は「資料を渡す」が押せず、開いていた欄は閉じる。閉じた要約（件数・ファイル名）は生成中も見える
test('生成中は「資料を渡す」が非活性で開いていた欄は閉じ、要約は残る。終わるとまた押せる', async ({ page }) => {
  await demoBook(page, { demoDelay: 2000 })
  await page.getByRole('button', { name: L.material }).click()
  await page.locator('#materialfile').setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# メモ') })
  await expect(page.getByLabel('渡す資料')).toContainText('notes.md')
  await page.getByRole('button', { name: L.generateLesson }).click()
  const toggle = page.getByRole('button', { name: L.material })
  await expect(toggle).toBeDisabled()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveText(`${L.material}（1）`)
  await expect(page.getByLabel('渡す資料')).toHaveCount(0)
  await expect(page.locator('.matrow').getByText('notes.md')).toBeVisible()
  // 終わるとレッスンに移る。次の節（資料なし）ではまた押せる
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3, { timeout: 15_000 })
  await page.getByRole('button', { name: /次へ/ }).click()
  await expect(page.getByRole('button', { name: L.material })).toBeEnabled()
})

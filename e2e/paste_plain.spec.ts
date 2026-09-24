import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #88: 見たまま編集への貼り付けは文字だけ。HTML の装飾は入らず、カレットは貼った文の直後に来る
test('見たまま編集: HTML を貼り付けても文字だけが入る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  const body = page.locator('.doc [data-by="ai"]').first().locator('.blk-body')
  await body.click()
  await page.keyboard.press('End')
  await body.evaluate((el) => {
    const dt = new DataTransfer()
    dt.setData('text/html', '<b>太字</b><a href="https://example.com">リンク</a>')
    dt.setData('text/plain', '貼った文')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await page.keyboard.type('の続き')
  // 文字だけ入り、HTML 側の太字・リンクは入らない（見本の本文にもともとある <strong> は数えない）
  const check = async () => {
    await expect(body).toContainText('貼った文の続き')
    await expect(body.locator('a')).toHaveCount(0)
    await expect(body.getByText('太字')).toHaveCount(0)
    await expect(body.getByText('リンク')).toHaveCount(0)
  }
  await check()
  // 確定（blur）して md に往復しても同じ
  await page.locator('h1').click()
  await check()
})

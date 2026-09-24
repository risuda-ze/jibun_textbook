import { expect, test } from '@playwright/test'
import { demoBook, nav } from './helpers'

// 節を消したあとに消えた節を選んだままにしない（#88）。レッスンタブを押しても「節が選ばれていません」にならない
test('選んでいる節を消すと別の節が選ばれ、レッスンを開ける。元に戻すで選択も戻る', async ({ page }) => {
  await demoBook(page)
  const name = page.getByLabel('節の名前')
  const removed = await name.inputValue()
  await page.getByRole('button', { name: 'この節を消す' }).click()
  await expect(page.getByRole('status')).toContainText('節を消しました')
  await expect(name).not.toHaveValue(removed)
  await nav(page, /レッスン/).click()
  await expect(page.getByText('節が選ばれていません。')).toHaveCount(0)
  await nav(page, /ロードマップ/).click()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(name).toHaveValue(removed)
})

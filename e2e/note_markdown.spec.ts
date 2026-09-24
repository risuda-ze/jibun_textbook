import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { blankBook } from './helpers'

test('ノート入力欄の挿入ボタンで Markdown を入れ、書き込むと整形される（#52）', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  const note = page.locator('#note')
  const tools = page.getByRole('toolbar', { name: 'Markdown の挿入' })
  await expect(tools.getByText('Markdown が使えます')).toBeVisible()

  await note.fill('大事な点')
  await note.selectText()
  await tools.getByRole('button', { name: '太字' }).click()
  await expect(note).toHaveValue('**大事な点**')
  // 当てた範囲が選ばれている（続けて別の記法を当てられる）
  expect(await note.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('大事な点')

  await tools.getByRole('button', { name: '箇条書き' }).click()
  await expect(note).toHaveValue('- **大事な点**')

  await note.press('End')
  await note.type('\n')
  await tools.getByRole('button', { name: 'コード' }).click()
  await expect(note).toHaveValue('- **大事な点**\n`コード`')

  await page.getByRole('button', { name: L.write }).click()
  const block = page.locator('.doc [data-by="me"]').first()
  await expect(block.locator('ul li strong')).toHaveText('大事な点')
  await expect(block.locator('code')).toHaveText('コード')
})

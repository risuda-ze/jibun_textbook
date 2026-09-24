import { expect, test } from '@playwright/test'
import { L } from '../src/ui/labels'
import { PNG, demoBook, writeNote } from './helpers'

// 完了条件3（見たまま編集とノート）を機能ごとに分けた（#84）。1つが落ちても他の結果が見える
async function lessonWithDraft(page: Parameters<typeof demoBook>[0]) {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
}

test('見たまま編集: 直すと「自分で修正」になり、状態が「書き込みあり」に変わる', async ({ page }) => {
  await lessonWithDraft(page)
  const first = page.locator('.doc [data-by="ai"]').first()
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' 自分で書き足した。')
  await page.locator('h1').click()
  await expect(first.getByText('自分で修正')).toBeVisible()
  await expect(first.locator('.blk-body')).toContainText('自分で書き足した。')
  await expect(page.locator('.pagehead').getByText('書き込みあり')).toBeVisible()
})

test('ノート: 画像（ファイル選択）と出典つきで書き込める', async ({ page }) => {
  await lessonWithDraft(page)
  await page.locator('#imgf').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.locator('#src').fill('https://doc.rust-lang.org/book/')
  await writeNote(page, 'やってみたらエラーが出た')
  const note = page.locator('.doc [data-by="me"]').first()
  await expect(note.locator('img')).toHaveAttribute('src', /^data:image\/(webp|jpeg)/)
  await expect(note.getByRole('link', { name: 'https://doc.rust-lang.org/book/' })).toBeVisible()
})

test('ノート: 手描きの図を入れられる', async ({ page }) => {
  await lessonWithDraft(page)
  await page.getByRole('button', { name: '図を描く' }).click()
  const box = (await page.locator('#cv').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 5 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'この図を入れる' }).click()
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.getByRole('button', { name: L.write }).click()
  await expect(page.locator('.doc [data-by="me"] img')).toHaveCount(1)
})

test('ノート: 本文を選択して引用すると、そのブロックの直下に入る', async ({ page }) => {
  await lessonWithDraft(page)
  await page.evaluate(() => {
    const el = document.querySelectorAll('.doc [data-by="ai"] .blk-body')[1]
    const r = document.createRange()
    r.selectNodeContents(el)
    const s = getSelection()!
    s.removeAllRanges()
    s.addRange(r)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const qbtn = page.getByRole('button', { name: '引用してノートを書く' })
  await expect(qbtn).toBeVisible()
  await qbtn.dispatchEvent('pointerdown')
  await expect(page.locator('.addnote blockquote')).toContainText('まず小さく試す')
  await writeNote(page, '引用へのコメント')
  const quoted = page.locator('.doc [data-by="me"]').filter({ hasText: '引用へのコメント' })
  await expect(quoted.locator('blockquote')).toContainText('まず小さく試す')
  const order = await page
    .locator('.doc [data-block]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-by') + ':' + (e.textContent ?? '')))
  const at = order.findIndex((x) => x.includes('引用へのコメント'))
  expect(order[at - 1]).toContain('ai:')
  expect(order[at - 1]).toContain('要点')
})

test('ノート: 行の間に差し込み、消して元に戻せる', async ({ page }) => {
  await lessonWithDraft(page)
  await page.locator('.ins').first().click()
  await writeNote(page, '先頭に差し込んだノート')
  expect(await page.locator('.doc [data-block]').first().getAttribute('data-by')).toBe('me')
  const target = page.locator('.doc [data-by="me"]').filter({ hasText: '先頭に差し込んだノート' })
  await target.hover()
  await target.getByRole('button', { name: '消す' }).click()
  await expect(target).toHaveCount(0)
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(target).toHaveCount(1)
})

import { expect, test } from '@playwright/test'

// #65: 版の移行と不整合の修復。Help の「読み込めない場合、まずはこちら」で試せる。JSON 読込でも自動で直る
const DUP = {
  schemaVersion: 1, id: 'b-dup', title: '直す本', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  chapters: [{ id: 'c1', title: '第1章', lessons: [{ id: 'l1', title: '節1' }, { id: 'l1', title: '節2' }] }],
}
const file = (name: string, obj: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) })

test('Help で id が重複した JSON を選ぶと、直した所が見えて本棚に追加できる', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Help' }).click()
  await page.locator('#repairfile').setInputFiles(file('dup.textbook.json', DUP))
  const result = page.getByLabel('直した結果')
  await expect(result).toContainText('dup.textbook.json')
  await expect(result).toContainText('重複していた id を 1 件振り直しました')
  await result.getByRole('button', { name: '本棚に追加' }).click()
  await expect(page.getByRole('heading', { name: '直す本' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('直した所')
})

test('直せない JSON は理由と問い合わせへの導線が出る', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Help' }).click()
  await page.locator('#repairfile').setInputFiles(file('future.textbook.json', { ...DUP, schemaVersion: 99 }))
  const result = page.getByLabel('直した結果')
  await expect(result).toContainText('schemaVersion: 99')
  await expect(result.getByRole('link', { name: '問い合わせ' })).toBeVisible()
  await expect(result.getByRole('button', { name: '本棚に追加' })).toHaveCount(0)
})

test('本棚の JSON読込でも自動で直り、直した所がトーストに出る', async ({ page }) => {
  await page.goto('./')
  await page.locator('#importfile').setInputFiles(file('dup.textbook.json', DUP))
  await expect(page.getByRole('status')).toContainText('重複していた id を 1 件振り直しました')
  await expect(page.getByRole('heading', { name: '直す本' })).toBeVisible()
})

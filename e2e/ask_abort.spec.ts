import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'

// #88: 確認質問を考えている途中で「やめる」。質問は出ず、もう一度押せる
test('つくる: 確認質問の途中でやめると質問は出ない', async ({ page }) => {
  await page.goto('./?demoDelay=3000')
  await page.getByRole('button', { name: L.newWithAi }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('やめるの確認')
  await page.getByRole('button', { name: L.design }).click()
  await expect(page.getByRole('button', { name: L.stop })).toBeVisible()
  await page.getByRole('button', { name: L.stop }).click()
  await expect(page.locator('.toast')).toContainText('生成をやめました')
  await expect(page.getByText('AIからの確認')).toHaveCount(0)
  await expect(page.getByRole('button', { name: L.stop })).toHaveCount(0)
  await expect(page.getByRole('button', { name: L.design })).toBeEnabled()
})

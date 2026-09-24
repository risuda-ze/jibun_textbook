import { expect, test } from '@playwright/test'
import { demoBook, isPhone } from './helpers'

// #11: 節の上下・別の章へ・章の上下。番号は位置から作り直され、中身と選択は動かした節のまま。元に戻せる
test('節を下へ → 元に戻す → 別の章へ → 章を上へ', async ({ page }) => {
  await demoBook(page)
  const name = page.getByLabel('節の名前')
  const first = 'ゴールから逆算して地図を描く'
  await expect(name).toHaveValue(first)
  const list = isPhone(page) ? page.locator('.chlist') : page.locator('.tl')
  const rows = list.getByRole('button')
  const heads = isPhone(page) ? page.locator('.chlist h3') : page.locator('.tl-label')
  const eyebrow = page.locator('.detail .eyebrow').filter({ hasText: '選択中' })

  // 1-1 は上へ動かせない。下へ動かすと 1-2 になり、名前と選択は同じ節のまま
  await expect(page.getByRole('button', { name: '1-1 を上へ' })).toBeDisabled()
  const down = page.getByRole('button', { name: '1-1 を下へ' })
  if (isPhone(page)) expect((await down.boundingBox())?.height).toBeGreaterThanOrEqual(32)
  await down.click()
  await expect(page.getByRole('status')).toContainText('節を下へ動かしました')
  await expect(name).toHaveValue(first)
  await expect(eyebrow).toContainText('選択中 1-2')
  await expect(rows.nth(0)).toContainText('1-1')
  await expect(rows.nth(0)).toContainText('必要な道具と環境をそろえる')
  await expect(rows.nth(1)).toContainText(first)

  // 元に戻す
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(eyebrow).toContainText('選択中 1-1')
  await expect(rows.nth(0)).toContainText(first)

  // 別の章へ（第4章の末尾）
  await page.getByLabel('1-1 を別の章へ').selectOption({ label: '第4章 振り返って教科書に残す' })
  await expect(page.getByRole('status')).toContainText('節を第4章の末尾へ動かしました')
  await expect(name).toHaveValue(first)
  await expect(eyebrow).toContainText('選択中 4-3')
  await expect(rows.last()).toContainText(first)
  await expect(page.getByLabel('章の名前')).toHaveValue('振り返って教科書に残す')

  // 章を上へ。末尾の章は下へ動かせない。節の番号は章に追従する
  await expect(page.getByRole('button', { name: '第4章を下へ' })).toBeDisabled()
  await page.getByRole('button', { name: '第4章を上へ' }).click()
  await expect(page.getByRole('status')).toContainText('章を上へ動かしました')
  await expect(eyebrow).toContainText('選択中 3-3')
  await expect(page.getByLabel('章の名前')).toHaveValue('振り返って教科書に残す')
  await expect(heads.filter({ hasText: 'CH3' })).toContainText('振り返って教科書に残す')
  await expect(heads.filter({ hasText: 'CH4' })).toContainText('応用する')

  // 中身は残っている（レッスンを開ける）
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  await expect(page.getByText('3-3', { exact: false }).first()).toBeVisible()
})

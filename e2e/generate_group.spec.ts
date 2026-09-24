import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #90 #91: 「資料を渡す」→「資料を生成」が1つの枠（group）に左からこの順で並び、開く／消すは枠の外にある。ロードマップとレッスンで同じ形
const group = (page: import('@playwright/test').Page) => page.getByRole('group', { name: L.generateGroup })

test('ロードマップ・レッスン: 渡す → 生成 が1つの枠に並び、開く・消すは枠の外', async ({ page }) => {
  await demoBook(page)

  // ロードマップの「選択中の節」
  const g1 = group(page)
  await expect(g1.getByRole('button')).toHaveText([L.material, L.generateLesson])
  await expect(g1.getByRole('button', { name: L.startWriting })).toHaveCount(0)
  await expect(g1.getByRole('button', { name: 'この節を消す' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: L.startWriting })).toBeVisible()
  // 渡す欄は枠の中に開く
  await g1.getByRole('button', { name: L.material }).click()
  await expect(g1.getByLabel('渡す資料')).toBeVisible()

  // レッスン（資料が無い節）も同じ形
  await page.getByRole('button', { name: L.startWriting }).click()
  const g2 = group(page)
  await expect(g2.getByRole('button')).toHaveText([L.material, L.generate])
  await expect(page.getByText('使うAI:')).toBeVisible()
  await g2.getByRole('button', { name: L.material }).click()
  await expect(g2.getByLabel('渡す資料')).toBeVisible()
})

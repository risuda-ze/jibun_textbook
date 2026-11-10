import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { demoBook } from './helpers'

// #90 #91 #123: 未作成の節は3択の枠（group）。見出しは「まだ資料がありません…」、中に 渡す → 生成 と 自分で書き始める が左からこの順。
// 消すは枠の外（右上の ×）。ロードマップとレッスンで同じ形
const group = (page: import('@playwright/test').Page) => page.getByRole('group', { name: L.generateGroup })

test('ロードマップ・レッスン: 渡す → 生成 → 自分で書き始める が1つの枠に並び、消すは枠の外', async ({ page }) => {
  await demoBook(page)

  // ロードマップの「選択中の節」
  const g1 = group(page)
  await expect(g1.locator('.eyebrow')).toHaveText(L.generateGroup)
  await expect(g1.getByRole('button')).toHaveText([L.material, L.generateLesson, L.startWriting])
  await expect(g1.getByRole('button', { name: 'この節を消す' })).toHaveCount(0)
  // 枠の上に重複した案内文は無い（見出しの1つだけ）
  await expect(page.locator('.detail').getByText('まだ資料がありません')).toHaveCount(1)
  // 「この節を消す」は右上の ×。「足す」は見出し行（カードの上端）にあり、カードの下端に操作は無い
  await expect(page.getByRole('button', { name: 'この節を消す' })).toHaveText('×')
  const addCh = page.getByRole('button', { name: '＋章を足す' })
  const meter = page.getByText('教科書の育ち具合')
  expect((await addCh.boundingBox())!.y).toBeLessThan((await meter.boundingBox())!.y)
  // 渡す欄は枠の中に開く
  await g1.getByRole('button', { name: L.material }).click()
  await expect(g1.getByLabel('渡す資料')).toBeVisible()

  // レッスン（資料が無い節）も同じ形。「自分で書き始める」はノート欄へ
  await g1.getByRole('button', { name: L.startWriting }).click()
  const g2 = group(page)
  await expect(g2.locator('.eyebrow')).toHaveText(L.generateGroup)
  await expect(g2.getByRole('button')).toHaveText([L.material, L.generate, L.startWriting])
  await expect(page.getByText('使うAI:')).toBeVisible()
  await g2.getByRole('button', { name: L.startWriting }).click()
  await expect(page.locator('#note')).toBeFocused()
  await g2.getByRole('button', { name: L.material }).click()
  await expect(g2.getByLabel('渡す資料')).toBeVisible()

  // 資料がある節では枠が無く、「レッスンを開く」が主操作の行の右端
  await page.getByRole('button', { name: L.generate }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await page.getByRole('main').getByRole('button', { name: L.roadmap, exact: true }).click()
  await expect(group(page)).toHaveCount(0)
  const open = page.getByRole('button', { name: 'レッスンを開く' })
  const openBox = (await open.boundingBox())!
  const paneBox = (await page.locator('.detail .stack').boundingBox())!
  expect(openBox.x + openBox.width).toBeGreaterThan(paneBox.x + paneBox.width - 8)
})

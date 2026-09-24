import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'

// #64: Help 画面。本棚から行けて3章が見える。JSON 読込の失敗文の近くからも行ける
test('本棚から Help に行き、3章が見え、本棚に戻れる', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: L.help }).click()
  await expect(page.getByRole('heading', { name: '読み込めない場合、まずはこちら' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Q&A' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '問い合わせ' })).toBeVisible()
  // Q&A は5問以上
  expect(await page.getByLabel('Q&A').locator('dt').count()).toBeGreaterThanOrEqual(5)
  // 問い合わせは GitHub の新規 Issue ページへのリンク（不具合・要望）
  await expect(page.getByRole('link', { name: '不具合を知らせる' })).toHaveAttribute(
    'href',
    /github\.com\/risuda-ze\/jibun_textbook\/issues\/new\?.*labels=bug/,
  )
  await expect(page.getByRole('link', { name: '要望を送る' })).toHaveAttribute('href', /issues\/new\?.*labels=enhancement/)
  await page.getByRole('button', { name: '本棚へ戻る' }).click()
  await expect(page.getByRole('button', { name: L.newWithAi })).toBeVisible()
})

test('JSON 読込に失敗すると、失敗文の近くから「読み込めない場合、まずはこちら」へ行ける', async ({ page }) => {
  await page.goto('./')
  await page
    .locator('#importfile')
    .setInputFiles({ name: 'broken.textbook.json', mimeType: 'application/json', buffer: Buffer.from('{ これは JSON ではない') })
  await expect(page.getByRole('alert')).toContainText('JSONとして読み込めませんでした')
  await page.getByRole('button', { name: '読み込めない場合、まずはこちら' }).click()
  await expect(page.getByRole('heading', { name: '読み込めない場合、まずはこちら' })).toBeVisible()
  await expect(page.getByText('「JSONとして読み込めませんでした」と出る')).toBeVisible()
})

import { expect, test } from '@playwright/test'
import { blankBook } from './helpers'

test('大きすぎる JSON は読み込む前に断る（#17）', async ({ page }) => {
  await page.goto('./')
  const big = Buffer.alloc(16 * 1024 * 1024 + 1, 0x20)
  await page.locator('#importfile').setInputFiles({ name: 'big.json', mimeType: 'application/json', buffer: big })
  await expect(page.getByRole('alert')).toContainText('大きすぎて読み込めません')
})

test('一次情報リンクに題名を付けられる（#17）', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  const clues = page.getByLabel('参考情報')
  await clues.locator('#cluelink').fill('https://example.com/doc')
  await clues.locator('#cluetitle').fill('公式ドキュメント')
  await clues.getByRole('button', { name: 'リンクを足す' }).click()
  await expect(clues.getByRole('link', { name: '公式ドキュメント' })).toHaveAttribute('href', 'https://example.com/doc')
  // 題名を空にすると URL がそのまま題名になる
  await clues.locator('#cluelink').fill('https://example.com/2')
  await clues.getByRole('button', { name: 'リンクを足す' }).click()
  await expect(clues.getByRole('link', { name: 'https://example.com/2' })).toBeVisible()
})

test('最後の節を消すと章も消えたことを伝え、元に戻せる（#17）', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: 'この節を消す' }).click()
  await expect(page.getByRole('status')).toContainText('章も消しました')
  await expect(page.getByText('節がありません。')).toBeVisible()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByLabel('節の名前')).toHaveValue('最初の節')
})

test('読めない教科書は本棚で知らせ、生データを書き出すか消せる（#17）', async ({ page }) => {
  await page.goto('./')
  // idb-keyval の既定のストアに壊れたデータを直接入れる
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('keyval-store', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('keyval')
    req.onsuccess = () => {
      const tx = req.result.transaction('keyval', 'readwrite')
      tx.objectStore('keyval').put({ schemaVersion: 1, title: '壊れた' }, 'tb:broken-1')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  }))
  await page.reload()
  const card = page.getByLabel('読めない教科書')
  await expect(card).toContainText('読み込めない教科書が 1 冊あります')
  const [dl] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: '生データを書き出す' }).click()])
  expect(dl.suggestedFilename()).toBe('tb_broken-1.raw.json')
  page.on('dialog', (d) => d.accept())
  await card.getByRole('button', { name: '消去' }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('読めない教科書')).toHaveCount(0)
})

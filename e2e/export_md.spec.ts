import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import { PNG, lessonWithDraft, nav, writeNote } from './helpers'

// Markdown 書き出し（#136）: zip に <名前>.md と img/ が入り、ノートの画像は相対パスで本文に出る。手を動かすは出ない
test('Markdown を書き出すと zip に .md と img/ が入り、画像は相対パスで本文に出る', async ({ page }) => {
  await lessonWithDraft(page)
  await page.locator('#imgf').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await writeNote(page, '書き出すノート')

  await nav(page, /ロードマップ/).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Markdownを書き出す' }).click()])
  expect(dl.suggestedFilename()).toMatch(/\.zip$/)
  await expect(page.getByText(/Markdown を書き出しました（/)).toBeVisible()

  const files = unzipSync(new Uint8Array(readFileSync((await dl.path()) as string)))
  const names = Object.keys(files)
  const mdName = dl.suggestedFilename().replace(/\.zip$/, '.md')
  expect(names).toContain(mdName)
  const imgs = names.filter((n) => n.startsWith('img/'))
  expect(imgs).toHaveLength(1)
  expect(imgs[0]).toMatch(/^img\/[0-9a-f-]+\.(webp|png|jpg)$/)

  const md = strFromU8(files[mdName])
  expect(md).toMatch(/^---\ntitle: /)
  expect(md).toContain('書き出すノート')
  expect(md).toContain(`![](${imgs[0]})`)
  expect(md).not.toContain('- [ ]')
})

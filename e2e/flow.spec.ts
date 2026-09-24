import { L } from '../src/ui/labels'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { PNG, blankBook, busyButton, demoBook, isPhone, writeNote } from './helpers'

test('完了条件1: 自由入力 → 確認質問 → 設計案 → ロードマップに並ぶ', async ({ page }) => {
  await demoBook(page)
  const list = isPhone(page) ? page.locator('.chlist') : page.locator('.tl')
  await expect(list).toBeVisible()
  await expect(list.getByText('最小の一歩をやってみる')).toBeVisible()
  await expect(page.locator('.detail').getByText('未作成').locator('visible=true').first()).toBeVisible()
})

test('スマホ幅は章ごとの一覧、PC幅はタイムライン', async ({ page }) => {
  await demoBook(page)
  if (isPhone(page)) {
    await expect(page.locator('.chlist')).toBeVisible()
    await expect(page.locator('.tl')).toBeHidden()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  } else {
    await expect(page.locator('.tl')).toBeVisible()
    await expect(page.locator('.chlist')).toBeHidden()
    await expect(page.locator('.playhead')).toBeVisible()
  }
})

test('完了条件2: 資料を生成すると本文と参考情報が入る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(page.locator('.doc table')).toBeVisible()
  const clues = page.getByLabel('参考情報')
  await expect(clues.locator('a.qchip').first()).toHaveAttribute('href', /google\.com\/search\?q=/)
  await expect(clues.getByText('本文の例を自分の環境で再現する')).toBeVisible()
  await expect(page.locator('.rail').getByText('例を自分の環境で試す')).toBeVisible()
})

test('完了条件4: 完了と再確認の印がロードマップと本棚に出る', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  await writeNote(page, '最初のノート')
  await page.getByLabel('あとで再確認').check()
  await expect(page.locator('.pagehead .flag')).toBeVisible()
  await page.getByLabel('完了', { exact: true }).check()
  await expect(page.locator('.pagehead .chip.done')).toBeVisible()
  await page.getByRole('button', { name: L.roadmap, exact: true }).click()
  await expect(page.locator('.detail .chip.done').locator('visible=true').first()).toBeVisible()
  await expect(page.locator('.detail .flag').locator('visible=true').first()).toBeVisible()
  await page.getByRole('tab', { name: /本棚/ }).click()
  await expect(page.getByText('すべて完了')).toBeVisible()
  await expect(page.getByText('再確認 1件')).toBeVisible()
  await expect(page.getByText('完了 1 / 書き込みあり 0')).toBeVisible()
})

test('完了条件5: 設計を直す。差分を見て採用。守る対象は残る', async ({ page }) => {
  await demoBook(page)
  // 1-1 を完了に、1-2 にノートを書く
  await page.getByRole('button', { name: L.startWriting }).click()
  await writeNote(page, '守られるべきノート')
  await page.getByLabel('完了', { exact: true }).check()
  await page.getByRole('button', { name: /次へ 1-2/ }).click()
  await writeNote(page, '二つ目の節のノート')
  await page.getByRole('button', { name: L.roadmap, exact: true }).click()

  await page.getByRole('button', { name: '設計を直す' }).click()
  const redo = page.getByLabel('設計を直す', { exact: true })
  await redo.getByRole('button', { name: /この章だけ/ }).click()
  await redo.locator('#redotext').fill('実践を先に')
  await redo.getByRole('button', { name: L.propose }).click()
  await expect(redo.locator('.diff li').filter({ hasText: '残す' })).toHaveCount(2)
  await expect(redo.getByText('完了の節のため触りません')).toBeVisible()
  await expect(redo.getByText('自分の書き込みありのため触りません')).toBeVisible()
  await expect(redo.locator('.diff li').filter({ hasText: '変更' })).toHaveCount(1)
  await expect(redo.locator('.diff li').filter({ hasText: '追加' })).toHaveCount(1)

  // 採用するまで何も変わらない
  await expect(page.getByText('注文から追加した節')).toHaveCount(1) // 差分の行だけ
  await redo.getByRole('button', { name: 'この案を採用' }).click()
  const list = isPhone(page) ? page.locator('.chlist') : page.locator('.tl')
  await expect(list.getByText(/注文から追加した節/)).toBeVisible()
  await expect(list.getByText(/お手本を集めて観察する（実践を先に）/)).toBeVisible()
  await expect(list.getByText('ゴールから逆算して地図を描く', { exact: false }).first()).toBeVisible()

  // 守られたノートがそのまま残っている
  await page.getByRole('tab', { name: /教科書/ }).click()
  await expect(page.getByText('守られるべきノート')).toBeVisible()
  await expect(page.getByText('二つ目の節のノート')).toBeVisible()
})

test('完了条件6: 通読。絞り込みと書き手の印の切り替え', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await writeNote(page, '通読で見えるノート')
  await page.getByRole('tab', { name: /教科書/ }).click()
  const book = page.locator('article.book')
  await expect(book.getByText('通読で見えるノート')).toBeVisible()
  await expect(book.getByText('この節の狙い')).toBeVisible()
  await expect(book.locator('.gut').first()).toBeHidden()
  await page.getByLabel('書き手の印を出す').check()
  await expect(book.locator('.gut').first()).toBeVisible()
  await expect(book.locator('[contenteditable="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: '自分のノートだけ' }).click()
  await expect(book.getByText('通読で見えるノート')).toBeVisible()
  await expect(book.getByText('この節の狙い')).toHaveCount(0)
  await page.getByRole('button', { name: '再確認の節だけ' }).click()
  await expect(book.getByText('該当なし。')).toBeVisible()
  await page.getByRole('button', { name: 'すべて' }).click()
  await book.getByRole('button', { name: 'このページに書く' }).first().click()
  await expect(page.locator('#note')).toBeVisible()
})

test('完了条件7: JSONの書き出しと読み込み。キーは入らない。新旧の判定', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await blankBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  await writeNote(page, '端末をまたぐノート')

  // APIキーを設定してから書き出す
  await page.getByRole('tab', { name: /つくる/ }).click()
  await page.getByRole('button', { name: 'Anthropic API' }).click()
  await page.getByRole('button', { name: '入れる' }).click()
  await page.locator('#ai_key').fill('sk-ant-e2e-SECRET-KEY')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('APIキー 設定済み')).toBeVisible()

  await page.getByRole('tab', { name: /本棚/ }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON書出' }).click()])
  expect(dl.suggestedFilename()).toBe('新しい教科書.textbook.json')
  const json = readFileSync((await dl.path())!, 'utf8')
  expect(json).not.toContain('SECRET')
  expect(json).not.toContain('apiKey')
  expect(json).toContain('端末をまたぐノート')
  await expect(page.getByText(/書き出しました（/)).toBeVisible()
  const tb = JSON.parse(json)
  expect(tb.schemaVersion).toBe(1)

  // 消して、読み込み直す（別の端末で読む想定）
  await page.getByRole('button', { name: '消去', exact: true }).click()
  await expect(page.getByText('まだ教科書がありません。')).toBeVisible()
  const upload = (name: string, body: string) =>
    page.locator('#importfile').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) })
  await upload('a.json', json)
  await expect(page.getByRole('heading', { name: '新しい教科書' })).toBeVisible()

  // 新しいJSON → 自動で上書き
  const newer = { ...tb, title: 'スマホで続きを書いた', updatedAt: new Date(Date.now() + 60_000).toISOString() }
  await upload('b.json', JSON.stringify(newer))
  await expect(page.getByRole('heading', { name: 'スマホで続きを書いた' })).toBeVisible()
  await expect(page.getByText('新しい内容で上書きしました')).toBeVisible()

  // 古いJSON → 警告して選ばせる
  await upload('c.json', json)
  const dlg = page.getByRole('alertdialog')
  await expect(dlg.getByText('読み込もうとしたファイルの方が古いです。')).toBeVisible()
  await dlg.getByRole('button', { name: L.stop }).click()
  await expect(page.getByRole('heading', { name: 'スマホで続きを書いた' })).toBeVisible()
  await upload('c.json', json)
  await dlg.getByRole('button', { name: '別の本として追加' }).click()
  await expect(page.getByRole('heading', { name: '新しい教科書（コピー）' })).toBeVisible()

  // 壊れたファイル・未知の版
  await upload('broken.json', '{oops')
  await expect(page.getByRole('alert')).toContainText('読み込めませんでした')
  await upload('v9.json', JSON.stringify({ ...tb, schemaVersion: 9 }))
  await expect(page.getByRole('alert')).toContainText('schemaVersion: 9')

  // 再読み込みしても端末に残っている（IndexedDB）
  await page.reload()
  await expect(page.getByRole('heading', { name: 'スマホで続きを書いた' })).toBeVisible()
  // キーは端末に残るが、画面には出さない
  await page.getByRole('tab', { name: /つくる/ }).click()
  await expect(page.getByText('APIキー 設定済み')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('SECRET')
})

test('AIにつながらないときは教科書を変えずに理由を出す', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await expect(page.getByRole('status')).toContainText('APIキーが未設定')
  await expect(page.locator('.detail').getByText('未作成').locator('visible=true').first()).toBeVisible()
})

test('ノートの下書きは差し込み位置や節の切り替えで消えない', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: L.generateLesson }).click()
  await page.locator('.doc [data-by="ai"]').first().waitFor()

  // 書きかけの文と画像
  await page.locator('#note').fill('まだ書きかけ')
  await page.locator('#imgf').setInputFiles({ name: 'draft.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.locator('#src').fill('https://example.com/')

  // 差し込み位置を先頭に変えても残る
  await page.locator('.ins').first().click()
  await expect(page.locator('#note')).toHaveValue('まだ書きかけ')
  await expect(page.locator('.atts img')).toHaveCount(1)
  await expect(page.locator('#src')).toHaveValue('https://example.com/')

  // 別の節へ行くと、その節の下書きは空。戻ると元の下書きが残っている
  await page.getByRole('button', { name: /次へ 1-2/ }).click()
  await expect(page.locator('#note')).toHaveValue('')
  await page.getByRole('button', { name: L.roadmap, exact: true }).click()
  await page.getByRole('button', { name: /続きから 1-1/ }).click()
  await expect(page.locator('#note')).toHaveValue('まだ書きかけ')
  await expect(page.locator('.atts img')).toHaveCount(1)

  // 書き込むと下書きは空になる
  await page.getByRole('button', { name: L.write }).click()
  await expect(page.locator('.doc [data-by="me"]').filter({ hasText: 'まだ書きかけ' })).toBeVisible()
  await expect(page.locator('#note')).toHaveValue('')
  await expect(page.locator('.atts img')).toHaveCount(0)
})

test('不正な URL と画像は無害化される（読み込んだ JSON 由来）', async ({ page }) => {
  await page.goto('./')
  const now = new Date().toISOString()
  const tb = {
    schemaVersion: 1,
    id: 'bad-urls',
    title: '不正なURLの教科書',
    createdAt: now,
    updatedAt: now,
    chapters: [
      {
        id: 'c1',
        title: '第1章',
        lessons: [
          {
            id: 'l1',
            title: '節1',
            clues: {
              queries: [],
              how: [],
              links: [
                { title: '悪いリンク', url: 'javascript:alert(1)' },
                { title: '良いリンク', url: 'https://example.com/' },
              ],
            },
            blocks: [
              {
                id: 'b1',
                by: 'me',
                md: '本文',
                source: 'javascript:alert(2)',
                images: [{ id: 'i1', dataUrl: 'data:text/html,<b>x</b>', alt: '' }],
              },
            ],
          },
        ],
      },
    ],
  }
  await page
    .locator('#importfile')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tb)) })
  await page.getByRole('button', { name: '開く' }).click()
  await page.getByRole('button', { name: 'レッスンを開く' }).click()
  const clues = page.getByLabel('参考情報')
  await expect(clues.getByText('悪いリンク')).toBeVisible()
  await expect(clues.getByRole('link', { name: '悪いリンク' })).toHaveCount(0)
  await expect(clues.getByRole('link', { name: '良いリンク' })).toHaveAttribute('href', 'https://example.com/')
  await expect(page.locator('.doc img')).toHaveCount(0)
  await expect(page.locator('.doc').getByText('表示できない画像です')).toBeVisible()
  await expect(page.locator('.doc').getByRole('link', { name: 'javascript:alert(2)' })).toHaveCount(0)
  await expect(page.locator('.doc').getByText('javascript:alert(2)')).toBeVisible()
})

test('CSP 違反が出ない（本番ビルドの meta CSP）', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy|CSP/i.test(m.text())) violations.push(m.text())
  })
  page.on('pageerror', (e) => violations.push('pageerror: ' + e.message))
  await demoBook(page)
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /connect-src 'self' https:\/\/api\.anthropic\.com/,
  )
  await page.getByRole('button', { name: L.generateLesson }).click()
  await page.locator('.doc [data-by="ai"]').first().waitFor()
  // 画像（data URL）と手描きの図（canvas → data URL）
  await page.locator('#imgf').setInputFiles({ name: 'csp.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await writeNote(page, 'CSP の確認')
  await expect(page.locator('.doc [data-by="me"] img')).toHaveCount(1)
  // 書き出し（blob URL のダウンロード）
  await page.getByRole('button', { name: L.roadmap, exact: true }).click()
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSONを書き出す' }).click()])
  expect(violations).toEqual([])
})

test('AI の作業中は押したボタンが進行中の色になり、終わると元に戻る（つくる・設計を直す）', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: L.newWithAi }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('ゲージの確認')
  await page.getByRole('button', { name: L.design }).click()
  await page.getByRole('button', { name: 'スキップ' }).click()
  // 設計を作っている間、上のボタンが進行中（灰色→青で塗られる）。今していることと秒数はボタンの中に出る（#77）
  const making = busyButton(page)
  await expect(making).toHaveClass(/gauge/)
  await expect(making.getByRole('status')).toContainText(/中…・\d+秒$/)
  await expect(page.locator('.working')).toHaveCount(1)
  await expect(page.getByText('Step 2 コース設計案')).toBeVisible()
  // 終わると元に戻る
  const again = page.getByRole('button', { name: 'もう一度調べ直す' })
  await expect(again).not.toHaveClass(/gauge/)
  await expect(again).toBeEnabled()

  // 設計を直してもらう: そのボタンが進行中になり、一覧が薄くなる
  await page.locator('#tweak').fill('実践を先に')
  await page.getByRole('button', { name: '設計を直してもらう' }).click()
  const redoing = busyButton(page)
  await expect(redoing).toHaveClass(/gauge/)
  await expect(redoing).toContainText(/秒/)
  await expect(page.locator('.outline.dim')).toBeVisible()
  await expect(page.getByRole('button', { name: '設計を直してもらう' })).not.toHaveClass(/gauge/)
  await expect(page.locator('.outline.dim')).toHaveCount(0)

  // ロードマップの「設計を直す」も同じ
  await page.getByRole('button', { name: 'この設計で始める' }).click()
  await page.getByRole('button', { name: '設計を直す' }).click()
  const redo = page.getByLabel('設計を直す', { exact: true })
  await redo.getByRole('button', { name: L.propose }).click()
  // 1段階だけ（デモは 200ms）なので、進行中の印と中の文を1回の待ちで確かめる
  await expect(redo.locator('button[aria-busy="true"].gauge')).toContainText('案を作成中…')
  await expect(redo.getByRole('button', { name: '別の案を出す' })).not.toHaveClass(/gauge/)
})

test('本文のチェックリストはクリックで切り替わり、保存される（レッスン・通読）', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: L.startWriting }).click()
  await page.locator('#note').fill('- [ ] 未\n- [x] 済')
  await page.getByRole('button', { name: L.write }).click()
  const boxes = page.locator('.doc [data-by="me"] input[type="checkbox"]')
  await expect(boxes).toHaveCount(2)
  await expect(boxes.nth(0)).not.toBeChecked()
  await expect(boxes.nth(1)).toBeChecked()
  await boxes.nth(0).click()
  await expect(boxes.nth(0)).toBeChecked()
  // 別の画面へ行って戻っても残る
  await page.getByRole('button', { name: L.roadmap, exact: true }).click()
  await page.getByRole('button', { name: /続きから 1-1/ }).click()
  await expect(page.locator('.doc [data-by="me"] input[type="checkbox"]').nth(0)).toBeChecked()
  // 通読でも切り替えられる
  await page.getByRole('tab', { name: /教科書/ }).click()
  const bookBoxes = page.locator('.book input[type="checkbox"]')
  await expect(bookBoxes).toHaveCount(2)
  await bookBoxes.nth(1).click()
  await expect(bookBoxes.nth(1)).not.toBeChecked()
  await page.getByRole('button', { name: 'このページに書く' }).click()
  await expect(page.locator('.doc [data-by="me"] input[type="checkbox"]').nth(1)).not.toBeChecked()
})

import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 1x1 の PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 820

async function blankBook(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: '白紙から作る' }).click()
  await expect(page.getByLabel('教科書の名前')).toHaveValue('新しい教科書')
}

async function demoBook(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'AIと新規作成' }).click()
  await page.getByRole('button', { name: 'デモ応答' }).click()
  await page.locator('#goal').fill('Rustで自分用の小さなツールを書けるようになりたい')
  await page.locator('#env').fill('Windows、VS Code')
  await page.getByRole('button', { name: '調べてコース設計を作る' }).click()
  await expect(page.getByText('AIからの確認')).toBeVisible()
  await page.getByRole('button', { name: 'スキップ' }).click()
  await expect(page.getByText('Step 2 コース設計案')).toBeVisible()
  await page.getByRole('button', { name: 'この設計で始める' }).click()
  await expect(page.getByLabel('教科書の名前')).toBeVisible()
}

async function writeNote(page: Page, text: string) {
  await page.locator('#note').fill(text)
  await page.getByRole('button', { name: '書き込む' }).click()
  await expect(page.locator('.doc [data-by="me"]').filter({ hasText: text })).toBeVisible()
}

test('完了条件1: 自由入力 → 確認質問 → 設計案 → ロードマップに並ぶ', async ({ page }) => {
  await demoBook(page)
  const list = isPhone(page) ? page.locator('.chlist') : page.locator('.tl')
  await expect(list).toBeVisible()
  await expect(list.getByText('最小の一歩をやってみる')).toBeVisible()
  await expect(page.locator('.detail').getByText('未作成').first()).toBeVisible()
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

test('完了条件2: 資料を生成すると本文と調べる手がかりが入る', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
  await expect(page.locator('.doc [data-by="ai"]')).toHaveCount(3)
  await expect(page.locator('.doc table')).toBeVisible()
  const clues = page.getByLabel('調べる手がかり')
  await expect(clues.locator('a.qchip').first()).toHaveAttribute('href', /google\.com\/search\?q=/)
  await expect(clues.getByText('本文の例を自分の環境で再現する')).toBeVisible()
  await expect(page.locator('.rail').getByText('例を自分の環境で試す')).toBeVisible()
})

test('完了条件3: 見たまま編集とノート（文・画像・図・引用・出典）', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
  const first = page.locator('.doc [data-by="ai"]').first()

  // 見たまま編集 → 「自分で修正」になり、状態が「書き込みあり」に変わる
  await first.locator('.blk-body').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' 自分で書き足した。')
  await page.locator('h1').click()
  await expect(first.getByText('自分で修正')).toBeVisible()
  await expect(first.locator('.blk-body')).toContainText('自分で書き足した。')
  await expect(page.locator('.pagehead').getByText('書き込みあり')).toBeVisible()

  // 画像（ファイル選択）と出典つきのノート
  await page.locator('#imgf').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.locator('#src').fill('https://doc.rust-lang.org/book/')
  await writeNote(page, 'やってみたらエラーが出た')
  const note = page.locator('.doc [data-by="me"]').first()
  await expect(note.locator('img')).toHaveAttribute('src', /^data:image\/(webp|jpeg)/)
  await expect(note.getByRole('link', { name: 'https://doc.rust-lang.org/book/' })).toBeVisible()

  // 手描きの図
  await page.getByRole('button', { name: '図を描く' }).click()
  const box = (await page.locator('#cv').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 5 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'この図を入れる' }).click()
  await expect(page.locator('.atts img')).toHaveCount(1)
  await page.getByRole('button', { name: '書き込む' }).click()
  await expect(page.locator('.doc [data-by="me"] img')).toHaveCount(2)

  // 本文を選択して引用 → そのブロックの直下にノート
  await page.evaluate(() => {
    const el = document.querySelectorAll('.doc [data-by="ai"] .blk-body')[1]
    const r = document.createRange(); r.selectNodeContents(el)
    const s = getSelection()!; s.removeAllRanges(); s.addRange(r)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const qbtn = page.getByRole('button', { name: '引用してノートを書く' })
  await expect(qbtn).toBeVisible()
  await qbtn.dispatchEvent('pointerdown')
  await expect(page.locator('.addnote blockquote')).toContainText('まず小さく試す')
  await writeNote(page, '引用へのコメント')
  const quoted = page.locator('.doc [data-by="me"]').filter({ hasText: '引用へのコメント' })
  await expect(quoted.locator('blockquote')).toContainText('まず小さく試す')
  // 引用元（2つ目のAIブロック）の直後に入っている
  const order = await page.locator('.doc [data-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-by') + ':' + (e.textContent ?? '')))
  const at = order.findIndex((x) => x.includes('引用へのコメント'))
  expect(order[at - 1]).toContain('ai:')
  expect(order[at - 1]).toContain('要点')

  // 行の間に差し込む
  await page.locator('.ins').first().click()
  await writeNote(page, '先頭に差し込んだノート')
  expect(await page.locator('.doc [data-block]').first().getAttribute('data-by')).toBe('me')

  // 消す → 元に戻す
  const target = page.locator('.doc [data-by="me"]').filter({ hasText: '先頭に差し込んだノート' })
  await target.hover()
  await target.getByRole('button', { name: '消す' }).click()
  await expect(target).toHaveCount(0)
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(target).toHaveCount(1)
})

test('完了条件4: 完了と再確認の印がロードマップと本棚に出る', async ({ page }) => {
  await blankBook(page)
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  await writeNote(page, '最初のノート')
  await page.getByLabel('あとで再確認').check()
  await expect(page.locator('.pagehead .flag')).toBeVisible()
  await page.getByLabel('完了', { exact: true }).check()
  await expect(page.locator('.pagehead .chip.done')).toBeVisible()
  await page.getByRole('button', { name: 'ロードマップ', exact: true }).click()
  await expect(page.locator('.detail .chip.done').first()).toBeVisible()
  await expect(page.locator('.detail .flag').first()).toBeVisible()
  await page.getByRole('tab', { name: /本棚/ }).click()
  await expect(page.getByText('すべて完了')).toBeVisible()
  await expect(page.getByText('再確認 1件')).toBeVisible()
  await expect(page.getByText('完了 1 / 書き込みあり 0')).toBeVisible()
})

test('完了条件5: 設計を直す。差分を見て採用。守る対象は残る', async ({ page }) => {
  await demoBook(page)
  // 1-1 を完了に、1-2 にノートを書く
  await page.getByRole('button', { name: '自分で書き始める' }).click()
  await writeNote(page, '守られるべきノート')
  await page.getByLabel('完了', { exact: true }).check()
  await page.getByRole('button', { name: /次へ 1-2/ }).click()
  await writeNote(page, '二つ目の節のノート')
  await page.getByRole('button', { name: 'ロードマップ', exact: true }).click()

  await page.getByRole('button', { name: '設計を直す' }).click()
  const redo = page.getByLabel('設計を直す', { exact: true })
  await redo.getByRole('button', { name: /この章だけ/ }).click()
  await redo.locator('#redotext').fill('実践を先に')
  await redo.getByRole('button', { name: '変更案を出してもらう' }).click()
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
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
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
  await page.getByRole('button', { name: '自分で書き始める' }).click()
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
  const upload = (name: string, body: string) => page.locator('#importfile').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) })
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
  await dlg.getByRole('button', { name: 'やめる' }).click()
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
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
  await expect(page.getByRole('status')).toContainText('APIキーが未設定')
  await expect(page.locator('.detail').getByText('未作成').first()).toBeVisible()
})

test('ノートの下書きは差し込み位置や節の切り替えで消えない', async ({ page }) => {
  await demoBook(page)
  await page.getByRole('button', { name: 'この節の資料を生成' }).click()
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
  await page.getByRole('button', { name: 'ロードマップ', exact: true }).click()
  await page.getByRole('button', { name: /続きから 1-1/ }).click()
  await expect(page.locator('#note')).toHaveValue('まだ書きかけ')
  await expect(page.locator('.atts img')).toHaveCount(1)

  // 書き込むと下書きは空になる
  await page.getByRole('button', { name: '書き込む' }).click()
  await expect(page.locator('.doc [data-by="me"]').filter({ hasText: 'まだ書きかけ' })).toBeVisible()
  await expect(page.locator('#note')).toHaveValue('')
  await expect(page.locator('.atts img')).toHaveCount(0)
})

test('不正な URL と画像は無害化される（読み込んだ JSON 由来）', async ({ page }) => {
  await page.goto("./")
  const now = new Date().toISOString()
  const tb = {
    schemaVersion: 1, id: 'bad-urls', title: '不正なURLの教科書', createdAt: now, updatedAt: now,
    chapters: [{ id: 'c1', title: '第1章', lessons: [{ id: 'l1', title: '節1', clues: { queries: [], how: [],
      links: [{ title: '悪いリンク', url: 'javascript:alert(1)' }, { title: '良いリンク', url: 'https://example.com/' }] },
      blocks: [{ id: 'b1', by: 'me', md: '本文', source: 'javascript:alert(2)', images: [{ id: 'i1', dataUrl: 'data:text/html,<b>x</b>', alt: '' }] }] }] }],
  }
  await page.locator('#importfile').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tb)) })
  await page.getByRole('button', { name: '開く' }).click()
  await page.getByRole('button', { name: 'レッスンを開く' }).click()
  const clues = page.getByLabel('調べる手がかり')
  await expect(clues.getByText('悪いリンク')).toBeVisible()
  await expect(clues.getByRole('link', { name: '悪いリンク' })).toHaveCount(0)
  await expect(clues.getByRole('link', { name: '良いリンク' })).toHaveAttribute('href', 'https://example.com/')
  await expect(page.locator('.doc img')).toHaveCount(0)
  await expect(page.locator('.doc').getByText('表示できない画像です')).toBeVisible()
  await expect(page.locator('.doc').getByRole('link', { name: 'javascript:alert(2)' })).toHaveCount(0)
  await expect(page.locator('.doc').getByText('javascript:alert(2)')).toBeVisible()
})

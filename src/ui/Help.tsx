import { useEffect, useRef, useState } from 'react'
import { migrate } from '../lib/migrate'
import { readTextbookFile, type ParseResult } from '../lib/io'
import { KEY } from '../lib/messages'
import { clearRepairTarget, go, useApp } from '../store'
import { downloadBook } from './common'
import { OlderCard, importTextbook, type Older } from './import'
import { MAX_SEARCH_DESIGN, MAX_SEARCH_LESSON, WEB_SEARCH_USD_PER_1000 } from '../ai/anthropic'
import { Button, Card, PageHead } from './kit'

const REPO = 'https://github.com/risuda-ze/jibun_textbook'

/**
 * JSON が読み込めない時に出る文と、次に試すこと（#64）。
 * 「…と出る」の行は `src/lib/messages.ts` の KEY から組み、実際の失敗文と必ず一致させる（#78・`tests/messages.test.ts`）。
 */
export const TROUBLES: { when: string; next: string }[] = [
  {
    when: `「${KEY.notJson}」と出る`,
    next: 'ファイルが途中で切れているか、JSON 以外のファイルです。書き出した端末でもう一度「JSON書出」を押し、新しいファイルを送り直してください。',
  },
  {
    when: `「${KEY.notTextbook}」「${KEY.noVersion}」と出る`,
    next: 'このアプリが書き出したファイルではありません。ファイル名が「<題名>.textbook.json」になっているか確かめてください。',
  },
  {
    when: `「${KEY.newer}（schemaVersion: …）」「版 … ${KEY.noMigration}」と出る`,
    next: '読み込む側のアプリが古いです。ページを再読み込みして最新にしてから、もう一度読み込んでください。',
  },
  {
    when: '読み込んだあとに「直した所: …」と出た',
    next: '古い版の形式か、id の重複などの不整合があったので、読み込むときに自動で直しました。中身は変わっていません。念のため「JSON書出」で新しいファイルを作っておいてください。',
  },
  {
    when: `「${KEY.badShape}（…）」と出る`,
    next: 'ファイルの一部が壊れています。括弧の中に壊れている場所が出ます。手で直せない場合は、書き出した端末から新しいファイルを送り直してください。',
  },
  {
    when: `「${KEY.tooBig}」と出る`,
    next: '上限は 16MB です。画像を減らしてから書き出し直してください。',
  },
  {
    when: '本棚に「読めない教科書」が出る',
    next: '端末に保存されたデータが壊れています。カードの「Help で直す」で版の移行と修復を試せます。直らなければ「生データを書き出す」で控えを取ってから消去し、書き出してあった JSON を読み込み直してください。',
  },
]

/** 版の移行と不整合の修復を手で試す道具（#65）。本棚の「読めない教科書」からも生データが渡ってくる */
function Repair() {
  const { books, repairTarget } = useApp()
  const file = useRef<HTMLInputElement>(null)
  const [res, setRes] = useState<{ name: string; r: ParseResult } | null>(null)
  const [older, setOlder] = useState<Older | null>(null)
  useEffect(() => {
    if (!repairTarget) return
    setRes({ name: repairTarget.name, r: migrate(repairTarget.raw) })
    clearRepairTarget()
  }, [repairTarget])

  // 本棚の「JSON読込」と同じ道（16MB の上限・JSON の検証・版の移行）を通す（#78）
  async function onFile(f: File | undefined) {
    if (!f) return
    setOlder(null)
    setRes({ name: f.name, r: await readTextbookFile(f) })
  }

  // 本棚と同じ判定（新しければ上書き・同じなら何もしない・古ければ確認）（#78）
  function add() {
    if (!res?.r.ok) return
    const o = importTextbook(res.r.tb, res.r.steps, books)
    if (o.done) go('shelf')
    else setOlder(o.older)
  }

  return (
    <div className="stack">
      <p className="sub">上の対処で直らない場合は、ここでファイルを選ぶと、版の移行と不整合の修復を試せます。元のファイルは変えません。</p>
      <div className="row">
        <Button v="soft" onClick={() => file.current?.click()}>ファイルを選ぶ</Button>
        <input ref={file} type="file" id="repairfile" accept=".json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {res && (
        <Card as="div" tone={res.r.ok ? 'sky' : 'peach'} aria-label="直した結果">
          <p><b className="mono">{res.name}</b>{res.r.from !== null && <span className="sub">・schemaVersion {res.r.from}</span>}</p>
          {res.r.ok ? (
            <>
              {res.r.steps.length ? (
                <ul>{res.r.steps.map((s) => <li key={s}>{s}</li>)}</ul>
              ) : (
                <p className="sub">直す所はありませんでした。そのまま読み込めます。</p>
              )}
              <div className="row" style={{ marginTop: 8 }}>
                <Button v="soft" onClick={add}>本棚に追加</Button>
                <Button v="outline" sm onClick={() => res.r.ok && downloadBook(res.r.tb)}>直した JSON を書き出す</Button>
              </div>
              {older && <OlderCard older={older} onDone={() => { setOlder(null); go('shelf') }} />}
            </>
          ) : (
            <>
              <p className="err">{res.r.reason}</p>
              <p className="sub">直せませんでした。<a href="#help-contact">問い合わせ</a>からファイルを添えて知らせてください。</p>
            </>
          )}
        </Card>
      )}
    </div>
  )
}

/** よくある質問（#64）。答えは README と docs/security.md の事実から起こす。作り込まない */
const QA: { q: string; a: string }[] = [
  {
    q: 'データはどこに保存されますか？',
    a: 'この端末のブラウザの中（IndexedDB）にだけ保存されます。サーバーには送りません。ブラウザや URL が変わると別の保存領域になるので、移すときは JSON を書き出して読み込みます。',
  },
  {
    q: '別の端末で続きを書くには？',
    a: '本棚の「JSON書出」でファイルを作り、メールなどで別の端末に送って「JSON読込」で読み込みます。同じ教科書が端末にある場合は、新しい方で上書きします。読み込む側が古いときは確認が出ます。',
  },
  {
    q: 'API キーはどこに置かれますか？',
    a: 'この端末の中の設定にだけ保存されます。書き出す JSON には入りません。共有の端末ではキーを消してから離れてください（「つくる」画面の「変える」から空で保存すると消えます）。',
  },
  {
    q: '本棚に「まだ一度も書き出していません」と出るのは？',
    a: '自分の書き込みがある教科書を、7日以上（または一度も）書き出していないときの知らせです。端末の保存領域はブラウザの都合で消えることがあるので、JSON を書き出して控えを取ってください。',
  },
  {
    q: 'AI が失敗した、または応答を控えたときは？',
    a: '教科書は変わりません。出た理由を読んで、もう一度試してください。応答を控えられた場合は、言い回しを変えるかモデルを切り替えると通ることがあります。',
  },
  {
    q: '「デモ応答」とは何ですか？',
    a: 'API キーなしで動線を試すための見本です。Web 調査はせず、決まった内容を返します。',
  },
  {
    q: 'Web 調査の料金はどのくらいですか？',
    a: `Anthropic の Web 検索は検索 1000 回あたり ${WEB_SEARCH_USD_PER_1000} ドルです。コース設計で最大 ${MAX_SEARCH_DESIGN} 回、節の資料で最大 ${MAX_SEARCH_LESSON} 回まで検索します。「つくる」画面で「検索なし」も選べます。`,
  },
  {
    q: 'オフラインで使えますか？',
    a: 'オフラインは考慮していません。一度開いたページは表示できることがありますが、AI は使えません。',
  },
]

const issueUrl = (labels: string, title: string, body: string): string =>
  `${REPO}/issues/new?${new URLSearchParams({ labels, title, body }).toString()}`

const BUG_BODY = `## 何をしたか

## 何が起きたか（出た文をそのまま）

## 期待した結果

## 端末とブラウザ

## 添付
書き出した JSON（個人情報が無いか確かめてから）と画面の写真があると早く直せます。
`

const WISH_BODY = `## こうしたい

## 理由・困っていること

`

export function Help() {
  return (
    <>
      <PageHead
        eyebrow="Help"
        title="困ったときに"
        lead="読み込めないときの対処、よくある質問、問い合わせ先です。"
        actions={<Button v="ghost" onClick={() => go('shelf')}>本棚へ戻る</Button>}
      />

      <Card as="section" stack aria-labelledby="help-trouble">
        <h2 id="help-trouble">読み込めない場合、まずはこちら</h2>
        <p className="sub">本棚の「JSON読込」で出た文を探して、次に試すことを見てください。</p>
        <dl className="help-list">
          {TROUBLES.map((t) => (
            <div key={t.when}>
              <dt>{t.when}</dt>
              <dd>{t.next}</dd>
            </div>
          ))}
        </dl>
        <Repair />
      </Card>

      <Card as="section" stack aria-labelledby="help-qa">
        <h2 id="help-qa">Q&A</h2>
        <dl className="help-list">
          {QA.map((x) => (
            <div key={x.q}>
              <dt>{x.q}</dt>
              <dd>{x.a}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card as="section" stack aria-labelledby="help-contact">
        <h2 id="help-contact">問い合わせ</h2>
        <p className="sub">不具合や要望は GitHub の Issue で受け付けます（GitHub のアカウントが必要です）。下のリンクを開くと、書く項目が入った状態で新しい Issue が開きます。</p>
        <div className="row">
          <a className="btn soft" href={issueUrl('bug', '不具合: ', BUG_BODY)} target="_blank" rel="noopener noreferrer">不具合を知らせる</a>
          <a className="btn outline" href={issueUrl('enhancement', '要望: ', WISH_BODY)} target="_blank" rel="noopener noreferrer">要望を送る</a>
        </div>
        <p className="sub">知らせるときは、書き出した JSON（個人情報が無いか確かめてから）と画面の写真を添えると早く直せます。</p>
      </Card>
    </>
  )
}

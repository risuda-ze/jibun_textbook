import { go } from '../store'
import { Button, Card, PageHead } from './kit'

const REPO = 'https://github.com/risuda-ze/jibun_textbook'

/** JSON が読み込めない時に出る文と、次に試すこと（#64）。文は `src/lib/io.ts` と `Shelf.tsx` の失敗文に合わせる。版の移行と修復の道具は #65 でこの章に入る */
const TROUBLES: { when: string; next: string }[] = [
  {
    when: '「JSONとして読み込めませんでした」と出る',
    next: 'ファイルが途中で切れているか、JSON 以外のファイルです。書き出した端末でもう一度「JSON書出」を押し、新しいファイルを送り直してください。',
  },
  {
    when: '「教科書のJSONではありません」と出る',
    next: 'このアプリが書き出したファイルではありません。ファイル名が「<題名>.textbook.json」になっているか確かめてください。',
  },
  {
    when: '「このアプリでは読み込めない形式のファイルです（schemaVersion: …）」と出る',
    next: '読み込む側のアプリが古いです。ページを再読み込みして最新にしてから、もう一度読み込んでください。',
  },
  {
    when: '「同じ id の章・節・ノートが複数あるため読み込めません」と出る',
    next: 'ファイルの中で id が重複しています。書き出した端末で教科書を開き直し、「JSON書出」をやり直してください。それでも直らない場合は、下の「問い合わせ」からファイルを添えて知らせてください。',
  },
  {
    when: '「形式が正しくありません（…）」と出る',
    next: 'ファイルの一部が壊れています。括弧の中に壊れている場所が出ます。手で直せない場合は、書き出した端末から新しいファイルを送り直してください。',
  },
  {
    when: '「大きすぎて読み込めません」と出る',
    next: '上限は 16MB です。画像を減らしてから書き出し直してください。',
  },
  {
    when: '本棚に「読めない教科書」が出る',
    next: '端末に保存されたデータが壊れています。カードの「生データを書き出す」で控えを取ってから消去し、書き出してあった JSON を読み込み直してください。',
  },
]

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
    a: 'Anthropic の Web 検索は検索 1000 回あたり 10 ドルです。コース設計で最大 8 回、節の資料で最大 5 回まで検索します。「つくる」画面で「検索なし」も選べます。',
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

import { asCopy, decideImport } from '../lib/io'
import { putBook, toast } from '../store'
import type { Textbook } from '../types'
import { Button, Card } from './kit'

/** 読み込む側が古いときの確認に使う組 */
export type Older = { incoming: Textbook; existing: Textbook }

export type ImportOutcome = { done: true } | { done: false; older: Older }

/**
 * 読み込んだ教科書を本棚に入れる（#78）。本棚の「JSON読込」と Help の「本棚に追加」で同じ判定を通す。
 * 新しければ上書き（元に戻せる）、同じなら何もしない、古ければ確認を返す（呼び出し側が OlderCard を出す）。
 * `steps` は読み込みで直した所（#65）。知らせに添える
 */
export function importTextbook(tb: Textbook, steps: string[], books: Textbook[]): ImportOutcome {
  const existing = books.find((b) => b.id === tb.id)
  const d = decideImport(existing, tb)
  const fixed = steps.length ? `直した所: ${steps.join('、')}。` : ''
  if (d === 'add') {
    putBook(tb, false)
    toast(`「${tb.title}」を読み込みました。${fixed}`)
  } else if (d === 'overwrite' && existing) {
    putBook(tb, false)
    toast(`「${tb.title}」を新しい内容で上書きしました。${fixed}`, () => putBook(existing, false))
  } else if (d === 'same') {
    toast('同じ内容が存在します。')
  } else if (existing) {
    return { done: false, older: { incoming: tb, existing } }
  }
  return { done: true }
}

/** 「読み込もうとしたファイルの方が古い」の確認。古い内容で上書き／別の本として追加／やめる */
export function OlderCard({ older, onDone }: { older: Older; onDone: () => void }) {
  return (
    <Card stack tone="marigold" role="alertdialog" aria-label="古いファイルの読み込み">
      <p>
        <b>読み込もうとしたファイルの方が古いです。</b>「{older.existing.title}」
      </p>
      <p className="sub mono">
        端末: {new Date(older.existing.updatedAt).toLocaleString('ja-JP')} / ファイル:{' '}
        {new Date(older.incoming.updatedAt).toLocaleString('ja-JP')}
      </p>
      <div className="row">
        <Button
          v="ghost"
          onClick={() => {
            const prev = older.existing
            putBook(older.incoming, false)
            onDone()
            toast('古い内容で上書きしました', () => putBook(prev, false))
          }}
        >
          古い内容で上書き
        </Button>
        <Button
          v="ghost"
          onClick={() => {
            putBook(asCopy(older.incoming), false)
            onDone()
            toast('別の本として追加しました')
          }}
        >
          別の本として追加
        </Button>
        <Button v="soft" onClick={onDone}>
          やめる
        </Button>
      </div>
    </Card>
  )
}

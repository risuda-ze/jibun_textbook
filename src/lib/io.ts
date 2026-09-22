import { TextbookStrictZ, TextbookZ, type Textbook, uid, nowIso } from '../types'

export const SIZE_WARN_BYTES = 8 * 1024 * 1024

/** 書き出し。スキーマを通すので、教科書以外の項目（APIキー等）は構造上入らない。 */
export function exportJson(tb: Textbook): string {
  return JSON.stringify(TextbookZ.parse(tb), null, 1)
}

export const byteSize = (s: string): number => new Blob([s]).size

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const fileName = (tb: Textbook): string =>
  `${tb.title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'textbook'}.textbook.json`

export type ParseResult = { ok: true; tb: Textbook } | { ok: false; reason: string }

export function parseImport(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'JSONとして読み込めませんでした。ファイルが壊れているか、別の種類のファイルの可能性があります。' }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: '教科書のJSONではありません。' }
  const v = (raw as { schemaVersion?: unknown }).schemaVersion
  if (v !== 1) return { ok: false, reason: `このアプリでは読み込めない形式のファイルです（schemaVersion: ${String(v)}）。アプリを更新してから読み込んでください。` }
  // 読み込みは id の一意性まで検証する（#36）。端末内の既存データは store.init が振り直して救済する
  const r = TextbookStrictZ.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    if (i.code === 'custom') return { ok: false, reason: `${i.message}。同じ id の章・節・ノートが複数あるため読み込めません。` }
    return { ok: false, reason: `形式が正しくありません（${i.path.join('.') || 'root'}: ${i.message}）。` }
  }
  return { ok: true, tb: r.data }
}

/**
 * 同じidの教科書が端末にあるときの判定。
 * - add: 端末に無い → 追加
 * - overwrite: 読み込む側が新しい → 自動で上書き
 * - same: 同じ更新日時 → 何もしない
 * - older: 読み込む側が古い → 警告して選ばせる
 */
export type ImportDecision = 'add' | 'overwrite' | 'same' | 'older'

export function decideImport(existing: Textbook | undefined, incoming: Textbook): ImportDecision {
  if (!existing) return 'add'
  const a = Date.parse(existing.updatedAt)
  const b = Date.parse(incoming.updatedAt)
  if (b > a) return 'overwrite'
  if (b === a) return 'same'
  return 'older'
}

/** 「別の本として追加」用。idを振り直す。 */
export function asCopy(tb: Textbook): Textbook {
  return { ...tb, id: uid(), title: tb.title + '（コピー）', updatedAt: nowIso() }
}

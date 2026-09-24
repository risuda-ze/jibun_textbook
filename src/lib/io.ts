import { TextbookZ, type Textbook, uid, nowIso } from '../types'
import { migrate } from './migrate'
import { MSG } from './messages'

export const SIZE_WARN_BYTES = 8 * 1024 * 1024
/** 読み込む JSON の上限（#17）。これを超えるファイルは JSON.parse する前に断る */
export const IMPORT_LIMIT_BYTES = 16 * 1024 * 1024

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

export const fileName = (tb: Textbook): string => `${tb.title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'textbook'}.textbook.json`

/** steps は読み込むときに直した所（版の移行・不整合の修復）。空なら手を入れていない。from は読んだ版（分からなければ null） */
export type ParseResult = { ok: true; tb: Textbook; steps: string[]; from: number } | { ok: false; reason: string; from: number | null }

export function parseImport(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: MSG.notJson, from: null }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: MSG.notTextbook, from: null }
  // 版の移行と既知の不整合（id の重複・日時の欠落）の修復は migrate() に寄せる（#65）。端末内のデータも同じ道を通る
  const r = migrate(raw)
  if (!r.ok) return { ok: false, reason: r.reason, from: r.from }
  return { ok: true, tb: r.tb, steps: r.steps, from: r.from }
}

/**
 * ファイルから教科書を読む（#78）。本棚の「JSON読込」と Help の修復で同じ道を通す。
 * 16MB を超えるファイルは JSON.parse の前に断る（#17）
 */
export async function readTextbookFile(f: File): Promise<ParseResult> {
  if (f.size > IMPORT_LIMIT_BYTES)
    return { ok: false, reason: MSG.tooBig(f.name, formatSize(f.size), formatSize(IMPORT_LIMIT_BYTES)), from: null }
  return parseImport(await f.text())
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

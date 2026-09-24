import type { Material, MaterialKind } from '../ai/types'
import { MATERIAL_MSG } from './messages'

/** 渡せる資料の上限（#63）。txt/md はプロンプトに入るので小さく、PDF は API の document 入力に渡す */
export const TEXT_LIMIT_BYTES = 200 * 1024
export const PDF_LIMIT_BYTES = 10 * 1024 * 1024
/** 複数の資料の合計の上限（#69）。PDF 2つ分。base64 で 4/3 に膨らんでも API のリクエスト上限 32MB に収まる */
export const TOTAL_LIMIT_BYTES = 20 * 1024 * 1024
export const PASTED_NAME = '貼り付けた文'

/** 拡張子と MIME から種類を決める。渡せない種類は null */
export function classify(name: string, type: string): MaterialKind | null {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf'
  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || type.startsWith('text/')) return 'text'
  return null
}

const kb = (n: number): string => (n >= 1024 * 1024 ? `${Math.round(n / 1024 / 1024)}MB` : `${Math.round(n / 1024)}KB`)

/** 上限を超えていれば理由、収まっていれば null。「先頭だけ使う」はしない（何が入ったか分からなくなる） */
export function checkSize(kind: MaterialKind, size: number): string | null {
  const limit = kind === 'pdf' ? PDF_LIMIT_BYTES : TEXT_LIMIT_BYTES
  if (size <= limit) return null
  return MATERIAL_MSG.tooBig(kind === 'pdf' ? 'PDF' : '文字', kb(size), kb(limit))
}

/** 資料の合計の大きさ */
export const totalSize = (mats: Material[]): number => mats.reduce((n, m) => n + m.size, 0)

/** 合計が上限を超えていれば理由、収まっていれば null（#69） */
export function checkTotal(size: number): string | null {
  if (size <= TOTAL_LIMIT_BYTES) return null
  return MATERIAL_MSG.tooBigTotal(kb(size), kb(TOTAL_LIMIT_BYTES))
}

export type ReadResult = { ok: true; material: Material } | { ok: false; reason: string }

const readAs = (file: File, how: 'text' | 'dataUrl'): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result ?? ''))
    r.onerror = () => rej(new Error('ファイルを読めませんでした。'))
    if (how === 'text') r.readAsText(file)
    else r.readAsDataURL(file)
  })

/** ファイルを1つ読んで資料にする。txt/md は文字、PDF は base64（data URL の先頭を外す） */
export async function readMaterial(file: File): Promise<ReadResult> {
  const kind = classify(file.name, file.type)
  if (!kind) return { ok: false, reason: MATERIAL_MSG.badKind(file.name) }
  const over = checkSize(kind, file.size)
  if (over) return { ok: false, reason: `「${file.name}」は${over}` }
  try {
    if (kind === 'text') return { ok: true, material: { kind, name: file.name, size: file.size, text: await readAs(file, 'text') } }
    const dataUrl = await readAs(file, 'dataUrl')
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
    return { ok: true, material: { kind, name: file.name, size: file.size, data } }
  } catch (e) {
    return { ok: false, reason: MATERIAL_MSG.unreadable(file.name, (e as Error).message) }
  }
}

/** 貼り付けた文を資料にする。空なら null。ファイルと同じ上限（#79） */
export function pastedMaterial(text: string): ReadResult | null {
  const t = text.trim()
  if (!t) return null
  const size = new Blob([t]).size
  const over = checkSize('text', size)
  if (over) return { ok: false, reason: `貼り付けた文は${over}` }
  return { ok: true, material: { kind: 'text', name: PASTED_NAME, size, text: t } }
}

/** 貼り付けた文の今の大きさ（バイト）。欄の下に上限と並べて出す */
export const pastedSize = (text: string): number => new Blob([text.trim()]).size

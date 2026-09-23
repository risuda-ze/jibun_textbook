import type { Material, MaterialKind } from '../ai/types'

/** 渡せる資料の上限（#63）。txt/md はプロンプトに入るので小さく、PDF は API の document 入力に渡す */
export const TEXT_LIMIT_BYTES = 200 * 1024
export const PDF_LIMIT_BYTES = 10 * 1024 * 1024
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
  return `大きすぎて渡せません（${kb(size)}。${kind === 'pdf' ? 'PDF' : '文字のファイル'}の上限は ${kb(limit)}）。`
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
  if (!kind) return { ok: false, reason: `「${file.name}」は渡せない種類のファイルです。渡せるのは .txt / .md / .pdf です。` }
  const over = checkSize(kind, file.size)
  if (over) return { ok: false, reason: `「${file.name}」は${over}` }
  try {
    if (kind === 'text') return { ok: true, material: { kind, name: file.name, size: file.size, text: await readAs(file, 'text') } }
    const dataUrl = await readAs(file, 'dataUrl')
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
    return { ok: true, material: { kind, name: file.name, size: file.size, data } }
  } catch (e) {
    return { ok: false, reason: `「${file.name}」を読めませんでした。${(e as Error).message}` }
  }
}

/** 貼り付けた文を資料にする。空なら null */
export function pastedMaterial(text: string): Material | null {
  const t = text.trim()
  if (!t) return null
  return { kind: 'text', name: PASTED_NAME, size: new Blob([t]).size, text: t }
}

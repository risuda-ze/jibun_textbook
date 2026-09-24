/**
 * ノート入力欄の Markdown 挿入（#52）。textarea の選択範囲に記法を当てる純粋関数。
 * 見たまま編集ではなく、書く前の textarea 用。保存形式（Markdown 文字列）は変えない。
 */

export type MdKind = 'bold' | 'code' | 'link' | 'bullet' | 'number' | 'heading'

export type MdEdit = { md: string; start: number; end: number }

const WRAP: Record<'bold' | 'code', { open: string; close: string; placeholder: string }> = {
  bold: { open: '**', close: '**', placeholder: '太字' },
  code: { open: '`', close: '`', placeholder: 'コード' },
}
const PREFIX: Record<'bullet' | 'number' | 'heading', string> = { bullet: '- ', number: '1. ', heading: '## ' }

/** 選択範囲 [start, end) に kind の記法を当てる。戻り値の start/end は当てた後に選択しておく範囲 */
export function applyMarkdown(md: string, start: number, end: number, kind: MdKind): MdEdit {
  const s = Math.max(0, Math.min(start, end)),
    e = Math.max(start, end)
  const before = md.slice(0, s),
    sel = md.slice(s, e),
    after = md.slice(e)

  if (kind === 'bold' || kind === 'code') {
    const { open, close, placeholder } = WRAP[kind]
    // 既に囲まれていれば外す
    if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
      const inner = sel.slice(open.length, sel.length - close.length)
      return { md: before + inner + after, start: s, end: s + inner.length }
    }
    const text = sel || placeholder
    return { md: before + open + text + close + after, start: s + open.length, end: s + open.length + text.length }
  }

  if (kind === 'link') {
    const text = sel || 'リンク'
    const url = 'URL'
    const out = `[${text}](${url})`
    const urlStart = s + 1 + text.length + 2
    return { md: before + out + after, start: urlStart, end: urlStart + url.length }
  }

  // 行頭に付ける記法。選択範囲にかかる行すべてに付ける。全行に付いていれば外す
  const prefix = PREFIX[kind]
  const lineStart = before.lastIndexOf('\n') + 1
  const lineEndIdx = after.indexOf('\n')
  const lineEnd = lineEndIdx < 0 ? md.length : e + lineEndIdx
  const block = md.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const allHave = lines.every((l) => l.startsWith(prefix))
  const next = lines.map((l) => (allHave ? l.slice(prefix.length) : prefix + l)).join('\n')
  const delta = next.length - block.length
  const out = md.slice(0, lineStart) + next + md.slice(lineEnd)
  const ns = Math.max(lineStart, s + (allHave ? -prefix.length : prefix.length))
  return { md: out, start: ns, end: Math.max(ns, e + delta) }
}

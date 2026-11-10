import { strToU8, zipSync } from 'fflate'
import type { Block, Image, Lesson, Textbook } from '../types'
import { safeName } from './io'
import { replaceRefs } from './md'
import { isHttpUrl, isImageDataUrl } from './safe'

/**
 * Markdown 書き出し（#136）。brain vault（Obsidian）に置く前提。1冊 = zip 1つ（<名前>.md と img/）。
 * 書き手の印（AI の下書き / 自分のノート / 自分で修正）は残さず、本文の順に平文で並べる。手を動かすは含めない。
 * 見出しは # 章 / ## 節。コース名・狙い・作成日は frontmatter。本文の中の見出し（AI は ### を使う）はそのまま
 */

/** data URL の MIME から拡張子（jpeg → jpg、svg+xml → svg）。画像の data URL でなければ null */
export function imageExt(dataUrl: string): string | null {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl)
  if (!m || !isImageDataUrl(dataUrl)) return null
  const t = m[1].toLowerCase()
  return t === 'jpeg' ? 'jpg' : t === 'svg+xml' ? 'svg' : t
}

/** zip の中の画像のパス。Image.id がそのままファイル名。表示できない画像は null（本文にも zip にも出さない） */
export const imagePath = (im: Image): string | null => {
  const ext = imageExt(im.dataUrl)
  return ext ? `img/${im.id}.${ext}` : null
}

/** YAML の文字列。JSON の二重引用符は YAML でもそのまま通る（改行・引用符を含む狙いも 1 行に収まる） */
const yaml = (v: string): string => JSON.stringify(v)

/** 1ブロック: 本文（img:<ID> は相対パスに）→ 参照していない画像 → 引用 → 出典 */
function blockMd(b: Block): string {
  const paths = new Map(b.images.map((im) => [im.id, imagePath(im)] as const))
  const used = new Set<string>()
  const body = replaceRefs(b.md, (id) => {
    const p = paths.get(id)
    if (!p) return '（消した画像）'
    used.add(id)
    return `![](${p})`
  })
  const rest = b.images.flatMap((im) => {
    const p = paths.get(im.id)
    return p && !used.has(im.id) ? [`![](${p})`] : []
  })
  const out = [body.trim(), ...rest]
  if (b.quote.trim())
    out.push(
      b.quote
        .trim()
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n'),
    )
  if (b.source.trim()) out.push(`出典: ${b.source.trim()}`)
  return out.filter(Boolean).join('\n\n')
}

/** 1節: ## 題名 → 狙い → ブロック → 参考情報（検索語とリンク）。手を動かす・確かめ方・渡した資料の名前は出さない */
function lessonMd(l: Lesson): string {
  const parts = [`## ${l.title}`]
  if (l.summary.trim()) parts.push(l.summary.trim())
  for (const b of l.blocks) {
    const s = blockMd(b)
    if (s) parts.push(s)
  }
  const refs = [
    ...l.clues.queries.map((q) => `- 検索: ${q}`),
    ...l.clues.links.map((k) => (isHttpUrl(k.url) ? `- [${k.title || k.url}](${k.url})` : `- ${k.title || k.url}`)),
  ]
  if (refs.length) parts.push(['**参考情報**', ...refs].join('\n'))
  return parts.join('\n\n')
}

/** 教科書1冊を Markdown 1ファイルに。純粋関数（単体テストの対象） */
export function bookToMarkdown(tb: Textbook): string {
  const head = ['---', `title: ${yaml(tb.title)}`, `goal: ${yaml(tb.goal)}`, `created: ${tb.createdAt.slice(0, 10)}`, '---']
  const body = tb.chapters.flatMap((c) => [`# ${c.title}`, ...c.lessons.map(lessonMd)])
  return `${[head.join('\n'), ...body].join('\n\n')}\n`
}

/** zip に入れる画像。パス → バイト列。data URL が壊れていて読めないものは飛ばす */
export function bookImages(tb: Textbook): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const c of tb.chapters)
    for (const l of c.lessons)
      for (const b of l.blocks)
        for (const im of b.images) {
          const p = imagePath(im)
          if (!p) continue
          const i = im.dataUrl.indexOf(',')
          const data = im.dataUrl.slice(i + 1)
          try {
            out[p] = im.dataUrl.slice(0, i).endsWith(';base64')
              ? Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0))
              : strToU8(decodeURIComponent(data))
          } catch {
            // 読めない data URL は zip に入れない（本文の参照はそのまま残る）
          }
        }
  return out
}

/** zip のバイト列。画像は縮小時に圧縮済みなので store（level 0） */
export function bookZip(tb: Textbook): Uint8Array {
  return zipSync({ [`${safeName(tb)}.md`]: strToU8(bookToMarkdown(tb)), ...bookImages(tb) }, { level: 0 })
}

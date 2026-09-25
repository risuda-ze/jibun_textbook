import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
// @ts-expect-error 型定義が無い
import { gfm } from 'turndown-plugin-gfm'
import { isImageDataUrl } from './safe'
import type { Image } from '../types'

/** 保存はMarkdown、編集は見たまま。表示時に md→HTML、編集確定時に HTML→md。 */

/**
 * 本文の中の画像の参照記法 `![](img:<ID>)`（#125）。同じブロックの images[] の id を指す。画像の本体は images[] に持ち、本文に data URL を入れない。
 * 読み取りでは <img>、見たまま編集ではチップ（contenteditable="false" の span）にし、確定時に imgref の rule が記法に戻す
 */
const REF = /!\[[^\]]*\]\(img:([^)\s]+)\)/g
/** 本文が参照している画像の id */
export const refIds = (md: string): Set<string> => new Set([...md.matchAll(REF)].map((m) => m[1]))
/** 画像を外すときに本文の参照も消す */
export const removeRef = (md: string, id: string): string =>
  md
    .replace(REF, (m, i) => (i === id ? '' : m))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
/** 見たまま編集に出すチップ。BlockRow の「文中に置く」もこれをカレットに差し込む */
export const imgChip = (id: string): string =>
  `<span class="imgref" contenteditable="false" data-id="${esc(id)}">[画像: ${esc(id.slice(0, 8))}]</span>`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

// チェックリストの箱は disabled を付けずに描画し、クリックで切り替えられるようにする（#56）。切り替えは BlockRow が拾って toggleTask で保存する
const renderer = new marked.Renderer()
renderer.checkbox = ({ checked }) => `<input type="checkbox"${checked ? ' checked=""' : ''}>`
// 参照記法の解決。marked の renderer は1つなので、描画する間だけ images と mode をここに置く（parse は同期）
let ctx: { images: Image[]; mode: 'read' | 'edit' } = { images: [], mode: 'read' }
const baseImage = renderer.image.bind(renderer)
renderer.image = (token) => {
  if (!token.href.startsWith('img:')) return baseImage(token)
  const id = token.href.slice(4)
  const im = ctx.images.find((x) => x.id === id)
  if (!im) return `<span class="imgref missing" data-id="${esc(id)}">（消した画像）</span>`
  if (ctx.mode === 'edit') return imgChip(id)
  // JSON 由来の画像は data:image/ だけを表示する（#35）
  return isImageDataUrl(im.dataUrl) ? `<img src="${im.dataUrl}" alt="">` : `<span class="imgref missing">表示できない画像です</span>`
}
marked.setOptions({ gfm: true, breaks: true, renderer })

/** Markdown の中の index 番目（0 始まり）のチェック項目（- [ ] / - [x]）を反転する。無ければそのまま */
export function toggleTask(md: string, index: number): string {
  let n = -1
  return md
    .split('\n')
    .map((line) => {
      const m = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/.exec(line)
      if (!m) return line
      n++
      if (n !== index) return line
      return line.replace(/\[( |x|X)\]/, m[2] === ' ' ? '[x]' : '[ ]')
    })
    .join('\n')
}

export function mdToHtml(md: string, images: Image[] = [], mode: 'read' | 'edit' = 'read'): string {
  ctx = { images, mode }
  const html = marked.parse(md, { async: false }) as string
  // target は許可しない（#88）。marked は target を付けず、本文に直書きした <a target="_blank"> も同一タブに揃える（docs/security.md）。
  // チップの contenteditable="false" は既定で落ちるので編集のときだけ許す（data-id は既定で通る）
  return DOMPurify.sanitize(html, mode === 'edit' ? { ADD_ATTR: ['contenteditable'] } : {})
}

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' })
td.use(gfm)
// 見たまま編集で打った文字は Markdown として扱う（#147）。turndown は既定で文字中の * ` [ # - _ > を \* のように
// エスケープするため、編集中に打った記法が文字のまま残っていた（#76 #145）。本文は Markdown なので、入力欄と同じ規則に揃える。
// 代わりに、もともと \* で文字として保っていた記号は、その段落を編集で確定すると Markdown として解釈される
td.escape = (s: string) => s
// 表のセルの中の <br> は <br> のまま出す（#48）。既定の「行末空白2つ＋改行」にすると表の行が途中で切れる。
// GFM の表セルは HTML の <br> を許すので、marked が再び改行として描画する
td.addRule('brInTableCell', {
  filter: (node) => node.nodeName === 'BR' && !!node.closest('td, th'),
  replacement: () => '<br>',
})
// 画像のチップを参照記法に戻す（#125）。中の文字は使わない
td.addRule('imgref', {
  filter: (node) => node.nodeName === 'SPAN' && node.classList.contains('imgref') && !!node.getAttribute('data-id'),
  replacement: (_content, node) => `![](img:${(node as HTMLElement).getAttribute('data-id')})`,
})
// contenteditable が作る <div> の改行を段落として扱う
td.addRule('divAsParagraph', {
  filter: 'div',
  replacement: (content) => '\n\n' + content + '\n\n',
})
// 表の外の <br> は改行1つにする（#148）。既定の「行末空白2つ＋改行」でも描画は同じだが、Markdown の元文として行末の空白を残さない。
// 見たまま編集の Enter は <br>（行）なので、2つ続く <br>（空行）は段落の区切り \n\n にする
// （turndown は続く改行を1つにまとめるため、2つ目の <br> で \n\n を返す）。表のセルの中は brInTableCell（#48）に任せる。
// ブロック末尾の <br>（Enter で置く見えない <br> や、ブラウザがブロックを分けた残り）は描画に出ないので消す。
// li の末尾に改行が残ると空白だけの行になり、tight list が loose になる
td.addRule('lineBreak', {
  filter: (node) => node.nodeName === 'BR' && !node.closest('td, th'),
  replacement: (_content, node) => {
    let next = node.nextSibling
    while (next?.nodeName === 'BR') next = next.nextSibling
    if (!next) return ''
    return node.previousSibling?.nodeName === 'BR' ? '\n\n' : '\n'
  },
})

export function htmlToMd(html: string): string {
  return td
    .turndown(DOMPurify.sanitize(html))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

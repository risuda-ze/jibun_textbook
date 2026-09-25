import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
// @ts-expect-error 型定義が無い
import { gfm } from 'turndown-plugin-gfm'

/** 保存はMarkdown、編集は見たまま。表示時に md→HTML、編集確定時に HTML→md。 */

// チェックリストの箱は disabled を付けずに描画し、クリックで切り替えられるようにする（#56）。切り替えは BlockRow が拾って toggleTask で保存する
const renderer = new marked.Renderer()
renderer.checkbox = ({ checked }) => `<input type="checkbox"${checked ? ' checked=""' : ''}>`
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

export function mdToHtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string
  // target は許可しない（#88）。marked は target を付けず、本文に直書きした <a target="_blank"> も同一タブに揃える（docs/security.md）
  return DOMPurify.sanitize(html)
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

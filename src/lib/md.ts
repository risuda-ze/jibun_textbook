import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
// @ts-expect-error 型定義が無い
import { gfm } from 'turndown-plugin-gfm'
import { isHttpUrl } from './safe'

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
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
}

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' })
td.use(gfm)
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

export function htmlToMd(html: string): string {
  return (
    td
      .turndown(DOMPurify.sanitize(html))
      .replace(/\n{3,}/g, '\n\n')
      // 見たまま編集で文字として打った [文](URL) は turndown が \[文\](URL) にエスケープする（#76）。
      // URL が http(s) のものだけリンクの記法に戻す。太字やコードは意図しない変換になりうるので戻さない
      .replace(/\\\[([^[\]\n]+)\\\]\((\S+?)\)/g, (m, text, url) => (isHttpUrl(url) ? `[${text}](${url})` : m))
      .trim()
  )
}

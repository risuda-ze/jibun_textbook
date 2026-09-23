import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
// @ts-expect-error 型定義が無い
import { gfm } from 'turndown-plugin-gfm'

/** 保存はMarkdown、編集は見たまま。表示時に md→HTML、編集確定時に HTML→md。 */

marked.setOptions({ gfm: true, breaks: true })

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
  return td.turndown(DOMPurify.sanitize(html)).replace(/\n{3,}/g, '\n\n').trim()
}

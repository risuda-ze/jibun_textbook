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
// contenteditable が作る <div> の改行を段落として扱う
td.addRule('divAsParagraph', {
  filter: 'div',
  replacement: (content) => '\n\n' + content + '\n\n',
})

export function htmlToMd(html: string): string {
  return td.turndown(DOMPurify.sanitize(html)).replace(/\n{3,}/g, '\n\n').trim()
}

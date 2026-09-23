import { describe, expect, it } from 'vitest'
import { applyMarkdown } from '../src/lib/mdedit'

describe('ノート入力欄の Markdown 挿入（#52）', () => {
  it('選択範囲を太字・コードで囲む。もう一度で外す', () => {
    expect(applyMarkdown('大事な点', 0, 3, 'bold')).toEqual({ md: '**大事な**点', start: 2, end: 5 })
    expect(applyMarkdown('**大事な**点', 0, 7, 'bold')).toEqual({ md: '大事な点', start: 0, end: 3 })
    expect(applyMarkdown('cargo run を実行', 0, 9, 'code')).toEqual({ md: '`cargo run` を実行', start: 1, end: 10 })
  })
  it('選択が無ければ見本の語を入れて選択する', () => {
    expect(applyMarkdown('', 0, 0, 'bold')).toEqual({ md: '**太字**', start: 2, end: 4 })
    expect(applyMarkdown('前 ', 2, 2, 'link')).toEqual({ md: '前 [リンク](URL)', start: 8, end: 11 })
  })
  it('リンクは選択テキストを文にし、URL を選択する', () => {
    const r = applyMarkdown('公式ドキュメント', 0, 8, 'link')
    expect(r.md).toBe('[公式ドキュメント](URL)')
    expect(r.md.slice(r.start, r.end)).toBe('URL')
  })
  it('行頭の記法は選択範囲にかかる全行に付け、全行に付いていれば外す', () => {
    expect(applyMarkdown('一\n二\n三', 0, 3, 'bullet').md).toBe('- 一\n- 二\n三')
    expect(applyMarkdown('- 一\n- 二', 0, 7, 'bullet').md).toBe('一\n二')
    expect(applyMarkdown('見出し', 1, 1, 'heading').md).toBe('## 見出し')
    expect(applyMarkdown('a\nb', 2, 3, 'number').md).toBe('a\n1. b')
  })
})

import { describe, expect, it } from 'vitest'
import { htmlToMd, mdToHtml, toggleTask } from '../src/lib/md'

const roundTrip = (md: string) => htmlToMd(mdToHtml(md))

describe('見たまま編集とMarkdownの往復', () => {
  it('見出し・強調・箇条書き', () => {
    expect(roundTrip('### 見出し\n\n本文に**強調**がある。')).toBe('### 見出し\n\n本文に**強調**がある。')
    expect(roundTrip('- 一\n- 二')).toMatch(/^-\s+一\n-\s+二$/)
  })
  it('コードブロックは中身が変わらない', () => {
    const md = '```\nlet s2 = s1;\nprintln!("{}", s1);\n```'
    expect(roundTrip(md)).toContain('let s2 = s1;\nprintln!("{}", s1);')
    expect(roundTrip(md)).toMatch(/^```/)
  })
  it('表は表のまま', () => {
    const out = roundTrip('| BPM | 30fps |\n|---|---|\n| 120 | 15 |')
    expect(out).toContain('| BPM | 30fps |')
    expect(out).toContain('| 120 | 15 |')
  })
  it('危険なHTMLは落とす', () => {
    expect(mdToHtml('<img src=x onerror="alert(1)"><script>alert(1)</script>')).not.toMatch(/onerror|<script/)
  })
})

describe('チェックリストの切り替え（#56）', () => {
  it('チェックボックスは disabled なしで描画される', () => {
    const html = mdToHtml('- [ ] 未\n- [x] 済')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('disabled')
    expect(html.match(/checked/g)).toHaveLength(1)
  })
  it('n 番目の項目だけ反転する（往復後の空白つきの形も）', () => {
    expect(toggleTask('- [ ] 未\n- [x] 済', 0)).toBe('- [x] 未\n- [x] 済')
    expect(toggleTask('- [ ] 未\n- [x] 済', 1)).toBe('- [ ] 未\n- [ ] 済')
    expect(toggleTask('-   [ ]  未\n-   [x]  済', 1)).toBe('-   [ ]  未\n-   [ ]  済')
    expect(toggleTask('1. [ ] 一\n   - [X] 子', 1)).toBe('1. [ ] 一\n   - [ ] 子')
  })
  it('範囲外やチェック項目以外は変えない', () => {
    expect(toggleTask('- [ ] 未', 3)).toBe('- [ ] 未')
    expect(toggleTask('本文 [ ] ではない', 0)).toBe('本文 [ ] ではない')
  })
})

import { describe, expect, it } from 'vitest'
import { htmlToMd, mdToHtml } from '../src/lib/md'

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

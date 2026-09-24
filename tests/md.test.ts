import { describe, expect, it } from 'vitest'
import { mdToHtml, toggleTask } from '../src/lib/md'

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

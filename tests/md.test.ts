import { describe, expect, it } from 'vitest'
import { mdToHtml, refIds, removeRef, toggleTask } from '../src/lib/md'

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

describe('本文の中の画像の参照記法 ![](img:ID)（#125）', () => {
  const images = [{ id: 'abcdefgh-1234', dataUrl: 'data:image/png;base64,AA==', alt: '' }]
  it('読み取りでは images[] の data URL の <img>、説明は空', () => {
    expect(mdToHtml('前\n\n![](img:abcdefgh-1234)\n\n後', images)).toContain('<img src="data:image/png;base64,AA==" alt="">')
  })
  it('編集ではチップ（contenteditable="false"・data-id が残る）。data URL は本文に入らない', () => {
    const html = mdToHtml('![](img:abcdefgh-1234)', images, 'edit')
    expect(html).toContain('<span class="imgref" contenteditable="false" data-id="abcdefgh-1234">[画像: abcdefgh]</span>')
    expect(html).not.toContain('data:image')
  })
  it('無い ID は「（消した画像）」。img: 以外の画像は今までどおり', () => {
    expect(mdToHtml('![](img:nothing)', images)).toContain('<span class="imgref missing" data-id="nothing">（消した画像）</span>')
    expect(mdToHtml('![説明](https://example.com/a.png)', images)).toContain('<img src="https://example.com/a.png" alt="説明">')
  })
  it('data:image/ でない画像は表示しない（#35）', () => {
    expect(mdToHtml('![](img:x)', [{ id: 'x', dataUrl: 'data:text/html,<b>x</b>', alt: '' }])).not.toContain('<img')
  })
  it('refIds は参照している id の集合、removeRef はその参照だけ消す', () => {
    const md = '前\n\n![](img:a)\n\n![](img:b)\n\n後'
    expect([...refIds(md)]).toEqual(['a', 'b'])
    expect(removeRef(md, 'a')).toBe('前\n\n![](img:b)\n\n後')
    expect(removeRef('![](img:a)', 'a')).toBe('')
    expect(removeRef(md, 'zzz')).toBe(md)
  })
})

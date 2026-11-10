import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { bookImages, bookToMarkdown, bookZip, imageExt } from '../src/lib/mdexport'
import { newBlock, newChapter, newLesson, newTextbook, type Textbook } from '../src/types'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const book = (): Textbook =>
  newTextbook('Rust 入門', {
    goal: '小さな\nツール',
    createdAt: '2026-11-09T01:02:03.000Z',
    chapters: [
      newChapter('一章', [
        newLesson('節A', {
          summary: 'この節の狙い',
          tasks: [{ text: 'やること', checked: false }],
          clues: {
            queries: ['rust 所有権'],
            links: [
              { title: '公式', url: 'https://doc.rust-lang.org/', fetchedAt: '' },
              { title: '危険', url: 'javascript:alert(1)', fetchedAt: '' },
            ],
            how: ['確かめ方'],
          },
          blocks: [
            newBlock('ai', '### 見出し\n\n前 ![](img:p1) 後', {
              images: [
                { id: 'p1', dataUrl: PNG, alt: '' },
                { id: 'p2', dataUrl: 'data:image/webp;base64,AAAA', alt: '' },
                { id: 'p3', dataUrl: 'data:text/html,<b>x</b>', alt: '' },
              ],
            }),
            newBlock('me', 'やってみた', { edited: true, quote: '引用の文\n二行目', source: 'https://example.com/a' }),
            newBlock('me', '消した参照 ![](img:gone)'),
          ],
        }),
        newLesson('節B'),
      ]),
      newChapter('二章'),
    ],
  })

describe('Markdown 書き出し（#136）', () => {
  const md = bookToMarkdown(book())

  it('frontmatter と # 章 / ## 節 / 狙い', () => {
    expect(
      md.startsWith('---\ntitle: "Rust 入門"\ngoal: "小さな\\nツール"\ncreated: 2026-11-09\n---\n\n# 一章\n\n## 節A\n\nこの節の狙い\n\n'),
    ).toBe(true)
    expect(md).toContain('\n## 節B\n')
    expect(md).toContain('\n# 二章\n')
  })

  it('本文の img:<ID> は相対パスに、参照していない画像は本文の直後に、無い ID は「（消した画像）」', () => {
    expect(md).toContain('### 見出し\n\n前 ![](img/p1.png) 後\n\n![](img/p2.webp)\n\n')
    expect(md).not.toContain('img:')
    expect(md).toContain('消した参照 （消した画像）')
    // 画像でない data URL は出さない
    expect(md).not.toContain('p3')
  })

  it('引用と出典はブロックの直後。参考情報は節末。http でないリンクは文字だけ', () => {
    expect(md).toContain('やってみた\n\n> 引用の文\n> 二行目\n\n出典: https://example.com/a\n')
    expect(md).toContain('\n**参考情報**\n- 検索: rust 所有権\n- [公式](https://doc.rust-lang.org/)\n- 危険\n')
    expect(md).not.toContain('javascript:')
  })

  it('書き手の印・手を動かす・確かめ方は出ない', () => {
    expect(md).not.toContain('やること')
    expect(md).not.toContain('確かめ方')
    expect(md).not.toContain('- [ ]')
    expect(md).not.toMatch(/AI ?の下書き|自分のノート|自分で修正/)
  })

  it('画像は img/<ID>.<拡張子> のバイト列。壊れた data URL は飛ばす', () => {
    const imgs = bookImages(book())
    expect(Object.keys(imgs)).toEqual(['img/p1.png', 'img/p2.webp'])
    expect([...imgs['img/p1.png'].slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    const broken = newTextbook('b', {
      chapters: [
        newChapter('c', [
          newLesson('l', { blocks: [newBlock('me', '', { images: [{ id: 'x', dataUrl: 'data:image/png;base64,@@', alt: '' }] })] }),
        ]),
      ],
    })
    expect(bookImages(broken)).toEqual({})
  })

  it('zip は <名前>.md と img/ を持つ', () => {
    const files = unzipSync(bookZip(book()))
    expect(Object.keys(files).sort()).toEqual(['Rust_入門.md', 'img/p1.png', 'img/p2.webp'])
    expect(strFromU8(files['Rust_入門.md'])).toBe(md)
  })

  it('拡張子は MIME から', () => {
    expect(imageExt('data:image/jpeg;base64,AA')).toBe('jpg')
    expect(imageExt('data:image/svg+xml;base64,AA')).toBe('svg')
    expect(imageExt('data:image/webp;base64,AA')).toBe('webp')
    expect(imageExt('data:text/html,<b>')).toBeNull()
    expect(imageExt('https://example.com/a.png')).toBeNull()
  })
})

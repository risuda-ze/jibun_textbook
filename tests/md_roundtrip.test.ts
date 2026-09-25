/**
 * 見たまま編集の往復（md → HTML → md）で、記法ごとに何が保たれるかを固定する。
 * docs/markdown_roundtrip.md の結果表はこのファイルの期待値と対応させる。表を変えるときはここも変える。
 *
 * 判定の意味:
 *   same   … 往復後の Markdown が入力と一字一句同じ
 *   equiv  … 文字列は変わるが、もう一度描画すると同じ HTML になる（意味は同じ）
 *   stable … 2回目の往復で変わらない（往復のたびに変わり続けない）
 */
import { describe, expect, it } from 'vitest'
import { htmlToMd, mdToHtml } from '../src/lib/md'

const back = (md: string) => htmlToMd(mdToHtml(md))
const equiv = (md: string) => mdToHtml(back(md)) === mdToHtml(md)
const stable = (md: string) => back(back(md)) === back(md)

describe('往復で一字一句保たれる（same）', () => {
  const cases: [string, string][] = [
    ['見出し', '# 見出し1\n\n## 見出し2\n\n### 見出し3'],
    ['強調と斜体', '本文に**強調**と*斜体*と***両方***がある。'],
    ['コードブロック', '```\nlet s2 = s1;\nprintln!("{}", s1);\n```'],
    ['言語つきコードブロック', '```rust\nfn main() {}\n```'],
    ['インラインコード', '`cargo run` を実行する'],
    ['リンク', '[Rust Book](https://doc.rust-lang.org/book/) を読む'],
    ['画像', '![説明](https://example.com/a.png)'],
    ['画像（data URL）', '![](data:image/png;base64,iVBORw0KGgo=)'],
    ['段落', '一段落目\n\n二段落目'],
    ['単一改行（breaks: true で <br>。#148 で行末の空白2つを付けない）', '一行目\n二行目'],
    ['引用', '> 引用した文\n> 二行目'],
    ['エスケープ', '1 < 2 && 3 > 2 の "引用符"'],
    ['長い文', 'あ'.repeat(120)],
  ]
  for (const [name, md] of cases) it(name, () => expect(back(md)).toBe(md))
})

describe('文字列は変わるが意味は同じ（equiv・stable）', () => {
  const cases: [string, string, string][] = [
    ['取り消し線（~~ が ~ になる）', '~~消した~~文', '~消した~文'],
    ['箇条書き（記号の後の空白が3つになる）', '- 一\n- 二\n- 三', '-   一\n-   二\n-   三'],
    ['番号付き（番号の後の空白が2つになる）', '1. 一\n2. 二\n3. 三', '1.  一\n2.  二\n3.  三'],
    ['入れ子のリスト（字下げが4つになる）', '- 親\n  - 子\n    - 孫\n- 親2', '-   親\n    -   子\n        -   孫\n-   親2'],
    ['番号付きの入れ子', '1. 一\n   - 一の子\n   - 一の子2\n2. 二', '1.  一\n    -   一の子\n    -   一の子2\n2.  二'],
    ['表（区切り行が | --- | になる）', '| BPM | 30fps |\n|---|---|\n| 120 | 15 |', '| BPM | 30fps |\n| --- | --- |\n| 120 | 15 |'],
    ['表の揃え', '| 左 | 中 | 右 |\n|:--|:-:|--:|\n| a | b | c |', '| 左 | 中 | 右 |\n| :-- | :-: | --: |\n| a | b | c |'],
    ['水平線（--- が * * * になる）', '上\n\n---\n\n下', '上\n\n* * *\n\n下'],
    ['チェックリスト（記号の後の空白が3つになる。箱はクリックで切り替えられる #56）', '- [ ] 未\n- [x] 済', '-   [ ] 未\n-   [x] 済'],
    ['アスタリスクの文字（#147: エスケープしない。単独の * は文字のまま）', '価格は 5*3 で 15 です', '価格は 5*3 で 15 です'],
    [
      '表の中の改行（<br> のまま残る #48）',
      '| 項目 | 説明 |\n|---|---|\n| A | 一行目<br>二行目 |',
      '| 項目 | 説明 |\n| --- | --- |\n| A | 一行目<br>二行目 |',
    ],
  ]
  for (const [name, md, expected] of cases) {
    it(name, () => {
      expect(back(md)).toBe(expected)
      expect(equiv(md)).toBe(true)
      expect(stable(md)).toBe(true)
    })
  }
})

describe('本文の中の画像の参照記法（#125）', () => {
  const images = [{ id: 'abcdefgh-1234', dataUrl: 'data:image/png;base64,AA==', alt: '' }]
  const backEdit = (md: string) => htmlToMd(mdToHtml(md, images, 'edit'))
  it('編集のチップは往復で一字一句 ![](img:ID) に戻る（文の途中でも・無い ID でも）', () => {
    for (const md of ['前\n\n![](img:abcdefgh-1234)\n\n後', '文の途中に![](img:abcdefgh-1234)置く', '![](img:nothing)'])
      expect(backEdit(md)).toBe(md)
  })
})

describe('見たまま編集の Enter は行（<br>）、空行は段落（#148）', () => {
  it('1行ずつ <br> で打った表は Markdown の表になる', () => {
    const md = htmlToMd('<p>本文。<br>|a|b|<br>|-|-|<br>|1|2|</p>')
    expect(md).toBe('本文。\n|a|b|\n|-|-|\n|1|2|')
    expect(mdToHtml(md)).toContain('<table')
    expect(stable(md)).toBe(true)
  })
  it('<br> で打ったリストは tight list になる（<li> の中に <p> が無い）', () => {
    // 「- 」は #146（エスケープ無効化）が入るまで \\- になるため、turndown がエスケープしない「1) 」で確かめる
    const md = htmlToMd('<p>1) 一<br>2) 二</p>')
    expect(md).toBe('1) 一\n2) 二')
    expect(mdToHtml(md)).toContain('<li>一</li>')
  })
  it('<br> が2つ続く（空行）と段落の区切り \\n\\n になる', () => {
    expect(htmlToMd('<p>一段落目<br><br>二段落目</p>')).toBe('一段落目\n\n二段落目')
    // ブラウザがブロックを分けたときの空の段落と末尾の <br> は消える
    expect(htmlToMd('<p>一段落目<br><br></p><p><br></p><p>二段落目</p>')).toBe('一段落目\n\n二段落目')
  })
  it('li の末尾に残った <br> は消え、tight list のまま（Enter 2回で次の項目にしたとき）', () => {
    const md = htmlToMd('<ul><li>一<br><br></li><li>二</li></ul>')
    expect(md).toBe('-   一\n-   二')
    expect(mdToHtml(md)).toContain('<li>一</li>')
  })
})

describe('崩れる・落ちる（意図したものと、直す対象）', () => {
  it('HTML の直書きは、許可された要素だけ残り、style などの装飾は落ちる（意図どおり。DOMPurify）', () => {
    expect(back('<b>太字</b>と<span style="color:red">赤</span>')).toBe('**太字**と赤')
  })
  it('危険な HTML は落ちる', () => {
    expect(mdToHtml('<img src=x onerror="alert(1)"><script>alert(1)</script>')).not.toMatch(/onerror|<script/)
    // 本文に直書きした target は落とし、同一タブで開く（#88）
    expect(mdToHtml('<a href="https://example.com" target="_blank">x</a>')).not.toMatch(/target=/)
  })
})

describe('見たまま編集で文字として打った記法は Markdown として扱う（#76 #145 → #147）', () => {
  it('[文](URL) はリンクになる', () => {
    const md = htmlToMd('<p>編集中に [ツール](https://creatools.dev/color-palette) を使うと</p>')
    expect(md).toBe('編集中に [ツール](https://creatools.dev/color-palette) を使うと')
    expect(mdToHtml(md)).toContain('<a href="https://creatools.dev/color-palette">ツール</a>')
    expect(stable(md)).toBe(true)
  })
  it('**文** と `文` は太字・コードになる', () => {
    const md = htmlToMd('<p>それぞれの効果を確認する。**パンク・膨張**：パスの点を `Alt` で動かす</p>')
    expect(md).toBe('それぞれの効果を確認する。**パンク・膨張**：パスの点を `Alt` で動かす')
    expect(mdToHtml(md)).toContain('<strong>パンク・膨張</strong>')
    expect(mdToHtml(md)).toContain('<code>Alt</code>')
    expect(stable(md)).toBe(true)
  })
  it('段落の先頭の # と - は見出し・箇条書きになる（入力欄と同じ規則）', () => {
    const md = htmlToMd('<p># 見出し</p><p>- 一</p><p>- 二</p>')
    expect(mdToHtml(md)).toContain('<h1>見出し</h1>')
    expect(mdToHtml(md)).toMatch(/<li>(?:<p>)?一(?:<\/p>)?\s*<\/li>\s*<li>(?:<p>)?二/)
  })
  it('対になっていない * や空白で囲まれた * は文字のまま（CommonMark の規則）', () => {
    const md = htmlToMd('<p>2 * 3 = 6 と **強調 の片割れ</p>')
    expect(md).toBe('2 * 3 = 6 と **強調 の片割れ')
    expect(mdToHtml(md)).not.toContain('<strong>')
  })
  it('文字として保ちたい記号は自分で \\ を付ける（入力欄と同じ）', () => {
    const md = htmlToMd('<p>\\*注\\* は文字</p>')
    expect(md).toBe('\\*注\\* は文字')
    expect(mdToHtml(md)).toContain('*注*')
    expect(mdToHtml(md)).not.toContain('<em>')
  })
})

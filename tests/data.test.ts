import { describe, expect, it } from 'vitest'
import { TextbookZ, newBlock, newChapter, newLesson, newTextbook, type Textbook } from '../src/types'
import { currentLesson, lessonNo, lessonStatus, minePercent, statusCounts } from '../src/lib/status'
import { asCopy, decideImport, exportJson, parseImport } from '../src/lib/io'
import { fitSize } from '../src/lib/image'

const book = (): Textbook =>
  newTextbook('テスト', {
    chapters: [
      newChapter('一章', [
        newLesson('空の節'),
        newLesson('AIだけ', { blocks: [newBlock('ai', '本文')] }),
        newLesson('ノートあり', { blocks: [newBlock('ai', '本文'), newBlock('me', 'やってみた')] }),
        newLesson('直した', { blocks: [newBlock('ai', '本文', { edited: true })] }),
        newLesson('完了', { done: true, review: true, blocks: [newBlock('ai', '本文')] }),
      ]),
    ],
  })

describe('節の状態は保存せず導出する', () => {
  const tb = book()
  const [none, ai, me, edited, done] = tb.chapters[0].lessons
  it('4状態', () => {
    expect(lessonStatus(none)).toBe('none')
    expect(lessonStatus(ai)).toBe('ai')
    expect(lessonStatus(me)).toBe('me')
    expect(lessonStatus(edited)).toBe('me')
    expect(lessonStatus(done)).toBe('done')
  })
  it('再確認の旗は状態と独立', () => {
    expect(done.review).toBe(true)
    expect(lessonStatus({ ...ai, review: true })).toBe('ai')
  })
  it('集計・現在地・番号', () => {
    expect(statusCounts(tb)).toEqual({ none: 1, ai: 1, me: 2, done: 1 })
    expect(currentLesson(tb)?.title).toBe('空の節')
    expect(lessonNo(tb, me.id)).toBe('1-3')
    const allDone = { ...tb, chapters: [{ ...tb.chapters[0], lessons: tb.chapters[0].lessons.map((l) => ({ ...l, done: true })) }] }
    expect(currentLesson(allDone)).toBeNull()
  })
  it('自分の言葉の割合', () => {
    expect(minePercent(none)).toBe(0)
    expect(minePercent(ai)).toBe(0)
    expect(minePercent(edited)).toBe(100)
    expect(minePercent(me)).toBeGreaterThan(0)
  })
})

describe('JSONの書き出しと読み込み', () => {
  it('往復しても同じ', () => {
    const tb = book()
    const r = parseImport(exportJson(tb))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.tb).toEqual(TextbookZ.parse(tb))
  })
  it('書き出しJSONに教科書以外の項目（APIキー等）は入らない', () => {
    const dirty = { ...book(), apiKey: 'sk-ant-SECRET', ai: { apiKey: 'sk-ant-SECRET' } } as unknown as Textbook
    const json = exportJson(dirty)
    expect(json).not.toContain('SECRET')
    expect(json).not.toContain('apiKey')
  })
  it('壊れたJSON・別物・未知の版は理由つきで断る', () => {
    expect(parseImport('{oops')).toMatchObject({ ok: false })
    expect(parseImport('[1,2]')).toMatchObject({ ok: false })
    const v2 = parseImport(JSON.stringify({ ...book(), schemaVersion: 2 }))
    expect(v2.ok).toBe(false)
    if (!v2.ok) expect(v2.reason).toContain('schemaVersion: 2')
    expect(parseImport(JSON.stringify({ schemaVersion: 1, id: 'x' })).ok).toBe(false)
  })
  it('欠けている項目は既定値で補う', () => {
    const r = parseImport(JSON.stringify({
      schemaVersion: 1, id: 'a', title: 't', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      chapters: [{ id: 'c', title: 'c', lessons: [{ id: 'l', title: 'l' }] }],
    }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.tb.chapters[0].lessons[0]).toMatchObject({ done: false, review: false, blocks: [] })
  })
})

describe('読み込み時の上書き判定', () => {
  const base = book()
  const at = (iso: string): Textbook => ({ ...base, updatedAt: iso })
  it('端末に無ければ追加', () => expect(decideImport(undefined, base)).toBe('add'))
  it('読み込む側が新しければ自動で上書き', () => expect(decideImport(at('2026-09-01T00:00:00Z'), at('2026-09-02T00:00:00Z'))).toBe('overwrite'))
  it('読み込む側が古ければ警告', () => expect(decideImport(at('2026-09-02T00:00:00Z'), at('2026-09-01T00:00:00Z'))).toBe('older'))
  it('同じ日時なら何もしない', () => expect(decideImport(at('2026-09-02T00:00:00Z'), at('2026-09-02T00:00:00Z'))).toBe('same'))
  it('別の本として追加するとidが変わる', () => {
    const c = asCopy(base)
    expect(c.id).not.toBe(base.id)
  })
})

describe('画像の縮小サイズ', () => {
  it('長辺1600pxに収める。小さい画像は拡大しない', () => {
    expect(fitSize(3200, 1800)).toEqual({ w: 1600, h: 900 })
    expect(fitSize(1080, 2400)).toEqual({ w: 720, h: 1600 })
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
    expect(fitSize(1600, 1600)).toEqual({ w: 1600, h: 1600 })
  })
})

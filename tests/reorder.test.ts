import { describe, expect, it } from 'vitest'
import { newBlock, newChapter, newLesson, newTextbook, type Textbook } from '../src/types'
import { lessonNo } from '../src/lib/status'
import { moveChapter, moveLesson, moveLessonToChapter } from '../src/lib/reorder'

const book = (): Textbook =>
  newTextbook('テスト', {
    chapters: [
      newChapter('一章', [
        newLesson('完了', { done: true, review: true, blocks: [newBlock('ai', '本文'), newBlock('me', 'ノート')] }),
        newLesson('二つ目'),
        newLesson('三つ目'),
      ]),
      newChapter('二章', [newLesson('二章の節')]),
      newChapter('三章', [newLesson('三章の節')]),
    ],
  })

const titles = (tb: Textbook, ci: number) => tb.chapters[ci].lessons.map((l) => l.title)

describe('節の上下（#11）', () => {
  it('下へ。id・完了・再確認・本文はそのまま。元は変えない', () => {
    const tb = book()
    const l = tb.chapters[0].lessons[0]
    const out = moveLesson(tb, l.id, 1)
    expect(titles(out, 0)).toEqual(['二つ目', '完了', '三つ目'])
    expect(titles(tb, 0)).toEqual(['完了', '二つ目', '三つ目'])
    expect(lessonNo(out, l.id)).toBe('1-2')
    const moved = out.chapters[0].lessons[1]
    expect(moved.id).toBe(l.id)
    expect(moved.done).toBe(true)
    expect(moved.review).toBe(true)
    expect(moved.blocks).toBe(l.blocks)
  })
  it('上へ', () => {
    const tb = book()
    const out = moveLesson(tb, tb.chapters[0].lessons[2].id, -1)
    expect(titles(out, 0)).toEqual(['完了', '三つ目', '二つ目'])
  })
  it('端と無い id は動かさない（同じ教科書を返す）', () => {
    const tb = book()
    expect(moveLesson(tb, tb.chapters[0].lessons[0].id, -1)).toBe(tb)
    expect(moveLesson(tb, tb.chapters[0].lessons[2].id, 1)).toBe(tb)
    expect(moveLesson(tb, 'nope', 1)).toBe(tb)
  })
})

describe('別の章へ（#11）', () => {
  it('移動先の末尾に入る。番号は位置から変わる', () => {
    const tb = book()
    const l = tb.chapters[0].lessons[0]
    const out = moveLessonToChapter(tb, l.id, tb.chapters[1].id)
    expect(titles(out, 0)).toEqual(['二つ目', '三つ目'])
    expect(titles(out, 1)).toEqual(['二章の節', '完了'])
    expect(lessonNo(out, l.id)).toBe('2-2')
    expect(out.chapters[1].lessons[1]).toBe(l)
    expect(titles(tb, 0)).toEqual(['完了', '二つ目', '三つ目'])
  })
  it('元の章が空になったら章ごと消える', () => {
    const tb = book()
    const out = moveLessonToChapter(tb, tb.chapters[1].lessons[0].id, tb.chapters[2].id)
    expect(out.chapters.map((c) => c.title)).toEqual(['一章', '三章'])
    expect(titles(out, 1)).toEqual(['三章の節', '二章の節'])
  })
  it('同じ章・無い章は動かさない', () => {
    const tb = book()
    expect(moveLessonToChapter(tb, tb.chapters[0].lessons[0].id, tb.chapters[0].id)).toBe(tb)
    expect(moveLessonToChapter(tb, tb.chapters[0].lessons[0].id, 'nope')).toBe(tb)
  })
})

describe('章の上下（#11）', () => {
  it('下へ。節の番号は章に追従する', () => {
    const tb = book()
    const l = tb.chapters[0].lessons[1]
    const out = moveChapter(tb, tb.chapters[0].id, 1)
    expect(out.chapters.map((c) => c.title)).toEqual(['二章', '一章', '三章'])
    expect(out.chapters[1]).toBe(tb.chapters[0])
    expect(lessonNo(out, l.id)).toBe('2-2')
    expect(tb.chapters.map((c) => c.title)).toEqual(['一章', '二章', '三章'])
  })
  it('端は動かさない', () => {
    const tb = book()
    expect(moveChapter(tb, tb.chapters[0].id, -1)).toBe(tb)
    expect(moveChapter(tb, tb.chapters[2].id, 1)).toBe(tb)
    expect(moveChapter(tb, 'nope', 1)).toBe(tb)
  })
})

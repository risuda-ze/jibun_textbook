import { describe, expect, it } from 'vitest'
import { newBlock, newChapter, newLesson, newTextbook } from '../src/types'
import { EXPORT_WARN_DAYS, exportWarning, localDay } from '../src/lib/status'

const DAY = 86400000
const now = Date.parse('2026-09-23T12:00:00.000Z')
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString()

function book(withMine: boolean) {
  return newTextbook('t', { chapters: [newChapter('c', [newLesson('l', { blocks: withMine ? [newBlock('me', '自分の言葉')] : [newBlock('ai', '下書き')] })])] })
}

describe('exportWarning（#16）', () => {
  it('自分の書き込みが無ければ知らせない（一度も書き出していなくても）', () => {
    expect(exportWarning(book(false), undefined, now)).toBeNull()
    expect(exportWarning(book(false), iso(30), now)).toBeNull()
  })
  it('自分の書き込みがあり一度も書き出していなければ days: null', () => {
    expect(exportWarning(book(true), undefined, now)).toEqual({ days: null })
  })
  it('最後の書き出しから 7 日以上なら日数を返し、それより前なら知らせない', () => {
    expect(exportWarning(book(true), iso(EXPORT_WARN_DAYS - 1), now)).toBeNull()
    expect(exportWarning(book(true), iso(EXPORT_WARN_DAYS), now)).toEqual({ days: 7 })
    expect(exportWarning(book(true), iso(30), now)).toEqual({ days: 30 })
  })
  it('書き出した直後は知らせない', () => {
    expect(exportWarning(book(true), iso(0), now)).toBeNull()
  })
})

describe('localDay', () => {
  it('端末のローカル日付を YYYY-MM-DD で返す', () => {
    const d = new Date(2026, 0, 5, 9, 0, 0)
    expect(localDay(d.getTime())).toBe('2026-01-05')
  })
})

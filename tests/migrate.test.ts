import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, migrate } from '../src/lib/migrate'
import { TextbookZ, findDuplicateIds, newBlock, newChapter, newLesson, newTextbook } from '../src/types'

const v1 = () => JSON.parse(readFileSync('tests/fixtures/textbook_v1.json', 'utf8')) as Record<string, unknown>

describe('migrate（#65）', () => {
  it('今の版の見本はそのまま通り、直した所が無い', () => {
    expect(CURRENT_VERSION).toBe(TextbookZ.shape.schemaVersion.value)
    const r = migrate(v1())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.from).toBe(CURRENT_VERSION)
      expect(r.steps).toEqual([])
      expect(r.tb.schemaVersion).toBe(CURRENT_VERSION)
    }
  })
  it('教科書の JSON でない・版が無い・新しすぎる、は理由を返す', () => {
    expect(migrate(null)).toMatchObject({ ok: false, reason: '教科書のJSONではありません。' })
    expect(migrate([1])).toMatchObject({ ok: false })
    expect(migrate({ id: 'x' })).toMatchObject({ ok: false, from: null })
    const newer = migrate({ ...v1(), schemaVersion: CURRENT_VERSION + 1 })
    expect(newer.ok).toBe(false)
    if (!newer.ok) expect(newer.reason).toContain(`schemaVersion: ${CURRENT_VERSION + 1}`)
  })
  it('移行関数が無い古い版は理由を返す', () => {
    const r = migrate({ ...v1(), schemaVersion: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('版 0 から 1 への移行')
  })
  it('移行表に関数があれば1段ずつ当てて今の版にし、steps に残す', () => {
    // 見本: 版 0 は題名を name に持っていた、という想定
    const old = { ...v1(), schemaVersion: 0, name: '古い題名' } as Record<string, unknown>
    delete old.title
    const r = migrate(old, { table: { 0: (o) => ({ ...o, title: o.name }) } })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.from).toBe(0)
      expect(r.tb.title).toBe('古い題名')
      expect(r.tb.schemaVersion).toBe(1)
      expect(r.steps).toEqual(['版 0 から 1 に移行しました'])
    }
  })
  it('2段の移行も順に当たる（テスト用に今の版を 2 にする）', () => {
    const calls: number[] = []
    const r = migrate(
      { ...v1(), schemaVersion: 0 },
      {
        current: 2,
        table: {
          0: (o) => {
            calls.push(0)
            return o
          },
          1: (o) => {
            calls.push(1)
            return o
          },
        },
      },
    )
    // 版 2 の形は TextbookZ（版 1）に合わないので検証で落ちるが、移行は順に呼ばれている
    expect(calls).toEqual([0, 1])
    expect(r.ok).toBe(false)
  })
  it('id の重複と日時の欠落を直し、steps に残す', () => {
    const tb = newTextbook('t', { chapters: [newChapter('c', [newLesson('a', { blocks: [newBlock('ai', 'x')] }), newLesson('b')])] })
    tb.chapters[0].lessons[1].id = tb.chapters[0].lessons[0].id
    const raw = { ...tb, updatedAt: undefined, createdAt: 'not a date' } as unknown as Record<string, unknown>
    const r = migrate(raw)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(findDuplicateIds(r.tb)).toEqual([])
      expect(r.tb.chapters[0].lessons.map((l) => l.title)).toEqual(['a', 'b'])
      expect(Number.isNaN(Date.parse(r.tb.createdAt))).toBe(false)
      expect(r.tb.updatedAt).toBe(r.tb.createdAt)
      expect(r.steps).toEqual([
        '作成日時が無かったので補いました',
        '更新日時が無かったので作成日時で補いました',
        '重複していた id を 1 件振り直しました',
      ])
    }
  })
  it('形式が壊れていれば場所つきで断る', () => {
    const r = migrate({ ...v1(), chapters: 'oops' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('chapters')
  })
})

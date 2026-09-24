import { beforeEach, describe, expect, it } from 'vitest'
import { clear } from 'idb-keyval'
import { generateInto, mergeDraft } from '../src/ui/generate'
import { getStateForTest, init, putBook } from '../src/store'
import { DEFAULT_AI } from '../src/ai/types'
import { newBlock, newChapter, newLesson, newTextbook } from '../src/types'

const draft = () => ({
  blocks: ['### 本文', '', '  ', '### 要点'],
  tasks: ['試す', '書く'],
  clues: { queries: ['q1', 'q2'], links: [{ title: 'A', url: 'https://a.example/', fetchedAt: '2026-09-24' }, { title: 'B', url: 'https://b.example/', fetchedAt: '2026-09-24' }], how: ['h1'] },
})

describe('mergeDraft（#83）', () => {
  it('本文は自分のノートの後ろに足し、空の要素は捨てる', () => {
    const l = newLesson('l', { blocks: [newBlock('me', '待っている間に書いた')] })
    mergeDraft(l, draft(), [])
    expect(l.blocks.map((b) => [b.by, b.md])).toEqual([['me', '待っている間に書いた'], ['ai', '### 本文'], ['ai', '### 要点']])
  })
  it('手を動かすは、まだ無いときだけ採用する', () => {
    const empty = newLesson('l')
    mergeDraft(empty, draft(), [])
    expect(empty.tasks).toEqual([{ text: '試す', checked: false }, { text: '書く', checked: false }])
    const mine = newLesson('l', { tasks: [{ text: '自分のやること', checked: true }] })
    mergeDraft(mine, draft(), [])
    expect(mine.tasks).toEqual([{ text: '自分のやること', checked: true }])
  })
  it('参考情報は重複を除いて足し、リンクは URL が同じものを足さない', () => {
    const l = newLesson('l', { clues: { queries: ['q1'], links: [{ title: '既にある A', url: 'https://a.example/', fetchedAt: '2026-09-01' }], how: ['h0'] } })
    mergeDraft(l, draft(), [])
    expect(l.clues.queries).toEqual(['q1', 'q2'])
    expect(l.clues.links.map((x) => x.title)).toEqual(['既にある A', 'B'])
    expect(l.clues.how).toEqual(['h0', 'h1'])
  })
  it('元にした資料は名前だけ残し、重複しない', () => {
    const l = newLesson('l', { materials: ['notes.md'] })
    mergeDraft(l, draft(), ['notes.md', 'paper.pdf'])
    expect(l.materials).toEqual(['notes.md', 'paper.pdf'])
  })
})

describe('generateInto（デモ応答で通す）', () => {
  beforeEach(async () => { await clear(); await init() })
  const book = () => newTextbook('t', { chapters: [newChapter('c', [newLesson('最初の節')])] })
  const tick = () => new Promise((r) => setTimeout(r, 0))

  it('成功すると本文・手を動かす・参考情報が節に入り、知らせが出る', async () => {
    const tb = book(); putBook(tb); await tick()
    const id = tb.chapters[0].lessons[0].id
    const steps: number[] = []
    const ok = await generateInto(tb, id, { ...DEFAULT_AI, kind: 'demo' }, (s) => steps.push(s))
    expect(ok).toBe(true)
    expect(steps).toEqual([0, 1, 2])
    const l = getStateForTest().books[0].chapters[0].lessons[0]
    expect(l.blocks).toHaveLength(3)
    expect(l.blocks.every((b) => b.by === 'ai')).toBe(true)
    expect(l.tasks.length).toBeGreaterThan(0)
    expect(l.clues.queries.length).toBeGreaterThan(0)
    expect(getStateForTest().toast?.msg).toContain('資料を生成しました')
  })
  it('失敗しても教科書は変えず、理由を知らせる（未対応の接続先）', async () => {
    const tb = book(); putBook(tb); await tick()
    const id = tb.chapters[0].lessons[0].id
    const ok = await generateInto(tb, id, { ...DEFAULT_AI, kind: 'compat' }, () => {})
    expect(ok).toBe(false)
    expect(getStateForTest().books[0].chapters[0].lessons[0].blocks).toEqual([])
    expect(getStateForTest().toast?.msg).toContain('まだ使用できません')
  })
  it('中止すると教科書は変えず、短く知らせる', async () => {
    const tb = book(); putBook(tb); await tick()
    const id = tb.chapters[0].lessons[0].id
    const c = new AbortController()
    const p = generateInto(tb, id, { ...DEFAULT_AI, kind: 'demo' }, () => {}, c.signal)
    c.abort()
    expect(await p).toBe(false)
    expect(getStateForTest().books[0].chapters[0].lessons[0].blocks).toEqual([])
    expect(getStateForTest().toast?.msg).toBe('生成をやめました')
  })
})

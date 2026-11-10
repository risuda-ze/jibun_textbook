import { beforeEach, describe, expect, it, vi } from 'vitest'

// idb-keyval を差し替え、set / del を失敗させられるようにする（#80）
const fail = { set: 0, del: 0 }
vi.mock('idb-keyval', async (orig) => {
  const m = await orig<typeof import('idb-keyval')>()
  return {
    ...m,
    set: async (k: IDBValidKey, v: unknown) => {
      if (fail.set > 0) {
        fail.set--
        throw new Error('quota')
      }
      return m.set(k, v)
    },
    del: async (k: IDBValidKey) => {
      if (fail.del > 0) {
        fail.del--
        throw new Error('io')
      }
      return m.del(k)
    },
  }
})

import { clear, get, set } from 'idb-keyval'
import { getStateForTest, init, putBook, removeBook, setAi, setDraft, updateBook } from '../src/store'
import { emptyDraft } from '../src/types'
import { DEFAULT_AI } from '../src/ai/types'
import { newChapter, newLesson, newTextbook } from '../src/types'

const tick = () => new Promise((r) => setTimeout(r, 0))
const book = (title = 't') => newTextbook(title, { chapters: [newChapter('c', [newLesson('l')])] })

beforeEach(async () => {
  await clear()
  fail.set = 0
  fail.del = 0
  await init()
})

describe('store（#80）', () => {
  it('init: 壊れたデータは broken に、id の重複は直して書き戻す', async () => {
    const dup = book('dup')
    dup.chapters[0].lessons.push({ ...newLesson('x'), id: dup.chapters[0].lessons[0].id })
    await set('tb:broken', { nonsense: true })
    await set('tb:' + dup.id, dup)
    await init()
    const s = getStateForTest()
    expect(s.broken.map((b) => b.key)).toEqual(['tb:broken'])
    expect(s.books.map((b) => b.title)).toEqual(['dup'])
    const saved = (await get('tb:' + dup.id)) as typeof dup
    expect(new Set(saved.chapters[0].lessons.map((l) => l.id)).size).toBe(2)
  })
  it('init: 設定が読めなくても教科書は本棚に出る', async () => {
    await set('tb:' + book('a').id, book('a'))
    await set('settings', 1) // 壊れた設定（get は成功するが形が違う）
    await init()
    expect(getStateForTest().books).toHaveLength(1)
    expect(getStateForTest().ai.kind).toBe('anthropic')
  })
  it('init: 消した接続先（compat / local）が設定に残っていれば Anthropic にする（#127）', async () => {
    await set('settings', { ai: { ...DEFAULT_AI, kind: 'compat' } })
    await init()
    expect(getStateForTest().ai.kind).toBe('anthropic')
  })
  it('putBook: 書き込みに失敗したら、その教科書だけ元に戻す', async () => {
    const a = book('a')
    const b = book('b')
    putBook(a)
    putBook(b)
    await tick()
    fail.set = 1
    updateBook(a.id, (d) => {
      d.title = 'a2'
    })
    await tick()
    const titles = getStateForTest()
      .books.map((x) => x.title)
      .sort()
    expect(titles).toEqual(['a', 'b'])
    expect(getStateForTest().toast?.msg).toContain('保存できませんでした')
  })
  it('putBook: 1回目が失敗しても2回目が成功していれば2回目の内容が残る', async () => {
    const a = book('a')
    putBook(a)
    await tick()
    fail.set = 1
    updateBook(a.id, (d) => {
      d.title = 'a2'
    }) // 失敗する
    updateBook(a.id, (d) => {
      d.title = 'a3'
    }) // 成功する
    await tick()
    expect(getStateForTest().books.find((x) => x.id === a.id)?.title).toBe('a3')
    expect(((await get('tb:' + a.id)) as { title: string }).title).toBe('a3')
  })
  it('removeBook: 消せなかったら本棚に戻して知らせる。消せたら元に戻すで復活する', async () => {
    const a = book('a')
    const b = book('b')
    putBook(a)
    putBook(b)
    await tick()
    fail.del = 1
    removeBook(a.id)
    await tick()
    expect(getStateForTest().books.map((x) => x.id)).toContain(a.id)
    expect(getStateForTest().toast?.msg).toContain('消せませんでした')
    removeBook(a.id)
    await tick()
    expect(getStateForTest().books.map((x) => x.id)).not.toContain(a.id)
    getStateForTest().toast?.undo?.()
    await tick()
    expect(getStateForTest().books.map((x) => x.id)).toContain(a.id)
  })
  it('setDraft: 節ごとに下書きを持ち、空にすると消える', () => {
    setDraft('l1', { ...emptyDraft(), md: '書きかけ' })
    setDraft('l2', { ...emptyDraft(), quote: '引用' })
    expect(Object.keys(getStateForTest().drafts).sort()).toEqual(['l1', 'l2'])
    setDraft('l1', emptyDraft())
    expect(Object.keys(getStateForTest().drafts)).toEqual(['l2'])
  })
  it('setAi: 保存できたかを返し、失敗したら知らせる', async () => {
    expect(await setAi({ model: 'm' })).toBe(true)
    fail.set = 1
    expect(await setAi({ model: 'n' })).toBe(false)
    expect(getStateForTest().toast?.msg).toContain('保存できませんでした')
  })
})

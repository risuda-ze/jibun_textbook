import { describe, expect, it } from 'vitest'
import { newBlock, newChapter, newLesson, newTextbook } from '../src/types'
import { applyChapterPlan, applyCoursePlan, applyLessonRegen, diffLessonRegen, diffTextbooks, type PlanLesson } from '../src/lib/protect'

const P = (id: string | null, title: string): PlanLesson => ({ id, title, minutes: 30, isTask: false, summary: '' })

function fixture() {
  const draft = newLesson('AIだけの節', { blocks: [newBlock('ai', '下書き')] })
  const noted = newLesson('ノートのある節', {
    blocks: [newBlock('ai', '下書きA'), newBlock('me', '自分のノート'), newBlock('ai', '直した文', { edited: true }), newBlock('ai', '下書きB')],
  })
  const done = newLesson('完了の節', { done: true, blocks: [newBlock('ai', '確認済みの本文')] })
  const empty = newLesson('未作成の節')
  const ch1 = newChapter('一章', [draft, noted, done, empty])
  const ch2 = newChapter('二章', [newLesson('二章の節')])
  return { tb: newTextbook('本', { chapters: [ch1, ch2] }), draft, noted, done, empty, ch1, ch2 }
}

describe('この節だけ作り直す', () => {
  it('AIの下書きだけ置き換え、自分のノートと直した文は位置も中身も残る', () => {
    const { noted } = fixture()
    const r = applyLessonRegen(noted, ['新A', '新B', '新C'])
    expect(r.blocks.map((b) => b.md)).toEqual(['新A', '自分のノート', '直した文', '新B', '新C'])
    expect(r.blocks[1]).toBe(noted.blocks[1])
    expect(r.blocks[2]).toBe(noted.blocks[2])
  })
  it('新しい下書きが少なくても、自分の文は消えない', () => {
    const { noted } = fixture()
    expect(applyLessonRegen(noted, ['新A']).blocks.map((b) => b.md)).toEqual(['新A', '自分のノート', '直した文'])
    expect(applyLessonRegen(noted, []).blocks.map((b) => b.md)).toEqual(['自分のノート', '直した文'])
  })
  it('完了の節は何も変えない', () => {
    const { done } = fixture()
    expect(applyLessonRegen(done, ['別の文'])).toBe(done)
  })
})

describe('この章だけ直す', () => {
  it('AIが守る節を消しても書き換えても、元のまま残る', () => {
    const { ch1, draft, noted, done } = fixture()
    // 雑な変更案: 守る節を改名し、完了の節を載せず、未作成の節も消す
    const r = applyChapterPlan(ch1, [P(draft.id, '下書きの新しい題'), P(noted.id, '勝手に改名'), P(null, '足した節')])
    const byId = new Map(r.lessons.map((l) => [l.id, l]))
    expect(byId.get(noted.id)).toBe(noted)
    expect(byId.get(done.id)).toBe(done)
    expect(byId.get(draft.id)?.title).toBe('下書きの新しい題')
    expect(byId.get(draft.id)?.blocks).toEqual(draft.blocks)
    expect(r.lessons.map((l) => l.title)).toEqual(['下書きの新しい題', 'ノートのある節', '完了の節', '足した節'])
  })
  it('同じidを2回書かれても節は重複しない', () => {
    const { ch1, draft } = fixture()
    const r = applyChapterPlan(ch1, [P(draft.id, 'a'), P(draft.id, 'b')])
    expect(r.lessons.filter((l) => l.id === draft.id)).toHaveLength(1)
  })
})

describe('コース全体を直す', () => {
  it('変更案に出てこない章でも、守る節は章ごと残る', () => {
    const { tb, noted, done, ch1 } = fixture()
    const r = applyCoursePlan(tb, [{ id: null, title: '全部入れ替えた章', lessons: [P(null, '新しい節')] }])
    const kept = r.chapters.find((c) => c.id === ch1.id)!
    expect(kept.title).toBe('一章')
    expect(kept.lessons).toEqual([noted, done])
    expect(r.chapters.map((c) => c.title)).toEqual(['一章', '全部入れ替えた章'])
  })
  it('守る節のある章は章名も変えない。守る節を他の章へ動かす指示は無視する', () => {
    const { tb, ch1, ch2, noted } = fixture()
    const r = applyCoursePlan(tb, [
      { id: ch1.id, title: '改名された一章', lessons: [] },
      { id: ch2.id, title: '改名された二章', lessons: [P(noted.id, '奪った節'), P(null, '新節')] },
    ])
    expect(r.chapters[0].title).toBe('一章')
    expect(r.chapters[0].lessons.some((l) => l === noted)).toBe(true)
    expect(r.chapters[1].title).toBe('改名された二章')
    expect(r.chapters[1].lessons.map((l) => l.title)).toEqual(['奪った節', '新節'])
    expect(r.chapters[1].lessons[0].id).not.toBe(noted.id)
  })
  it('差分の行は反映結果と一致する', () => {
    const { tb, ch1, draft, noted, done } = fixture()
    const after = { ...tb, chapters: tb.chapters.map((c) => (c.id === ch1.id ? applyChapterPlan(c, [P(draft.id, '改題'), P(null, '追加')]) : c)) }
    expect(diffTextbooks(tb, after, ch1.id)).toEqual([
      { kind: 'change', level: 'lesson', text: '改題', from: 'AIだけの節' },
      { kind: 'keep', level: 'lesson', text: noted.title, note: '自分の書き込みあり' },
      { kind: 'keep', level: 'lesson', text: done.title, note: '完了の節' },
      { kind: 'add', level: 'lesson', text: '追加' },
      { kind: 'remove', level: 'lesson', text: '未作成の節' },
    ])
  })
})

describe('差分の行（#83）', () => {
  it('章の追加・削除・改名と、節の削除が行になる', () => {
    const { tb, ch1, ch2 } = fixture()
    const after = structuredClone(tb)
    after.chapters[0].title = '一章（改名）'
    after.chapters[0].lessons = after.chapters[0].lessons.slice(0, 2)   // 完了の節と未作成の節を消す
    after.chapters = [after.chapters[0], newChapter('三章', [newLesson('新しい節')])]  // 二章を消し、三章を足す
    const rows = diffTextbooks(tb, after)
    const pick = (kind: string, level: string) => rows.filter((r) => r.kind === kind && r.level === level).map((r) => r.text)
    expect(pick('change', 'chapter')).toEqual(['一章（改名）'])
    expect(rows.find((r) => r.kind === 'change' && r.level === 'chapter')?.from).toBe(ch1.title)
    expect(pick('add', 'chapter')).toEqual(['三章'])
    expect(pick('add', 'lesson')).toEqual(['新しい節'])
    expect(pick('remove', 'chapter')).toEqual([ch2.title])
    expect(pick('remove', 'lesson')).toEqual(['完了の節', '未作成の節', '二章の節'])
  })
  it('章を絞ると、その章の節の行だけになる', () => {
    const { tb, ch1 } = fixture()
    const after = structuredClone(tb)
    after.chapters[1].title = '二章（改名）'
    const rows = diffTextbooks(tb, after, ch1.id)
    expect(rows.every((r) => r.level === 'lesson')).toBe(true)
    expect(rows.map((r) => r.kind)).toEqual(['same', 'keep', 'keep', 'same'])
  })
  it('節の作り直しの差分: 件数を出し、完了の節は変えない', () => {
    const { noted, done } = fixture()
    const rows = diffLessonRegen(noted, ['a', '', 'b'])
    expect(rows[0]).toMatchObject({ kind: 'change', text: 'AIの下書き 2件 を、新しい下書き 2件 に置き換えます' })
    expect(rows[1]).toMatchObject({ kind: 'keep', text: '自分のノートと自分で直した文 2件' })
    expect(diffLessonRegen(done, ['a'])).toEqual([{ kind: 'keep', level: 'lesson', text: '完了の節なので何も変えません' }])
  })
})

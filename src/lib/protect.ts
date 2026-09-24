import { newBlock, newChapter, newLesson, type Block, type Chapter, type Lesson, type Textbook } from '../types'
import { isMine, isProtectedLesson } from './status'

/**
 * 「設計を直す」でAIが返す変更案を、自分の教科書を壊さずに反映する。
 * 守る対象（自分のノート・自分で修正した文・完了の節）はプロンプトで頼むだけでなく、
 * ここで機械的に保証する。AIが何を返しても、守る対象は元データのまま残る。
 */

export type PlanLesson = { id: string | null; title: string; minutes: number; isTask: boolean; summary: string }
export type PlanChapter = { id: string | null; title: string; lessons: PlanLesson[] }

/** この節だけ作り直す。AIの下書き（未修正）だけを新しい文に置き換える。 */
export function applyLessonRegen(lesson: Lesson, newMd: string[]): Lesson {
  if (lesson.done) return lesson
  const fresh = newMd.filter((m) => m.trim()).map((m) => newBlock('ai', m))
  const out: Block[] = []
  let lastSlot = -1
  for (const b of lesson.blocks) {
    if (isMine(b)) {
      out.push(b)
    } else {
      const next = fresh.shift()
      if (next) out.push(next)
      lastSlot = out.length
    }
  }
  if (fresh.length) {
    const at = lastSlot >= 0 ? lastSlot : out.length
    out.splice(at, 0, ...fresh)
  }
  return { ...lesson, blocks: out }
}

function applyPlanLesson(existing: Lesson | undefined, p: PlanLesson): Lesson {
  if (!existing) return newLesson(p.title, { minutes: p.minutes, isTask: p.isTask, summary: p.summary })
  if (isProtectedLesson(existing)) return existing
  return { ...existing, title: p.title, minutes: p.minutes, isTask: p.isTask, summary: p.summary }
}

/** 章の節の並びを変更案に合わせる。守る節は消えず、書き換わらず、元の位置の近くに残る。 */
export function applyChapterPlan(chapter: Chapter, plan: PlanLesson[], pool?: Map<string, Lesson>): Chapter {
  const own = new Map(chapter.lessons.map((l) => [l.id, l]))
  const used = new Set<string>()
  const out: Lesson[] = []
  for (const p of plan) {
    let ex = p.id ? own.get(p.id) : undefined
    // 別の章から移ってきた節。守る節は元の章から動かさない
    if (!ex && p.id && pool?.has(p.id) && !isProtectedLesson(pool.get(p.id)!)) ex = pool.get(p.id)
    if (ex && used.has(ex.id)) ex = undefined
    if (ex) used.add(ex.id)
    out.push(applyPlanLesson(ex, p))
  }
  chapter.lessons.forEach((l, i) => {
    if (isProtectedLesson(l) && !used.has(l.id)) out.splice(Math.min(i, out.length), 0, l)
  })
  return { ...chapter, lessons: out }
}

/** コース全体を変更案に合わせる。 */
export function applyCoursePlan(tb: Textbook, plan: PlanChapter[]): Textbook {
  const byId = new Map(tb.chapters.map((c) => [c.id, c]))
  const pool = new Map(tb.chapters.flatMap((c) => c.lessons).map((l) => [l.id, l]))
  const usedCh = new Set<string>()
  const out: Chapter[] = []
  for (const pc of plan) {
    const ex = pc.id && !usedCh.has(pc.id) ? byId.get(pc.id) : undefined
    if (ex) {
      usedCh.add(ex.id)
      const hasProtected = ex.lessons.some(isProtectedLesson)
      const next = applyChapterPlan(ex, pc.lessons, pool)
      out.push({ ...next, title: hasProtected ? ex.title : pc.title })
    } else {
      out.push(newChapter(pc.title, applyChapterPlan(newChapter(''), pc.lessons, pool).lessons))
    }
  }
  // 変更案に出てこなかった章。守る節があれば、その節だけ残して章を維持する
  tb.chapters.forEach((c, i) => {
    if (usedCh.has(c.id)) return
    const keep = c.lessons.filter(isProtectedLesson)
    if (keep.length) out.splice(Math.min(i, out.length), 0, { ...c, lessons: keep })
  })
  // 同じ節が2か所に入らないようにする（先勝ち）
  const seen = new Set<string>()
  const keepFirst = (id: string): boolean => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  }
  const dedup = out.map((c) => ({ ...c, lessons: c.lessons.filter((l) => keepFirst(l.id)) }))
  return { ...tb, chapters: dedup }
}

export type DiffKind = 'keep' | 'same' | 'change' | 'add' | 'remove'
export type DiffRow = { kind: DiffKind; level: 'chapter' | 'lesson'; text: string; from?: string; note?: string }

export const DIFF_LABEL: Record<DiffKind, string> = { keep: '残す', same: 'そのまま', change: '変更', add: '追加', remove: '削除' }

/** 反映前と反映後を比べて差分の行を作る。表示する差分 = 実際に反映される内容。 */
export function diffTextbooks(before: Textbook, after: Textbook, onlyChapterId?: string): DiffRow[] {
  const rows: DiffRow[] = []
  const bCh = new Map(before.chapters.map((c) => [c.id, c]))
  const bLs = new Map(before.chapters.flatMap((c) => c.lessons).map((l) => [l.id, l]))
  const aLs = new Set(after.chapters.flatMap((c) => c.lessons).map((l) => l.id))
  for (const c of after.chapters) {
    if (onlyChapterId && c.id !== onlyChapterId) continue
    const bc = bCh.get(c.id)
    if (!onlyChapterId) {
      if (!bc) rows.push({ kind: 'add', level: 'chapter', text: c.title })
      else if (bc.title !== c.title) rows.push({ kind: 'change', level: 'chapter', text: c.title, from: bc.title })
      else rows.push({ kind: 'same', level: 'chapter', text: c.title })
    }
    for (const l of c.lessons) {
      const bl = bLs.get(l.id)
      if (!bl) rows.push({ kind: 'add', level: 'lesson', text: l.title })
      else if (isProtectedLesson(bl))
        rows.push({ kind: 'keep', level: 'lesson', text: l.title, note: bl.done ? '完了の節' : '自分の書き込みあり' })
      else if (bl.title !== l.title || bl.summary !== l.summary || bl.minutes !== l.minutes)
        rows.push({ kind: 'change', level: 'lesson', text: l.title, from: bl.title !== l.title ? bl.title : undefined })
      else rows.push({ kind: 'same', level: 'lesson', text: l.title })
    }
    if (bc) for (const l of bc.lessons) if (!aLs.has(l.id)) rows.push({ kind: 'remove', level: 'lesson', text: l.title })
  }
  if (!onlyChapterId) {
    const aCh = new Set(after.chapters.map((c) => c.id))
    for (const c of before.chapters) {
      if (aCh.has(c.id)) continue
      rows.push({ kind: 'remove', level: 'chapter', text: c.title })
      for (const l of c.lessons) if (!aLs.has(l.id)) rows.push({ kind: 'remove', level: 'lesson', text: l.title })
    }
  }
  return rows
}

/** 節の作り直しの差分 */
export function diffLessonRegen(lesson: Lesson, newMd: string[]): DiffRow[] {
  if (lesson.done) return [{ kind: 'keep', level: 'lesson', text: '完了の節なので何も変えません' }]
  const mine = lesson.blocks.filter(isMine).length
  const ai = lesson.blocks.length - mine
  return [
    {
      kind: 'change',
      level: 'lesson',
      text: `AIの下書き ${ai}件 を、新しい下書き ${newMd.filter((m) => m.trim()).length}件 に置き換えます`,
    },
    { kind: 'keep', level: 'lesson', text: `自分のノートと自分で直した文 ${mine}件` },
  ]
}

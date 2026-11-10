import type { Block, Chapter, Lesson, Textbook } from '../types'

/** 節の状態。保存せず、毎回ブロックと手動の印から導出する。 */
export type Status = 'none' | 'ai' | 'me' | 'done'

export const STATUS_LABEL: Record<Status, string> = {
  none: '未作成',
  ai: 'AIの下書き',
  me: '書き込みあり',
  done: '完了',
}

export const isMine = (b: Block): boolean => b.by === 'me' || b.edited

export function lessonStatus(l: Lesson): Status {
  if (l.done) return 'done'
  if (l.blocks.length === 0) return 'none'
  if (l.blocks.some(isMine)) return 'me'
  return 'ai'
}

/** 再設計でAIに触らせない節か（完了 or 自分の書き込みあり） */
export const isProtectedLesson = (l: Lesson): boolean => l.done || l.blocks.some(isMine)

export const allLessons = (tb: Textbook): Lesson[] => tb.chapters.flatMap((c) => c.lessons)

export function findLesson(tb: Textbook, lessonId: string): { chapter: Chapter; lesson: Lesson; ci: number; li: number } | null {
  for (let ci = 0; ci < tb.chapters.length; ci++) {
    const li = tb.chapters[ci].lessons.findIndex((l) => l.id === lessonId)
    if (li >= 0) return { chapter: tb.chapters[ci], lesson: tb.chapters[ci].lessons[li], ci, li }
  }
  return null
}

/** 表示用の番号 "2-1"。idはuuidなので番号は位置から作る。 */
export function lessonNo(tb: Textbook, lessonId: string): string {
  const f = findLesson(tb, lessonId)
  return f ? `${f.ci + 1}-${f.li + 1}` : ''
}

/** ロードマップの現在地 = 最初の完了でない節 */
export function currentLesson(tb: Textbook): Lesson | null {
  return allLessons(tb).find((l) => !l.done) ?? null
}

export function statusCounts(tb: Textbook): Record<Status, number> {
  const c: Record<Status, number> = { none: 0, ai: 0, me: 0, done: 0 }
  for (const l of allLessons(tb)) c[lessonStatus(l)]++
  return c
}

export const reviewCount = (tb: Textbook): number => allLessons(tb).filter((l) => l.review).length

const plain = (md: string): number => md.replace(/[#*_`>\-|\s]/g, '').length
/** ブロックの重み。文字数に画像1枚 40 字を足す */
const weight = (b: Block): number => plain(b.md) + b.images.length * 40

/** 節の中で自分の言葉が占める割合（%） */
export function minePercent(l: Lesson): number {
  const total = l.blocks.reduce((a, b) => a + weight(b), 0)
  if (!total) return 0
  const mine = l.blocks.filter(isMine).reduce((a, b) => a + weight(b), 0)
  return Math.round((mine / total) * 100)
}

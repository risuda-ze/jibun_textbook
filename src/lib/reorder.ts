import type { Textbook } from '../types'
import { findLesson } from './status'

/**
 * 節と章の並べ替え（#11）。どれも新しい教科書を返し、元は変えない。動かせない（端・同じ章・無い id）ときは
 * 同じ教科書をそのまま返す。id は変えないので、番号「2-1」は位置から作り直され、参照は壊れない。
 * 人の操作なので protect.ts の守る対象は掛けない（完了の節も動かしてよい）。
 */

/** 節を同じ章の中で1つ上（-1）か下（+1）へ */
export function moveLesson(tb: Textbook, lessonId: string, dir: -1 | 1): Textbook {
  const f = findLesson(tb, lessonId)
  if (!f) return tb
  const to = f.li + dir
  if (to < 0 || to >= f.chapter.lessons.length) return tb
  const lessons = [...f.chapter.lessons]
  lessons.splice(to, 0, ...lessons.splice(f.li, 1))
  return { ...tb, chapters: tb.chapters.map((c, i) => (i === f.ci ? { ...c, lessons } : c)) }
}

/** 節を別の章の末尾へ。元の章が空になったら章ごと消す（removeLesson と同じ） */
export function moveLessonToChapter(tb: Textbook, lessonId: string, chapterId: string): Textbook {
  const f = findLesson(tb, lessonId)
  if (!f || f.chapter.id === chapterId || !tb.chapters.some((c) => c.id === chapterId)) return tb
  return {
    ...tb,
    chapters: tb.chapters
      .map((c) => {
        if (c.id === chapterId) return { ...c, lessons: [...c.lessons, f.lesson] }
        if (c.id === f.chapter.id) return { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) }
        return c
      })
      .filter((c) => c.lessons.length),
  }
}

/** 章を1つ上（-1）か下（+1）へ */
export function moveChapter(tb: Textbook, chapterId: string, dir: -1 | 1): Textbook {
  const i = tb.chapters.findIndex((c) => c.id === chapterId)
  const to = i + dir
  if (i < 0 || to < 0 || to >= tb.chapters.length) return tb
  const chapters = [...tb.chapters]
  chapters.splice(to, 0, ...chapters.splice(i, 1))
  return { ...tb, chapters }
}

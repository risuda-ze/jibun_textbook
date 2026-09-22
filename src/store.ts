import { useSyncExternalStore } from 'react'
import { del, get, keys, set } from 'idb-keyval'
import { TextbookZ, findDuplicateIds, isDraftEmpty, nowIso, renumberDuplicateIds, type Lesson, type NoteDraft, type Textbook } from './types'
import { DEFAULT_AI, type AiSettings } from './ai/types'
import { currentLesson, findLesson } from './lib/status'

export type Screen = 'shelf' | 'new' | 'road' | 'lesson' | 'book'
export type Toast = { id: number; msg: string; undo?: () => void }

export type State = {
  ready: boolean
  books: Textbook[]
  bookId: string | null
  lessonId: string | null
  screen: Screen
  ai: AiSettings
  /** 教科書ごとの最後に書き出した日時。端末内だけの情報 */
  lastExport: Record<string, string>
  /** ノート入力欄の下書き（節idごと）。画面をまたいで残すが端末には保存しない（#12） */
  drafts: Record<string, NoteDraft>
  toast: Toast | null
}

let state: State = {
  ready: false, books: [], bookId: null, lessonId: null, screen: 'shelf', ai: DEFAULT_AI, lastExport: {}, drafts: {}, toast: null,
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const setState = (p: Partial<State>) => { state = { ...state, ...p }; emit() }

export const getState = (): State => state
export function useApp(): State {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}

const TB = 'tb:'
const SETTINGS = 'settings'

export async function init(): Promise<void> {
  const books: Textbook[] = []
  let renumbered = 0
  try {
    for (const k of await keys()) {
      if (typeof k !== 'string' || !k.startsWith(TB)) continue
      const r = TextbookZ.safeParse(await get(k))
      if (!r.success) continue
      // 端末内のデータは弾かず、重複した id を振り直して救済する（#36）
      if (findDuplicateIds(r.data).length) {
        const fixed = renumberDuplicateIds(r.data)
        renumbered += fixed.count
        await set(k, fixed.tb).catch(() => {})
        books.push(fixed.tb)
      } else books.push(r.data)
    }
    const s = (await get(SETTINGS)) as { ai?: AiSettings; lastExport?: Record<string, string> } | undefined
    books.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    setState({ ready: true, books, ai: { ...DEFAULT_AI, ...s?.ai }, lastExport: s?.lastExport ?? {} })
    if (renumbered) toast(`重複していた id を ${renumbered} 件振り直しました。`)
    // 端末の保存領域を勝手に消されないよう、永続化を要求する
    void navigator.storage?.persist?.()
  } catch {
    setState({ ready: true })
  }
}

const saveSettings = () => set(SETTINGS, { ai: state.ai, lastExport: state.lastExport }).catch(() => {})

let toastSeq = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string, undo?: () => void): void {
  clearTimeout(toastTimer)
  const t = { id: ++toastSeq, msg, undo }
  setState({ toast: t })
  toastTimer = setTimeout(() => { if (state.toast?.id === t.id) setState({ toast: null }) }, undo ? 7000 : 2600)
}
export const clearToast = () => setState({ toast: null })

export const currentBook = (s: State = state): Textbook | null => s.books.find((b) => b.id === s.bookId) ?? null

export function go(screen: Screen): void {
  setState({ screen })
  window.scrollTo(0, 0)
}

export function openBook(id: string, screen: Screen = 'road'): void {
  const b = state.books.find((x) => x.id === id)
  if (!b) return
  const cur = currentLesson(b) ?? b.chapters[0]?.lessons[0] ?? null
  setState({ bookId: id, lessonId: cur?.id ?? null, screen })
  window.scrollTo(0, 0)
}

export const selectLesson = (lessonId: string): void => setState({ lessonId })
export function openLesson(lessonId: string): void { setState({ lessonId, screen: 'lesson' }); window.scrollTo(0, 0) }

/** 教科書を置き換えて保存する。touch=false は読み込み時など updatedAt を保ちたいとき。 */
export function putBook(tb: Textbook, touch = true): void {
  const next = touch ? { ...tb, updatedAt: nowIso() } : tb
  const i = state.books.findIndex((b) => b.id === next.id)
  const books = i >= 0 ? state.books.map((b) => (b.id === next.id ? next : b)) : [next, ...state.books]
  setState({ books })
  set(TB + next.id, next).catch(() => toast('端末に保存できませんでした。空き容量を確認してください。'))
}

export function updateBook(id: string, fn: (draft: Textbook) => void): void {
  const b = state.books.find((x) => x.id === id)
  if (!b) return
  const draft = structuredClone(b)
  fn(draft)
  putBook(draft)
}

export function updateLesson(bookId: string, lessonId: string, fn: (l: Lesson, tb: Textbook) => void): void {
  updateBook(bookId, (tb) => {
    const f = findLesson(tb, lessonId)
    if (f) fn(f.lesson, tb)
  })
}

/** 直前の状態に戻すための控え。削除の「元に戻す」で使う。 */
export function snapshot(id: string): Textbook | null {
  const b = state.books.find((x) => x.id === id)
  return b ? structuredClone(b) : null
}

export function removeBook(id: string): void {
  const b = state.books.find((x) => x.id === id)
  if (!b) return
  setState({ books: state.books.filter((x) => x.id !== id), bookId: state.bookId === id ? null : state.bookId, screen: 'shelf' })
  del(TB + id).catch(() => {})
  toast(`「${b.title}」を消しました`, () => putBook(b, false))
}

export function setAi(p: Partial<AiSettings>): void {
  setState({ ai: { ...state.ai, ...p } })
  void saveSettings()
}

/** ノートの下書きを置き換える。空なら消す */
export function setDraft(lessonId: string, d: NoteDraft): void {
  const { [lessonId]: _drop, ...rest } = state.drafts
  setState({ drafts: isDraftEmpty(d) ? rest : { ...rest, [lessonId]: d } })
}

export function markExported(id: string): void {
  setState({ lastExport: { ...state.lastExport, [id]: nowIso() } })
  void saveSettings()
}

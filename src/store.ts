import { useSyncExternalStore } from 'react'
import { del, get, keys, set } from 'idb-keyval'
import { isDraftEmpty, nowIso, type Lesson, type NoteDraft, type Textbook } from './types'
import { DEFAULT_AI, type AiSettings } from './ai/types'
import { currentLesson, findLesson } from './lib/status'
import { migrate } from './lib/migrate'

export type Screen = 'shelf' | 'new' | 'road' | 'lesson' | 'book' | 'help'
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
  /** レッスン・通読の表示領域を画面幅の約 90% に広げるか。端末内だけの設定（#53） */
  wide: boolean
  /** ノート入力欄の下書き（節idごと）。画面をまたいで残すが端末には保存しない（#12） */
  drafts: Record<string, NoteDraft>
  /** 起動時に読めなかった教科書の生データ（#17）。本棚から書き出すか消せる */
  broken: { key: string; raw: unknown }[]
  /** Help の「読み込めない場合、まずはこちら」に渡す生データ（本棚の「読めない教科書」から）（#65） */
  repairTarget: { name: string; raw: unknown } | null
  toast: Toast | null
}

let state: State = {
  ready: false, books: [], bookId: null, lessonId: null, screen: 'shelf', ai: DEFAULT_AI, lastExport: {}, wide: false, drafts: {}, broken: [], repairTarget: null, toast: null,
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const setState = (p: Partial<State>) => { state = { ...state, ...p }; emit() }

export function useApp(): State {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}

const TB = 'tb:'
const SETTINGS = 'settings'

export async function init(): Promise<void> {
  const books: Textbook[] = []
  const broken: { key: string; raw: unknown }[] = []
  let repaired = 0
  try {
    for (const k of await keys()) {
      if (typeof k !== 'string' || !k.startsWith(TB)) continue
      const raw = await get(k)
      // 版の移行と既知の不整合の修復は migrate() に寄せ、JSON 読込と同じ結果にする（#65）
      const r = migrate(raw)
      // 直せない教科書は黙って捨てず、本棚で知らせて生データを書き出すか Help で直せるようにする（#17）
      if (!r.ok) { broken.push({ key: k, raw }); continue }
      if (r.steps.length) { repaired++; await set(k, r.tb).catch(() => {}) }
      books.push(r.tb)
    }
    const s = (await get(SETTINGS)) as { ai?: AiSettings; lastExport?: Record<string, string>; wide?: boolean } | undefined
    books.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    setState({ ready: true, books, broken, ai: { ...DEFAULT_AI, ...s?.ai }, lastExport: s?.lastExport ?? {}, wide: s?.wide ?? false })
    if (repaired) toast(`古い形式か不整合のあった教科書 ${repaired} 冊を直しました。`)
    else if (broken.length) toast(`読み込めない教科書が ${broken.length} 冊あります。本棚から生データを書き出せます。`)
    // 端末の保存領域を勝手に消されないよう、永続化を要求する
    void navigator.storage?.persist?.()
  } catch {
    setState({ ready: true })
  }
}

const saveSettings = () => set(SETTINGS, { ai: state.ai, lastExport: state.lastExport, wide: state.wide }).catch(() => {})

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
  const prev = state.books
  const i = prev.findIndex((b) => b.id === next.id)
  const books = i >= 0 ? prev.map((b) => (b.id === next.id ? next : b)) : [next, ...prev]
  setState({ books })
  // 端末に書けなかったら画面も元に戻す。画面だけ書けたように見えて再読み込みで消える、を防ぐ（#17）
  set(TB + next.id, next).catch(() => {
    setState({ books: prev })
    toast('端末に保存できませんでした。今の変更は取り消しました。空き容量を確認してください。')
  })
}

/** 生データを Help の修復画面に渡して開く（#65） */
export function openRepair(name: string, raw: unknown): void {
  setState({ repairTarget: { name, raw }, screen: 'help' })
  window.scrollTo(0, 0)
}
export const clearRepairTarget = (): void => setState({ repairTarget: null })

/** 読めなかった教科書の生データを消す（#17） */
export function dropBroken(key: string): void {
  // 端末から消えてから一覧を更新する（消える前に再読み込みされると復活するため）
  del(key)
    .catch(() => {})
    .then(() => setState({ broken: state.broken.filter((b) => b.key !== key) }))
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

/** 表示領域の切り替え（#53）。端末内に保存する */
export function setWide(wide: boolean): void {
  setState({ wide })
  void saveSettings()
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

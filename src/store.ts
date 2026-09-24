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
  ready: false,
  books: [],
  bookId: null,
  lessonId: null,
  screen: 'shelf',
  ai: DEFAULT_AI,
  lastExport: {},
  wide: false,
  drafts: {},
  broken: [],
  repairTarget: null,
  toast: null,
}
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const setState = (p: Partial<State>) => {
  state = { ...state, ...p }
  emit()
}

/** テスト専用。画面は useApp() を使う */
export const getStateForTest = (): State => state

export function useApp(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

const TB = 'tb:'
const SETTINGS = 'settings'

type Settings = { ai?: AiSettings; lastExport?: Record<string, string>; wide?: boolean }

export async function init(): Promise<void> {
  const books: Textbook[] = []
  const broken: { key: string; raw: unknown }[] = []
  let repaired = 0
  // 教科書と設定は別々に読む。設定1件が読めなくても教科書は本棚に出す（#80）
  let booksFailed = false
  try {
    for (const k of await keys()) {
      if (typeof k !== 'string' || !k.startsWith(TB)) continue
      const raw = await get(k)
      // 版の移行と既知の不整合の修復は migrate() に寄せ、JSON 読込と同じ結果にする（#65）
      const r = migrate(raw)
      // 直せない教科書は黙って捨てず、本棚で知らせて生データを書き出すか Help で直せるようにする（#17）
      if (!r.ok) {
        broken.push({ key: k, raw })
        continue
      }
      if (r.steps.length) {
        repaired++
        await set(k, r.tb).catch(() => {})
      }
      books.push(r.tb)
    }
  } catch {
    booksFailed = true
  }
  let s: Settings | undefined
  let settingsFailed = false
  try {
    s = (await get(SETTINGS)) as Settings | undefined
  } catch {
    settingsFailed = true
  }
  books.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  setState({ ready: true, books, broken, ai: { ...DEFAULT_AI, ...s?.ai }, lastExport: s?.lastExport ?? {}, wide: s?.wide ?? false })
  if (booksFailed) toast('端末の保存領域を読めませんでした。ブラウザの設定で保存が許可されているか確認してください。')
  else if (settingsFailed) toast('設定を読み込めませんでした。既定の設定で開きます。')
  else if (repaired) toast(`古い形式か不整合のあった教科書 ${repaired} 冊を直しました。`)
  else if (broken.length) toast(`読み込めない教科書が ${broken.length} 冊あります。本棚から生データを書き出せます。`)
  // 端末の保存領域を勝手に消されないよう、永続化を要求する
  void navigator.storage?.persist?.()
}

/** 設定を端末に保存する。失敗を握りつぶさず、呼び元が知らせられるよう真偽を返す（#80） */
const saveSettings = (): Promise<boolean> =>
  set(SETTINGS, { ai: state.ai, lastExport: state.lastExport, wide: state.wide } satisfies Settings).then(
    () => true,
    () => false,
  )
const SAVE_FAILED = '端末に保存できませんでした。空き容量を確認してください。'
const warnIfFailed = (p: Promise<boolean>): Promise<boolean> =>
  p.then((ok) => {
    if (!ok) toast(SAVE_FAILED)
    return ok
  })

let toastSeq = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string, undo?: () => void): void {
  clearTimeout(toastTimer)
  const t = { id: ++toastSeq, msg, undo }
  setState({ toast: t })
  toastTimer = setTimeout(
    () => {
      if (state.toast?.id === t.id) setState({ toast: null })
    },
    undo ? 7000 : 2600,
  )
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
export function openLesson(lessonId: string): void {
  setState({ lessonId, screen: 'lesson' })
  window.scrollTo(0, 0)
}

/** 教科書ごとの書き込みの連番。失敗した書き込みが最新かどうかを見る（#80） */
const writeSeq = new Map<string, number>()

/** 教科書を置き換えて保存する。touch=false は読み込み時など updatedAt を保ちたいとき。 */
export function putBook(tb: Textbook, touch = true): void {
  const next = touch ? { ...tb, updatedAt: nowIso() } : tb
  const before = state.books.find((b) => b.id === next.id)
  const i = state.books.findIndex((b) => b.id === next.id)
  const books = i >= 0 ? state.books.map((b) => (b.id === next.id ? next : b)) : [next, ...state.books]
  setState({ books })
  const seq = (writeSeq.get(next.id) ?? 0) + 1
  writeSeq.set(next.id, seq)
  // 端末に書けなかったら画面も元に戻す。画面だけ書けたように見えて再読み込みで消える、を防ぐ（#17）。
  // ただし、その後の書き込みが成功していれば画面はそちらが正なので、失敗したのが最新の書き込みのときだけ戻す（#80）。
  // 戻すのはこの教科書だけ（他の教科書の変更は巻き込まない）
  set(TB + next.id, next).catch(() => {
    if (writeSeq.get(next.id) !== seq) return
    setState({ books: before ? state.books.map((b) => (b.id === next.id ? before : b)) : state.books.filter((b) => b.id !== next.id) })
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
  const i = state.books.findIndex((x) => x.id === id)
  const b = state.books[i]
  if (!b) return
  setState({ books: state.books.filter((x) => x.id !== id), bookId: state.bookId === id ? null : state.bookId, screen: 'shelf' })
  toast(`「${b.title}」を消しました`, () => putBook(b, false))
  // 端末から消せなかったら本棚に戻す（再読み込みで復活するのを「消えた」と見せない）（#80）
  del(TB + id).catch(() => {
    const books = [...state.books]
    books.splice(Math.min(i, books.length), 0, b)
    setState({ books })
    toast(`「${b.title}」を端末から消せませんでした。`)
  })
}

/** 表示領域の切り替え（#53）。端末内に保存する */
export function setWide(wide: boolean): void {
  setState({ wide })
  void warnIfFailed(saveSettings())
}

/** AI の設定を変えて保存する。保存できたかを返す（キーの「保存しました」は結果を見てから出す）（#80） */
export function setAi(p: Partial<AiSettings>): Promise<boolean> {
  setState({ ai: { ...state.ai, ...p } })
  return warnIfFailed(saveSettings())
}

/** ノートの下書きを置き換える。空なら消す */
export function setDraft(lessonId: string, d: NoteDraft): void {
  const { [lessonId]: _drop, ...rest } = state.drafts
  setState({ drafts: isDraftEmpty(d) ? rest : { ...rest, [lessonId]: d } })
}

export function markExported(id: string): void {
  setState({ lastExport: { ...state.lastExport, [id]: nowIso() } })
  void warnIfFailed(saveSettings())
}

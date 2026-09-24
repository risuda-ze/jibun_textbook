import { getProvider, type AiError, type AiSettings, type LessonDraft, type ResearchInfo, type Usage } from '../ai'
import { toast, updateLesson } from '../store'
import { newBlock, type Lesson, type Textbook } from '../types'
import { materialError, toMaterials, type MaterialInput } from './material'

/** 生成の段階数（Web を調査している → 資料を書いている → 資料ができた）。ボタンの塗りは stepPercent(step, GEN_STEPS) */
export const GEN_STEPS = 2

/** 進行中の状態。画面がボタンの塗りと Working に使う（#55） */
export type GenState = { step: number; detail: string; startedAt: number; endedAt: number | null }

export const startGen = (): GenState => ({ step: 0, detail: '', startedAt: Date.now(), endedAt: null })

/**
 * Web 調査の状態を、完了の知らせに添える文にする（#81）。
 * 検索が全部失敗したときは「モデルの知識だけで書いた」と明かす。途中で切れたら根拠が足りない可能性を伝える
 */
export function researchNote(usage: Usage, info: ResearchInfo | undefined): string {
  if (!info) return ''
  const parts: string[] = []
  if (info.searchErrors.length) {
    parts.push(
      usage.searches === 0
        ? `Web検索ができなかったので（${info.searchErrors.join('・')}）、モデルの知識だけで書きました。根拠は自分で確かめてください`
        : `Web検索が${info.searchErrors.length}回失敗しました（${[...new Set(info.searchErrors)].join('・')}）`,
    )
  }
  if (info.truncated) parts.push('Web調査が長くなり途中で切れました。根拠が足りない所は自分で確かめてください')
  return parts.length ? `。${parts.join('。')}` : ''
}

/** 使った量の文（検索回数・トークン）。無ければ空 */
export const usageNote = (usage: Usage): string =>
  usage.searches || usage.inputTokens
    ? `（検索${usage.searches}回・入力${usage.inputTokens.toLocaleString()}・出力${usage.outputTokens.toLocaleString()}トークン）`
    : ''

/**
 * AI の下書きを節に当てる（#83 で純粋関数に）。節をその場で書き換える。
 * - 本文: 生成を待つ間に自分で書いたノートがあれば、その後ろに足す。空の要素は捨てる
 * - 手を動かす: まだ無いときだけ採用する（自分で足した分を上書きしない）
 * - 参考情報: 検索語と確かめ方は重複を除いて足す。リンクは URL が同じものを足さない
 * - 元にした資料: 名前だけ残す（本文は JSON に入れない）
 */
export function mergeDraft(l: Lesson, draft: LessonDraft, materialNames: string[]): void {
  l.blocks.push(...draft.blocks.filter((m) => m.trim()).map((m) => newBlock('ai', m)))
  if (!l.tasks.length) l.tasks = draft.tasks.map((text) => ({ text, checked: false }))
  l.materials = [...new Set([...l.materials, ...materialNames])]
  l.clues = {
    queries: [...new Set([...l.clues.queries, ...draft.clues.queries])],
    links: [...l.clues.links, ...draft.clues.links.filter((x) => !l.clues.links.some((y) => y.url === x.url))],
    how: [...new Set([...l.clues.how, ...draft.clues.how])],
  }
}

/** 節の資料を生成して教科書に入れる。失敗しても教科書は変えない。 */
export async function generateInto(
  tb: Textbook,
  lessonId: string,
  ai: AiSettings,
  onProgress: (step: number, detail: string) => void,
  signal?: AbortSignal,
  input?: MaterialInput,
): Promise<boolean> {
  // 渡す資料（#63）。ファイルと貼り付けを別々の資料として並べる。無ければ「この資料だけ」は効かない
  const materials = input ? toMaterials(input) : []
  const sourceOnly = !!input?.sourceOnly && materials.length > 0
  // 貼り付けが上限を超えていたら、API を呼ぶ前に断る（#79）
  const bad = input ? materialError(input) : null
  if (bad) {
    toast(bad)
    return false
  }
  try {
    const { draft, usage } = await getProvider(ai).generateLesson(tb, lessonId, onProgress, { signal, materials, sourceOnly })
    if (!draft.blocks.length) throw new Error('AIが本文を返しませんでした。もう一度お試しください。')
    updateLesson(tb.id, lessonId, (l) =>
      mergeDraft(
        l,
        draft,
        materials.map((m) => m.name),
      ),
    )
    // Web 調査の状態（途中で切れた・検索が失敗した）を知らせる（#17 #81）。下書きは入るが、根拠が足りない可能性がある
    const info = draft.research ?? (draft.truncated ? { truncated: true, searchErrors: [] } : undefined)
    toast(`資料を生成しました${usageNote(usage)}${researchNote(usage, info)}`)
    return true
  } catch (e) {
    const err = e as AiError
    // 自分でやめたときは短く知らせる（#14）。ここまでに使った検索の回数が分かれば添える（課金されるため）
    if (err.code === 'aborted')
      toast(err.usage?.searches ? `生成をやめました（ここまでの検索${err.usage.searches}回）` : '生成をやめました')
    else toast(err.message)
    return false
  }
}

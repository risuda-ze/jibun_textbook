import { getProvider, type AiError, type AiSettings } from '../ai'
import { toast, updateLesson } from '../store'
import { newBlock, type Textbook } from '../types'
import { materialError, toMaterials, type MaterialInput } from './material'

/** 生成の段階数（Web を調査している → 資料を書いている → 資料ができた）。ボタンの塗りは stepPercent(step, GEN_STEPS) */
export const GEN_STEPS = 2

/** 進行中の状態。画面がボタンの塗りと Working に使う（#55） */
export type GenState = { step: number; detail: string; startedAt: number; endedAt: number | null }

export const startGen = (): GenState => ({ step: 0, detail: '', startedAt: Date.now(), endedAt: null })

/** 節の資料を生成して教科書に入れる。失敗しても教科書は変えない。 */
export async function generateInto(tb: Textbook, lessonId: string, ai: AiSettings, onProgress: (step: number, detail: string) => void, signal?: AbortSignal, input?: MaterialInput): Promise<boolean> {
  // 渡す資料（#63）。ファイルと貼り付けを別々の資料として並べる。無ければ「この資料だけ」は効かない
  const materials = input ? toMaterials(input) : []
  const sourceOnly = !!input?.sourceOnly && materials.length > 0
  // 貼り付けが上限を超えていたら、API を呼ぶ前に断る（#79）
  const bad = input ? materialError(input) : null
  if (bad) { toast(bad); return false }
  try {
    const { draft, usage } = await getProvider(ai).generateLesson(tb, lessonId, onProgress, { signal, materials, sourceOnly })
    if (!draft.blocks.length) throw new Error('AIが本文を返しませんでした。もう一度お試しください。')
    updateLesson(tb.id, lessonId, (l) => {
      // 生成を待つ間に自分で書いたノートがあれば、その後ろに足す
      l.blocks.push(...draft.blocks.filter((m) => m.trim()).map((m) => newBlock('ai', m)))
      if (!l.tasks.length) l.tasks = draft.tasks.map((text) => ({ text, checked: false }))
      // 元にした資料は名前だけ残す（本文は JSON に入れない）
      l.materials = [...new Set([...l.materials, ...materials.map((m) => m.name)])]
      l.clues = {
        queries: [...new Set([...l.clues.queries, ...draft.clues.queries])],
        links: [...l.clues.links, ...draft.clues.links.filter((x) => !l.clues.links.some((y) => y.url === x.url))],
        how: [...new Set([...l.clues.how, ...draft.clues.how])],
      }
    })
    // Web 調査が途中で切れていたら、そのことを知らせる（#17）。下書きは入るが、根拠が足りない可能性がある
    const cut = draft.truncated ? '。Web調査が長くなり途中で切れました。根拠が足りない所は自分で確かめてください' : ''
    toast(usage.searches || usage.inputTokens
      ? `資料を生成しました（検索${usage.searches}回・入力${usage.inputTokens.toLocaleString()}・出力${usage.outputTokens.toLocaleString()}トークン）${cut}`
      : '資料を生成しました' + cut)
    return true
  } catch (e) {
    const err = e as AiError
    // 自分でやめたときは短く知らせる（#14）。ここまでに使った検索の回数が分かれば添える（課金されるため）
    if (err.code === 'aborted') toast(err.usage?.searches ? `生成をやめました（ここまでの検索${err.usage.searches}回）` : '生成をやめました')
    else toast(err.message)
    return false
  }
}

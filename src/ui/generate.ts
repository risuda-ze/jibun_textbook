import { getProvider, type AiSettings } from '../ai'
import { toast, updateLesson } from '../store'
import { newBlock, type Textbook } from '../types'

/** 生成の段階数（Web を調査している → 資料を書いている → 資料ができた）。ボタンの塗りは stepPercent(step, GEN_STEPS) */
export const GEN_STEPS = 2

/** 進行中の状態。画面がボタンの塗りと Working に使う（#55） */
export type GenState = { step: number; detail: string; startedAt: number; endedAt: number | null }

export const startGen = (): GenState => ({ step: 0, detail: '', startedAt: Date.now(), endedAt: null })

/** 節の資料を生成して教科書に入れる。失敗しても教科書は変えない。 */
export async function generateInto(tb: Textbook, lessonId: string, ai: AiSettings, onProgress: (step: number, detail: string) => void): Promise<boolean> {
  try {
    const { draft, usage } = await getProvider(ai).generateLesson(tb, lessonId, onProgress)
    if (!draft.blocks.length) throw new Error('AIが本文を返しませんでした。もう一度お試しください。')
    updateLesson(tb.id, lessonId, (l) => {
      // 生成を待つ間に自分で書いたノートがあれば、その後ろに足す
      l.blocks.push(...draft.blocks.filter((m) => m.trim()).map((m) => newBlock('ai', m)))
      if (!l.tasks.length) l.tasks = draft.tasks.map((text) => ({ text, checked: false }))
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
    toast((e as Error).message)
    return false
  }
}

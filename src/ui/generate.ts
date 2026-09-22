import { getProvider, type AiSettings } from '../ai'
import { toast, updateLesson } from '../store'
import { newBlock, type Textbook } from '../types'

/** 節の資料を生成して教科書に入れる。失敗しても教科書は変えない。 */
export async function generateInto(tb: Textbook, lessonId: string, ai: AiSettings, onDetail: (d: string) => void): Promise<boolean> {
  try {
    const { draft, usage } = await getProvider(ai).generateLesson(tb, lessonId, (_s, d) => onDetail(d))
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
    toast(usage.searches || usage.inputTokens
      ? `資料を生成しました（検索${usage.searches}回・入力${usage.inputTokens.toLocaleString()}・出力${usage.outputTokens.toLocaleString()}トークン）`
      : '資料を生成しました')
    return true
  } catch (e) {
    toast((e as Error).message)
    return false
  }
}

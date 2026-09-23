import type { CourseInput, Textbook } from '../types'
import { findLesson, isProtectedLesson } from '../lib/status'
import { abortError, zeroUsage, type AiOpts, type AiProvider, type Progress, type QA, type RedesignPlan, type RedesignScope } from './types'

/**
 * デモ応答。APIキーなしで動線を試すためのサンプルを返す。通しテストもこれを使う。
 * 内容は入力から機械的に組み立てた見本で、調査はしていない。
 */
/** 見本の待ち時間。signal で中止できる（#14。e2e で「やめる」を確かめるため） */
const wait = (ms = 200, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  if (signal?.aborted) return rej(abortError())
  const onAbort = () => { clearTimeout(t); rej(abortError()) }
  const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); res() }, ms)
  signal?.addEventListener('abort', onAbort, { once: true })
})

const topicOf = (i: CourseInput): string => (i.prompt.trim().split(/[。\n、,.]/)[0] || '学びたいこと').slice(0, 24)

export class DemoProvider implements AiProvider {
  async askQuestions(): Promise<string[]> {
    await wait()
    return ['「できるようになった」と言えるのはどんな状態？ 成果物の例があると設計しやすい。', '好きな学び方、避けたい学び方はある？']
  }

  async designCourse(input: CourseInput, _qa: QA[], note: string, onProgress: Progress, opts: AiOpts = {}) {
    const t = topicOf(input)
    onProgress(0, '学びたいことを分解している'); await wait(200, opts.signal)
    onProgress(1, 'デモ応答のためWeb調査はしません'); await wait(200, opts.signal)
    onProgress(2, 'コース設計を作っている'); await wait(200, opts.signal)
    const L = (title: string, minutes = 45, isTask = false) => ({ title, minutes, isTask, summary: `${title}ができるようになる。` })
    const design = {
      title: t,
      goal: input.prompt.trim() || `${t}を身につける`,
      chapters: [
        { title: '全体像をつかむ', lessons: [L('ゴールから逆算して地図を描く', 40), L('必要な道具と環境をそろえる', 30), L('お手本を集めて観察する', 50)] },
        { title: '基礎を固める', lessons: [L('最小の一歩をやってみる', 45), L('基本の型を覚える', 60), L('よくある失敗を先に知る', 40), L('課題: 基礎だけで小さく作る', 90, true)] },
        { title: '応用する', lessons: [L('型を組み合わせる', 60), L('仕上がりの質を上げる', 60), L('課題: 自分の題材で作る', 120, true)] },
        { title: '振り返って教科書に残す', lessons: [L('できたことと詰まった所を整理する', 45), L('次に学ぶことを決める', 30)] },
      ],
    }
    if (note) design.chapters[1].lessons.splice(1, 0, L(`注文を反映: ${note.slice(0, 20)}`, 45))
    onProgress(3, '設計ができた')
    return { design, usage: zeroUsage() }
  }

  async generateLesson(tb: Textbook, lessonId: string, onProgress: Progress, opts: AiOpts = {}) {
    const f = findLesson(tb, lessonId)!
    // 渡された資料（#63）は本文に名前と先頭だけ写して、動線を確かめられるようにする
    const mats = opts.materials ?? []
    const sourceOnly = !!opts.sourceOnly && mats.length > 0
    onProgress(0, sourceOnly ? '渡された資料だけで書きます（デモ応答）' : 'デモ応答のためWeb調査はしません'); await wait(200, opts.signal)
    onProgress(1, '資料を書いている'); await wait(200, opts.signal)
    const t = f.lesson.title
    const matLine = mats.length
      ? `\n\n（デモ）渡された資料: ${mats.map((m) => `${m.name}・${(m.text ?? 'PDF').replace(/\s+/g, ' ').slice(0, 40)}`).join(' ／ ')}${sourceOnly ? '（この資料だけから作る）' : ''}`
      : ''
    const draft = {
      blocks: [
        `### この節の狙い\n${f.lesson.summary || `${t}の要点をつかむ。`}\n\nこれは**デモ応答**の見本。実際のAIにつなぐと、Web調査をもとにした本文がここに入る。${matLine}`,
        `### 要点\n- まず小さく試す\n- うまくいかなかった所をノートに残す\n- 自分の言葉で言い直す`,
        `### 例\n| 手順 | やること |\n|---|---|\n| 1 | お手本を1つ選ぶ |\n| 2 | 同じことを自分の環境でやる |\n| 3 | 違いを書き出す |`,
      ],
      tasks: ['本文を読む', '例を自分の環境で試す', '結果や気づきをノートに1つ書く'],
      clues: {
        queries: [t, `${t} 公式`, `${t} よくある間違い`],
        links: [],
        how: ['本文の例を自分の環境で再現する', '公式の一次情報と照らす'],
      },
    }
    onProgress(2, '資料ができた')
    return { draft, usage: zeroUsage() }
  }

  async proposeRedesign(tb: Textbook, scope: RedesignScope, lessonId: string, order: string, onProgress: Progress, opts: AiOpts = {}) {
    const f = findLesson(tb, lessonId)!
    onProgress(0, '変更案を作っている'); await wait(200, opts.signal)
    const tag = order ? `（${order.slice(0, 16)}）` : '（見直し）'
    let plan: RedesignPlan
    const keepOrChange = (l: Textbook['chapters'][number]['lessons'][number], first: boolean) => ({
      id: l.id, title: !isProtectedLesson(l) && first ? `${l.title}${tag}` : l.title, minutes: l.minutes, isTask: l.isTask, summary: l.summary,
    })
    if (scope === 'lesson') {
      plan = { scope, blocks: [`### 作り直した下書き${tag}\nデモ応答の見本。`, '### 要点\n- 作り直しでも、自分のノートは残る'] }
    } else if (scope === 'chapter') {
      let first = true
      const lessons = f.chapter.lessons.map((l) => { const r = keepOrChange(l, first && !isProtectedLesson(l)); if (!isProtectedLesson(l)) first = false; return r })
      lessons.push({ id: null as unknown as string, title: `注文から追加した節${tag}`, minutes: 45, isTask: false, summary: '' })
      plan = { scope, lessons: lessons.map((l) => ({ ...l, id: l.id || null })) }
    } else {
      plan = {
        scope,
        chapters: [
          ...tb.chapters.map((c) => ({ id: c.id, title: c.title, lessons: c.lessons.map((l) => ({ ...keepOrChange(l, false), id: l.id as string | null })) })),
          { id: null, title: `追加の章${tag}`, lessons: [{ id: null, title: '新しい節', minutes: 45, isTask: false, summary: '' }] },
        ],
      }
    }
    return { plan, usage: zeroUsage() }
  }
}

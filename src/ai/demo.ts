import type { CourseInput, Lesson, Textbook } from '../types'
import { findLesson, isProtectedLesson } from '../lib/status'
import type { PlanLesson } from '../lib/protect'
import {
  PROGRESS,
  abortError,
  zeroUsage,
  type AiOpts,
  type AiProvider,
  type Progress,
  type QA,
  type RedesignPlan,
  type RedesignScope,
} from './types'

/**
 * デモ応答。APIキーなしで動線を試すためのサンプルを返す。通しテストもこれを使う。
 * 内容は入力から機械的に組み立てた見本で、調査はしていない。
 */
/**
 * 見本の1段階あたりの待ち時間（ms）。通しテストは `?demoDelay=3000` のように URL で長くして、
 * 「やめる」を押す前に終わってしまう競走を避ける（#84）。本番の URL に付ける意味は無い
 */
const delayParam = Number(new URLSearchParams(globalThis.location?.search).get('demoDelay') ?? NaN)
const DEMO_DELAY_MS = Number.isFinite(delayParam) && delayParam >= 0 ? delayParam : 200

/** 見本の待ち時間。signal で中止できる（#14。e2e で「やめる」を確かめるため） */
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal?.aborted) return rej(abortError())
    const onAbort = () => {
      clearTimeout(t)
      rej(abortError())
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      res()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })

const topicOf = (i: CourseInput): string => (i.prompt.trim().split(/[。\n、,.]/)[0] || '学びたいこと').slice(0, 24)

export class DemoProvider implements AiProvider {
  async askQuestions(_input: CourseInput, opts: AiOpts = {}) {
    await wait(DEMO_DELAY_MS, opts.signal)
    return {
      questions: [
        '「できるようになった」と言えるのはどんな状態？ 成果物の例があると設計しやすい。',
        '好きな学び方、避けたい学び方はある？',
      ],
      usage: zeroUsage(),
    }
  }

  async designCourse(input: CourseInput, _qa: QA[], note: string, onProgress: Progress, opts: AiOpts = {}) {
    const t = topicOf(input)
    onProgress(0, PROGRESS.splitting)
    await wait(DEMO_DELAY_MS, opts.signal)
    onProgress(1, PROGRESS.demo)
    await wait(DEMO_DELAY_MS, opts.signal)
    onProgress(2, PROGRESS.designing)
    await wait(DEMO_DELAY_MS, opts.signal)
    const L = (title: string, minutes = 45, isTask = false) => ({ title, minutes, isTask, summary: `${title}ができるようになる。` })
    const design = {
      title: t,
      goal: input.prompt.trim() || `${t}を身につける`,
      chapters: [
        {
          title: '全体像をつかむ',
          lessons: [L('ゴールから逆算して地図を描く', 40), L('必要な道具と環境をそろえる', 30), L('お手本を集めて観察する', 50)],
        },
        {
          title: '基礎を固める',
          lessons: [
            L('最小の一歩をやってみる', 45),
            L('基本の型を覚える', 60),
            L('よくある失敗を先に知る', 40),
            L('課題: 基礎だけで小さく作る', 90, true),
          ],
        },
        { title: '応用する', lessons: [L('型を組み合わせる', 60), L('仕上がりの質を上げる', 60), L('課題: 自分の題材で作る', 120, true)] },
        { title: '振り返って教科書に残す', lessons: [L('できたことと詰まった所を整理する', 45), L('次に学ぶことを決める', 30)] },
      ],
    }
    if (note) design.chapters[1].lessons.splice(1, 0, L(`注文を反映: ${note.slice(0, 20)}`, 45))
    onProgress(3, PROGRESS.designed)
    return { design, usage: zeroUsage() }
  }

  async generateLesson(tb: Textbook, lessonId: string, onProgress: Progress, opts: AiOpts = {}) {
    const f = findLesson(tb, lessonId)!
    // 渡された資料（#63）は本文に名前と先頭だけ写して、動線を確かめられるようにする
    const mats = opts.materials ?? []
    const sourceOnly = !!opts.sourceOnly && mats.length > 0
    onProgress(0, PROGRESS.demo)
    await wait(DEMO_DELAY_MS, opts.signal)
    onProgress(1, sourceOnly ? PROGRESS.writingFromMaterial : PROGRESS.writing)
    await wait(DEMO_DELAY_MS, opts.signal)
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
    onProgress(2, PROGRESS.written)
    return { draft, usage: zeroUsage() }
  }

  async proposeRedesign(tb: Textbook, scope: RedesignScope, lessonId: string, order: string, onProgress: Progress, opts: AiOpts = {}) {
    const f = findLesson(tb, lessonId)!
    onProgress(0, PROGRESS.proposing)
    await wait(DEMO_DELAY_MS, opts.signal)
    const tag = order ? `（${order.slice(0, 16)}）` : '（見直し）'
    let plan: RedesignPlan
    const keepOrChange = (l: Lesson, first: boolean): PlanLesson => ({
      id: l.id,
      title: !isProtectedLesson(l) && first ? `${l.title}${tag}` : l.title,
      minutes: l.minutes,
      isTask: l.isTask,
      summary: l.summary,
    })
    if (scope === 'lesson') {
      plan = { scope, blocks: [`### 作り直した下書き${tag}\nデモ応答の見本。`, '### 要点\n- 作り直しでも、自分のノートは残る'] }
    } else if (scope === 'chapter') {
      let first = true
      const lessons: PlanLesson[] = f.chapter.lessons.map((l) => {
        const r = keepOrChange(l, first && !isProtectedLesson(l))
        if (!isProtectedLesson(l)) first = false
        return r
      })
      lessons.push({ id: null, title: `注文から追加した節${tag}`, minutes: 45, isTask: false, summary: '' })
      plan = { scope, lessons }
    } else {
      plan = {
        scope,
        chapters: [
          ...tb.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            lessons: c.lessons.map((l) => keepOrChange(l, false)),
          })),
          { id: null, title: `追加の章${tag}`, lessons: [{ id: null, title: '新しい節', minutes: 45, isTask: false, summary: '' }] },
        ],
      }
    }
    return { plan, usage: zeroUsage() }
  }
}

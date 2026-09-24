import type { Clues, CourseInput, Textbook } from '../types'
import type { PlanChapter, PlanLesson } from '../lib/protect'

export type AiKind = 'anthropic' | 'compat' | 'local' | 'demo'
export type SearchMode = 'builtin' | 'none'

/** 端末内にだけ保存する設定。教科書のJSONには入らない。 */
export type AiSettings = {
  kind: AiKind
  model: string
  apiKey: string
  search: SearchMode
}

export const DEFAULT_AI: AiSettings = { kind: 'anthropic', model: 'claude-sonnet-5', apiKey: '', search: 'builtin' }

export const MODELS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-opus-5', label: 'Claude Opus 5' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
]

export type Progress = (step: number, detail: string) => void

/** 渡す資料（#63）。txt/md は文字、PDF は base64。教科書の JSON には入れない */
export type MaterialKind = 'text' | 'pdf'
export type Material = { kind: MaterialKind; name: string; size: number; text?: string; data?: string }

/** 生成の追加指定。signal は中止（#14）、materials と sourceOnly は渡す資料（#63） */
export type AiOpts = { signal?: AbortSignal; materials?: Material[]; sourceOnly?: boolean }

export type Usage = { inputTokens: number; outputTokens: number; searches: number }
export const zeroUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0 })

export type QA = { q: string; a: string }

export type CourseDesign = {
  title: string
  goal: string
  chapters: { title: string; lessons: { title: string; minutes: number; isTask: boolean; summary: string }[] }[]
}

/** Web 調査の状態（#81）。途中で切れた（max_tokens か pause_turn の上限）、検索が失敗した回数と理由 */
export type ResearchInfo = { truncated: boolean; searchErrors: string[] }

export type LessonDraft = {
  blocks: string[]
  tasks: string[]
  clues: Clues /** Web 調査が途中で切れた（#17） */
  truncated?: boolean /** 調査の状態（#81） */
  research?: ResearchInfo
}

export type RedesignScope = 'lesson' | 'chapter' | 'course'
export type RedesignPlan =
  | { scope: 'lesson'; blocks: string[] }
  | { scope: 'chapter'; lessons: PlanLesson[] }
  | { scope: 'course'; chapters: PlanChapter[] }

export interface AiProvider {
  askQuestions(input: CourseInput, opts?: AiOpts): Promise<string[]>
  designCourse(
    input: CourseInput,
    qa: QA[],
    note: string,
    onProgress: Progress,
    opts?: AiOpts,
  ): Promise<{ design: CourseDesign; usage: Usage; research?: ResearchInfo }>
  generateLesson(tb: Textbook, lessonId: string, onProgress: Progress, opts?: AiOpts): Promise<{ draft: LessonDraft; usage: Usage }>
  proposeRedesign(
    tb: Textbook,
    scope: RedesignScope,
    lessonId: string,
    order: string,
    onProgress: Progress,
    opts?: AiOpts,
  ): Promise<{ plan: RedesignPlan; usage: Usage }>
}

export type AiErrorCode = 'nokey' | 'auth' | 'rate' | 'network' | 'refusal' | 'parse' | 'unsupported' | 'api' | 'aborted'

export class AiError extends Error {
  code: AiErrorCode
  /** 途中まで使った分（中止時など）。分かるときだけ入る（#14） */
  usage?: Usage
  constructor(code: AiErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AiError'
  }
}

/** 自分でやめたときのエラー（#14） */
export const abortError = (): AiError => new AiError('aborted', '生成をやめました。')
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}

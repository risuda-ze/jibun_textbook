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

export type Usage = { inputTokens: number; outputTokens: number; searches: number }
export const zeroUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0 })

export type QA = { q: string; a: string }

export type CourseDesign = {
  title: string
  goal: string
  chapters: { title: string; lessons: { title: string; minutes: number; isTask: boolean; summary: string }[] }[]
}

export type LessonDraft = { blocks: string[]; tasks: string[]; clues: Clues; /** Web 調査が max_tokens で途中で切れた（#17） */ truncated?: boolean }

export type RedesignScope = 'lesson' | 'chapter' | 'course'
export type RedesignPlan =
  | { scope: 'lesson'; blocks: string[] }
  | { scope: 'chapter'; lessons: PlanLesson[] }
  | { scope: 'course'; chapters: PlanChapter[] }

export interface AiProvider {
  askQuestions(input: CourseInput): Promise<string[]>
  designCourse(input: CourseInput, qa: QA[], note: string, onProgress: Progress): Promise<{ design: CourseDesign; usage: Usage }>
  generateLesson(tb: Textbook, lessonId: string, onProgress: Progress): Promise<{ draft: LessonDraft; usage: Usage }>
  proposeRedesign(tb: Textbook, scope: RedesignScope, lessonId: string, order: string, onProgress: Progress): Promise<{ plan: RedesignPlan; usage: Usage }>
}

export type AiErrorCode = 'nokey' | 'auth' | 'rate' | 'network' | 'refusal' | 'parse' | 'unsupported' | 'api'

export class AiError extends Error {
  code: AiErrorCode
  constructor(code: AiErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AiError'
  }
}

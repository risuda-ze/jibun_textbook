import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { CourseInput, Textbook } from '../types'
import { findLesson, isProtectedLesson, lessonNo } from '../lib/status'
import { AI_MSG } from '../lib/messages'
import {
  AiError,
  MAX_SEARCH_DESIGN,
  MAX_SEARCH_LESSON,
  PROGRESS,
  abortError,
  throwIfAborted,
  zeroUsage,
  type AiOpts,
  type AiProvider,
  type Material,
  type AiSettings,
  type CourseDesign,
  type LessonDraft,
  type Progress,
  type QA,
  type RedesignPlan,
  type RedesignScope,
  type ResearchInfo,
  type Usage,
} from './types'

/**
 * Anthropic API をブラウザから直接呼ぶ。
 * 生成は2段構え: (1) Web検索つきで自由文の調査 → (2) ツールなしで構造化出力。
 * 検索結果には常に出典(citations)が付き、構造化出力と同じリクエストでは衝突しうるため分けている。
 */

const WEB_SEARCH_TYPE = 'web_search_20260209'
const MAX_PAUSE_CONTINUES = 5

/** テストで差し替えられるよう、使うメソッドだけの最小インターフェース */
export interface MessagesLike {
  stream(params: Record<string, unknown>, options?: RequestOpts): { finalMessage(): Promise<AnyMessage> }
  parse(
    params: Record<string, unknown>,
    options?: RequestOpts,
  ): Promise<{ parsed_output: unknown; stop_reason: string | null; usage?: RawUsage }>
}
/** SDK の request options のうち使うもの。signal で中止する（#14） */
export type RequestOpts = { signal?: AbortSignal }
type RawUsage = { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } | null }
type AnyBlock = { type: string; [k: string]: unknown }
type AnyMessage = { content: AnyBlock[]; stop_reason: string | null; usage?: RawUsage }

export type Source = { title: string; url: string }
/** user メッセージの内容。文字だけか、資料のブロック＋文字（#63） */
type Prompt = string | AnyBlock[]

/**
 * 渡された資料をプロンプトに付ける（#63）。文字はそのまま text ブロック、PDF は document ブロック（base64）。
 * 資料が無ければ文字のまま返す。指示文は最後に置く
 */
function withMaterials(prompt: string, mats: Material[]): Prompt {
  if (!mats.length) return prompt
  const blocks: AnyBlock[] = mats.map((m) =>
    m.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m.data ?? '' }, title: m.name }
      : { type: 'text', text: `## 渡された資料: ${m.name}\n${m.text ?? ''}` },
  )
  return [...blocks, { type: 'text', text: prompt }]
}
export type Research = { text: string; sources: Source[]; searchErrors: string[]; truncated: boolean }

export function makeClient(apiKey: string): MessagesLike {
  // ブラウザ直呼びはSDKで既定無効。自分専用でキーは端末内にだけ置くので明示的に許可する。
  const c = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  return c.messages as unknown as MessagesLike
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  // 自分でやめた（#14）。APIUserAbortError は APIError の子なので先に見る
  if (e instanceof Anthropic.APIUserAbortError || (e instanceof Error && e.name === 'AbortError')) return abortError()
  if (e instanceof Anthropic.AuthenticationError) return new AiError('auth', AI_MSG.auth)
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('auth', AI_MSG.permission)
  if (e instanceof Anthropic.RateLimitError) return new AiError('rate', AI_MSG.rate)
  if (e instanceof Anthropic.APIConnectionError) return new AiError('network', AI_MSG.network)
  if (e instanceof Anthropic.APIError) return new AiError('api', AI_MSG.api(e.status ?? '?', e.message))
  // fetch の失敗は TypeError で来る。それ以外の TypeError はコードの不具合なので、接続の案内にせず中身を出す（#88）
  if (e instanceof TypeError && /fetch|network|Load failed/i.test(e.message)) return new AiError('network', AI_MSG.network)
  return new AiError('api', e instanceof Error ? e.message : String(e))
}

export class AnthropicProvider implements AiProvider {
  private messages: MessagesLike
  constructor(
    private settings: AiSettings,
    client?: MessagesLike,
  ) {
    if (!client && !settings.apiKey) throw new AiError('nokey', AI_MSG.nokey)
    this.messages = client ?? makeClient(settings.apiKey)
  }

  private add(u: Usage, raw?: RawUsage) {
    u.inputTokens += raw?.input_tokens ?? 0
    u.outputTokens += raw?.output_tokens ?? 0
    u.searches += raw?.server_tool_use?.web_search_requests ?? 0
  }

  /** 1段目: 調査。pause_turn は内容をそのまま送り返して続行する。検索エラーはHTTP 200で返るので中身で分岐する。 */
  async research(
    system: string,
    prompt: Prompt,
    maxUses: number,
    usage: Usage,
    onDetail?: (d: string) => void,
    signal?: AbortSignal,
  ): Promise<Research> {
    const useSearch = this.settings.search === 'builtin'
    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [{ role: 'user', content: prompt }]
    const out: Research = { text: '', sources: [], searchErrors: [], truncated: false }
    const seen = new Set<string>()
    const addSource = (url: unknown, title: unknown) => {
      if (typeof url !== 'string' || seen.has(url)) return
      seen.add(url)
      out.sources.push({ url, title: typeof title === 'string' && title ? title : url })
    }
    try {
      for (let i = 0; i <= MAX_PAUSE_CONTINUES; i++) {
        throwIfAborted(signal)
        const msg = await this.messages
          .stream(
            {
              model: this.settings.model,
              max_tokens: 16000,
              system,
              messages,
              ...(useSearch ? { tools: [{ type: WEB_SEARCH_TYPE, name: 'web_search', max_uses: maxUses }] } : {}),
            },
            { signal },
          )
          .finalMessage()
        this.add(usage, msg.usage)
        for (const b of msg.content) {
          if (b.type === 'text') {
            out.text += String(b.text ?? '')
            for (const c of (b.citations as AnyBlock[] | undefined) ?? []) addSource(c.url, c.title)
          } else if (b.type === 'web_search_tool_result') {
            // 成功なら配列、エラーなら {type:'web_search_tool_result_error', error_code} の単体オブジェクト
            if (Array.isArray(b.content)) for (const r of b.content as AnyBlock[]) addSource(r.url, r.title)
            else out.searchErrors.push(String((b.content as AnyBlock | undefined)?.error_code ?? 'unknown'))
          } else if (b.type === 'server_tool_use') {
            const q = (b.input as { query?: string } | undefined)?.query
            if (q) onDetail?.(`検索: ${q}`)
          }
        }
        if (msg.stop_reason === 'refusal') throw new AiError('refusal', AI_MSG.refusal)
        if (msg.stop_reason === 'max_tokens') out.truncated = true
        if (msg.stop_reason !== 'pause_turn') break
        messages.push({ role: 'assistant', content: msg.content })
        // 上限まで pause_turn が続いた（続きを打ち切った）ことも「途中で切れた」として知らせる（#81）
        if (i === MAX_PAUSE_CONTINUES) out.truncated = true
      }
    } catch (e) {
      const err = toAiError(e)
      err.usage = usage
      throw err
    }
    return out
  }

  /** 2段目: 構造化。ツールを付けない。 */
  async structure<T extends z.ZodType>(system: string, prompt: Prompt, schema: T, usage: Usage, signal?: AbortSignal): Promise<z.infer<T>> {
    try {
      throwIfAborted(signal)
      const res = await this.messages.parse(
        {
          model: this.settings.model,
          max_tokens: 16000,
          system,
          messages: [{ role: 'user', content: prompt }],
          output_config: { format: zodOutputFormat(schema) },
        },
        { signal },
      )
      this.add(usage, res.usage)
      if (res.stop_reason === 'refusal') throw new AiError('refusal', AI_MSG.refusal)
      if (res.parsed_output == null) throw new AiError('parse', AI_MSG.parse)
      return res.parsed_output as z.infer<T>
    } catch (e) {
      const err = toAiError(e)
      err.usage = usage
      throw err
    }
  }

  async askQuestions(input: CourseInput, opts: AiOpts = {}) {
    const usage = zeroUsage()
    const r = await this.structure(
      SYS,
      `${describeInput(input)}\n\nこの人に合うコースを設計する前に確かめたいことを、2〜3個の質問にする。答えが設計を変える質問だけにする。分野に合わせて具体的に聞く。`,
      z.object({ questions: z.array(z.string()) }),
      usage,
      opts.signal,
    )
    return { questions: r.questions.slice(0, 3), usage }
  }

  async designCourse(input: CourseInput, qa: QA[], note: string, onProgress: Progress, opts: AiOpts = {}) {
    const usage = zeroUsage()
    const who = describeInput(input) + describeQa(qa) + (note ? `\n\n設計への注文: ${note}` : '')
    onProgress(0, PROGRESS.splitting)
    let found = ''
    let research: ResearchInfo | undefined
    if (this.settings.search === 'builtin') {
      onProgress(1, PROGRESS.searching)
      const r = await this.research(
        SYS,
        `${who}\n\nこの人のためのコースを設計する材料を集める。日本語と英語の両方で調べ、公式ドキュメントなどの一次情報を優先する。` +
          `この分野を体系的に学ぶときの標準的な順序、つまずきやすい点、最近変わったことを調べて、要点を日本語でまとめる。`,
        MAX_SEARCH_DESIGN,
        usage,
        (d) => onProgress(1, d),
        opts.signal,
      )
      found = `\n\n## 調査で分かったこと\n${r.text}`
      research = { truncated: r.truncated, searchErrors: r.searchErrors }
    }
    onProgress(2, PROGRESS.designing)
    const design = await this.structure(
      SYS,
      `${who}${found}\n\n上をもとにコースを設計する。\n- 章は4〜9、各章の節は2〜5\n- 節の題は、その節でできるようになることが分かる具体的な言葉にする\n` +
        `- 各章に手を動かす実践課題の節（isTask: true）を1つ入れてよい\n- minutes は所要時間の見積もり（分）\n- summary は節の狙いを1文で\n- すべて日本語`,
      DesignOutZ,
      usage,
      opts.signal,
    )
    onProgress(3, PROGRESS.designed)
    return { design: design as CourseDesign, usage, research }
  }

  async generateLesson(tb: Textbook, lessonId: string, onProgress: Progress, opts: AiOpts = {}) {
    const f = findLesson(tb, lessonId)
    if (!f) throw new AiError('api', AI_MSG.noLesson)
    const usage = zeroUsage()
    const ctx = `${describeInput(tb.input)}\n\nコース: ${tb.title}（${tb.goal}）\n\n${outline(tb)}\n\n今回書く節: ${lessonNo(tb, lessonId)} ${f.lesson.title}\n狙い: ${f.lesson.summary || '（未設定）'}`
    let sources: Source[] = []
    let found = ''
    let truncated = false
    let research: ResearchInfo | undefined
    // 渡された資料（#63）。「この資料だけから作る」なら Web 調査をしない
    const mats = opts.materials ?? []
    const sourceOnly = !!opts.sourceOnly && mats.length > 0
    const matNote = mats.length
      ? `\n\n渡された資料: ${mats.map((m) => m.name).join('、')}。${sourceOnly ? 'この資料だけを根拠に書く。資料に無いことは書かず、足りない所は「資料に無い」と書く' : '本文の主な根拠にし、調査で補う'}`
      : ''
    if (this.settings.search === 'builtin' && !sourceOnly) {
      onProgress(0, PROGRESS.searching)
      // 調査には資料の本文を渡さない（名前だけ）。資料は書く段階でだけ読ませ、入力トークンを二重に使わない（#79）
      const researchNote = mats.length
        ? `\n\n手元に資料がある（${mats.map((m) => m.name).join('、')}。本文は書く段階で読む）。資料を補う事実や最新の情報を集める。`
        : ''
      const r = await this.research(
        SYS,
        `${ctx}${researchNote}\n\nこの節の教材を書くための事実を集める。日本語と英語の両方で調べ、公式ドキュメントなどの一次情報を優先する。` +
          `手順・数値・用語は出典で確かめる。分かったことを日本語で整理する。`,
        MAX_SEARCH_LESSON,
        usage,
        (d) => onProgress(0, d),
        opts.signal,
      )
      sources = r.sources
      truncated = r.truncated
      research = { truncated: r.truncated, searchErrors: r.searchErrors }
      found = `\n\n## 調査で分かったこと\n${r.text}\n\n## 見つけたページ\n${sources.map((s, i) => `[${i}] ${s.title} ${s.url}`).join('\n')}`
    }
    onProgress(1, sourceOnly ? PROGRESS.writingFromMaterial : PROGRESS.writing)
    const d = await this.structure(
      SYS,
      withMaterials(
        `${ctx}${found}${matNote}\n\nこの節の教材を書く。\n- blocks: 本文を意味のまとまりごとに3〜7個に分ける。各要素はMarkdown。見出しは ### を使う。コード・表・式も使ってよい\n` +
          `- 読み手が自分で確かめて書き込む前提の「下書き」。断定しすぎず、確かめるべき点は確かめ方を添える\n` +
          `- tasks: この節で実際に手を動かすこと3〜5個\n- queries: 自分で調べるときの検索語3〜5個\n- how: 本文が正しいか自分で確かめる方法2〜3個\n` +
          `- linkIndexes: 「見つけたページ」のうち一次情報として読む価値が高いものの番号（無ければ空）\n- すべて日本語`,
        mats,
      ),
      LessonOutZ,
      usage,
      opts.signal,
    )
    const fetchedAt = new Date().toISOString().slice(0, 10)
    const links = d.linkIndexes
      .filter((i) => Number.isInteger(i) && sources[i])
      .slice(0, 6)
      .map((i) => ({ ...sources[i], fetchedAt }))
    const draft: LessonDraft = { blocks: d.blocks, tasks: d.tasks, clues: { queries: d.queries, how: d.how, links }, truncated, research }
    onProgress(2, PROGRESS.written)
    return { draft, usage }
  }

  async proposeRedesign(tb: Textbook, scope: RedesignScope, lessonId: string, order: string, onProgress: Progress, opts: AiOpts = {}) {
    const f = findLesson(tb, lessonId)
    if (!f) throw new AiError('api', AI_MSG.noLesson)
    const usage = zeroUsage()
    onProgress(0, PROGRESS.proposing)
    const base = `${describeInput(tb.input)}\n\nコース: ${tb.title}（${tb.goal}）\n\n${outline(tb, true)}\n\n注文: ${order || '（特になし。より良くする）'}`
    let plan: RedesignPlan
    if (scope === 'lesson') {
      const r = await this.structure(
        SYS,
        `${base}\n\n節「${f.lesson.title}」のAIの下書きだけを書き直す。今の下書き:\n${
          f.lesson.blocks
            .filter((b) => b.by === 'ai' && !b.edited)
            .map((b) => b.md)
            .join('\n\n---\n\n') || '（なし）'
        }\n\n` + `blocks に新しい本文をMarkdownで3〜7個。見出しは ###。日本語。`,
        z.object({ blocks: z.array(z.string()) }),
        usage,
        opts.signal,
      )
      plan = { scope, blocks: r.blocks }
    } else if (scope === 'chapter') {
      const r = await this.structure(
        SYS,
        `${base}\n\n第${f.ci + 1}章「${f.chapter.title}」の節の並びだけを見直す。\n- 既存の節を残すときは id をそのまま書く。新しい節は id を空文字にする\n- 【守る】と付いた節は変更も削除もできない。必ず id を含める`,
        z.object({ lessons: z.array(PlanLessonZ) }),
        usage,
        opts.signal,
      )
      plan = { scope, lessons: r.lessons.map((l) => ({ ...l, id: l.id || null })) }
    } else {
      const r = await this.structure(
        SYS,
        `${base}\n\nコース全体の章と節を見直す。\n- 既存の章・節を残すときは id をそのまま書く。新しいものは id を空文字にする\n- 【守る】と付いた節は変更も削除もできない。必ず元の章に id を含める`,
        z.object({ chapters: z.array(z.object({ id: z.string(), title: z.string(), lessons: z.array(PlanLessonZ) })) }),
        usage,
        opts.signal,
      )
      plan = {
        scope,
        chapters: r.chapters.map((c) => ({ ...c, id: c.id || null, lessons: c.lessons.map((l) => ({ ...l, id: l.id || null })) })),
      }
    }
    return { plan, usage }
  }
}

const SYS =
  'あなたは独学者のための教材づくりを手伝う。読み手は1人で、AIの下書きに自分で確かめたことを書き込んで自分の教科書に育てる。' +
  '分野は問わない。本文は日本語で、平易に、具体例を添えて書く。事実に自信がないことは、そう書く。'

const PlanLessonZ = z.object({ id: z.string(), title: z.string(), minutes: z.number(), isTask: z.boolean(), summary: z.string() })

/** AI の出力（設計）のスキーマ。保存形式の types.ts の TextbookZ とは別物 */
const DesignOutZ = z.object({
  title: z.string(),
  goal: z.string(),
  chapters: z.array(
    z.object({
      title: z.string(),
      lessons: z.array(z.object({ title: z.string(), minutes: z.number(), isTask: z.boolean(), summary: z.string() })),
    }),
  ),
})

/** AI の出力（節）のスキーマ。保存形式の types.ts の LessonZ とは別物 */
const LessonOutZ = z.object({
  blocks: z.array(z.string()),
  tasks: z.array(z.string()),
  queries: z.array(z.string()),
  how: z.array(z.string()),
  linkIndexes: z.array(z.number()),
})

function describeInput(i: CourseInput): string {
  return `## 学ぶ人\n学びたいこと: ${i.prompt}\n今できること: ${i.can || '（未記入）'}\n使える時間・期限: ${i.time || '（未記入）'}\n道具・環境: ${i.env || '（未記入）'}`
}

function describeQa(qa: QA[]): string {
  const a = qa.filter((x) => x.a.trim())
  return a.length ? `\n\n## 確認への回答\n${a.map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n')}` : ''
}

function outline(tb: Textbook, withIds = false): string {
  return (
    '## 今の設計\n' +
    tb.chapters
      .map(
        (c, ci) =>
          `第${ci + 1}章 ${c.title}${withIds ? ` (id: ${c.id})` : ''}\n` +
          c.lessons
            .map((l, li) => `  ${ci + 1}-${li + 1} ${l.title}${withIds ? ` (id: ${l.id})${isProtectedLesson(l) ? '【守る】' : ''}` : ''}`)
            .join('\n'),
      )
      .join('\n')
  )
}

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { CourseInput, Textbook } from '../types'
import { findLesson, isProtectedLesson, lessonNo } from '../lib/status'
import {
  AiError, zeroUsage, type AiProvider, type AiSettings, type CourseDesign, type LessonDraft,
  type Progress, type QA, type RedesignPlan, type RedesignScope, type Usage,
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
  stream(params: Record<string, unknown>): { finalMessage(): Promise<AnyMessage> }
  parse(params: Record<string, unknown>): Promise<{ parsed_output: unknown; stop_reason: string | null; usage?: RawUsage }>
}
type RawUsage = { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } | null }
type AnyBlock = { type: string; [k: string]: unknown }
type AnyMessage = { content: AnyBlock[]; stop_reason: string | null; usage?: RawUsage }

export type Source = { title: string; url: string }
export type Research = { text: string; sources: Source[]; searchErrors: string[]; truncated: boolean }

export function makeClient(apiKey: string): MessagesLike {
  // ブラウザ直呼びはSDKで既定無効。自分専用でキーは端末内にだけ置くので明示的に許可する。
  const c = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  return c.messages as unknown as MessagesLike
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof Anthropic.AuthenticationError) return new AiError('auth', 'APIキーが正しく認証されませんでした。キーを入れ直してください。')
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('auth', 'このキーでは使用できない機能またはモデルです。モデルを変更するか、Web調査を「検索なし」にしてください。')
  if (e instanceof Anthropic.RateLimitError) return new AiError('rate', '利用上限に達しました。しばらく待ってから、もう一度お試しください。')
  if (e instanceof Anthropic.APIConnectionError) return new AiError('network', 'ネットワークに接続できませんでした。接続を確認してから、もう一度お試しください。')
  if (e instanceof Anthropic.APIError) return new AiError('api', `APIエラーが発生しました（${e.status ?? '?'}）: ${e.message}`)
  if (e instanceof TypeError) return new AiError('network', 'ネットワークに接続できませんでした。接続を確認してから、もう一度お試しください。')
  return new AiError('api', e instanceof Error ? e.message : String(e))
}

export class AnthropicProvider implements AiProvider {
  private messages: MessagesLike
  constructor(private settings: AiSettings, client?: MessagesLike) {
    if (!client && !settings.apiKey) throw new AiError('nokey', 'APIキーが未設定です。「使うAI」でキーを入力してください。')
    this.messages = client ?? makeClient(settings.apiKey)
  }

  private add(u: Usage, raw?: RawUsage) {
    u.inputTokens += raw?.input_tokens ?? 0
    u.outputTokens += raw?.output_tokens ?? 0
    u.searches += raw?.server_tool_use?.web_search_requests ?? 0
  }

  /** 1段目: 調査。pause_turn は内容をそのまま送り返して続行する。検索エラーはHTTP 200で返るので中身で分岐する。 */
  async research(system: string, prompt: string, maxUses: number, usage: Usage, onDetail?: (d: string) => void): Promise<Research> {
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
        const msg = await this.messages
          .stream({
            model: this.settings.model,
            max_tokens: 16000,
            system,
            messages,
            ...(useSearch ? { tools: [{ type: WEB_SEARCH_TYPE, name: 'web_search', max_uses: maxUses }] } : {}),
          })
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
        if (msg.stop_reason === 'refusal') throw new AiError('refusal', 'この内容についてはモデルが応答を控えました。言い回しを変えるか、モデルを切り替えてください。')
        if (msg.stop_reason === 'max_tokens') out.truncated = true
        if (msg.stop_reason !== 'pause_turn') break
        messages.push({ role: 'assistant', content: msg.content })
      }
    } catch (e) {
      throw toAiError(e)
    }
    return out
  }

  /** 2段目: 構造化。ツールを付けない。 */
  async structure<T extends z.ZodType>(system: string, prompt: string, schema: T, usage: Usage): Promise<z.infer<T>> {
    try {
      const res = await this.messages.parse({
        model: this.settings.model,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: zodOutputFormat(schema) },
      })
      this.add(usage, res.usage)
      if (res.stop_reason === 'refusal') throw new AiError('refusal', 'この内容についてはモデルが応答を控えました。言い回しを変えるか、モデルを切り替えてください。')
      if (res.parsed_output == null) throw new AiError('parse', 'AIの返答を読み取れませんでした。もう一度お試しください。')
      return res.parsed_output as z.infer<T>
    } catch (e) {
      throw toAiError(e)
    }
  }

  async askQuestions(input: CourseInput): Promise<string[]> {
    const r = await this.structure(
      SYS,
      `${describeInput(input)}\n\nこの人に合うコースを設計する前に確かめたいことを、2〜3個の質問にする。答えが設計を変える質問だけにする。分野に合わせて具体的に聞く。`,
      z.object({ questions: z.array(z.string()) }),
      zeroUsage(),
    )
    return r.questions.slice(0, 3)
  }

  async designCourse(input: CourseInput, qa: QA[], note: string, onProgress: Progress) {
    const usage = zeroUsage()
    const who = describeInput(input) + describeQa(qa) + (note ? `\n\n設計への注文: ${note}` : '')
    onProgress(0, '学びたいことを分解している')
    let found = ''
    if (this.settings.search === 'builtin') {
      onProgress(1, 'Webを調査している')
      const r = await this.research(
        SYS,
        `${who}\n\nこの人のためのコースを設計する材料を集める。日本語と英語の両方で調べ、公式ドキュメントなどの一次情報を優先する。` +
          `この分野を体系的に学ぶときの標準的な順序、つまずきやすい点、最近変わったことを調べて、要点を日本語でまとめる。`,
        8, usage, (d) => onProgress(1, d),
      )
      found = `\n\n## 調査で分かったこと\n${r.text}`
    }
    onProgress(2, 'コース設計を作っている')
    const design = await this.structure(
      SYS,
      `${who}${found}\n\n上をもとにコースを設計する。\n- 章は4〜9、各章の節は2〜5\n- 節の題は、その節でできるようになることが分かる具体的な言葉にする\n` +
        `- 各章に手を動かす実践課題の節（isTask: true）を1つ入れてよい\n- minutes は所要時間の見積もり（分）\n- summary は節の狙いを1文で\n- すべて日本語`,
      DesignZ, usage,
    )
    onProgress(3, '設計ができた')
    return { design: design as CourseDesign, usage }
  }

  async generateLesson(tb: Textbook, lessonId: string, onProgress: Progress) {
    const f = findLesson(tb, lessonId)
    if (!f) throw new AiError('api', '節が見つかりませんでした。')
    const usage = zeroUsage()
    const ctx = `${describeInput(tb.input)}\n\nコース: ${tb.title}（${tb.goal}）\n\n${outline(tb)}\n\n今回書く節: ${lessonNo(tb, lessonId)} ${f.lesson.title}\n狙い: ${f.lesson.summary || '（未設定）'}`
    let sources: Source[] = []
    let found = ''
    if (this.settings.search === 'builtin') {
      onProgress(0, 'Webを調査している')
      const r = await this.research(
        SYS,
        `${ctx}\n\nこの節の教材を書くための事実を集める。日本語と英語の両方で調べ、公式ドキュメントなどの一次情報を優先する。` +
          `手順・数値・用語は出典で確かめる。分かったことを日本語で整理する。`,
        5, usage, (d) => onProgress(0, d),
      )
      sources = r.sources
      found = `\n\n## 調査で分かったこと\n${r.text}\n\n## 見つけたページ\n${sources.map((s, i) => `[${i}] ${s.title} ${s.url}`).join('\n')}`
    }
    onProgress(1, '資料を書いている')
    const d = await this.structure(
      SYS,
      `${ctx}${found}\n\nこの節の教材を書く。\n- blocks: 本文を意味のまとまりごとに3〜7個に分ける。各要素はMarkdown。見出しは ### を使う。コード・表・式も使ってよい\n` +
        `- 読み手が自分で確かめて書き込む前提の「下書き」。断定しすぎず、確かめるべき点は確かめ方を添える\n` +
        `- tasks: この節で実際に手を動かすこと3〜5個\n- queries: 自分で調べるときの検索語3〜5個\n- how: 本文が正しいか自分で確かめる方法2〜3個\n` +
        `- linkIndexes: 「見つけたページ」のうち一次情報として読む価値が高いものの番号（無ければ空）\n- すべて日本語`,
      LessonZ, usage,
    )
    const fetchedAt = new Date().toISOString().slice(0, 10)
    const links = d.linkIndexes.filter((i) => Number.isInteger(i) && sources[i]).slice(0, 6).map((i) => ({ ...sources[i], fetchedAt }))
    const draft: LessonDraft = { blocks: d.blocks, tasks: d.tasks, clues: { queries: d.queries, how: d.how, links } }
    onProgress(2, '資料ができた')
    return { draft, usage }
  }

  async proposeRedesign(tb: Textbook, scope: RedesignScope, lessonId: string, order: string, onProgress: Progress) {
    const f = findLesson(tb, lessonId)
    if (!f) throw new AiError('api', '節が見つかりませんでした。')
    const usage = zeroUsage()
    onProgress(0, '変更案を作っている')
    const base = `${describeInput(tb.input)}\n\nコース: ${tb.title}（${tb.goal}）\n\n${outline(tb, true)}\n\n注文: ${order || '（特になし。より良くする）'}`
    let plan: RedesignPlan
    if (scope === 'lesson') {
      const r = await this.structure(
        SYS,
        `${base}\n\n節「${f.lesson.title}」のAIの下書きだけを書き直す。今の下書き:\n${f.lesson.blocks.filter((b) => b.by === 'ai' && !b.edited).map((b) => b.md).join('\n\n---\n\n') || '（なし）'}\n\n` +
          `blocks に新しい本文をMarkdownで3〜7個。見出しは ###。日本語。`,
        z.object({ blocks: z.array(z.string()) }), usage,
      )
      plan = { scope, blocks: r.blocks }
    } else if (scope === 'chapter') {
      const r = await this.structure(
        SYS,
        `${base}\n\n第${f.ci + 1}章「${f.chapter.title}」の節の並びだけを見直す。\n- 既存の節を残すときは id をそのまま書く。新しい節は id を空文字にする\n- 【守る】と付いた節は変更も削除もできない。必ず id を含める`,
        z.object({ lessons: z.array(PlanLessonZ) }), usage,
      )
      plan = { scope, lessons: r.lessons.map((l) => ({ ...l, id: l.id || null })) }
    } else {
      const r = await this.structure(
        SYS,
        `${base}\n\nコース全体の章と節を見直す。\n- 既存の章・節を残すときは id をそのまま書く。新しいものは id を空文字にする\n- 【守る】と付いた節は変更も削除もできない。必ず元の章に id を含める`,
        z.object({ chapters: z.array(z.object({ id: z.string(), title: z.string(), lessons: z.array(PlanLessonZ) })) }), usage,
      )
      plan = { scope, chapters: r.chapters.map((c) => ({ ...c, id: c.id || null, lessons: c.lessons.map((l) => ({ ...l, id: l.id || null })) })) }
    }
    return { plan, usage }
  }
}

const SYS =
  'あなたは独学者のための教材づくりを手伝う。読み手は1人で、AIの下書きに自分で確かめたことを書き込んで自分の教科書に育てる。' +
  '分野は問わない。本文は日本語で、平易に、具体例を添えて書く。事実に自信がないことは、そう書く。'

const PlanLessonZ = z.object({ id: z.string(), title: z.string(), minutes: z.number(), isTask: z.boolean(), summary: z.string() })

const DesignZ = z.object({
  title: z.string(),
  goal: z.string(),
  chapters: z.array(z.object({
    title: z.string(),
    lessons: z.array(z.object({ title: z.string(), minutes: z.number(), isTask: z.boolean(), summary: z.string() })),
  })),
})

const LessonZ = z.object({
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
  return '## 今の設計\n' + tb.chapters.map((c, ci) =>
    `第${ci + 1}章 ${c.title}${withIds ? ` (id: ${c.id})` : ''}\n` +
    c.lessons.map((l, li) => `  ${ci + 1}-${li + 1} ${l.title}${withIds ? ` (id: ${l.id})${isProtectedLesson(l) ? '【守る】' : ''}` : ''}`).join('\n'),
  ).join('\n')
}

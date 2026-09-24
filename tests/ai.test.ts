import { describe, expect, it } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { AnthropicProvider, type MessagesLike } from '../src/ai/anthropic'
import { DemoProvider } from '../src/ai/demo'
import { getProvider } from '../src/ai'
import { AiError, DEFAULT_AI, zeroUsage, type AiSettings } from '../src/ai/types'
import { newChapter, newLesson, newTextbook } from '../src/types'

const settings: AiSettings = { ...DEFAULT_AI, apiKey: 'test' }

type Msg = { content: Record<string, unknown>[]; stop_reason: string; usage?: Record<string, unknown> }

/** stream() と parse() の応答を順に返す偽クライアント。呼ばれた引数も記録する。 */
function fake(streams: (Msg | Error)[], parses: (Record<string, unknown> | Error)[] = []) {
  const calls = { stream: [] as Record<string, unknown>[], parse: [] as Record<string, unknown>[], opts: [] as unknown[] }
  const client: MessagesLike = {
    stream(params, options) {
      calls.stream.push(structuredClone(params))
      calls.opts.push(options)
      const next = streams.shift()
      return {
        finalMessage: async () => {
          if (!next) throw new Error('no more')
          if (next instanceof Error) throw next
          return next as never
        },
      }
    },
    async parse(params, options) {
      calls.parse.push(params)
      calls.opts.push(options)
      const next = parses.shift()
      if (!next) throw new Error('no more')
      if (next instanceof Error) throw next
      return next as never
    },
  }
  return { client, calls }
}

const text = (t: string, citations?: Record<string, unknown>[]) => ({ type: 'text', text: t, ...(citations ? { citations } : {}) })

describe('調査（1段目）', () => {
  it('pause_turn は assistant の内容をそのまま送り返して続行する', async () => {
    const paused: Msg = {
      stop_reason: 'pause_turn',
      content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'rust ownership' } },
        {
          type: 'web_search_tool_result',
          tool_use_id: 's1',
          content: [{ type: 'web_search_result', url: 'https://doc.rust-lang.org/book/', title: 'The Book', encrypted_content: 'ENC' }],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 10, server_tool_use: { web_search_requests: 1 } },
    }
    const done: Msg = {
      stop_reason: 'end_turn',
      content: [
        text('所有権は'),
        text('値ごとに1つ。', [{ type: 'web_search_result_location', url: 'https://example.com/a', title: 'A', cited_text: 'x' }]),
      ],
      usage: { input_tokens: 200, output_tokens: 20 },
    }
    const { client, calls } = fake([paused, done])
    const usage = zeroUsage()
    const details: string[] = []
    const r = await new AnthropicProvider(settings, client).research('sys', '調べて', 5, usage, (d) => details.push(d))

    expect(calls.stream).toHaveLength(2)
    const second = calls.stream[1].messages as { role: string; content: unknown }[]
    expect(second).toHaveLength(2)
    expect(second[1]).toEqual({ role: 'assistant', content: paused.content })
    expect(r.text).toBe('所有権は値ごとに1つ。')
    expect(r.sources.map((s) => s.url)).toEqual(['https://doc.rust-lang.org/book/', 'https://example.com/a'])
    expect(usage).toEqual({ inputTokens: 300, outputTokens: 30, searches: 1 })
    expect(details).toEqual(['検索: rust ownership'])
  })

  it('Web検索ツールを max_uses つきで付ける。検索なしなら付けない', async () => {
    const end: Msg = { stop_reason: 'end_turn', content: [text('ok')] }
    const a = fake([end])
    await new AnthropicProvider(settings, a.client).research('s', 'p', 5, zeroUsage())
    expect(a.calls.stream[0].tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }])
    const b = fake([{ ...end }])
    await new AnthropicProvider({ ...settings, search: 'none' }, b.client).research('s', 'p', 5, zeroUsage())
    expect(b.calls.stream[0].tools).toBeUndefined()
  })

  it('検索エラーはHTTP 200で返る。例外にせず記録して続ける', async () => {
    const { client } = fake([
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'web_search_tool_result',
            tool_use_id: 's1',
            content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
          },
          text('分かった範囲で書く'),
        ],
      },
    ])
    const r = await new AnthropicProvider(settings, client).research('s', 'p', 1, zeroUsage())
    expect(r.searchErrors).toEqual(['max_uses_exceeded'])
    expect(r.sources).toEqual([])
    expect(r.text).toBe('分かった範囲で書く')
  })

  it('pause_turn が続いても打ち切る', async () => {
    const p: Msg = { stop_reason: 'pause_turn', content: [text('…')] }
    const { client, calls } = fake(Array.from({ length: 20 }, () => ({ ...p })))
    const r = await new AnthropicProvider(settings, client).research('s', 'p', 1, zeroUsage())
    expect(calls.stream.length).toBeLessThanOrEqual(6)
    // 打ち切ったことは「途中で切れた」として返す（#81）
    expect(r.truncated).toBe(true)
  })

  it('refusal は分かる言葉のエラーにする', async () => {
    const { client } = fake([{ stop_reason: 'refusal', content: [] }])
    await expect(new AnthropicProvider(settings, client).research('s', 'p', 1, zeroUsage())).rejects.toMatchObject({ code: 'refusal' })
  })

  it('max_tokens で切れたら途中までの文を使い、切れたことを返す', async () => {
    const { client } = fake([{ stop_reason: 'max_tokens', content: [text('途中まで')] }])
    const r = await new AnthropicProvider(settings, client).research('s', 'p', 1, zeroUsage())
    expect(r).toMatchObject({ text: '途中まで', truncated: true })
  })

  it('ネットワーク断・認証失敗・利用上限を区別する', async () => {
    const run = (e: Error) => new AnthropicProvider(settings, fake([e]).client).research('s', 'p', 1, zeroUsage())
    await expect(run(new Anthropic.APIConnectionError({ message: 'down' }))).rejects.toMatchObject({ code: 'network' })
    await expect(run(new TypeError('Failed to fetch'))).rejects.toMatchObject({ code: 'network' })
    await expect(run(new Anthropic.AuthenticationError(401, undefined, 'bad key', new Headers()))).rejects.toMatchObject({ code: 'auth' })
    await expect(run(new Anthropic.RateLimitError(429, undefined, 'slow', new Headers()))).rejects.toMatchObject({ code: 'rate' })
  })
})

describe('構造化（2段目）', () => {
  it('ツールを付けず、output_config.format を付ける', async () => {
    const { client, calls } = fake([], [{ parsed_output: { questions: ['a', 'b', 'c', 'd'] }, stop_reason: 'end_turn' }])
    const qs = await new AnthropicProvider(settings, client).askQuestions({ prompt: 'Rust', can: '', time: '', env: '' })
    expect(qs).toEqual(['a', 'b', 'c'])
    expect(calls.parse[0].tools).toBeUndefined()
    expect((calls.parse[0].output_config as { format: unknown }).format).toBeTruthy()
    expect(calls.parse[0].model).toBe('claude-sonnet-5')
  })
  it('parsed_output が null なら parse エラー', async () => {
    const { client } = fake([], [{ parsed_output: null, stop_reason: 'end_turn' }])
    await expect(new AnthropicProvider(settings, client).askQuestions({ prompt: 'x', can: '', time: '', env: '' })).rejects.toMatchObject({
      code: 'parse',
    })
  })
})

describe('節の生成', () => {
  const tb = newTextbook('Rust入門', {
    goal: 'CLIを書く',
    chapters: [newChapter('所有権', [newLesson('ムーブ', { summary: 'ムーブを理解する' })])],
  })
  const lessonId = tb.chapters[0].lessons[0].id

  it('一次情報リンクは調査で実際に見つけたページからだけ作る（AIが書いたURLは使わない）', async () => {
    const { client, calls } = fake(
      [
        {
          stop_reason: 'end_turn',
          content: [
            {
              type: 'web_search_tool_result',
              tool_use_id: 's',
              content: [
                { type: 'web_search_result', url: 'https://doc.rust-lang.org/book/ch04-01.html', title: 'What Is Ownership?' },
                { type: 'web_search_result', url: 'https://example.com/blog', title: 'Blog' },
              ],
            },
            text('調査メモ'),
          ],
        },
      ],
      [
        {
          parsed_output: {
            blocks: ['### ムーブ\n本文', ''],
            tasks: ['試す'],
            queries: ['rust move'],
            how: ['コンパイルする'],
            linkIndexes: [0, 7, -1, 0.5],
          },
          stop_reason: 'end_turn',
        },
      ],
    )
    const steps: number[] = []
    const { draft } = await new AnthropicProvider(settings, client).generateLesson(tb, lessonId, (s) => steps.push(s))
    expect(draft.clues.links.map((l) => l.url)).toEqual(['https://doc.rust-lang.org/book/ch04-01.html'])
    expect(draft.clues.links[0].fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(draft.blocks[0]).toContain('### ムーブ')
    expect(steps).toEqual([0, 1, 2])
    // 2段目の入力に、1段目の調査結果と見つけたページの一覧が入っている
    const prompt = (calls.parse[0].messages as { content: string }[])[0].content
    expect(prompt).toContain('調査メモ')
    expect(prompt).toContain('[0] What Is Ownership?')
  })

  it('検索なしなら調査を飛ばして構造化だけ呼ぶ', async () => {
    const { client, calls } = fake(
      [],
      [{ parsed_output: { blocks: ['a'], tasks: [], queries: [], how: [], linkIndexes: [] }, stop_reason: 'end_turn' }],
    )
    await new AnthropicProvider({ ...settings, search: 'none' }, client).generateLesson(tb, lessonId, () => {})
    expect(calls.stream).toHaveLength(0)
    expect(calls.parse).toHaveLength(1)
  })
})

describe('設計を直す', () => {
  it('守る節に【守る】を付けてAIに渡し、空文字のidは新規として扱う', async () => {
    const kept = newLesson('完了の節', { done: true })
    const tb = newTextbook('本', { chapters: [newChapter('章', [kept, newLesson('下書き')])] })
    const { client, calls } = fake(
      [],
      [
        {
          parsed_output: {
            lessons: [
              { id: kept.id, title: 'x', minutes: 1, isTask: false, summary: '' },
              { id: '', title: '新', minutes: 1, isTask: false, summary: '' },
            ],
          },
          stop_reason: 'end_turn',
        },
      ],
    )
    const { plan } = await new AnthropicProvider(settings, client).proposeRedesign(tb, 'chapter', kept.id, '短く', () => {})
    const prompt = (calls.parse[0].messages as { content: string }[])[0].content
    expect(prompt).toContain(`(id: ${kept.id})【守る】`)
    expect(prompt).toContain('注文: 短く')
    expect(plan).toMatchObject({ scope: 'chapter', lessons: [{ id: kept.id }, { id: null, title: '新' }] })
  })
})

describe('接続先の切り替え', () => {
  it('キー未設定・未対応の接続先は分かる言葉で断る', () => {
    expect(() => getProvider({ ...DEFAULT_AI, apiKey: '' })).toThrowError(AiError)
    expect(() => getProvider({ ...DEFAULT_AI, kind: 'local' })).toThrowError(/まだ使用できません/)
    expect(getProvider({ ...DEFAULT_AI, kind: 'demo' })).toBeTruthy()
  })
})

describe('生成の中止（#14）', () => {
  const tb = newTextbook('t', { chapters: [newChapter('c', [newLesson('l')])] })
  const lessonId = tb.chapters[0].lessons[0].id

  it('中止済みの signal なら API を呼ばずに aborted で終わる', async () => {
    const { client, calls } = fake([], [])
    const c = new AbortController()
    c.abort()
    await expect(
      new AnthropicProvider(settings, client).generateLesson(tb, lessonId, () => {}, { signal: c.signal }),
    ).rejects.toMatchObject({ code: 'aborted' })
    expect(calls.stream).toHaveLength(0)
    expect(calls.parse).toHaveLength(0)
  })
  it('signal を SDK に渡し、SDK の中止エラーは aborted にする。途中まで使った分を返す', async () => {
    const c = new AbortController()
    const { client, calls } = fake(
      [
        {
          stop_reason: 'pause_turn',
          content: [text('途中')],
          usage: { input_tokens: 10, output_tokens: 1, server_tool_use: { web_search_requests: 2 } },
        },
        new Anthropic.APIUserAbortError({ message: 'aborted' }),
      ],
      [],
    )
    const p = new AnthropicProvider(settings, client).generateLesson(tb, lessonId, () => {}, { signal: c.signal })
    await expect(p).rejects.toMatchObject({ code: 'aborted', usage: { searches: 2 } })
    expect((calls.opts[0] as { signal?: AbortSignal }).signal).toBe(c.signal)
    expect(calls.parse).toHaveLength(0)
  })
  it('デモ応答も途中で中止できる', async () => {
    const c = new AbortController()
    const p = new DemoProvider().generateLesson(tb, lessonId, () => {}, { signal: c.signal })
    c.abort()
    await expect(p).rejects.toMatchObject({ code: 'aborted' })
  })
})

describe('渡された資料（#63）', () => {
  const tb = newTextbook('t', { chapters: [newChapter('c', [newLesson('l')])] })
  const lessonId = tb.chapters[0].lessons[0].id
  const out = { parsed_output: { blocks: ['a'], tasks: [], queries: [], how: [], linkIndexes: [] }, stop_reason: 'end_turn' }
  const mats = [
    { kind: 'text' as const, name: 'notes.md', size: 3, text: '所有権のメモ' },
    { kind: 'pdf' as const, name: 'paper.pdf', size: 4, data: 'JVBERg==' },
  ]

  it('「この資料だけから作る」は Web 検索をせず、文字は text・PDF は document ブロックで渡す', async () => {
    const { client, calls } = fake([], [out])
    await new AnthropicProvider(settings, client).generateLesson(tb, lessonId, () => {}, { materials: mats, sourceOnly: true })
    expect(calls.stream).toHaveLength(0)
    expect(calls.parse).toHaveLength(1)
    const content = (calls.parse[0].messages as { content: Record<string, unknown>[] }[])[0].content
    expect(content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('渡された資料: notes.md') })
    expect(content[0]).toMatchObject({ text: expect.stringContaining('所有権のメモ') })
    expect(content[1]).toMatchObject({
      type: 'document',
      title: 'paper.pdf',
      source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERg==' },
    })
    expect((content[2] as { text: string }).text).toContain('この資料だけを根拠に書く')
  })
  it('資料があっても調査する時は、調査には資料の本文を渡さず（名前だけ）、書く段階で全部渡す', async () => {
    const { client, calls } = fake([{ stop_reason: 'end_turn', content: [text('調査メモ')] }], [out])
    await new AnthropicProvider(settings, client).generateLesson(tb, lessonId, () => {}, { materials: mats, sourceOnly: false })
    expect(calls.stream).toHaveLength(1)
    expect(calls.stream[0].tools).toBeDefined()
    const research = (calls.stream[0].messages as { content: unknown }[])[0].content
    expect(typeof research).toBe('string')
    expect(research as string).toContain('notes.md')
    expect(research as string).not.toContain('所有権のメモ')
    const write = (calls.parse[0].messages as { content: Record<string, unknown>[] }[])[0].content
    expect(write.map((b) => b.type)).toEqual(['text', 'document', 'text'])
    expect((write[2] as { text: string }).text).toContain('本文の主な根拠にし、調査で補う')
  })
  it('資料が無ければ従来どおり文字だけのプロンプト', async () => {
    const { client, calls } = fake([], [out])
    await new AnthropicProvider({ ...settings, search: 'none' }, client).generateLesson(tb, lessonId, () => {}, { sourceOnly: true })
    expect(typeof (calls.parse[0].messages as { content: unknown }[])[0].content).toBe('string')
  })
})

describe('調査の状態を知らせる（#81）', () => {
  const tb = newTextbook('t', { chapters: [newChapter('c', [newLesson('l')])] })
  const lessonId = tb.chapters[0].lessons[0].id
  const out = { parsed_output: { blocks: ['a'], tasks: [], queries: [], how: [], linkIndexes: [] }, stop_reason: 'end_turn' }
  const searchError = {
    type: 'web_search_tool_result',
    tool_use_id: 's',
    content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
  }

  it('節の生成: 検索の失敗と切り詰めを draft.research に載せる', async () => {
    const { client } = fake([{ stop_reason: 'max_tokens', content: [searchError, text('途中')] }], [out])
    const { draft } = await new AnthropicProvider(settings, client).generateLesson(tb, lessonId, () => {})
    expect(draft.research).toEqual({ truncated: true, searchErrors: ['max_uses_exceeded'] })
  })
  it('設計: 同じ情報を research に載せる。検索なしなら undefined', async () => {
    const design = {
      title: 't',
      goal: 'g',
      chapters: [{ title: 'c', lessons: [{ title: 'l', minutes: 30, isTask: false, summary: 's' }] }],
    }
    const { client } = fake([{ stop_reason: 'end_turn', content: [searchError] }], [{ parsed_output: design, stop_reason: 'end_turn' }])
    const r = await new AnthropicProvider(settings, client).designCourse({ prompt: 'p', can: '', time: '', env: '' }, [], '', () => {})
    expect(r.research).toEqual({ truncated: false, searchErrors: ['max_uses_exceeded'] })
    const { client: c2 } = fake([], [{ parsed_output: design, stop_reason: 'end_turn' }])
    const r2 = await new AnthropicProvider({ ...settings, search: 'none' }, c2).designCourse(
      { prompt: 'p', can: '', time: '', env: '' },
      [],
      '',
      () => {},
    )
    expect(r2.research).toBeUndefined()
  })
})

describe('デモ応答の設計を直す（#83）', () => {
  const tb = newTextbook('t', { chapters: [newChapter('c', [newLesson('a'), newLesson('b', { done: true })])] })
  const lessonId = tb.chapters[0].lessons[0].id
  it('節だけ: 下書きが2つ', async () => {
    const { plan } = await new DemoProvider().proposeRedesign(tb, 'lesson', lessonId, '', () => {})
    expect(plan.scope).toBe('lesson')
    if (plan.scope === 'lesson') expect(plan.blocks).toHaveLength(2)
  })
  it('章だけ: 守らない最初の節に注文を付け、id 無しの節を1つ足す。完了の節は変えない', async () => {
    const { plan } = await new DemoProvider().proposeRedesign(tb, 'chapter', lessonId, '実践を先に', () => {})
    expect(plan.scope).toBe('chapter')
    if (plan.scope === 'chapter') {
      expect(plan.lessons.map((l) => l.title)).toEqual(['a（実践を先に）', 'b', '注文から追加した節（実践を先に）'])
      expect(plan.lessons.map((l) => l.id)).toEqual([tb.chapters[0].lessons[0].id, tb.chapters[0].lessons[1].id, null])
    }
  })
  it('コース全体: 章を1つ足す', async () => {
    const { plan } = await new DemoProvider().proposeRedesign(tb, 'course', lessonId, '', () => {})
    expect(plan.scope).toBe('course')
    if (plan.scope === 'course') {
      expect(plan.chapters).toHaveLength(2)
      expect(plan.chapters[1]).toMatchObject({ id: null, title: '追加の章（見直し）' })
    }
  })
})

import { L } from './labels'
import { clearLesson, type Lesson, type Textbook } from '../types'
import { STATUS_LABEL, lessonStatus, statusCounts, type Status } from '../lib/status'
import { MODELS, WEB_SEARCH_USD_PER_1000, type AiKind } from '../ai/types'
import { markExported, putBook, setAi, snapshot, toast, updateLesson, useApp } from '../store'
import { SIZE_WARN_BYTES, byteSize, exportJson, fileName, formatSize } from '../lib/io'
import { downloadText } from '../lib/download'
import { PROGRESS, type AiError, type Progress, type Usage } from '../ai/types'
import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Button, Card, Pill, Segmented, type Busy } from './kit'

export function StatusChip({ lesson }: { lesson: Lesson }) {
  const s = lessonStatus(lesson)
  return (
    <>
      <Pill tone={s}>{STATUS_LABEL[s]}</Pill>
      {lesson.review && <Pill tone="review">再確認</Pill>}
    </>
  )
}

/** 「資料を消す」（#104）。確認のあと節の資料をまっさらにし、元に戻せる知らせを出す。ロードマップとレッスンで共用 */
export function clearLessonWithUndo(tb: Textbook, lessonId: string): void {
  if (!window.confirm('この節の資料をすべて消します。自分のノートも消えます。')) return
  const before = snapshot(tb.id)
  updateLesson(tb.id, lessonId, (l) => Object.assign(l, clearLesson(l)))
  toast('資料を消しました', before ? () => putBook(before) : undefined)
}

const METER_COLOR: Record<Status, string> = { done: 'var(--st-done)', me: 'var(--st-me)', ai: 'var(--st-ai)', none: 'transparent' }
const ORDER: Status[] = ['done', 'me', 'ai', 'none']

export function Meter({ tb }: { tb: Textbook }) {
  const c = statusCounts(tb)
  const label = ORDER.map((k) => `${STATUS_LABEL[k]} ${c[k]}`).join(' / ')
  return (
    <div>
      <div className="meter" role="img" aria-label={label}>
        {ORDER.map((k) => (
          <i key={k} style={{ flex: c[k], background: METER_COLOR[k] }} />
        ))}
      </div>
      <div className="sub mono" style={{ fontSize: 12 }}>
        {label}
      </div>
    </div>
  )
}

const KINDS: [AiKind, string][] = [
  ['anthropic', 'Anthropic API'],
  ['demo', 'デモ応答'],
]

/** 使うAI。設定画面に埋めず、使う場所で直接切り替える。 */
export function AiBar() {
  const { ai } = useApp()
  const [editKey, setEditKey] = useState(false)
  const [key, setKey] = useState('')
  return (
    <Card stack className="aibar" aria-label="使うAI">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span className="eyebrow">使うAI</span>
          <Segmented label="AIの接続先" value={ai.kind} options={KINDS} onChange={(k) => setAi({ kind: k })} />
        </div>
        {ai.kind === 'anthropic' && (
          <div className="row">
            <Pill tone={ai.apiKey ? 'done' : 'warn'}>APIキー {ai.apiKey ? '設定済み' : '未設定'}</Pill>
            <Button v="outline" sm onClick={() => setEditKey((v) => !v)}>
              {ai.apiKey ? '変える' : '入れる'}
            </Button>
          </div>
        )}
      </div>
      {ai.kind === 'anthropic' && editKey && (
        <div className="row">
          <input
            type="password"
            id="ai_key"
            autoComplete="off"
            placeholder="sk-ant-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{ flex: '1 1 260px' }}
            aria-label="APIキー"
          />
          <Button
            v="soft"
            onClick={() => {
              const k = key.trim()
              setKey('')
              setEditKey(false)
              void setAi({ apiKey: k }).then((ok) => {
                if (ok) toast(k ? 'キーをこの端末に保存しました' : 'キーを消しました')
              })
            }}
          >
            保存
          </Button>
          <span className="sub">この端末の中にだけ保存します。書き出すJSONには入りません。</span>
        </div>
      )}
      {ai.kind === 'anthropic' && (
        <div className="opts">
          <label className="f" htmlFor="ai_model">
            モデル
            <select id="ai_model" value={ai.model} onChange={(e) => setAi({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="f" htmlFor="ai_search">
            Web調査のやり方
            <select id="ai_search" value={ai.search} onChange={(e) => setAi({ search: e.target.value as 'builtin' | 'none' })}>
              <option value="builtin">モデル内蔵のWeb検索（検索1000回あたり${WEB_SEARCH_USD_PER_1000}）</option>
              <option value="none">検索なし（モデルの知識だけで書く）</option>
            </select>
          </label>
        </div>
      )}
      {ai.kind === 'demo' && <p className="sub">APIキーなしで動線を試すための見本を返します。調査はしません。</p>}
    </Card>
  )
}

/** 経過秒数（#50）。running の間は1秒ごとに更新し、終わったら止まる */
export function useElapsed(running: boolean, startedAt: number | null, endedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  return startedAt ? Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000)) : null
}

/** ボタンの塗りに使う進み具合（%）。段階が終わった分だけ進む（3段階なら 0 / 33 / 67 / 100） */
export const stepPercent = (step: number, total: number): number => Math.round((Math.max(0, Math.min(step, total)) / total) * 100)

/**
 * 進行中の文を「ボタンに出す現状」と「補足」に分ける（#77）。
 * 調査中の検索語（`検索: …`）は長くてボタンに収まらないので、段階の文は残したまま hint（ボタンの title）に入れる
 */
export const splitDetail = (cur: { detail: string; hint: string }, d: string): { detail: string; hint: string } =>
  d.startsWith('検索: ') ? { detail: cur.detail, hint: d } : { detail: d, hint: '' }

export function Steps({ labels, step, detail }: { labels: string[]; step: number; detail: string }) {
  return (
    <ol className="steps">
      {labels.map((l, i) => (
        <li key={l} className={step > i ? 'done' : step === i ? 'run' : ''}>
          <span className="dot" />
          <span>
            {l}
            <small>{step > i ? '済み' : step === i ? detail || PROGRESS.running : '待機'}</small>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * 生成の中止（#14）。start() で新しい AbortController を作って signal を返し、stop() で中止する。
 * 画面を離れる（unmount）ときも自動で中止する。
 */
export function useAbort(): { start: () => AbortSignal; stop: () => void } {
  const ref = useRef<AbortController | null>(null)
  useEffect(() => () => ref.current?.abort(), [])
  return {
    start: () => {
      ref.current?.abort()
      const c = new AbortController()
      ref.current = c
      return c.signal
    },
    stop: () => ref.current?.abort(),
  }
}

/**
 * 題名などの入力欄（#80）。文字は手元で持ち、300ms 打鍵が止まるか欄を離れたときだけ確定する。
 * 1文字ごとに教科書全体をクローンして IndexedDB に書かないため
 */
function useCommit(value: string, onCommit: (v: string) => void) {
  const [v, setV] = useState(value)
  const dirty = useRef(false)
  const latest = useRef(value)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 外から値が変わったら（別の節を選んだなど）、打ちかけでなければ追随する
  useEffect(() => {
    if (!dirty.current) {
      setV(value)
      latest.current = value
    }
  }, [value])
  const commit = () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    commitRef.current(latest.current)
  }
  // 画面を離れるときも打ちかけを確定する
  useEffect(
    () => () => {
      if (dirty.current) commitRef.current(latest.current)
    },
    [],
  )
  const onChange = (next: string) => {
    setV(next)
    latest.current = next
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(commit, 300)
  }
  return { v, onChange, onBlur: commit }
}

type Commit = { value: string; onCommit: (v: string) => void }

export function TitleInput({
  value,
  onCommit,
  ...rest
}: Commit & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const c = useCommit(value, onCommit)
  return <input {...rest} value={c.v} onChange={(e) => c.onChange(e.target.value)} onBlur={c.onBlur} />
}

/** 狙いなど1〜3行の入力欄（#103）。確定のしかたは TitleInput と同じ */
export function GoalInput({
  value,
  onCommit,
  ...rest
}: Commit & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onBlur'>) {
  const c = useCommit(value, onCommit)
  return <textarea rows={1} {...rest} value={c.v} onChange={(e) => c.onChange(e.target.value)} onBlur={c.onBlur} />
}

/** 教科書を JSON で書き出す（#82 で Shelf から移動。本棚・ロードマップ・通読・Help で共用） */
export function downloadBook(tb: Textbook): void {
  const json = exportJson(tb)
  const size = byteSize(json)
  downloadText(fileName(tb), json)
  markExported(tb.id)
  toast(
    size > SIZE_WARN_BYTES
      ? `書き出しました（${formatSize(size)}）。8MBを超えているので、添付上限に注意してください。`
      : `書き出しました（${formatSize(size)}）`,
  )
}

/** 使った量（検索回数・トークン）の1行。無ければ出さない */
export function UsageLine({ usage }: { usage: Usage | null }) {
  if (!usage || (!usage.inputTokens && !usage.searches)) return null
  return (
    <p className="usage">
      検索 {usage.searches}回 / 入力 {usage.inputTokens.toLocaleString()} / 出力 {usage.outputTokens.toLocaleString()} トークン
    </p>
  )
}

/** 「やめる」（#14）。進行中のボタンの脇に置く。今していることと経過秒数はボタンの中に出る（#77） */
export function StopButton({ onStop }: { onStop: () => void }) {
  return (
    <Button v="outline" sm onClick={onStop}>
      {L.stop}
    </Button>
  )
}

/**
 * AI の作業を1回走らせる（#82）。busy・段階・今していること・経過時間・エラー・中止をまとめて持つ。
 * つくる（設計）と、ロードマップの「設計を直す」で使う。自分でやめたときはエラーにせず短く知らせる（#14）。
 * `working` はそのままボタンの `busy` に渡す（#77）
 */
export function useAiRun() {
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(-1)
  const [text, setText] = useState({ detail: '', hint: '' })
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const abort = useAbort()
  const seconds = useElapsed(busy, startedAt, endedAt)
  async function run<T>(fn: (progress: Progress, signal: AbortSignal) => Promise<T>, doneStep?: number): Promise<T | null> {
    setBusy(true)
    setError('')
    setStep(0)
    setText({ detail: '', hint: '' })
    setStartedAt(Date.now())
    setEndedAt(null)
    try {
      const r = await fn((s, d) => {
        setStep(s)
        setText((cur) => splitDetail(cur, d))
      }, abort.start())
      if (doneStep !== undefined) setStep(doneStep)
      return r
    } catch (e) {
      if ((e as AiError).code === 'aborted') toast('生成をやめました')
      else setError((e as Error).message)
      setStep(-1)
      return null
    } finally {
      setEndedAt(Date.now())
      setBusy(false)
    }
  }
  const working: Busy | null = busy ? { label: text.detail, seconds, title: text.hint } : null
  return { busy, step, detail: text.detail, hint: text.hint, working, error, setError, run, stop: abort.stop }
}

import type { Lesson, Textbook } from '../types'
import { STATUS_LABEL, lessonStatus, statusCounts, type Status } from '../lib/status'
import { MODELS, type AiKind } from '../ai/types'
import { WEB_SEARCH_USD_PER_1000 } from '../ai/anthropic'
import { setAi, toast, useApp } from '../store'
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { Button, Card, Pill, Segmented } from './kit'

export function StatusChip({ lesson }: { lesson: Lesson }) {
  const s = lessonStatus(lesson)
  return (
    <>
      <Pill tone={s}>{STATUS_LABEL[s]}</Pill>
      {lesson.review && <Pill tone="review">再確認</Pill>}
    </>
  )
}

const METER_COLOR: Record<Status, string> = { done: 'var(--st-done)', me: 'var(--st-me)', ai: 'var(--st-ai)', none: 'transparent' }
const ORDER: Status[] = ['done', 'me', 'ai', 'none']

export function Meter({ tb }: { tb: Textbook }) {
  const c = statusCounts(tb)
  const label = ORDER.map((k) => `${STATUS_LABEL[k]} ${c[k]}`).join(' / ')
  return (
    <div>
      <div className="meter" role="img" aria-label={label}>
        {ORDER.map((k) => <i key={k} style={{ flex: c[k], background: METER_COLOR[k] }} />)}
      </div>
      <div className="sub mono" style={{ fontSize: 12 }}>{label}</div>
    </div>
  )
}

const KINDS: [AiKind, string][] = [['anthropic', 'Anthropic API'], ['compat', 'OpenAI互換API'], ['local', 'ローカル'], ['demo', 'デモ応答']]

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
            <Button v="outline" sm onClick={() => setEditKey((v) => !v)}>{ai.apiKey ? '変える' : '入れる'}</Button>
          </div>
        )}
      </div>
      {ai.kind === 'anthropic' && editKey && (
        <div className="row">
          <input type="password" id="ai_key" autoComplete="off" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} style={{ flex: '1 1 260px' }} aria-label="APIキー" />
          <Button v="soft" onClick={() => { const k = key.trim(); setKey(''); setEditKey(false); void setAi({ apiKey: k }).then((ok) => { if (ok) toast(k ? 'キーをこの端末に保存しました' : 'キーを消しました') }) }}>保存</Button>
          <span className="sub">この端末の中にだけ保存します。書き出すJSONには入りません。</span>
        </div>
      )}
      {ai.kind === 'anthropic' && (
        <div className="opts">
          <label className="f" htmlFor="ai_model">モデル
            <select id="ai_model" value={ai.model} onChange={(e) => setAi({ model: e.target.value })}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="f" htmlFor="ai_search">Web調査のやり方
            <select id="ai_search" value={ai.search} onChange={(e) => setAi({ search: e.target.value as 'builtin' | 'none' })}>
              <option value="builtin">モデル内蔵のWeb検索（検索1000回あたり${WEB_SEARCH_USD_PER_1000}）</option>
              <option value="none">検索なし（モデルの知識だけで書く）</option>
            </select>
          </label>
        </div>
      )}
      {(ai.kind === 'compat' || ai.kind === 'local') && <p className="sub">この接続先はまだ使えません。次の段階で対応します。{ai.kind === 'local' && 'ローカルのモデルはPCでだけ使える予定です。'}</p>}
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

/** 進行中の一言。今していること（検索語など）と経過秒数。ボタンの脇に置く */
export function Working({ running, detail, startedAt, endedAt }: { running: boolean; detail: string; startedAt: number | null; endedAt: number | null }) {
  const sec = useElapsed(running, startedAt, endedAt)
  if (!running) return null
  return <span className="sub working" role="status">{detail || '実行中…'}{sec !== null && <span className="mono">・{sec}秒</span>}</span>
}

export function Steps({ labels, step, detail }: { labels: string[]; step: number; detail: string }) {
  return (
    <ol className="steps">
      {labels.map((l, i) => (
        <li key={l} className={step > i ? 'done' : step === i ? 'run' : ''}>
          <span className="dot" />
          <span>{l}<small>{step > i ? '済み' : step === i ? detail || '実行中…' : '待機'}</small></span>
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
    start: () => { ref.current?.abort(); const c = new AbortController(); ref.current = c; return c.signal },
    stop: () => ref.current?.abort(),
  }
}

/**
 * 題名などの入力欄（#80）。文字は手元で持ち、300ms 打鍵が止まるか欄を離れたときだけ確定する。
 * 1文字ごとに教科書全体をクローンして IndexedDB に書かないため
 */
export function TitleInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [v, setV] = useState(value)
  const dirty = useRef(false)
  const latest = useRef(value)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 外から値が変わったら（別の節を選んだなど）、打ちかけでなければ追随する
  useEffect(() => { if (!dirty.current) { setV(value); latest.current = value } }, [value])
  const commit = () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    commitRef.current(latest.current)
  }
  // 画面を離れるときも打ちかけを確定する
  useEffect(() => () => { if (dirty.current) commitRef.current(latest.current) }, [])
  return (
    <input
      {...rest}
      value={v}
      onChange={(e) => { setV(e.target.value); latest.current = e.target.value; dirty.current = true; clearTimeout(timer.current); timer.current = setTimeout(commit, 300) }}
      onBlur={commit}
    />
  )
}

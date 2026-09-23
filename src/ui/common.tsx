import type { Lesson, Textbook } from '../types'
import { STATUS_LABEL, lessonStatus, statusCounts, type Status } from '../lib/status'
import { MODELS, type AiKind } from '../ai/types'
import { markExported, setAi, toast, useApp } from '../store'
import { SIZE_WARN_BYTES, byteSize, exportJson, fileName, formatSize } from '../lib/io'
import { useEffect, useState } from 'react'
import { Button, Card, Pill, Segmented } from './kit'

/** 教科書を JSON で書き出す。本棚・ロードマップ・通読・レッスンの知らせ（#16）で共用 */
export function downloadBook(tb: Textbook): void {
  const json = exportJson(tb)
  const size = byteSize(json)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(
    new Blob([json], { type: 'application/json' }),
  )
  a.download = fileName(tb)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  markExported(tb.id)
  toast(
    size > SIZE_WARN_BYTES
      ? `書き出しました（${formatSize(size)}）。8MBを超えているので、添付上限に注意してください。`
      : `書き出しました（${formatSize(size)}）`,
  )
}

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
          <Button v="soft" onClick={() => { setAi({ apiKey: key.trim() }); setKey(''); setEditKey(false); toast(key.trim() ? 'キーをこの端末に保存しました' : 'キーを消しました') }}>保存</Button>
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
              <option value="builtin">モデル内蔵のWeb検索（検索1000回あたり$10）</option>
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

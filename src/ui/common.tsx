import type { Lesson, Textbook } from '../types'
import { STATUS_LABEL, lessonStatus, statusCounts, type Status } from '../lib/status'
import { MODELS, type AiKind } from '../ai/types'
import { setAi, toast, useApp } from '../store'
import { useState } from 'react'
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

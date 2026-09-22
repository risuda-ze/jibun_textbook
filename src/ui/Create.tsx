import { useState } from 'react'
import { getProvider, type CourseDesign, type QA, type Usage } from '../ai'
import { openBook, putBook, toast, useApp } from '../store'
import { newChapter, newLesson, newTextbook, type CourseInput } from '../types'
import { AiBar, Steps } from './common'
import { Button, Card, PageHead } from './kit'

const STEP_LABELS = ['学びたいことを分解', 'Webを調査', 'コース設計を作成']

export function UsageLine({ usage }: { usage: Usage | null }) {
  if (!usage || (!usage.inputTokens && !usage.searches)) return null
  return <p className="usage">検索 {usage.searches}回 / 入力 {usage.inputTokens.toLocaleString()} / 出力 {usage.outputTokens.toLocaleString()} トークン</p>
}

export function Create() {
  const { ai } = useApp()
  const [input, setInput] = useState<CourseInput>({ prompt: '', can: '', time: '', env: '' })
  const [qa, setQa] = useState<QA[] | null>(null)
  const [showQa, setShowQa] = useState(false)
  const [busy, setBusy] = useState<'ask' | 'design' | null>(null)
  const [step, setStep] = useState(-1)
  const [detail, setDetail] = useState('')
  const [design, setDesign] = useState<CourseDesign | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [off, setOff] = useState<Set<number>>(new Set())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const field = (k: keyof CourseInput) => (e: { target: { value: string } }) => setInput({ ...input, [k]: e.target.value })

  async function ask() {
    if (!input.prompt.trim()) return toast('学びたいことを書いてから進んでください')
    setError(''); setDesign(null); setBusy('ask')
    try {
      const qs = await getProvider(ai).askQuestions(input)
      setQa(qs.map((q) => ({ q, a: '' })))
      setShowQa(true)
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  async function run(extraNote = '') {
    setError(''); setBusy('design'); setStep(0); setDetail('')
    try {
      const r = await getProvider(ai).designCourse(input, qa ?? [], extraNote, (s, d) => { setStep(s); setDetail(d) })
      setDesign(r.design); setUsage(r.usage); setOff(new Set()); setStep(STEP_LABELS.length); setShowQa(false)
    } catch (e) { setError((e as Error).message); setStep(-1) }
    setBusy(null)
  }

  function adopt() {
    if (!design) return
    const tb = newTextbook(design.title, {
      goal: design.goal, input,
      chapters: design.chapters.filter((_, i) => !off.has(i)).map((c) =>
        newChapter(c.title, c.lessons.map((l) => newLesson(l.title, { minutes: l.minutes, isTask: l.isTask, summary: l.summary })))),
    })
    putBook(tb)
    openBook(tb.id)
    toast('教科書を作りました。節を選んで資料を生成してください')
  }

  return (
    <>
      <PageHead eyebrow="つくる・Step 1" title="何を学びたいか伝える" lead="話し言葉で構いません。AIが足りない所を聞き返し、調べてからコースを設計します。" />
      <AiBar />
      <div className="newgrid">
        <Card stack>
          <label className="f" htmlFor="goal">学びたいこと（話し言葉でよい）
            <textarea id="goal" value={input.prompt} onChange={field('prompt')} placeholder="例: 短い秒数に編集技術を詰め込んだ動画を作れるようになりたい / Rustで自分用の小さなツールを書けるようになりたい" />
          </label>
          <div className="opts">
            <label className="f" htmlFor="can">今できること<input type="text" id="can" value={input.can} onChange={field('can')} placeholder="自由に。空でも構いません" /></label>
            <label className="f" htmlFor="time">使える時間・期限<input type="text" id="time" value={input.time} onChange={field('time')} placeholder="例: 週3時間、年内まで" /></label>
            <label className="f" htmlFor="env">道具・環境<input type="text" id="env" value={input.env} onChange={field('env')} placeholder="ソフト、言語、機材など。未定でも構いません" /></label>
          </div>
          <div className="row">
            <Button v={design ? 'soft' : 'primary'} onClick={ask} disabled={busy !== null}>{busy === 'ask' ? '質問を考えている…' : design ? 'もう一度調べ直す' : '調べてコース設計を作る'}</Button>
            <span className="sub">全部自由入力です。先に設計だけ作り、資料は節ごとに後で生成します。</span>
          </div>
          {error && <p className="err" role="alert">{error}</p>}
        </Card>

        <Card stack>
          {qa && showQa && busy !== 'design' && (
            <>
              <div className="eyebrow">AIからの確認</div>
              <p className="sub">答えなくても進めます。</p>
              {qa.map((x, i) => (
                <label className="f" htmlFor={`q${i}`} key={i} style={{ color: 'var(--ink)', fontSize: 14 }}>{x.q}
                  <input type="text" id={`q${i}`} value={x.a} onChange={(e) => setQa(qa.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} />
                </label>
              ))}
              <div className="row">
                <Button v="soft" onClick={() => run()}>答えて進む</Button>
                <Button v="ghost" onClick={() => run()}>スキップ</Button>
              </div>
            </>
          )}
          <div className="eyebrow">AIの作業</div>
          <Steps labels={STEP_LABELS} step={step} detail={detail} />
          <UsageLine usage={usage} />
        </Card>
      </div>

      {design && (
        <Card stack>
          <div className="pagehead">
            <div><div className="eyebrow">Step 2 コース設計案</div><h2>{design.title}</h2><p className="sub">{design.goal}</p></div>
            <Button v="primary" onClick={adopt}>この設計で始める</Button>
          </div>
          <ul className="outline">
            {design.chapters.map((c, i) => (
              <li key={i}>
                <input type="checkbox" id={`oc${i}`} checked={!off.has(i)} aria-label={`${c.title}を含める`}
                  onChange={() => { const n = new Set(off); if (n.has(i)) n.delete(i); else n.add(i); setOff(n) }} />
                <label htmlFor={`oc${i}`}><b>{i + 1}. {c.title}</b> <span className="sub">{c.lessons.map((l) => (l.isTask ? '◆ ' : '') + l.title).join(' / ')}</span></label>
                <span className="mono sub">{c.lessons.reduce((a, l) => a + l.minutes, 0)}分</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <input type="text" id="tweak" value={note} onChange={(e) => setNote(e.target.value)} placeholder="設計への注文（例: 基礎は短く、実践課題を増やして）" style={{ flex: '1 1 280px' }} />
            <Button v="ghost" disabled={busy !== null || !note.trim()} onClick={() => run(note)}>設計を直してもらう</Button>
          </div>
          <p className="sub">あとからでも、ロードマップの「設計を直す」で節・章・全体を選んで直せます。</p>
        </Card>
      )}
    </>
  )
}

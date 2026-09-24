import { L } from './labels'
import { useState } from 'react'
import { researchNote } from './generate'
import { PROGRESS, getProvider, type CourseDesign, type QA, type Usage } from '../ai'
import { openBook, putBook, toast, useApp } from '../store'
import { newChapter, newLesson, newTextbook, type CourseInput } from '../types'
import { AiBar, Steps, StopButton, UsageLine, stepPercent, useAiRun } from './common'
import { Button, Card, PageHead } from './kit'

const STEP_LABELS = ['学びたいことを分解', 'Webを調査', 'コース設計を作成']

/** 確認質問と設計で使った量を合算する（#88） */
const addUsage = (a: Usage | null, b: Usage): Usage => ({
  inputTokens: (a?.inputTokens ?? 0) + b.inputTokens,
  outputTokens: (a?.outputTokens ?? 0) + b.outputTokens,
  searches: (a?.searches ?? 0) + b.searches,
})

export function Create() {
  const { ai } = useApp()
  const [input, setInput] = useState<CourseInput>({ prompt: '', can: '', time: '', env: '' })
  const [qa, setQa] = useState<QA[] | null>(null)
  const [showQa, setShowQa] = useState(false)
  // 確認質問の実行（中止と使用量つき）（#88）
  const a = useAiRun()
  // 設計の実行（busy・段階・今していること・経過時間・エラー・中止）（#82）
  const d = useAiRun()
  // 「設計を直してもらう」から始めたか（どのボタンを進行中にするかを決める）
  const [redoing, setRedoing] = useState(false)
  const [design, setDesign] = useState<CourseDesign | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [off, setOff] = useState<Set<number>>(new Set())
  const [note, setNote] = useState('')
  const field = (k: keyof CourseInput) => (e: { target: { value: string } }) => setInput({ ...input, [k]: e.target.value })
  const busyAny = a.busy || d.busy

  async function ask() {
    if (!input.prompt.trim()) return toast('学びたいことを書いてから進んでください')
    d.setError('')
    setDesign(null)
    const r = await a.run(async (_, signal) => (await getProvider(ai)).askQuestions(input, { signal }))
    if (!r) return
    setUsage(r.usage)
    setQa(r.questions.map((q) => ({ q, a: '' })))
    setShowQa(true)
  }

  async function run(extraNote = '') {
    setRedoing(!!extraNote)
    const r = await d.run(
      async (progress, signal) => (await getProvider(ai)).designCourse(input, qa ?? [], extraNote, progress, { signal }),
      STEP_LABELS.length,
    )
    if (!r) return
    setDesign(r.design)
    setUsage((u) => addUsage(u, r.usage))
    setOff(new Set())
    setShowQa(false)
    // 調査が切れた・検索が失敗した（#81）
    const note = researchNote(r.usage, r.research)
    if (note) toast(`設計を作りました${note}`)
  }

  function adopt() {
    if (!design) return
    const tb = newTextbook(design.title, {
      goal: design.goal,
      input,
      chapters: design.chapters
        .filter((_, i) => !off.has(i))
        .map((c) =>
          newChapter(
            c.title,
            c.lessons.map((l) => newLesson(l.title, { minutes: l.minutes, isTask: l.isTask, summary: l.summary })),
          ),
        ),
    })
    putBook(tb)
    openBook(tb.id)
    toast('教科書を作りました。節を選んで資料を生成してください')
  }

  return (
    <>
      <PageHead
        eyebrow="つくる・Step 1"
        title="何を学びたいか伝える"
        lead="話し言葉で構いません。AIが足りない所を聞き返し、調べてからコースを設計します。"
      />
      <AiBar />
      <div className="newgrid">
        <Card stack>
          <label className="f" htmlFor="goal">
            学びたいこと（話し言葉でよい）
            <textarea
              id="goal"
              value={input.prompt}
              onChange={field('prompt')}
              placeholder="例: 短い秒数に編集技術を詰め込んだ動画を作れるようになりたい / Rustで自分用の小さなツールを書けるようになりたい"
            />
          </label>
          <div className="opts">
            <label className="f" htmlFor="can">
              今できること
              <input type="text" id="can" value={input.can} onChange={field('can')} placeholder="自由に。空でも構いません" />
            </label>
            <label className="f" htmlFor="time">
              使える時間・期限
              <input type="text" id="time" value={input.time} onChange={field('time')} placeholder="例: 週3時間、年内まで" />
            </label>
            <label className="f" htmlFor="env">
              道具・環境
              <input
                type="text"
                id="env"
                value={input.env}
                onChange={field('env')}
                placeholder="ソフト、言語、機材など。未定でも構いません"
              />
            </label>
          </div>
          <div className="row">
            {/* 押すと灰色になり、段階が進んだ分だけ青で塗られる（#50）。設計を作る間はこのボタンが進行中になる */}
            <Button
              v={design ? 'soft' : 'primary'}
              onClick={ask}
              disabled={busyAny}
              progress={a.busy ? 0 : d.busy && !redoing ? stepPercent(d.step, STEP_LABELS.length) : null}
              busy={a.busy ? { label: PROGRESS.asking, seconds: null } : d.busy && !redoing ? d.working : null}
            >
              {design ? 'もう一度調べ直す' : L.design}
            </Button>
            {a.busy || (d.busy && !redoing) ? (
              <StopButton onStop={a.busy ? a.stop : d.stop} />
            ) : (
              <span className="sub">全部自由入力です。先に設計だけ作り、資料は節ごとに後で生成します。</span>
            )}
          </div>
          {(a.error || d.error) && (
            <p className="err" role="alert">
              {a.error || d.error}
            </p>
          )}
        </Card>

        <Card stack>
          {qa && showQa && !d.busy && (
            <>
              <div className="eyebrow">AIからの確認</div>
              <p className="sub">答えなくても進めます。</p>
              {qa.map((x, i) => (
                <label className="f" htmlFor={`q${i}`} key={i} style={{ color: 'var(--ink)', fontSize: 14 }}>
                  {x.q}
                  <input
                    type="text"
                    id={`q${i}`}
                    value={x.a}
                    onChange={(e) => setQa(qa.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))}
                  />
                </label>
              ))}
              <div className="row">
                <Button v="soft" onClick={() => run()}>
                  答えて進む
                </Button>
                <Button v="ghost" onClick={() => run()}>
                  スキップ
                </Button>
              </div>
            </>
          )}
          <div className="eyebrow">AIの作業</div>
          <Steps labels={STEP_LABELS} step={d.step} detail={d.hint || d.detail} />
          <UsageLine usage={usage} />
        </Card>
      </div>

      {design && (
        <Card stack>
          <div className="pagehead">
            <div>
              <div className="eyebrow">Step 2 コース設計案</div>
              <h2>{design.title}</h2>
              <p className="sub">{design.goal}</p>
            </div>
            <Button v="primary" onClick={adopt} disabled={busyAny}>
              この設計で始める
            </Button>
          </div>
          {/* 設計を直してもらっている間は一覧を薄くして触れなくする（#50） */}
          <ul className={`outline${d.busy ? ' dim' : ''}`} aria-disabled={d.busy}>
            {design.chapters.map((c, i) => (
              <li key={i}>
                <input
                  type="checkbox"
                  id={`oc${i}`}
                  checked={!off.has(i)}
                  aria-label={`${c.title}を含める`}
                  onChange={() => {
                    const n = new Set(off)
                    if (n.has(i)) n.delete(i)
                    else n.add(i)
                    setOff(n)
                  }}
                />
                <label htmlFor={`oc${i}`}>
                  <b>
                    {i + 1}. {c.title}
                  </b>{' '}
                  <span className="sub">{c.lessons.map((l) => (l.isTask ? '◆ ' : '') + l.title).join(' / ')}</span>
                </label>
                <span className="mono sub">{c.lessons.reduce((a, l) => a + l.minutes, 0)}分</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <input
              type="text"
              id="tweak"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="設計への注文（例: 基礎は短く、実践課題を増やして）"
              style={{ flex: '1 1 280px' }}
            />
            <Button
              v="ghost"
              disabled={busyAny || !note.trim()}
              onClick={() => run(note)}
              progress={d.busy && redoing ? stepPercent(d.step, STEP_LABELS.length) : null}
              busy={d.busy && redoing ? d.working : null}
            >
              設計を直してもらう
            </Button>
            {d.busy && redoing && <StopButton onStop={d.stop} />}
          </div>
          <p className="sub">あとからでも、ロードマップの「設計を直す」で節・章・全体を選んで直せます。</p>
        </Card>
      )}
    </>
  )
}

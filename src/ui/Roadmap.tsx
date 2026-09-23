import { useMemo, useState } from 'react'
import { getProvider, type RedesignPlan, type RedesignScope, type Usage } from '../ai'
import { applyChapterPlan, applyCoursePlan, applyLessonRegen, diffLessonRegen, diffTextbooks, DIFF_LABEL, type DiffRow } from '../lib/protect'
import { STATUS_LABEL, currentLesson, findLesson, lessonNo, lessonStatus } from '../lib/status'
import { openLesson, putBook, selectLesson, snapshot, toast, updateBook, updateLesson, useApp } from '../store'
import { newChapter, newLesson, type Lesson, type Textbook } from '../types'
import { Meter, StatusChip, Working, stepPercent } from './common'
import { UsageLine } from './Create'
import { downloadBook } from './Shelf'
import { GEN_STEPS, generateInto, startGen, type GenState } from './generate'
import { Button, Card, Pill, Segmented, type PillTone } from './kit'

const PXMIN = 1.6
const UNIT = 180 // 目盛り1つ = 3時間

/** 変更案を今の教科書に当てた結果を作る。守る対象の保証は protect.ts の中にある。 */
function applyPlan(tb: Textbook, lessonId: string, plan: RedesignPlan): Textbook {
  const f = findLesson(tb, lessonId)
  if (!f) return tb
  if (plan.scope === 'lesson') {
    return { ...tb, chapters: tb.chapters.map((c) => ({ ...c, lessons: c.lessons.map((l) => (l.id === lessonId ? applyLessonRegen(l, plan.blocks) : l)) })) }
  }
  if (plan.scope === 'chapter') {
    return { ...tb, chapters: tb.chapters.map((c) => (c.id === f.chapter.id ? applyChapterPlan(c, plan.lessons) : c)) }
  }
  return applyCoursePlan(tb, plan.chapters)
}

const DIFF_CHIP: Record<DiffRow['kind'], PillTone> = { keep: 'done', same: 'none', change: 'ai', add: 'me', remove: 'warn' }

function RedoPanel({ tb, lesson, onClose }: { tb: Textbook; lesson: Lesson; onClose: () => void }) {
  const { ai } = useApp()
  const f = findLesson(tb, lesson.id)!
  const [scope, setScope] = useState<RedesignScope>('chapter')
  const [order, setOrder] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<RedesignPlan | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState(-1)
  const [detail, setDetail] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const scopes: [RedesignScope, string][] = [['lesson', `この節だけ ${lessonNo(tb, lesson.id)}`], ['chapter', `この章だけ 第${f.ci + 1}章`], ['course', 'コース全体']]

  const after = useMemo(() => (plan ? applyPlan(tb, lesson.id, plan) : null), [plan, tb, lesson.id])
  const rows: DiffRow[] = !plan || !after ? []
    : plan.scope === 'lesson' ? diffLessonRegen(lesson, plan.blocks)
    : diffTextbooks(tb, after, plan.scope === 'chapter' ? f.chapter.id : undefined)

  async function propose() {
    setBusy(true); setError(''); setPlan(null); setStep(0); setDetail(''); setStartedAt(Date.now()); setEndedAt(null)
    try {
      const r = await getProvider(ai).proposeRedesign(tb, scope, lesson.id, order, (s, d) => { setStep(s); setDetail(d) })
      setPlan(r.plan); setUsage(r.usage); setStep(1)
    } catch (e) { setError((e as Error).message); setStep(-1) }
    setEndedAt(Date.now())
    setBusy(false)
  }

  function adopt() {
    if (!after) return
    const before = snapshot(tb.id)
    putBook(after)
    if (!findLesson(after, lesson.id)) { const c = currentLesson(after); if (c) selectLesson(c.id) }
    onClose()
    toast('変更案を反映しました', before ? () => putBook(before) : undefined)
  }

  return (
    <Card stack tone="sky" className="redo" aria-label="設計を直す">
      <div className="pagehead">
        <div><div className="eyebrow">設計を直す</div><h2 style={{ fontSize: 17 }}>直す範囲を選ぶ</h2></div>
        <Button v="outline" sm onClick={onClose}>閉じる</Button>
      </div>
      <div className="row">
        <Segmented label="直す範囲" value={scope} options={scopes} onChange={(k) => { setScope(k); setPlan(null) }} />
        <span className="sub">節や章は下の一覧で選び直せます。</span>
      </div>
      <div className="row">
        <input type="text" id="redotext" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="どう変えたいか（例: 理論は短く、実践を先に）" style={{ flex: '1 1 280px' }} />
        <Button v="soft" disabled={busy} onClick={propose} progress={busy ? stepPercent(step, 1) : null}>{busy ? '案を作成中…' : plan ? '別の案を出す' : '変更案を出してもらう'}</Button>
        {busy && <Working running detail={detail} startedAt={startedAt} endedAt={endedAt} />}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {plan && (
        <>
          <div>
            <div className="eyebrow">AIの変更案{order && `：「${order}」`}</div>
            <ul className="diff">
              {rows.map((r, i) => (
                <li key={i}>
                  <Pill tone={DIFF_CHIP[r.kind]}>{DIFF_LABEL[r.kind]}</Pill>
                  <span style={r.level === 'chapter' ? { fontWeight: 900 } : undefined}>
                    {r.from && <><s className="sub">{r.from}</s> → </>}{r.text}
                    {r.note && <span className="sub"> {r.note}のため触りません</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <UsageLine usage={usage} />
          <div className="row">
            <Button v="primary" onClick={adopt}>この案を採用</Button>
            <span className="sub">採用するまで何も変わりません。自分のノート・自分で直した文・完了の節は、どの案でも残ります。</span>
          </div>
        </>
      )}
    </Card>
  )
}

export function Roadmap({ tb }: { tb: Textbook }) {
  const { lessonId, ai } = useApp()
  const [redo, setRedo] = useState(false)
  // 資料を生成の進行中（#55）。押したボタンが進んだ分だけ塗られ、脇に今していることと経過秒数が出る
  const [gen, setGen] = useState<({ id: string } & GenState) | null>(null)
  const cur = currentLesson(tb)
  const sel = (lessonId && findLesson(tb, lessonId)) || (cur && findLesson(tb, cur.id)) || (tb.chapters[0]?.lessons[0] && findLesson(tb, tb.chapters[0].lessons[0].id))

  // タイムライン: 章ごとに1トラック。節は所要時間を幅にして、前の章の続きから並べる
  let cursor = 0
  let play = 0
  const tracks = tb.chapters.map((c) => ({
    c,
    clips: c.lessons.map((l) => {
      const left = cursor
      if (cur && l.id === cur.id) play = cursor + 12
      cursor += Math.max(20, l.minutes)
      return { l, left }
    }),
  }))
  const units = Math.max(1, Math.ceil(cursor / UNIT))
  const W = units * UNIT * PXMIN

  async function generate(id: string) {
    const g = { id, ...startGen() }
    setGen(g)
    const ok = await generateInto(tb, id, ai, (step, detail) => setGen({ ...g, step, detail }))
    setGen(null)
    if (ok) openLesson(id)
  }

  function addLesson(chapterId: string) {
    const l = newLesson('新しい節')
    updateBook(tb.id, (d) => { d.chapters.find((c) => c.id === chapterId)?.lessons.push(l) })
    selectLesson(l.id)
  }
  function addChapter() {
    const l = newLesson('最初の節')
    updateBook(tb.id, (d) => { d.chapters.push(newChapter(`第${d.chapters.length + 1}章`, [l])) })
    selectLesson(l.id)
  }
  function removeLesson(id: string) {
    const before = snapshot(tb.id)
    // 最後の1節を消すと章ごと消える。そのことをトーストで伝える（#17）。元に戻すで章も戻る
    const last = tb.chapters.some((c) => c.lessons.length === 1 && c.lessons[0].id === id)
    updateBook(tb.id, (d) => { for (const c of d.chapters) c.lessons = c.lessons.filter((l) => l.id !== id); d.chapters = d.chapters.filter((c) => c.lessons.length) })
    toast(last ? '節を消しました。節が無くなった章も消しました' : '節を消しました', before ? () => putBook(before) : undefined)
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">コース</div>
          <input className="titleinput" aria-label="教科書の名前" value={tb.title} onChange={(e) => updateBook(tb.id, (d) => { d.title = e.target.value })} />
          {tb.goal && <p className="lead">{tb.goal}</p>}
        </div>
        <div className="row">
          <Button v="ghost" onClick={() => downloadBook(tb)}>JSONを書き出す</Button>
          <Button v="ghost" onClick={() => setRedo(true)} disabled={!sel}>設計を直す</Button>
          {cur && <Button v="primary" onClick={() => openLesson(cur.id)}>続きから {lessonNo(tb, cur.id)}</Button>}
        </div>
      </div>

      <div className="row legend">
        {(['none', 'ai', 'me', 'done'] as const).map((k) => <Pill key={k} tone={k}>{STATUS_LABEL[k]}</Pill>)}
        <Pill tone="review">再確認</Pill>
        <span className="tlnote">◆ は実践課題、幅は所要時間、赤い線が現在地です。</span>
      </div>

      {/* PC幅: タイムライン */}
      <div className="tl" tabIndex={0} aria-label="ロードマップのタイムライン">
        <div className="tl-inner">
          <div className="tl-row tl-ruler">
            <div className="tl-label">3時間ごと</div>
            <div className="tl-lane" style={{ width: W }}>
              {Array.from({ length: units }, (_, i) => <span key={i} className="tick" style={{ left: i * UNIT * PXMIN }}>{(i + 1) * 3}h</span>)}
            </div>
          </div>
          {tracks.map(({ c, clips }, ci) => (
            <div className="tl-row" key={c.id}>
              <div className="tl-label"><span className="mono">CH{ci + 1}</span>{c.title}</div>
              <div className="tl-lane" style={{ width: W }}>
                {clips.map(({ l, left }, li) => (
                  <button key={l.id} className={`clip ${lessonStatus(l)} ${l.isTask ? 'task' : ''}`} style={{ left: left * PXMIN, width: Math.max(20, l.minutes) * PXMIN - 3 }}
                    aria-pressed={sel?.lesson.id === l.id} title={`${ci + 1}-${li + 1} ${l.title}（${l.minutes}分・${STATUS_LABEL[lessonStatus(l)]}）`} onClick={() => selectLesson(l.id)}>
                    {ci + 1}-{li + 1} {l.title}{l.review && <span className="flagdot" aria-label="再確認" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {cur && <div className="playhead" style={{ left: `calc(var(--lw) + ${play * PXMIN}px)` }} />}
        </div>
      </div>

      {/* スマホ幅: 章ごとの一覧 */}
      <div className="chlist" aria-label="章ごとの一覧">
        {tb.chapters.map((c, ci) => (
          <Card key={c.id}>
            <h3><span className="mono sub">CH{ci + 1}</span> {c.title}</h3>
            <ul className="lessonlist">
              {c.lessons.map((l, li) => (
                <li key={l.id}>
                  <button aria-current={sel?.lesson.id === l.id} onClick={() => { selectLesson(l.id); requestAnimationFrame(() => document.getElementById('detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}>
                    <span className="mono sub">{ci + 1}-{li + 1}</span><span>{l.isTask && '◆ '}{l.title}</span><span className="row" style={{ justifyContent: 'flex-end' }}><StatusChip lesson={l} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {redo && sel && <RedoPanel tb={tb} lesson={sel.lesson} onClose={() => setRedo(false)} />}

      {sel ? (
        <Card className="detail" id="detail">
          <div className="stack">
            <div>
              <div className="eyebrow">選択中 {lessonNo(tb, sel.lesson.id)}・{sel.lesson.minutes}分</div>
              <input className="titleinput" aria-label="節の名前" value={sel.lesson.title} onChange={(e) => updateLesson(tb.id, sel.lesson.id, (l) => { l.title = e.target.value })} />
            </div>
            <div className="row"><StatusChip lesson={sel.lesson} /></div>
            <p className="sub">{sel.lesson.summary || (sel.lesson.blocks.length ? '本文あり。' : 'まだ資料がありません。AIに生成させるか、自分で書き始めてください。')}</p>
            <div className="row">
              {sel.lesson.blocks.length === 0 && (
                <Button v="soft" disabled={gen !== null} onClick={() => generate(sel.lesson.id)} progress={gen?.id === sel.lesson.id ? stepPercent(gen.step, GEN_STEPS) : null}>{gen?.id === sel.lesson.id ? '生成中…' : 'この節の資料を生成'}</Button>
              )}
              {gen?.id === sel.lesson.id && (
                <Working running detail={gen.detail} startedAt={gen.startedAt} endedAt={gen.endedAt} />
              )}
              <Button v={sel.lesson.blocks.length ? 'soft' : 'ghost'} onClick={() => openLesson(sel.lesson.id)}>{sel.lesson.blocks.length ? 'レッスンを開く' : '自分で書き始める'}</Button>
              <Button v="outline" sm onClick={() => removeLesson(sel.lesson.id)}>この節を消す</Button>
            </div>
            <div><div className="sub" style={{ marginBottom: 4 }}>教科書の育ち具合</div><Meter tb={tb} /></div>
          </div>
          <div className="chapterpane">
            <div className="eyebrow">CH{sel.ci + 1}</div>
            <input className="titleinput" aria-label="章の名前" value={sel.chapter.title} onChange={(e) => updateBook(tb.id, (d) => { d.chapters[sel.ci].title = e.target.value })} />
            <ul className="lessonlist">
              {sel.chapter.lessons.map((l, li) => (
                <li key={l.id}>
                  <button aria-current={l.id === sel.lesson.id} onClick={() => selectLesson(l.id)}>
                    <span className="mono sub">{sel.ci + 1}-{li + 1}</span><span>{l.isTask && '◆ '}{l.title}</span><span className="row" style={{ justifyContent: 'flex-end' }}><StatusChip lesson={l} /></span>
                  </button>
                </li>
              ))}
            </ul>
            {/* この章への操作は章構成の右下に。コース全体への「章を足す」はカードの外に置く */}
            <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
              <Button v="outline" sm onClick={() => addLesson(sel.chapter.id)}>この章に節を足す</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="empty"><p>節がありません。</p><Button v="primary" onClick={addChapter}>章を足す</Button></Card>
      )}
      {sel && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <Button v="outline" sm onClick={addChapter}>章を足す</Button>
        </div>
      )}
    </>
  )
}

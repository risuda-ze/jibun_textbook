import { L } from './labels'
import { useMemo, useState } from 'react'
import { getProvider } from '../ai'
import type { RedesignPlan, RedesignScope, Usage } from '../ai/types'
import {
  applyChapterPlan,
  applyCoursePlan,
  applyLessonRegen,
  diffLessonRegen,
  diffTextbooks,
  DIFF_LABEL,
  type DiffRow,
} from '../lib/protect'
import { moveChapter, moveLesson, moveLessonToChapter } from '../lib/reorder'
import { STATUS_LABEL, currentLesson, findLesson, lessonNo, lessonStatus } from '../lib/status'
import { openLesson, putBook, selectLesson, snapshot, toast, updateBook, updateLesson, useApp } from '../store'
import { newChapter, newLesson, type Chapter, type Lesson, type Textbook } from '../types'
import {
  GoalInput,
  Meter,
  StatusChip,
  StopButton,
  TitleInput,
  UsageLine,
  clearLessonWithUndo,
  downloadBook,
  stepPercent,
  useAiRun,
} from './common'
import { GenerateControls, useGenerate } from './GenerateControls'
import { Button, Card, Pill, Segmented, type PillTone } from './kit'

const PXMIN = 1.6
const UNIT = 180 // 目盛り1つ = 3時間

/** 変更案を今の教科書に当てた結果を作る。守る対象の保証は protect.ts の中にある。 */
function applyPlan(tb: Textbook, lessonId: string, plan: RedesignPlan): Textbook {
  const f = findLesson(tb, lessonId)
  if (!f) return tb
  if (plan.scope === 'lesson') {
    return {
      ...tb,
      chapters: tb.chapters.map((c) => ({
        ...c,
        lessons: c.lessons.map((l) => (l.id === lessonId ? applyLessonRegen(l, plan.blocks) : l)),
      })),
    }
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
  const [plan, setPlan] = useState<RedesignPlan | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  // 変更案の実行（busy・段階・今していること・経過時間・エラー・中止）（#82）
  const p = useAiRun()
  const scopes: [RedesignScope, string][] = [
    ['lesson', `この節だけ ${lessonNo(tb, lesson.id)}`],
    ['chapter', `この章だけ 第${f.ci + 1}章`],
    ['course', 'コース全体'],
  ]

  const after = useMemo(() => (plan ? applyPlan(tb, lesson.id, plan) : null), [plan, tb, lesson.id])
  const rows: DiffRow[] =
    !plan || !after
      ? []
      : plan.scope === 'lesson'
        ? diffLessonRegen(lesson, plan.blocks)
        : diffTextbooks(tb, after, plan.scope === 'chapter' ? f.chapter.id : undefined)

  async function propose() {
    setPlan(null)
    const r = await p.run(
      async (progress, signal) => (await getProvider(ai)).proposeRedesign(tb, scope, lesson.id, order, progress, { signal }),
      1,
    )
    if (r) {
      setPlan(r.plan)
      setUsage(r.usage)
    }
  }

  function adopt() {
    if (!after) return
    const before = snapshot(tb.id)
    putBook(after)
    if (!findLesson(after, lesson.id)) {
      const c = currentLesson(after)
      if (c) selectLesson(c.id)
    }
    onClose()
    toast('変更案を反映しました', before ? () => putBook(before) : undefined)
  }

  return (
    <Card stack tone="sky" className="redo" aria-label="設計を直す">
      <div className="pagehead">
        <div>
          <div className="eyebrow">設計を直す</div>
          <h2 style={{ fontSize: 17 }}>直す範囲を選ぶ</h2>
        </div>
        <Button v="outline" sm onClick={onClose}>
          閉じる
        </Button>
      </div>
      <div className="row">
        <Segmented
          label="直す範囲"
          value={scope}
          options={scopes}
          onChange={(k) => {
            setScope(k)
            setPlan(null)
          }}
        />
        <span className="sub">節や章は下の一覧で選び直せます。</span>
      </div>
      <div className="row">
        <input
          type="text"
          id="redotext"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          placeholder="どう変えたいか（例: 理論は短く、実践を先に）"
          style={{ flex: '1 1 280px' }}
        />
        <Button v="soft" disabled={p.busy} onClick={propose} progress={p.busy ? stepPercent(p.step, 1) : null} busy={p.working}>
          {plan ? '別の案を出す' : L.propose}
        </Button>
        {p.busy && <StopButton onStop={p.stop} />}
      </div>
      {p.error && (
        <p className="err" role="alert">
          {p.error}
        </p>
      )}
      {plan && (
        <>
          <div>
            <div className="eyebrow">AIの変更案{order && `：「${order}」`}</div>
            <ul className="diff">
              {rows.map((r, i) => (
                <li key={i}>
                  <Pill tone={DIFF_CHIP[r.kind]}>{DIFF_LABEL[r.kind]}</Pill>
                  <span style={r.level === 'chapter' ? { fontWeight: 900 } : undefined}>
                    {r.from && (
                      <>
                        <s className="sub">{r.from}</s> →{' '}
                      </>
                    )}
                    {r.text}
                    {r.note && <span className="sub"> {r.note}のため触りません</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <UsageLine usage={usage} />
          <div className="row">
            <Button v="primary" onClick={adopt}>
              この案を採用
            </Button>
            <span className="sub">採用するまで何も変わりません。自分のノート・自分で直した文・完了の節は、どの案でも残ります。</span>
          </div>
        </>
      )}
    </Card>
  )
}

/** 上へ／下への対（#123 でアイコン化）。方向・読み上げの語・見た目の記号。章と節で同じ */
const DIRS: [-1 | 1, string, string][] = [
  [-1, '上へ', '∧'],
  [1, '下へ', '∨'],
]

export function Roadmap({ tb }: { tb: Textbook }) {
  const { lessonId, ai } = useApp()
  const [redo, setRedo] = useState(false)
  // 資料を生成（#55 #63 #14 をまとめた部品 #82）。状態はここが持つので、別の節を選び直しても生成は続く
  const g = useGenerate(tb, ai)
  const cur = currentLesson(tb)
  const sel =
    (lessonId && findLesson(tb, lessonId)) ||
    (cur && findLesson(tb, cur.id)) ||
    (tb.chapters[0]?.lessons[0] && findLesson(tb, tb.chapters[0].lessons[0].id))

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

  function addLesson(chapterId: string) {
    const l = newLesson('新しい節')
    updateBook(tb.id, (d) => {
      d.chapters.find((c) => c.id === chapterId)?.lessons.push(l)
    })
    selectLesson(l.id)
  }
  function addChapter() {
    const l = newLesson('最初の節')
    updateBook(tb.id, (d) => {
      d.chapters.push(newChapter(`第${d.chapters.length + 1}章`, [l]))
    })
    selectLesson(l.id)
  }
  function removeLesson(id: string) {
    const before = snapshot(tb.id)
    // 最後の1節を消すと章ごと消える。そのことをトーストで伝える（#17）。元に戻すで章も戻る
    const last = tb.chapters.some((c) => c.lessons.length === 1 && c.lessons[0].id === id)
    const after = {
      ...tb,
      chapters: tb.chapters.map((c) => ({ ...c, lessons: c.lessons.filter((l) => l.id !== id) })).filter((c) => c.lessons.length),
    }
    updateBook(tb.id, (d) => Object.assign(d, after))
    // 消した節を選んだままにしない（#88）。レッスンタブを押したときに「節が選ばれていません」になるのを防ぐ。元に戻すで選択も戻す
    const next = (currentLesson(after) ?? after.chapters[0]?.lessons[0])?.id
    const moved = (!lessonId || lessonId === id) && !!next
    if (moved) selectLesson(next)
    toast(
      last ? '節を消しました。節が無くなった章も消しました' : '節を消しました',
      before
        ? () => {
            putBook(before)
            if (moved) selectLesson(id)
          }
        : undefined,
    )
  }
  /** 並べ替え（#11）。純粋関数の結果で置き換え、元に戻せるトーストを出す。選択は動かした節のまま */
  function move(fn: (d: Textbook) => Textbook, lessonId: string, msg: string) {
    const before = snapshot(tb.id)
    updateBook(tb.id, (d) => Object.assign(d, fn(d)))
    selectLesson(lessonId)
    toast(msg, before ? () => putBook(before) : undefined)
  }

  /**
   * 節の1行（番号・◆題名・状態）。スマホ幅の一覧（.chlist）と章構成（chapterpane）で同じ形（#128）。
   * 選んだ行の中に「上へ／下へ／別の章へ」のメニューが開く（#123）。常設の操作行は無い
   */
  function lessonItem(c: Chapter, ci: number, l: Lesson, li: number) {
    const no = `${ci + 1}-${li + 1}`
    const on = l.id === sel?.lesson.id
    return (
      <li key={l.id}>
        <button type="button" aria-current={on} onClick={() => selectLesson(l.id)}>
          <span className="mono sub">{no}</span>
          <span>
            {l.isTask && '◆ '}
            {l.title}
          </span>
          <span className="row" style={{ justifyContent: 'flex-end' }}>
            <StatusChip lesson={l} />
          </span>
        </button>
        {on && (
          <div className="row movectl lessonmenu" role="group" aria-label={`${no} の位置`}>
            {DIRS.map(([dir, word, icon]) => (
              <Button
                key={dir}
                v="ghost"
                sm
                className="icon"
                aria-label={`${no} を${word}`}
                disabled={dir < 0 ? li === 0 : li === c.lessons.length - 1}
                onClick={() => move((d) => moveLesson(d, l.id, dir), l.id, `節を${word}動かしました`)}
              >
                {icon}
              </Button>
            ))}
            {tb.chapters.length > 1 && (
              <select
                aria-label={`${no} を別の章へ`}
                value=""
                onChange={(e) => {
                  const to = tb.chapters.findIndex((x) => x.id === e.target.value)
                  if (to < 0) return
                  // 最後の1節を移すと元の章は消える。そのことをトーストで伝える（removeLesson と同じ）
                  const last = c.lessons.length === 1
                  move(
                    (d) => moveLessonToChapter(d, l.id, e.target.value),
                    l.id,
                    `節を第${to + 1}章の末尾へ動かしました${last ? '。節が無くなった章も消しました' : ''}`,
                  )
                }}
              >
                <option value="">別の章へ…</option>
                {tb.chapters.map(
                  (x, i) =>
                    x.id !== c.id && (
                      <option key={x.id} value={x.id}>
                        第{i + 1}章 {x.title}
                      </option>
                    ),
                )}
              </select>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">コース</div>
          <TitleInput
            className="titleinput"
            aria-label="教科書の名前"
            value={tb.title}
            onCommit={(v) =>
              updateBook(tb.id, (d) => {
                d.title = v
              })
            }
          />
          <GoalInput
            className="lead goalinput"
            aria-label="教科書の狙い"
            placeholder="このコースの狙い"
            value={tb.goal}
            onCommit={(v) =>
              updateBook(tb.id, (d) => {
                d.goal = v
              })
            }
          />
        </div>
        <div className="row">
          <Button v="ghost" onClick={() => downloadBook(tb)}>
            JSONを書き出す
          </Button>
          <Button v="ghost" onClick={() => setRedo(true)} disabled={!sel}>
            設計を直す
          </Button>
          {cur && (
            <Button v="primary" onClick={() => openLesson(cur.id)}>
              続きから {lessonNo(tb, cur.id)}
            </Button>
          )}
        </div>
      </div>

      <div className="row legend">
        {(['none', 'ai', 'me', 'done'] as const).map((k) => (
          <Pill key={k} tone={k}>
            {STATUS_LABEL[k]}
          </Pill>
        ))}
        <Pill tone="review">再確認</Pill>
        <span className="tlnote">◆ は実践課題、幅は所要時間、赤い線が現在地です。</span>
      </div>

      {/* PC幅: タイムライン */}
      <div className="tl" tabIndex={0} role="region" aria-label="ロードマップのタイムライン">
        <div className="tl-inner">
          <div className="tl-row tl-ruler">
            <div className="tl-label">3時間ごと</div>
            <div className="tl-lane" style={{ width: W }}>
              {Array.from({ length: units }, (_, i) => (
                <span key={i} className="tick" style={{ left: i * UNIT * PXMIN }}>
                  {(i + 1) * 3}h
                </span>
              ))}
            </div>
          </div>
          {tracks.map(({ c, clips }, ci) => (
            <div className="tl-row" key={c.id}>
              <div className="tl-label">
                <span className="mono">CH{ci + 1}</span>
                {c.title}
              </div>
              <div className="tl-lane" style={{ width: W }}>
                {clips.map(({ l, left }, li) => {
                  const title = `${ci + 1}-${li + 1} ${l.title}（${l.minutes}分・${STATUS_LABEL[lessonStatus(l)]}）`
                  return (
                    <button
                      type="button"
                      key={l.id}
                      className={`clip ${lessonStatus(l)} ${l.isTask ? 'task' : ''}`}
                      style={{ left: left * PXMIN, width: Math.max(20, l.minutes) * PXMIN - 3 }}
                      aria-pressed={sel?.lesson.id === l.id}
                      title={title}
                      aria-label={title}
                      onClick={() => selectLesson(l.id)}
                    >
                      {ci + 1}-{li + 1} {l.title}
                      {l.review && <span className="flagdot" aria-label="再確認" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {cur && <div className="playhead" style={{ left: `calc(var(--lw) + ${play * PXMIN}px)` }} />}
        </div>
      </div>

      {/* スマホ幅: 章ごとの一覧。行を選ぶとその行にメニューが開く（#123）ので、詳細へは飛ばない */}
      <div className="chlist" aria-label="章ごとの一覧">
        {tb.chapters.map((c, ci) => (
          <Card key={c.id}>
            <h3>
              <span className="mono sub">CH{ci + 1}</span> {c.title}
            </h3>
            <ul className="lessonlist">{c.lessons.map((l, li) => lessonItem(c, ci, l, li))}</ul>
          </Card>
        ))}
      </div>

      {redo && sel && <RedoPanel tb={tb} lesson={sel.lesson} onClose={() => setRedo(false)} />}

      {sel ? (
        <Card className="detail" id="detail">
          {/* 見出し行: 章の番号と上下、右端に「足す」（#123）。画面の下端は読みづらいので、下に操作を置かない */}
          <div className="row detailhead">
            <div className="row movectl">
              <div className="eyebrow">CH{sel.ci + 1}</div>
              {DIRS.map(([dir, word, icon]) => (
                <Button
                  key={dir}
                  v="ghost"
                  sm
                  className="icon"
                  aria-label={`第${sel.ci + 1}章を${word}`}
                  disabled={dir < 0 ? sel.ci === 0 : sel.ci === tb.chapters.length - 1}
                  onClick={() => move((d) => moveChapter(d, sel.chapter.id, dir), sel.lesson.id, `章を${word}動かしました`)}
                >
                  {icon}
                </Button>
              ))}
            </div>
            <div className="row">
              <Button v="outline" sm onClick={() => addLesson(sel.chapter.id)}>
                ＋節を足す
              </Button>
              <Button v="outline" sm onClick={addChapter}>
                ＋章を足す
              </Button>
            </div>
          </div>
          {/* 章構成を左（広い）、選択中の節を右に置く（#89）。読み上げ順も同じ */}
          <div className="chapterpane">
            <TitleInput
              key={sel.chapter.id}
              className="titleinput"
              aria-label="章の名前"
              value={sel.chapter.title}
              onCommit={(v) =>
                updateBook(tb.id, (d) => {
                  d.chapters[sel.ci].title = v
                })
              }
            />
            <ul className="lessonlist">{sel.chapter.lessons.map((l, li) => lessonItem(sel.chapter, sel.ci, l, li))}</ul>
          </div>
          <div className="stack">
            <div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="eyebrow">
                  選択中 {lessonNo(tb, sel.lesson.id)}・{sel.lesson.minutes}分
                </div>
                <Button
                  v="ghost"
                  sm
                  className="icon"
                  aria-label="この節を消す"
                  title="この節を消す"
                  onClick={() => removeLesson(sel.lesson.id)}
                >
                  ×
                </Button>
              </div>
              <TitleInput
                key={sel.lesson.id}
                className="titleinput"
                aria-label="節の名前"
                value={sel.lesson.title}
                onCommit={(v) =>
                  updateLesson(tb.id, sel.lesson.id, (l) => {
                    l.title = v
                  })
                }
              />
            </div>
            <div className="row">
              <StatusChip lesson={sel.lesson} />
            </div>
            <GoalInput
              key={sel.lesson.id}
              className="sub goalinput"
              aria-label="節の狙い"
              placeholder="この節の狙い"
              value={sel.lesson.summary}
              onCommit={(v) =>
                updateLesson(tb.id, sel.lesson.id, (l) => {
                  l.summary = v
                })
              }
            />
            {sel.lesson.blocks.length ? (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button v="soft" onClick={() => openLesson(sel.lesson.id)}>
                  レッスンを開く
                </Button>
              </div>
            ) : (
              // 未作成の節は3択の枠（#123）: 渡す → 生成、その右に自分で書き始める
              <GenerateControls g={g} lessonId={sel.lesson.id} label={L.generateLesson} onDone={() => openLesson(sel.lesson.id)}>
                <Button v="ghost" onClick={() => openLesson(sel.lesson.id)}>
                  {L.startWriting}
                </Button>
              </GenerateControls>
            )}
            {/* 消す系は主操作の並びから離して右寄せに（#90）。「この節を消す」は右上の × */}
            {sel.lesson.blocks.length > 0 && (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button v="outline" sm onClick={() => clearLessonWithUndo(tb, sel.lesson.id)}>
                  {L.clearLesson}
                </Button>
              </div>
            )}
            <div>
              <div className="sub" style={{ marginBottom: 4 }}>
                教科書の育ち具合
              </div>
              <Meter tb={tb} />
            </div>
          </div>
        </Card>
      ) : (
        <Card className="empty">
          <p>節がありません。</p>
          <Button v="primary" onClick={addChapter}>
            章を足す
          </Button>
        </Card>
      )}
    </>
  )
}

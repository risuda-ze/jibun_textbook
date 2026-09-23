import { Fragment, useEffect, useRef, useState } from 'react'
import { allLessons, findLesson, lessonNo, minePercent } from '../lib/status'
import { go, openLesson, putBook, setDraft as storeDraft, setWide, snapshot, toast, updateLesson, useApp } from '../store'
import { emptyDraft, newBlock, uid, type Lesson, type NoteDraft, type Textbook } from '../types'
import { BlockRow, Composer } from './blocks'
import { StatusChip } from './common'
import { isHttpUrl } from '../lib/safe'
import { generateInto } from './generate'
import { Button, Card } from './kit'

const gq = (q: string) => 'https://www.google.com/search?q=' + encodeURIComponent(q)

function Clues({ tb, lesson }: { tb: Textbook; lesson: Lesson }) {
  const [q, setQ] = useState('')
  const [url, setUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const c = lesson.clues
  return (
    <Card stack className="clues" aria-label="参考情報">
      <h2 style={{ fontSize: 16 }}>参考情報</h2>
      <div>
        <div className="eyebrow">検索する</div>
        <div className="row" style={{ marginTop: 6 }}>
          {c.queries.length ? c.queries.map((x) => <a className="qchip" key={x} href={gq(x)} target="_blank" rel="noopener noreferrer">{x}</a>) : <span className="sub">まだありません。下から足せます。</span>}
        </div>
      </div>
      <div>
        <div className="eyebrow">一次情報</div>
        <ul className="plain">
          {c.links.length ? c.links.map((x) => (
            // JSON 由来の URL は http(s) 以外をリンクにしない（#35）
            <li key={x.url}>{isHttpUrl(x.url) ? <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a> : <span title="http(s) 以外のURLはリンクにしません">{x.title}</span>}{x.fetchedAt && <span className="sub"> （{x.fetchedAt} 時点）</span>}</li>
          )) : <li className="sub">まだありません。読んだページのURLを下から足せます。</li>}
        </ul>
      </div>
      {c.how.length > 0 && <div><div className="eyebrow">確かめ方</div><ul className="plain">{c.how.map((h) => <li key={h}>{h}</li>)}</ul></div>}
      <div className="row">
        <input type="text" id="clue" value={q} onChange={(e) => setQ(e.target.value)} placeholder="自分で見つけた検索語を足す" style={{ flex: '1 1 200px' }} />
        <Button v="ghost" onClick={() => { if (!q.trim()) return; updateLesson(tb.id, lesson.id, (l) => { l.clues.queries.push(q.trim()) }); setQ('') }}>検索語を足す</Button>
      </div>
      <div className="row">
        <input type="text" id="cluelink" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="読んだページのURLを足す" style={{ flex: '1 1 200px' }} />
        <input type="text" id="cluetitle" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="題名（任意）" style={{ flex: '1 1 120px' }} />
        <Button v="ghost" onClick={() => {
          const u = url.trim(); if (!isHttpUrl(u)) return toast('http から始まるURLを入れてください')
          updateLesson(tb.id, lesson.id, (l) => { l.clues.links.push({ title: linkTitle.trim() || u, url: u, fetchedAt: new Date().toISOString().slice(0, 10) }) }); setUrl(''); setLinkTitle('')
        }}>リンクを足す</Button>
      </div>
    </Card>
  )
}

export function LessonPage({ tb }: { tb: Textbook }) {
  const { lessonId, ai, drafts, wide } = useApp()
  const f = (lessonId && findLesson(tb, lessonId)) || null
  const [insAt, setInsAt] = useState<number | null>(null)
  const [blame, setBlame] = useState(true)
  const [genDetail, setGenDetail] = useState<string | null>(null)
  const [task, setTask] = useState('')
  const qbtn = useRef<HTMLButtonElement>(null)
  const pending = useRef<{ text: string; blockId: string } | null>(null)

  useEffect(() => { setInsAt(null) }, [lessonId])

  // 本文を選択すると「引用してノートを書く」を出す
  useEffect(() => {
    const onSel = () => {
      const btn = qbtn.current; const sel = document.getSelection()
      if (!btn) return
      const node = sel && !sel.isCollapsed ? sel.anchorNode : null
      const row = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest('.doc [data-block]') : null
      const text = sel?.toString().trim() ?? ''
      if (!row || !text) { btn.hidden = true; return }
      const r = sel!.getRangeAt(0).getBoundingClientRect()
      btn.hidden = false
      btn.style.top = Math.max(8, r.top - 42) + 'px'
      btn.style.left = Math.min(window.innerWidth - 210, Math.max(8, r.left)) + 'px'
      pending.current = { text: text.slice(0, 300), blockId: row.getAttribute('data-block')! }
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  if (!f) return <Card className="empty"><p>節が選ばれていません。</p><Button v="primary" onClick={() => go('road')}>ロードマップへ</Button></Card>
  const l = f.lesson
  const ls = allLessons(tb)
  const next = ls[ls.indexOf(l) + 1]
  const pct = minePercent(l)
  const withUndo = (msg: string, fn: () => void) => { const before = snapshot(tb.id); fn(); toast(msg, before ? () => putBook(before) : undefined) }
  // ノートの下書きは store に節ごとに持つ。差し込み位置の変更・節の切り替え・画面の移動で消えない（#12）
  const draft = drafts[l.id] ?? emptyDraft()
  const setDraft = (d: NoteDraft) => storeDraft(l.id, d)

  function addNote() {
    const n = draft
    updateLesson(tb.id, l.id, (d) => {
      const b = newBlock('me', n.md.trim(), { source: n.source.trim(), quote: n.quote, images: n.images.map((dataUrl) => ({ id: uid(), dataUrl, alt: '' })) })
      d.blocks.splice(insAt ?? d.blocks.length, 0, b)
    })
    setInsAt(null); setDraft(emptyDraft())
    toast('書き込みました')
  }

  async function generate() {
    setGenDetail('')
    await generateInto(tb, l.id, ai, setGenDetail)
    setGenDetail(null)
  }

  const composerAt = insAt ?? l.blocks.length
  const composer = <Composer draft={draft} onChange={setDraft} onSubmit={addNote} />

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">{lessonNo(tb, l.id)}・{l.minutes}分{l.isTask && '・実践課題'}</div>
          <h1>{l.title}</h1>
          <div className="row" style={{ marginTop: 6 }}><StatusChip lesson={l} /></div>
        </div>
        <div className="row">
          {/* 表示領域の切り替え（#53）。スマホ幅では CSS で隠す（元から1列で画面いっぱい） */}
          <Button v="ghost" className="widebtn" aria-pressed={wide} onClick={() => setWide(!wide)}>{wide ? '幅を戻す' : '広げる'}</Button>
          <Button v="ghost" onClick={() => go('road')}>ロードマップ</Button>
          {next && <Button v="ghost" onClick={() => openLesson(next.id)}>次へ {lessonNo(tb, next.id)}</Button>}
        </div>
      </div>

      <div className="lesson">
        <div className="stack">
          {l.blocks.length === 0 && (
            <Card stack>
              <p>この節はまだ資料がありません。AIに下書きを作らせるか、下の欄から自分で書き始めてください。</p>
              <div className="row">
                <Button v="soft" disabled={genDetail !== null} onClick={generate}>{genDetail !== null ? genDetail || '生成中…' : '資料を生成'}</Button>
                <span className="sub">使うAI: {ai.kind === 'anthropic' ? ai.model : ai.kind === 'demo' ? 'デモ応答' : '未対応の接続先'}（「つくる」画面で切り替え）</span>
              </div>
            </Card>
          )}
          <div className="row">
            <label className="row sub" htmlFor="blameL"><input type="checkbox" id="blameL" checked={blame} onChange={(e) => setBlame(e.target.checked)} />書き手の印を出す</label>
            <span className="sub">AI = AIの下書き / 自 = 自分のノート。本文はクリックして直接書き換えられます。本文を選択すると引用できます。</span>
          </div>
          <div className={`blocks doc ${blame ? '' : 'noblame'}`}>
            {l.blocks.map((b, i) => (
              <Fragment key={b.id}>
                {composerAt === i ? composer : <button className="ins" onClick={() => setInsAt(i)}>＋ ここに書く</button>}
                <BlockRow
                  block={b}
                  onCommit={(md) => updateLesson(tb.id, l.id, (d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) { x.md = md; if (x.by === 'ai') x.edited = true } })}
                  onCheck={(md) => updateLesson(tb.id, l.id, (d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) x.md = md })}
                  onDelete={() => withUndo(b.by === 'me' ? 'ノートを消しました' : '文を消しました', () => updateLesson(tb.id, l.id, (d) => { d.blocks = d.blocks.filter((y) => y.id !== b.id) }))}
                  onRemoveImage={(imgId) => withUndo('画像を外しました', () => updateLesson(tb.id, l.id, (d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) x.images = x.images.filter((im) => im.id !== imgId) }))}
                />
              </Fragment>
            ))}
            {composerAt >= l.blocks.length ? composer : <button className="ins" onClick={() => setInsAt(null)}>＋ ここに書く</button>}
          </div>
          <Clues tb={tb} lesson={l} />
        </div>

        <aside className="rail">
          <Card as="div">
            <h2>この節の印</h2>
            <div className="marks">
              <label className={`mark done ${l.done ? 'on' : ''}`} htmlFor="markdone"><input type="checkbox" id="markdone" checked={l.done} onChange={(e) => updateLesson(tb.id, l.id, (d) => { d.done = e.target.checked })} />完了</label>
              <label className={`mark review ${l.review ? 'on' : ''}`} htmlFor="markreview"><input type="checkbox" id="markreview" checked={l.review} onChange={(e) => updateLesson(tb.id, l.id, (d) => { d.review = e.target.checked })} />あとで再確認</label>
            </div>
            <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>どちらも自分のタイミングで付けます。完了の節は「設計を直す」で変更されません。</p>
          </Card>
          <Card as="div">
            <h2>この節の中身</h2>
            <div className="meter" role="img" aria-label={`自分の言葉 ${pct}%`}><i style={{ flex: pct, background: 'var(--st-me)' }} /><i style={{ flex: 100 - pct, background: 'var(--st-ai)' }} /></div>
            <p className="sub" style={{ fontSize: 13 }}>自分の言葉 <b className="mono">{pct}%</b></p>
          </Card>
          <Card as="div">
            <h2>手を動かす</h2>
            <ul>
              {l.tasks.map((t, j) => (
                <li className="check" key={j}>
                  <input type="checkbox" id={`task${j}`} checked={t.checked} onChange={(e) => updateLesson(tb.id, l.id, (d) => { d.tasks[j].checked = e.target.checked })} />
                  <label htmlFor={`task${j}`}>{t.text}</label>
                </li>
              ))}
              {l.tasks.length === 0 && <li className="sub">まだありません。</li>}
            </ul>
            <div className="row" style={{ marginTop: 8 }}>
              <input type="text" id="newtask" value={task} onChange={(e) => setTask(e.target.value)} placeholder="やることを足す" style={{ flex: '1 1 120px' }} />
              <Button v="outline" sm onClick={() => { if (!task.trim()) return; updateLesson(tb.id, l.id, (d) => { d.tasks.push({ text: task.trim(), checked: false }) }); setTask('') }}>足す</Button>
            </div>
          </Card>
        </aside>
      </div>

      <button ref={qbtn} className="qbtn" hidden onPointerDown={(e) => {
        // クリックより先に選択が消えるので、押した瞬間に処理する
        e.preventDefault()
        const p = pending.current; if (!p) return
        const i = l.blocks.findIndex((b) => b.id === p.blockId)
        setDraft({ ...draft, quote: p.text }); setInsAt(i >= 0 ? i + 1 : null)
        document.getSelection()?.removeAllRanges()
        e.currentTarget.hidden = true
      }}>引用してノートを書く</button>
    </>
  )
}

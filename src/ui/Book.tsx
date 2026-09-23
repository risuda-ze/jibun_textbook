import { useState } from 'react'
import { allLessons, isMine, reviewCount } from '../lib/status'
import { openLesson, setWide, updateLesson, useApp } from '../store'
import type { Block, Lesson, Textbook } from '../types'
import { BlockRow } from './blocks'
import { downloadBook } from './Shelf'
import { Button, PageHead, Pill, Segmented } from './kit'

type Filter = 'all' | 'me' | 'review'
const FILTERS: [Filter, string][] = [['all', 'すべて'], ['me', '自分のノートだけ'], ['review', '再確認の節だけ']]

export function Book({ tb }: { tb: Textbook }) {
  const { wide } = useApp()
  const [filter, setFilter] = useState<Filter>('all')
  const [blame, setBlame] = useState(false)
  const lessonOk = (l: Lesson) => l.blocks.length > 0 && (filter !== 'review' || l.review)
  const blockOk = (b: Block) => filter !== 'me' || isMine(b)
  const chapters = tb.chapters
    .map((c, ci) => ({ c, ci, lessons: c.lessons.map((l, li) => ({ l, li, blocks: lessonOk(l) ? l.blocks.filter(blockOk) : [] })).filter((x) => x.blocks.length) }))
    .filter((x) => x.lessons.length)
  const blocks = allLessons(tb).flatMap((l) => l.blocks)
  return (
    <>
      <PageHead eyebrow="教科書（通読）" title={tb.title} lead="全レッスンを1冊につなげた、読み返すための表示です。書くのはレッスン側で行います。"
        actions={<>
          <Button v="ghost" className="widebtn" aria-pressed={wide} onClick={() => setWide(!wide)}>{wide ? '幅を戻す' : '広げる'}</Button>
          <Button v="ghost" onClick={() => downloadBook(tb)}>JSONを書き出す</Button>
        </>} />
      <div className="row">
        {chapters.map(({ c, ci }) => (
          <Button key={c.id} v="outline" sm onClick={() => document.getElementById(`bkch${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{ci + 1}. {c.title}</Button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Segmented label="表示の絞り込み" value={filter} options={FILTERS} onChange={setFilter} />
        <label className="row sub" htmlFor="blameB"><input type="checkbox" id="blameB" checked={blame} onChange={(e) => setBlame(e.target.checked)} />書き手の印を出す</label>
      </div>
      <article className={`book ${blame ? '' : 'noblame'}`}>
        {chapters.length === 0 && <p className="sub">該当なし。</p>}
        {chapters.map(({ c, ci, lessons }) => (
          <section key={c.id}>
            <h2 id={`bkch${c.id}`}>{ci + 1}. {c.title}</h2>
            {lessons.map(({ l, li, blocks: bs }) => (
              <div key={l.id}>
                <h3 className="lt">
                  <span className="mono sub">{ci + 1}-{li + 1}</span>{l.title}
                  {l.done && <Pill tone="done">完了</Pill>}{l.review && <Pill tone="review">再確認</Pill>}
                  <button className="linkbtn" onClick={() => openLesson(l.id)}>このページに書く</button>
                </h3>
                {bs.map((b) => <BlockRow key={b.id} block={b} read onCheck={(md) => updateLesson(tb.id, l.id, (d) => { const x = d.blocks.find((y) => y.id === b.id); if (x) x.md = md })} />)}
              </div>
            ))}
          </section>
        ))}
      </article>
      <p className="sub">自分のノートと修正 {blocks.filter(isMine).length} / AIの下書き {blocks.filter((b) => !isMine(b)).length} / 再確認の節 {reviewCount(tb)}</p>
    </>
  )
}

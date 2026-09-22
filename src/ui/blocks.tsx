import { useEffect, useRef, useState } from 'react'
import { htmlToMd, mdToHtml } from '../lib/md'
import { shrinkImage } from '../lib/image'
import { toast } from '../store'
import type { Block } from '../types'
import { Button } from './kit'

/** 見たまま編集。表示は md→HTML、フォーカスが外れた時に変更があれば HTML→md で確定する。 */
export function Editable({ md, onCommit }: { md: string; onCommit: (md: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const before = useRef('')
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.innerHTML = mdToHtml(md)
  }, [md])
  return (
    <div
      ref={ref}
      className="blk-body"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      aria-label="本文（直接編集できる）"
      onFocus={(e) => { before.current = e.currentTarget.innerHTML }}
      onBlur={(e) => {
        // 触っていないのに md が正規化で変わって「自分で修正」になるのを防ぐため、HTMLの変化で判定する
        if (e.currentTarget.innerHTML === before.current) return
        const next = htmlToMd(e.currentTarget.innerHTML)
        if (next !== md.trim()) onCommit(next)
      }}
    />
  )
}

const MARK = (b: Block): [string, string, string] => (b.by === 'me' ? ['me', '自', '自分のノート'] : ['ai', 'AI', b.edited ? 'AIの下書き（自分で修正）' : 'AIの下書き'])

type RowProps = {
  block: Block
  read?: boolean
  onCommit?: (md: string) => void
  onDelete?: () => void
  onRemoveImage?: (imageId: string) => void
}

export function BlockRow({ block: b, read, onCommit, onDelete, onRemoveImage }: RowProps) {
  const [cls, mk, tt] = MARK(b)
  return (
    <div className={`ln ${cls}`} data-block={b.id} data-by={b.by}>
      <span className="gut" title={tt}>{mk}</span>
      <div>
        {!read && <div className="ln-acts"><Button v="outline" sm onClick={onDelete}>消す</Button></div>}
        {b.quote && <blockquote>{b.quote}</blockquote>}
        {read ? <div className="blk-body" dangerouslySetInnerHTML={{ __html: mdToHtml(b.md) }} /> : <Editable md={b.md} onCommit={(m) => onCommit?.(m)} />}
        {b.images.map((im) => (
          <span className="imgwrap" key={im.id}>
            <img src={im.dataUrl} alt={im.alt || '自分で入れた画像'} />
            {!read && <button onClick={() => onRemoveImage?.(im.id)} aria-label="この画像を外す">×</button>}
          </span>
        ))}
        {b.source && <div className="src">出典: {/^https?:\/\//.test(b.source) ? <a href={b.source} target="_blank" rel="noopener noreferrer">{b.source}</a> : b.source}</div>}
        {b.edited && !read && <div className="src">自分で修正</div>}
      </div>
    </div>
  )
}

const PENS: [string, string][] = [['#161A24', '黒'], ['#D6334C', '赤'], ['#2F5FD0', '青'], ['#ffffff', '消しゴム']]

export function DrawPad({ onSave, onClose }: { onSave: (dataUrl: string) => void; onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [pen, setPen] = useState(PENS[0][0])
  const drawing = useRef(false)
  const clear = () => { const c = cv.current!; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height) }
  useEffect(clear, [])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cv.current!; const r = c.getBoundingClientRect()
    return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height] as const
  }
  return (
    <div className="stack" id="pad">
      <canvas ref={cv} id="cv" width={960} height={540} aria-label="図を描くキャンバス"
        onPointerDown={(e) => {
          drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId)
          const x = e.currentTarget.getContext('2d')!
          x.strokeStyle = pen; x.lineWidth = pen === '#ffffff' ? 28 : 4; x.lineCap = 'round'; x.lineJoin = 'round'
          x.beginPath(); x.moveTo(...pos(e))
        }}
        onPointerMove={(e) => { if (!drawing.current) return; const x = e.currentTarget.getContext('2d')!; x.lineTo(...pos(e)); x.stroke() }}
        onPointerUp={() => { drawing.current = false }} />
      <div className="row">
        {PENS.map(([c, t]) => <button key={c} className="pen" style={{ background: c }} aria-label={t} title={t} aria-pressed={pen === c} onClick={() => setPen(c)} />)}
        <Button v="outline" sm onClick={clear}>全部消す</Button>
        <Button v="soft" sm onClick={() => onSave(cv.current!.toDataURL('image/png'))}>この図を入れる</Button>
        <Button v="outline" sm onClick={onClose}>やめる</Button>
      </div>
    </div>
  )
}

export type NoteDraft = { md: string; images: string[]; source: string; quote: string }

/** ノートの入力欄。文・貼り付け画像・手描きの図・引用・出典URL。 */
export function Composer({ quote, onUnquote, onSubmit }: { quote: string; onUnquote: () => void; onSubmit: (n: NoteDraft) => void }) {
  const [md, setMd] = useState('')
  const [source, setSource] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [pad, setPad] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const note = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (quote) note.current?.focus() }, [quote])

  async function addFiles(files: Iterable<File>) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      try { const url = await shrinkImage(f); setImages((v) => [...v, url]) } catch { toast('画像を読み込めませんでした。') }
    }
  }

  function submit() {
    if (!md.trim() && !images.length && !quote) return toast('文か画像を入れてから書き込んでください')
    onSubmit({ md: md.trim(), images, source: source.trim(), quote })
    setMd(''); setSource(''); setImages([]); setPad(false)
  }

  return (
    <div className="addnote" onPaste={(e) => {
      const fs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
      if (fs.length) { e.preventDefault(); void addFiles(fs); toast('画像を貼り付けました') }
    }}>
      {quote && <blockquote>{quote} <button className="linkbtn" onClick={onUnquote}>引用をやめる</button></blockquote>}
      <textarea ref={note} id="note" value={md} onChange={(e) => setMd(e.target.value)} placeholder="自分の言葉で。やってみた結果、調べて分かったこと、引っかかった点など。スクショは Ctrl+V で貼れます" />
      {images.length > 0 && (
        <div className="atts">
          {images.map((u, i) => (
            <figure key={i}><img src={u} alt={`入れる画像 ${i + 1}`} /><button onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="この画像を外す">×</button></figure>
          ))}
        </div>
      )}
      {pad && <DrawPad onClose={() => setPad(false)} onSave={async (u) => { const s = await shrinkImage(u).catch(() => u); setImages((v) => [...v, s]); setPad(false) }} />}
      <input ref={file} type="file" id="imgf" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = '' }} />
      <div className="row">
        <Button v="outline" sm onClick={() => file.current?.click()}>画像を入れる</Button>
        <Button v="outline" sm onClick={() => setPad(true)}>図を描く</Button>
        <input type="text" id="src" value={source} onChange={(e) => setSource(e.target.value)} placeholder="出典URL（任意）" style={{ flex: '1 1 180px' }} />
        <Button v="primary" onClick={submit}>書き込む</Button>
      </div>
    </div>
  )
}

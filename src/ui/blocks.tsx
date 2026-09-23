import { useEffect, useRef, useState } from 'react'
import { htmlToMd, mdToHtml, toggleTask } from '../lib/md'
import { shrinkImage } from '../lib/image'
import { isHttpUrl, isImageDataUrl } from '../lib/safe'
import { applyMarkdown, type MdKind } from '../lib/mdedit'
import { toast } from '../store'
import type { Block, NoteDraft } from '../types'
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
      onPaste={(e) => {
        // 貼り付けは文字だけ受け付ける（#17）。装飾つき HTML は確定まで生のまま入り、画像は縮小を通らず元サイズで md に入るため
        const files = [...e.clipboardData.files]
        e.preventDefault()
        if (files.some((f) => f.type.startsWith('image/'))) return toast('本文には画像を貼れません。ノートの「画像を入れる」を使ってください')
        const text = e.clipboardData.getData('text/plain')
        if (text) document.execCommand('insertText', false, text)
      }}
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
  /** 本文のチェックリストを切り替えたとき。onCommit と違い「自分で修正」にはしない（#56） */
  onCheck?: (md: string) => void
  onDelete?: () => void
  onRemoveImage?: (imageId: string) => void
}

export function BlockRow({ block: b, read, onCommit, onCheck, onDelete, onRemoveImage }: RowProps) {
  const [cls, mk, tt] = MARK(b)
  // 本文のチェックボックスのクリックを拾い、Markdown 側を反転して保存する。DOM の切り替えは保存後の再描画に任せる
  const onBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target
    if (!(t instanceof HTMLInputElement) || t.type !== 'checkbox') return
    e.preventDefault()
    const body = t.closest('.blk-body') as HTMLElement | null
    if (!body || !onCheck) return
    const i = [...body.querySelectorAll('input[type="checkbox"]')].indexOf(t)
    if (i < 0) return
    // 見たまま編集の中では、フォーカスが残っていると再描画が反映されないので外す
    if (body.isContentEditable) body.blur()
    onCheck(toggleTask(b.md, i))
  }
  return (
    <div className={`ln ${cls}`} data-block={b.id} data-by={b.by}>
      <span className="gut" title={tt}>{mk}</span>
      <div onClick={onBodyClick}>
        {!read && <div className="ln-acts"><Button v="outline" sm onClick={onDelete}>消す</Button></div>}
        {b.quote && <blockquote>{b.quote}</blockquote>}
        {read ? <div className="blk-body" dangerouslySetInnerHTML={{ __html: mdToHtml(b.md) }} /> : <Editable md={b.md} onCommit={(m) => onCommit?.(m)} />}
        {b.images.map((im) => (
          <span className="imgwrap" key={im.id}>
            {/* JSON 由来の画像は data:image/ だけを表示する（#35） */}
            {isImageDataUrl(im.dataUrl) ? <img src={im.dataUrl} alt={im.alt || '自分で入れた画像'} /> : <span className="sub">表示できない画像です</span>}
            {!read && <button onClick={() => onRemoveImage?.(im.id)} aria-label="この画像を外す">×</button>}
          </span>
        ))}
        {b.source && <div className="src">出典: {isHttpUrl(b.source) ? <a href={b.source} target="_blank" rel="noopener noreferrer">{b.source}</a> : b.source}</div>}
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

/**
 * ノートの入力欄。文・貼り付け画像・手描きの図・引用・出典URL。
 * 下書きは親（LessonPage）が持つ。差し込み位置を変えるとこの部品は描画位置が変わって作り直されるため、
 * 自分の state に持つと下書きが消える（#12）。
 */
export function Composer({ draft, onChange, onSubmit }: { draft: NoteDraft; onChange: (d: NoteDraft) => void; onSubmit: () => void }) {
  const [pad, setPad] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const note = useRef<HTMLTextAreaElement>(null)
  // 画像の読み込みは非同期なので、最新の下書きに足すために ref で持つ
  const latest = useRef(draft)
  latest.current = draft
  const set = (p: Partial<NoteDraft>) => onChange({ ...latest.current, ...p })
  const { md, images, source, quote } = draft
  useEffect(() => { if (quote) note.current?.focus() }, [quote])

  async function addFiles(files: Iterable<File>) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      try { const url = await shrinkImage(f); set({ images: [...latest.current.images, url] }) } catch { toast('画像を読み込めませんでした。') }
    }
  }

  function submit() {
    if (!md.trim() && !images.length && !quote) return toast('文か画像を入れてから書き込んでください')
    onSubmit()
    setPad(false)
  }

  // Markdown の挿入ボタン（#52）。textarea の選択範囲に記法を当て、当てた範囲を選び直す。
  // 選び直しは再描画（value の反映）の後でないと末尾へ飛ぶので、effect で行う
  const pendingSel = useRef<{ start: number; end: number } | null>(null)
  useEffect(() => {
    const el = note.current, p = pendingSel.current
    if (!el || !p) return
    pendingSel.current = null
    el.focus()
    el.setSelectionRange(p.start, p.end)
  }, [md])
  function insertMd(kind: MdKind) {
    const el = note.current
    if (!el) return
    const r = applyMarkdown(latest.current.md, el.selectionStart, el.selectionEnd, kind)
    pendingSel.current = { start: r.start, end: r.end }
    set({ md: r.md })
  }
  const MD_BUTTONS: [MdKind, string, string][] = [
    ['bold', '太字', '**太字**'], ['bullet', '箇条書き', '- 項目'], ['number', '番号', '1. 項目'],
    ['heading', '見出し', '## 見出し'], ['code', 'コード', '`コード`'], ['link', 'リンク', '[文](URL)'],
  ]

  return (
    <div className="addnote" onPaste={(e) => {
      const fs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
      if (fs.length) { e.preventDefault(); void addFiles(fs); toast('画像を貼り付けました') }
    }}>
      {quote && <blockquote>{quote} <button className="linkbtn" onClick={() => set({ quote: '' })}>引用をやめる</button></blockquote>}
      <div className="row mdtools" role="toolbar" aria-label="Markdown の挿入">
        {MD_BUTTONS.map(([k, label, hint]) => <Button key={k} v="outline" sm title={hint} onMouseDown={(e) => e.preventDefault()} onClick={() => insertMd(k)}>{label}</Button>)}
        <span className="sub">Markdown が使えます。書き込むと整形されます</span>
      </div>
      <textarea ref={note} id="note" value={md} onChange={(e) => set({ md: e.target.value })} placeholder="自分の言葉で。やってみた結果、調べて分かったこと、引っかかった点など。スクショは Ctrl+V で貼れます" />
      {images.length > 0 && (
        <div className="atts">
          {images.map((u, i) => (
            <figure key={i}><img src={u} alt={`入れる画像 ${i + 1}`} /><button onClick={() => set({ images: images.filter((_, j) => j !== i) })} aria-label="この画像を外す">×</button></figure>
          ))}
        </div>
      )}
      {pad && <DrawPad onClose={() => setPad(false)} onSave={async (u) => { const s = await shrinkImage(u).catch(() => u); set({ images: [...latest.current.images, s] }); setPad(false) }} />}
      <input ref={file} type="file" id="imgf" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = '' }} />
      <div className="row">
        <Button v="outline" sm onClick={() => file.current?.click()}>画像を入れる</Button>
        <Button v="outline" sm onClick={() => setPad(true)}>図を描く</Button>
        <input type="text" id="src" value={source} onChange={(e) => set({ source: e.target.value })} placeholder="出典URL（任意）" style={{ flex: '1 1 180px' }} />
        <Button v="primary" onClick={submit}>書き込む</Button>
      </div>
    </div>
  )
}

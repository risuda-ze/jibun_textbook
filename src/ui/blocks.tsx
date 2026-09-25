import { L } from './labels'
import { useEffect, useRef, useState } from 'react'
import { htmlToMd, imgChip, mdToHtml, refIds, removeRef, toggleTask } from '../lib/md'
import { shrinkImage } from '../lib/image'
import { isHttpUrl, isImageDataUrl } from '../lib/safe'
import { applyMarkdown, type MdKind } from '../lib/mdedit'
import { toast } from '../store'
import { type Block, type Image, type NoteDraft, uid } from '../types'
import { Button } from './kit'

/**
 * el の中のカレット（選択範囲）に node を差し込み、カレットをその直後に置く。選択が el の外なら何もしない（false）。
 * execCommand('insertText') は非推奨なので Range で差し込む（#88）。貼り付けと「文中に置く」（#125）が使う
 */
function insertAtCaret(el: HTMLElement, node: Node): boolean {
  const sel = getSelection()
  if (!sel?.rangeCount || !el.contains(sel.getRangeAt(0).startContainer)) return false
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const last = node.lastChild ?? node
  range.insertNode(node)
  range.setStartAfter(last)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

/** 画像の id の短い表示（#125）。先頭8文字、全文は title */
const ShortId = ({ id }: { id: string }) => (
  <span className="mono sub" title={id}>
    {id.slice(0, 8)}…
  </span>
)

/** 見たまま編集。表示は md→HTML、フォーカスが外れた時に変更があれば HTML→md で確定する。本文の画像の参照はチップにする（#125） */
function Editable({ md, images, onCommit }: { md: string; images: Image[]; onCommit: (md: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const before = useRef('')
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) el.innerHTML = mdToHtml(md, images, 'edit')
  }, [md, images])
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
        if (files.some((f) => f.type.startsWith('image/')))
          return toast('本文には画像を貼れません。ノートの「画像を入れる」を使ってください')
        const text = e.clipboardData.getData('text/plain')
        if (!text) return
        // 改行は <br>（marked の breaks と往復が合う）
        const frag = document.createDocumentFragment()
        text.split(/\r?\n/).forEach((line, i) => {
          if (i) frag.appendChild(document.createElement('br'))
          frag.appendChild(document.createTextNode(line))
        })
        insertAtCaret(e.currentTarget, frag)
      }}
      onKeyDown={(e) => {
        // Enter は行（<br>）、空行での Enter は段落の区切り。入力欄と同じ規則（#148）。contenteditable の既定の Enter は段落（<p>/<div>）を
        // 作るため、1行ずつ打った表や箇条書きが確定後に Markdown として成立しなかった。Shift+Enter は既定のまま（<br>）。
        // IME 変換中の Enter は変換の確定なので触らない
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
        const sel = getSelection()
        if (!sel?.rangeCount) return
        const range = sel.getRangeAt(0)
        const { startContainer: n, startOffset: o } = range
        const el = n instanceof Element ? n : n.parentElement
        // コードブロックの中は既定に任せる（fenced の往復は textContent なので <br> を入れると改行が消える）
        if (!el || !e.currentTarget.contains(el) || el.closest('pre')) return
        // 直前が <br>（空行か行頭）なら段落の区切り。ブラウザ既定でブロックを分ける（li なら次の項目になる）
        const prev = n.nodeType === Node.TEXT_NODE ? (o === 0 ? n.previousSibling : null) : n.childNodes[o - 1]
        if (prev?.nodeName === 'BR') return
        e.preventDefault()
        range.deleteContents()
        const br = document.createElement('br')
        range.insertNode(br)
        br.parentNode?.normalize()
        // ブロック末尾の <br> は行として見えないので、もう1つ置いてカレットをその手前に置く
        if (!br.nextSibling) br.after(document.createElement('br'))
        range.setStartAfter(br)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }}
      onFocus={(e) => {
        before.current = e.currentTarget.innerHTML
      }}
      onBlur={(e) => {
        // 触っていないのに md が正規化で変わって「自分で修正」になるのを防ぐため、HTMLの変化で判定する
        if (e.currentTarget.innerHTML === before.current) return
        const next = htmlToMd(e.currentTarget.innerHTML)
        if (next !== md.trim()) onCommit(next)
      }}
    />
  )
}

const MARK = (b: Block): [string, string, string] =>
  b.by === 'me' ? ['me', '自', '自分のノート'] : ['ai', 'AI', b.edited ? 'AIの下書き（自分で修正）' : 'AIの下書き']

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
  // 本文で参照している画像は本文の中に出るので、下には出さない（#125）。参照していない画像は今までどおり下に出る
  const refd = refIds(b.md)
  // 保存済みの画像を文中に置く（#125）。本文を見たまま編集中（フォーカスあり）ならカレットにチップを差し込み（確定は blur）、
  // そうでなければ本文の末尾に記法を足して保存する。ボタンの mousedown は既定を止め、本文のフォーカスを奪わない
  const place = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    const body = e.currentTarget.closest('.ln')?.querySelector<HTMLElement>('.blk-body')
    if (body && document.activeElement === body && insertAtCaret(body, document.createRange().createContextualFragment(imgChip(id)))) return
    onCommit?.(`${b.md.trimEnd()}\n\n![](img:${id})`.trim())
  }
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
      <span className="gut" title={tt}>
        {mk}
      </span>
      <div onClick={onBodyClick}>
        {!read && (
          <div className="ln-acts">
            <Button v="outline" sm onClick={onDelete}>
              消す
            </Button>
          </div>
        )}
        {b.quote && <blockquote>{b.quote}</blockquote>}
        {read ? (
          <div className="blk-body" dangerouslySetInnerHTML={{ __html: mdToHtml(b.md, b.images) }} />
        ) : (
          <Editable md={b.md} images={b.images} onCommit={(m) => onCommit?.(m)} />
        )}
        {b.images
          .filter((im) => !refd.has(im.id))
          .map((im) => (
            <figure className="imgwrap" key={im.id}>
              {/* JSON 由来の画像は data:image/ だけを表示する（#35） */}
              {isImageDataUrl(im.dataUrl) ? (
                <img src={im.dataUrl} alt="自分で入れた画像" />
              ) : (
                <span className="sub">表示できない画像です</span>
              )}
              {!read && (
                <>
                  <button type="button" className="rm" onClick={() => onRemoveImage?.(im.id)} aria-label="この画像を外す">
                    ×
                  </button>
                  <div className="row">
                    <ShortId id={im.id} />
                    <Button
                      v="ghost"
                      sm
                      aria-label={`画像 ${im.id.slice(0, 8)} を文中に置く`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => place(e, im.id)}
                    >
                      文中に置く
                    </Button>
                  </div>
                </>
              )}
            </figure>
          ))}
        {b.source && (
          <div className="src">
            出典:{' '}
            {isHttpUrl(b.source) ? (
              <a href={b.source} target="_blank" rel="noopener noreferrer">
                {b.source}
              </a>
            ) : (
              b.source
            )}
          </div>
        )}
        {b.edited && !read && <div className="src">自分で修正</div>}
      </div>
    </div>
  )
}

const PENS: [string, string][] = [
  ['#161A24', '黒'],
  ['#D6334C', '赤'],
  ['#2F5FD0', '青'],
  ['#ffffff', '消しゴム'],
]

function DrawPad({ onSave, onClose }: { onSave: (dataUrl: string) => void; onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [pen, setPen] = useState(PENS[0][0])
  const drawing = useRef(false)
  const clear = () => {
    const c = cv.current!
    const x = c.getContext('2d')!
    x.fillStyle = '#fff'
    x.fillRect(0, 0, c.width, c.height)
  }
  useEffect(clear, [])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cv.current!
    const r = c.getBoundingClientRect()
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height] as const
  }
  return (
    <div className="stack" id="pad">
      <canvas
        ref={cv}
        id="cv"
        width={960}
        height={540}
        aria-label="図を描くキャンバス"
        onPointerDown={(e) => {
          drawing.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          const x = e.currentTarget.getContext('2d')!
          x.strokeStyle = pen
          x.lineWidth = pen === '#ffffff' ? 28 : 4
          x.lineCap = 'round'
          x.lineJoin = 'round'
          x.beginPath()
          x.moveTo(...pos(e))
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const x = e.currentTarget.getContext('2d')!
          x.lineTo(...pos(e))
          x.stroke()
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
      />
      <div className="row">
        {PENS.map(([c, t]) => (
          <button
            type="button"
            key={c}
            className="pen"
            style={{ background: c }}
            aria-label={t}
            title={t}
            aria-pressed={pen === c}
            onClick={() => setPen(c)}
          />
        ))}
        <Button v="outline" sm onClick={clear}>
          全部消す
        </Button>
        <Button v="soft" sm onClick={() => onSave(cv.current!.toDataURL('image/png'))}>
          この図を入れる
        </Button>
        <Button v="outline" sm onClick={onClose}>
          やめる
        </Button>
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
  useEffect(() => {
    if (quote) note.current?.focus()
  }, [quote])

  async function addFiles(files: Iterable<File>) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      try {
        const url = await shrinkImage(f)
        set({ images: [...latest.current.images, { id: uid(), dataUrl: url, alt: '' }] })
      } catch {
        toast('画像を読み込めませんでした。')
      }
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: md が反映された再描画の後に選択を戻す（md は「いつ走るか」の指定）
  useEffect(() => {
    const el = note.current,
      p = pendingSel.current
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
  // 画像の参照記法をカレット位置に入れる（#125）。カレットは記法の直後
  function insertRef(id: string) {
    const el = note.current
    if (!el) return
    const m = latest.current.md,
      ref = `![](img:${id})`,
      at = el.selectionStart + ref.length
    pendingSel.current = { start: at, end: at }
    set({ md: m.slice(0, el.selectionStart) + ref + m.slice(el.selectionEnd) })
  }
  const refd = refIds(md)
  const MD_BUTTONS: [MdKind, string, string][] = [
    ['bold', '太字', '**太字**'],
    ['bullet', '箇条書き', '- 項目'],
    ['number', '番号', '1. 項目'],
    ['heading', '見出し', '## 見出し'],
    ['code', 'コード', '`コード`'],
    ['link', 'リンク', '[文](URL)'],
  ]

  return (
    <div
      className="addnote"
      onPaste={(e) => {
        const fs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
        if (fs.length) {
          e.preventDefault()
          void addFiles(fs)
          toast('画像を貼り付けました')
        }
      }}
    >
      {quote && (
        <blockquote>
          {quote}{' '}
          <button type="button" className="linkbtn" onClick={() => set({ quote: '' })}>
            引用をやめる
          </button>
        </blockquote>
      )}
      <div className="row mdtools" role="toolbar" aria-label="Markdown の挿入">
        {MD_BUTTONS.map(([k, label, hint]) => (
          <Button key={k} v="outline" sm title={hint} onMouseDown={(e) => e.preventDefault()} onClick={() => insertMd(k)}>
            {label}
          </Button>
        ))}
        <span className="sub">Markdown が使えます。書き込むと整形されます</span>
      </div>
      <textarea
        ref={note}
        id="note"
        value={md}
        onChange={(e) => set({ md: e.target.value })}
        placeholder="自分の言葉で。やってみた結果、調べて分かったこと、引っかかった点など。スクショは Ctrl+V で貼れます"
      />
      {images.length > 0 && (
        <div className="atts">
          {images.map((im, i) => (
            <figure key={im.id}>
              <img src={im.dataUrl} alt={`入れる画像 ${i + 1}`} />
              <button
                type="button"
                className="rm"
                // 外すときは本文の参照も消す（#125）
                onClick={() => set({ images: images.filter((x) => x.id !== im.id), md: removeRef(md, im.id) })}
                aria-label="この画像を外す"
              >
                ×
              </button>
              <div className="row">
                <ShortId id={im.id} />
                {/* 1つの画像は本文で1回だけ参照できる。2回目は無効 */}
                <Button
                  v="ghost"
                  sm
                  disabled={refd.has(im.id)}
                  aria-label={`画像 ${im.id.slice(0, 8)} を文中に置く`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertRef(im.id)}
                >
                  文中に置く
                </Button>
              </div>
            </figure>
          ))}
        </div>
      )}
      {pad && (
        <DrawPad
          onClose={() => setPad(false)}
          onSave={async (u) => {
            const s = await shrinkImage(u).catch(() => u)
            set({ images: [...latest.current.images, { id: uid(), dataUrl: s, alt: '' }] })
            setPad(false)
          }}
        />
      )}
      <input
        ref={file}
        type="file"
        id="imgf"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files ?? [])
          e.target.value = ''
        }}
      />
      <div className="row">
        <Button v="outline" sm onClick={() => file.current?.click()}>
          画像を入れる
        </Button>
        <Button v="outline" sm onClick={() => setPad(true)}>
          図を描く
        </Button>
        <input
          type="text"
          id="src"
          value={source}
          onChange={(e) => set({ source: e.target.value })}
          placeholder="出典URL（任意）"
          style={{ flex: '1 1 180px' }}
        />
        <Button v="primary" onClick={submit}>
          {L.write}
        </Button>
      </div>
    </div>
  )
}

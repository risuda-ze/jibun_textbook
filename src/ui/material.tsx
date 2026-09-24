import { L } from './labels'
import { useRef, useState, type ReactNode } from 'react'
import type { Material } from '../ai/types'
import { PDF_LIMIT_BYTES, TEXT_LIMIT_BYTES, pastedMaterial, pastedSize, readMaterial } from '../lib/material'
import { formatSize } from '../lib/io'
import { Button, Card } from './kit'

/** 「資料を渡す」欄の入力（#63）。ファイル1つ・貼り付け・この資料だけから作る */
export type MaterialInput = { file: Material | null; pasted: string; sourceOnly: boolean }
export const emptyMaterialInput = (): MaterialInput => ({ file: null, pasted: '', sourceOnly: false })

/** AI 層に渡す形にする。ファイルと貼り付けは別々の資料として並べる */
export function toMaterials(m: MaterialInput): Material[] {
  const out: Material[] = []
  if (m.file) out.push(m.file)
  const p = pastedMaterial(m.pasted)
  if (p?.ok) out.push(p.material)
  return out
}

/** 渡せない状態なら理由。生成の前に見る（#79） */
export function materialError(m: MaterialInput): string | null {
  const p = pastedMaterial(m.pasted)
  return p && !p.ok ? p.reason : null
}

/**
 * 「資料を渡す」の切り替えボタンと、開いたときの欄。
 * `children` は切り替えボタンの右に並ぶ（「資料を生成」など）。渡す → 生成 の順に左から読める（#90 #91）
 */
export function MaterialPanel({
  value,
  onChange,
  disabled,
  children,
}: {
  value: MaterialInput
  onChange: (v: MaterialInput) => void
  disabled?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const count = toMaterials(value).length
  const pastedErr = materialError(value)

  async function onFile(f: File | undefined) {
    if (!f) return
    setError('')
    const r = await readMaterial(f)
    if (!r.ok) return setError(r.reason)
    onChange({ ...value, file: r.material })
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row matrow">
        <Button v="ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {L.material}
          {count ? `（${count}）` : ''}
        </Button>
        {!open && value.file && <span className="sub mono">{value.file.name}</span>}
        {!open && count > 0 && value.sourceOnly && <span className="sub">この資料だけから作る</span>}
        {children}
      </div>
      {open && (
        <Card as="div" tone="sky" stack aria-label="渡す資料">
          <p className="sub">
            自分が持っている資料を元に本文を書かせます。渡した資料の本文は AI に送るだけで、教科書の JSON には名前だけ残ります。
          </p>
          <div className="row">
            <Button v="soft" sm disabled={disabled} onClick={() => file.current?.click()}>
              ファイルを選ぶ
            </Button>
            <input
              ref={file}
              type="file"
              id="materialfile"
              accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {value.file ? (
              <>
                <span className="sub mono">
                  {value.file.name}（{formatSize(value.file.size)}）
                </span>
                <Button v="outline" sm disabled={disabled} onClick={() => onChange({ ...value, file: null })}>
                  外す
                </Button>
              </>
            ) : (
              <span className="sub">
                .txt / .md（{formatSize(TEXT_LIMIT_BYTES)} まで）か .pdf（{formatSize(PDF_LIMIT_BYTES)} まで）を1つ
              </span>
            )}
          </div>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <label className="f" htmlFor="materialtext">
            文字を貼り付ける（YouTube の字幕や、コピーした本文）
            <textarea
              id="materialtext"
              rows={4}
              value={value.pasted}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, pasted: e.target.value })}
              placeholder="ここに貼り付けます"
              aria-invalid={!!pastedErr}
            />
          </label>
          <p className={pastedErr ? 'err' : 'sub'} role={pastedErr ? 'alert' : undefined}>
            {pastedErr ?? `${formatSize(pastedSize(value.pasted))} / 上限 ${formatSize(TEXT_LIMIT_BYTES)}`}
          </p>
          <label className="row sub" htmlFor="sourceonly">
            <input
              type="checkbox"
              id="sourceonly"
              checked={value.sourceOnly}
              disabled={disabled || count === 0}
              onChange={(e) => onChange({ ...value, sourceOnly: e.target.checked })}
            />
            この資料だけから作る（Web 調査をしません）
          </label>
        </Card>
      )}
    </div>
  )
}

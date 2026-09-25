import { L } from './labels'
import { useRef, useState, type ReactNode } from 'react'
import type { Material } from '../ai/types'
import {
  PDF_LIMIT_BYTES,
  TEXT_LIMIT_BYTES,
  TOTAL_LIMIT_BYTES,
  checkTotal,
  pastedMaterial,
  pastedSize,
  readMaterial,
  totalSize,
} from '../lib/material'
import { formatSize } from '../lib/io'
import { Button, Card } from './kit'

/** 「資料を渡す」欄の入力（#63 #69）。ファイル（複数）・貼り付け・この資料だけから作る */
export type MaterialInput = { files: Material[]; pasted: string; sourceOnly: boolean }
export const emptyMaterialInput = (): MaterialInput => ({ files: [], pasted: '', sourceOnly: false })

/** AI 層に渡す形にする。ファイルそれぞれと貼り付けを別々の資料として並べる */
export function toMaterials(m: MaterialInput): Material[] {
  const out: Material[] = [...m.files]
  const p = pastedMaterial(m.pasted)
  if (p?.ok) out.push(p.material)
  return out
}

/** 渡せない状態なら理由。生成の前に見る（#79）。貼り付けの上限 → 合計の上限（#69）の順 */
export function materialError(m: MaterialInput): string | null {
  const p = pastedMaterial(m.pasted)
  if (p && !p.ok) return p.reason
  const over = checkTotal(totalSize(toMaterials(m)))
  return over ? `資料の${over}` : null
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
  const [wantOpen, setOpen] = useState(false)
  // 生成中は閉じる。開いている ＝ 操作できる、なので中では disabled を見ない（#141）
  const open = wantOpen && !disabled
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const mats = toMaterials(value)
  const count = mats.length
  const total = totalSize(mats)
  const pastedErr = materialError(value)

  /** 選んだファイルを順に読んで足す。同じ名前は置き換える。合計が上限を超えるものは読む前に断る（#69） */
  async function onFiles(list: FileList | null) {
    if (!list?.length) return
    setError('')
    const errs: string[] = []
    let files = value.files
    for (const f of Array.from(list)) {
      const rest = files.filter((x) => x.name !== f.name)
      const over = checkTotal(totalSize(rest) + pastedSize(value.pasted) + f.size)
      if (over) {
        errs.push(`「${f.name}」を足すと${over}`)
        continue
      }
      const r = await readMaterial(f)
      if (!r.ok) {
        errs.push(r.reason)
        continue
      }
      files = [...rest, r.material]
    }
    if (files !== value.files) onChange({ ...value, files })
    setError(errs.join(' '))
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row matrow">
        <Button v="ghost" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}>
          {L.material}
          {count ? `（${count}）` : ''}
        </Button>
        {!open && value.files.length > 0 && <span className="sub mono">{value.files.map((f) => f.name).join('、')}</span>}
        {!open && count > 0 && value.sourceOnly && <span className="sub">この資料だけから作る</span>}
        {children}
      </div>
      {open && (
        <Card as="div" tone="sky" stack aria-label="渡す資料">
          <p className="sub">
            自分が持っている資料を元に本文を書かせます。渡した資料の本文は AI に送るだけで、教科書の JSON には名前だけ残ります。
          </p>
          <div className="row">
            <Button v="soft" sm onClick={() => file.current?.click()}>
              ファイルを選ぶ
            </Button>
            <input
              ref={file}
              type="file"
              id="materialfile"
              multiple
              accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
              hidden
              onChange={(e) => {
                void onFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <span className="sub">
              .txt / .md（{formatSize(TEXT_LIMIT_BYTES)} まで）か .pdf（{formatSize(PDF_LIMIT_BYTES)} まで）。複数選べます
            </span>
          </div>
          {value.files.length > 0 && (
            <ul className="stack" style={{ gap: 4, margin: 0, paddingLeft: 0, listStyle: 'none' }} aria-label="選んだファイル">
              {value.files.map((f) => (
                <li key={f.name} className="row">
                  <span className="sub mono">
                    {f.name}（{formatSize(f.size)}）
                  </span>
                  <Button
                    v="outline"
                    sm
                    aria-label={`${f.name} を外す`}
                    onClick={() => onChange({ ...value, files: value.files.filter((x) => x.name !== f.name) })}
                  >
                    外す
                  </Button>
                </li>
              ))}
            </ul>
          )}
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
              onChange={(e) => onChange({ ...value, pasted: e.target.value })}
              placeholder="ここに貼り付けます"
              aria-invalid={!!pastedErr}
            />
          </label>
          <p className={pastedErr ? 'err' : 'sub'} role={pastedErr ? 'alert' : undefined}>
            {pastedErr ??
              `${formatSize(pastedSize(value.pasted))} / 上限 ${formatSize(TEXT_LIMIT_BYTES)}。資料の合計 ${formatSize(total)} / 上限 ${formatSize(TOTAL_LIMIT_BYTES)}`}
          </p>
          <label className="row sub" htmlFor="sourceonly">
            <input
              type="checkbox"
              id="sourceonly"
              checked={value.sourceOnly}
              disabled={count === 0}
              onChange={(e) => onChange({ ...value, sourceOnly: e.target.checked })}
            />
            この資料だけから作る（Web 調査をしません）
          </label>
        </Card>
      )}
    </div>
  )
}

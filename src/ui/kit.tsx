import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { PROGRESS } from '../ai/types'

/**
 * 共通コンポーネント。見た目の正は DESIGN.md（暖色の紙のキャンバス・白いカード・細い罫線・青は主操作だけ）。
 * 画面側はここの部品を使い、色や角丸を直接書かない。
 */

/**
 * ボタンの5種（DESIGN.md の Components に対応）
 * - primary: 青の塗り。1画面に1つ、その画面でいちばん進めたい操作だけ
 * - soft:    薄い青の地（Ghost CTA）。主操作の次に大事な操作
 * - ghost:   地も枠もない文字ボタン（Ghost Text）。その他の操作
 * - outline: 細い枠の小さなボタン（Outlined Text）。行の中の小さな操作
 * - danger:  赤い枠と赤い文字（outline の警告版）。取り消しにくい操作（端末から消す等）だけ。
 *            塗りにしないのは DESIGN.md の「色面は主操作の青だけ」に合わせるため
 */
type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger'

/**
 * progress を渡すと「進行中のボタン」になる（#50）。押した瞬間に灰色になり、進んだ分（0〜100%）だけ左から青で塗る。
 * null に戻すと元の色に戻る。時間の見積もりは出さず、段階が終わった分だけ進める。
 *
 * busy を渡すと children の代わりに「{label}・{seconds}秒」をボタンの中に出す（#77）。
 * 幅は進行中でない間に測った値に固定し、文字が収まらなければ … で切る。title は検索語など、ボタンに出さない補足
 */
export type Busy = { label: string; seconds: number | null; title?: string }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  v?: ButtonVariant
  sm?: boolean
  progress?: number | null
  busy?: Busy | null
}

export function Button({
  v = 'ghost',
  sm,
  className = '',
  type = 'button',
  progress = null,
  busy,
  style,
  title,
  children,
  ...rest
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const width = useRef<number | null>(null)
  // busy を使うボタンだけ、進行中でない間の幅を覚える。進行中はその幅に固定する
  useLayoutEffect(() => {
    if (busy === null) width.current = ref.current?.getBoundingClientRect().width ?? null
  })
  const gauge = progress !== null
  const pct = gauge ? Math.max(0, Math.min(100, Math.round(progress))) : 0
  const st = { ...style } as CSSProperties & Record<string, string | number>
  if (gauge) st['--gauge'] = pct + '%'
  if (busy && width.current !== null) st.width = width.current
  // role="status" の中の文はボタンの名前に数えられない（読み上げで名無しになる）ので、同じ文を aria-label にも入れる
  const sec = busy && busy.seconds !== null ? `・${busy.seconds}秒` : ''
  const busyText = busy ? (busy.label || PROGRESS.running) + sec : ''
  return (
    <button
      ref={ref}
      type={type}
      className={`btn ${v}${sm ? ' sm' : ''}${gauge ? ' gauge' : ''}${className ? ' ' + className : ''}`}
      style={st}
      title={busy?.title || title}
      aria-busy={gauge || !!busy || undefined}
      aria-label={busy ? busyText : undefined}
      {...rest}
    >
      {busy ? (
        <span className="working" role="status">
          {busy.label || PROGRESS.running}
          {sec && <span className="mono">{sec}</span>}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

/** ピル（状態や種類のラベル）。tone は意味で選ぶ。色は styles.css が決める。 */
export type PillTone = 'none' | 'ai' | 'me' | 'done' | 'warn' | 'review'

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

/**
 * カード。既定は白地に細い罫線（White Feature Card）。
 * tone を付けると色面のカード（Accent Feature Card）になる。色面は1画面に1つまで。
 */
type CardTone = 'white' | 'sky' | 'marigold' | 'peach'

type CardProps = HTMLAttributes<HTMLElement> & { tone?: CardTone; stack?: boolean; as?: 'section' | 'div' }

export function Card({ tone = 'white', stack, as = 'section', className = '', ...rest }: CardProps) {
  const Tag = as
  return (
    <Tag
      className={`panel${tone !== 'white' ? ' tone-' + tone : ''}${stack ? ' stack' : ''}${className ? ' ' + className : ''}`}
      {...rest}
    />
  )
}

/** ページの頭。小見出し・大見出し・リード文（明朝）・右側の操作。 */
export function PageHead({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  lead?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="pagehead">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h1>{title}</h1>}
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

/** 切り替え（どれか1つを選ぶ）。 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, t]) => (
        <button type="button" key={k} aria-pressed={value === k} onClick={() => onChange(k)}>
          {t}
        </button>
      ))}
    </div>
  )
}

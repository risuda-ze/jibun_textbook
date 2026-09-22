import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

/**
 * 共通コンポーネント。見た目の正は DESIGN.md（暖色の紙のキャンバス・白いカード・細い罫線・青は主操作だけ）。
 * 画面側はここの部品を使い、色や角丸を直接書かない。
 */

/**
 * ボタンの4種（DESIGN.md の Components に対応）
 * - primary: 青の塗り。1画面に1つ、その画面でいちばん進めたい操作だけ
 * - soft:    薄い青の地（Ghost CTA）。主操作の次に大事な操作
 * - ghost:   地も枠もない文字ボタン（Ghost Text）。その他の操作
 * - outline: 細い枠の小さなボタン（Outlined Text）。行の中の小さな操作
 */
export type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'outline'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { v?: ButtonVariant; sm?: boolean }

export function Button({ v = 'ghost', sm, className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`btn ${v}${sm ? ' sm' : ''}${className ? ' ' + className : ''}`} {...rest} />
}

/** ピル（状態や種類のラベル）。tone は意味で選ぶ。色は styles.css が決める。 */
export type PillTone = 'none' | 'ai' | 'me' | 'done' | 'warn' | 'review'

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={tone === 'review' ? 'flag' : `chip ${tone}`}>{children}</span>
}

/**
 * カード。既定は白地に細い罫線（White Feature Card）。
 * tone を付けると色面のカード（Accent Feature Card）になる。色面は1画面に1つまで。
 */
export type CardTone = 'white' | 'sky' | 'marigold' | 'peach' | 'midnight'

type CardProps = HTMLAttributes<HTMLElement> & { tone?: CardTone; stack?: boolean; as?: 'section' | 'div' }

export function Card({ tone = 'white', stack, as = 'section', className = '', ...rest }: CardProps) {
  const Tag = as
  return <Tag className={`panel${tone !== 'white' ? ' tone-' + tone : ''}${stack ? ' stack' : ''}${className ? ' ' + className : ''}`} {...rest} />
}

/** ページの頭。小見出し・大見出し・リード文（明朝）・右側の操作。 */
export function PageHead({ eyebrow, title, lead, actions, children }: { eyebrow?: ReactNode; title?: ReactNode; lead?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h1>{title}</h1>}
        {children}
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

/** 切り替え（どれか1つを選ぶ）。 */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, t]) => <button type="button" key={k} aria-pressed={value === k} onClick={() => onChange(k)}>{t}</button>)}
    </div>
  )
}

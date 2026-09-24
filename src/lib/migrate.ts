import { TextbookZ, nowIso, renumberDuplicateIds, type Textbook } from '../types'
import { MSG } from './messages'

/** 今の保存形式の版。`TextbookZ` の `schemaVersion` と同じ値にする（規約: CLAUDE.md「保存形式の規約」） */
export const CURRENT_VERSION = 1

type Raw = Record<string, unknown>
export type Migration = (raw: Raw) => Raw

/**
 * 版ごとの移行関数。キーは元の版、戻り値は次の版の形（`schemaVersion` も次の版にする）。
 * 1段ずつ積む。版をまたぐ直行関数は作らない。今は版 1 だけなので空。
 */
export const migrations: Record<number, Migration> = {}

export type MigrateResult = { ok: true; tb: Textbook; from: number; steps: string[] } | { ok: false; reason: string; from: number | null }

const isObj = (x: unknown): x is Raw => !!x && typeof x === 'object' && !Array.isArray(x)
const validIso = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x))

/**
 * 生の JSON を今の版の教科書にする（#65）。
 * 版を読み → 移行関数を1段ずつ当て → 既知の不整合を直し → スキーマで検証する。
 * 直した内容は `steps` に日本語で残す（空なら手を入れていない）。
 * `opts` はテスト用（移行表と今の版を差し替える）。
 */
export function migrate(raw: unknown, opts: { table?: Record<number, Migration>; current?: number } = {}): MigrateResult {
  const table = opts.table ?? migrations
  const current = opts.current ?? CURRENT_VERSION
  if (!isObj(raw)) return { ok: false, reason: MSG.notTextbook, from: null }
  const v = raw.schemaVersion
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    return { ok: false, reason: MSG.noVersion, from: null }
  }
  if (v > current) {
    return { ok: false, reason: MSG.newer(v), from: v }
  }
  const steps: string[] = []
  let obj: Raw = raw
  for (let i = v; i < current; i++) {
    const fn = table[i]
    if (!fn) return { ok: false, reason: MSG.noMigration(i), from: v }
    obj = { ...fn(obj), schemaVersion: i + 1 }
    steps.push(`版 ${i} から ${i + 1} に移行しました`)
  }

  // 既知の不整合の修復。日時が無い・不正なら補う
  if (!validIso(obj.createdAt)) {
    obj = { ...obj, createdAt: validIso(obj.updatedAt) ? obj.updatedAt : nowIso() }
    steps.push('作成日時が無かったので補いました')
  }
  if (!validIso(obj.updatedAt)) {
    obj = { ...obj, updatedAt: obj.createdAt }
    steps.push('更新日時が無かったので作成日時で補いました')
  }

  const r = TextbookZ.safeParse(obj)
  if (!r.success) {
    const i = r.error.issues[0]
    return { ok: false, reason: MSG.badShape(i.path.join('.') || 'root', i.message), from: v }
  }
  // id の重複は後ろから振り直す（#36 の救済を読込と端末内で同じにする）
  const fixed = renumberDuplicateIds(r.data)
  if (fixed.count) steps.push(`重複していた id を ${fixed.count} 件振り直しました`)
  return { ok: true, tb: fixed.tb, from: v, steps }
}

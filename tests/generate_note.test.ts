import { describe, expect, it } from 'vitest'
import { researchNote, usageNote } from '../src/ui/generate'

const u = (searches: number) => ({ searches, inputTokens: 100, outputTokens: 10 })

describe('researchNote（#81）', () => {
  it('調査の情報が無ければ空', () => {
    expect(researchNote(u(2), undefined)).toBe('')
    expect(researchNote(u(2), { truncated: false, searchErrors: [] })).toBe('')
  })
  it('検索が全部失敗したら「モデルの知識だけで書いた」と明かす', () => {
    expect(researchNote(u(0), { truncated: false, searchErrors: ['unavailable'] })).toContain('モデルの知識だけで書きました')
  })
  it('一部失敗なら回数と理由。切れたら根拠の注意も', () => {
    const s = researchNote(u(3), { truncated: true, searchErrors: ['max_uses_exceeded', 'max_uses_exceeded'] })
    expect(s).toContain('Web検索が2回失敗しました（max_uses_exceeded）')
    expect(s).toContain('途中で切れました')
  })
  it('usageNote は使った量が無ければ空', () => {
    expect(usageNote({ searches: 0, inputTokens: 0, outputTokens: 0 })).toBe('')
    expect(usageNote(u(1))).toBe('（検索1回・入力100・出力10トークン）')
  })
})

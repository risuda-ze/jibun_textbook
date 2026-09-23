import { describe, expect, it } from 'vitest'
import { KEY, MSG } from '../src/lib/messages'
import { TROUBLES } from '../src/ui/Help'
import { parseImport, readTextbookFile, IMPORT_LIMIT_BYTES } from '../src/lib/io'

describe('失敗文の一元化（#78）', () => {
  it('Help の対処表は、失敗文の語をすべて含む', () => {
    const whens = TROUBLES.map((t) => t.when).join('\n')
    for (const [k, v] of Object.entries(KEY)) expect(whens, k).toContain(v)
  })
  it('MSG は KEY の語を含む', () => {
    expect(MSG.notJson).toContain(KEY.notJson)
    expect(MSG.newer(3)).toContain(KEY.newer)
    expect(MSG.newer(3)).toContain('schemaVersion: 3')
    expect(MSG.noMigration(0)).toContain('版 0 から 1')
    expect(MSG.badShape('chapters', 'x')).toContain(KEY.badShape)
    expect(MSG.tooBig('a.json', '17.0 MB', '16.0 MB')).toContain(KEY.tooBig)
  })
  it('parseImport は from（読んだ版）を返す', () => {
    expect(parseImport('{oops')).toMatchObject({ ok: false, reason: MSG.notJson, from: null })
    expect(parseImport(JSON.stringify({ schemaVersion: 9, id: 'x' }))).toMatchObject({ ok: false, from: 9 })
  })
  it('readTextbookFile は 16MB を超えたら読む前に断る', async () => {
    const big = new File([new Uint8Array(IMPORT_LIMIT_BYTES + 1)], 'big.textbook.json', { type: 'application/json' })
    const r = await readTextbookFile(big)
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining(KEY.tooBig) })
    const small = new File(['{ oops'], 'small.json', { type: 'application/json' })
    expect(await readTextbookFile(small)).toMatchObject({ ok: false, reason: MSG.notJson })
  })
})

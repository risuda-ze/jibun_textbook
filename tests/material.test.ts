import { describe, expect, it } from 'vitest'
import { PASTED_NAME, PDF_LIMIT_BYTES, TEXT_LIMIT_BYTES, checkSize, classify, pastedMaterial, readMaterial } from '../src/lib/material'

describe('渡す資料（#63）', () => {
  it('種類は拡張子か MIME で決め、それ以外は渡せない', () => {
    expect(classify('notes.md', '')).toBe('text')
    expect(classify('NOTES.TXT', '')).toBe('text')
    expect(classify('x', 'text/plain')).toBe('text')
    expect(classify('paper.pdf', '')).toBe('pdf')
    expect(classify('x', 'application/pdf')).toBe('pdf')
    expect(classify('photo.png', 'image/png')).toBeNull()
    expect(classify('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeNull()
  })
  it('上限を超えたら理由を返す。先頭だけ使うことはしない', () => {
    expect(checkSize('text', TEXT_LIMIT_BYTES)).toBeNull()
    expect(checkSize('text', TEXT_LIMIT_BYTES + 1)).toContain('200KB')
    expect(checkSize('pdf', PDF_LIMIT_BYTES)).toBeNull()
    expect(checkSize('pdf', PDF_LIMIT_BYTES + 1)).toContain('10MB')
  })
  it('txt/md は文字として読む', async () => {
    const r = await readMaterial(new File(['# メモ\n所有権'], 'notes.md', { type: 'text/markdown' }))
    expect(r).toMatchObject({ ok: true, material: { kind: 'text', name: 'notes.md', text: '# メモ\n所有権' } })
  })
  it('PDF は base64 にする（data URL の先頭は外す）', async () => {
    const r = await readMaterial(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'a.pdf', { type: 'application/pdf' }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.material.kind).toBe('pdf')
      expect(r.material.data).toBe('JVBERg==')
      expect(r.material.data).not.toContain(',')
    }
  })
  it('渡せない種類・大きすぎるファイルは理由つきで断る', async () => {
    expect(await readMaterial(new File(['x'], 'photo.png', { type: 'image/png' }))).toMatchObject({ ok: false, reason: expect.stringContaining('渡せない種類') })
    const big = new File([new Uint8Array(TEXT_LIMIT_BYTES + 1)], 'big.txt', { type: 'text/plain' })
    expect(await readMaterial(big)).toMatchObject({ ok: false, reason: expect.stringContaining('200KB') })
  })
  it('貼り付けは前後の空白を落とし、空なら無し', () => {
    expect(pastedMaterial('  \n')).toBeNull()
    expect(pastedMaterial(' 字幕の文 ')).toMatchObject({ kind: 'text', name: PASTED_NAME, text: '字幕の文' })
  })
})

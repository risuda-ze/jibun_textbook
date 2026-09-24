import { describe, expect, it } from 'vitest'
import { isHttpUrl, isImageDataUrl } from '../src/lib/safe'
import { TextbookZ } from '../src/types'

describe('URL の無害化（#35）', () => {
  it('http(s) だけをリンクにする', () => {
    expect(isHttpUrl('https://example.com/a?b=1')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('HTTPS://EXAMPLE.COM')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('https://exa mple.com')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
  })

  it('画像は data:image/ だけを表示する', () => {
    expect(isImageDataUrl('data:image/webp;base64,UklGR')).toBe(true)
    expect(isImageDataUrl('data:image/png;base64,iVBOR')).toBe(true)
    expect(isImageDataUrl('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(true)
    expect(isImageDataUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isImageDataUrl('javascript:alert(1)')).toBe(false)
    expect(isImageDataUrl('https://example.com/a.png')).toBe(false)
    expect(isImageDataUrl('')).toBe(false)
  })

  it('スキーマは弾かない（古い JSON を読めなくしない）。描画側で無害化する', () => {
    const tb = {
      schemaVersion: 1,
      id: 't',
      title: 'x',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      chapters: [
        {
          id: 'c',
          title: 'c',
          lessons: [
            {
              id: 'l',
              title: 'l',
              clues: { links: [{ title: '悪いリンク', url: 'javascript:alert(1)' }] },
              blocks: [{ id: 'b', by: 'me', md: 'x', images: [{ id: 'i', dataUrl: 'data:text/html,<b>x</b>' }] }],
            },
          ],
        },
      ],
    }
    const r = TextbookZ.safeParse(tb)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(isHttpUrl(r.data.chapters[0].lessons[0].clues.links[0].url)).toBe(false)
      expect(isImageDataUrl(r.data.chapters[0].lessons[0].blocks[0].images[0].dataUrl)).toBe(false)
    }
  })
})

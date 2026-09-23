import { describe, expect, it } from 'vitest'
import { byteSize, fileName, formatSize } from '../src/lib/io'
import { newTextbook } from '../src/types'

describe('io の小さな関数（#83）', () => {
  it('fileName: 記号と空白を _ にし、40 字で切り、空なら textbook', () => {
    expect(fileName(newTextbook('Rust 入門/応用: v2'))).toBe('Rust_入門_応用_v2.textbook.json')
    expect(fileName(newTextbook('あ'.repeat(50)))).toBe('あ'.repeat(40) + '.textbook.json')
    expect(fileName(newTextbook(''))).toBe('textbook.textbook.json')
  })
  it('formatSize: B / KB / MB の境目', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(1023)).toBe('1023 B')
    expect(formatSize(1024)).toBe('1 KB')
    expect(formatSize(1024 * 1024 - 1)).toBe('1024 KB')
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatSize(8.5 * 1024 * 1024)).toBe('8.5 MB')
  })
  it('byteSize: 多バイト文字はバイト数で数える', () => {
    expect(byteSize('abc')).toBe(3)
    expect(byteSize('あ')).toBe(3)
  })
})

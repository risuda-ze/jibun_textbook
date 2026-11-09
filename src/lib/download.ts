/** 文字をファイルとして端末に保存する（#82）。本棚の JSON・読めない教科書の生データ・Help の直した JSON で共用 */
export const downloadText = (name: string, text: string, type = 'application/json'): void => downloadBlob(name, new Blob([text], { type }))

/** Blob を端末に保存する。Markdown 書き出しの zip（#136）と上の文字の保存で共用 */
export function downloadBlob(name: string, blob: Blob): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

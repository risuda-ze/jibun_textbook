/** 文字をファイルとして端末に保存する（#82）。本棚の JSON・読めない教科書の生データ・Help の直した JSON で共用 */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

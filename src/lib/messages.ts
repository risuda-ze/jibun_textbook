/**
 * JSON の読み込みで出す失敗文（#78）。`io.ts` と `migrate.ts` がここから出し、
 * Help の「読み込めない場合、まずはこちら」は `KEY` の語を含む行を持つ（`tests/messages.test.ts` で検証）。
 * 文を変えるときはここだけを変える。
 */
export const KEY = {
  notJson: 'JSONとして読み込めませんでした',
  notTextbook: '教科書のJSONではありません',
  noVersion: 'schemaVersion（形式の版）がありません',
  newer: 'このアプリより新しい形式のファイルです',
  noMigration: 'への移行が用意されていません',
  badShape: '形式が正しくありません',
  tooBig: '大きすぎて読み込めません',
} as const

export const MSG = {
  notJson: `${KEY.notJson}。ファイルが壊れているか、別の種類のファイルの可能性があります。`,
  notTextbook: `${KEY.notTextbook}。`,
  noVersion: `${KEY.noVersion}。このアプリが書き出したファイルではない可能性があります。`,
  newer: (v: number) => `${KEY.newer}（schemaVersion: ${v}）。アプリを更新してから読み込んでください。`,
  noMigration: (from: number) => `版 ${from} から ${from + 1} ${KEY.noMigration}。アプリを更新してから読み込んでください。`,
  badShape: (where: string, detail: string) => `${KEY.badShape}（${where}: ${detail}）。`,
  tooBig: (name: string, size: string, limit: string) => `「${name}」は${KEY.tooBig}（${size}。上限は ${limit}）。`,
} as const

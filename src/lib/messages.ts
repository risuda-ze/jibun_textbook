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

/**
 * AI のエラー文（#102）。`src/ai/*` の `new AiError(code, …)` はここから出す。
 * Help の対処表は `AI_KEY` の語を含む行を持つ（`tests/messages.test.ts` で検証）。
 * `AI_KEY` は Help に行がある語だけ。行の無い文（parse など）は `AI_MSG` にだけ置く。
 */
export const AI_KEY = {
  nokey: 'APIキーが未設定です',
  auth: 'APIキーが正しく認証されませんでした',
  permission: 'このキーでは使用できない機能またはモデルです',
  rate: '利用上限に達しました',
  network: 'ネットワークに接続できませんでした',
  refusal: 'この内容についてはモデルが応答を控えました',
  api: 'APIエラーが発生しました',
} as const

export const AI_MSG = {
  nokey: `${AI_KEY.nokey}。「使うAI」でキーを入力してください。`,
  auth: `${AI_KEY.auth}。キーを入れ直してください。`,
  permission: `${AI_KEY.permission}。モデルを変更するか、Web調査を「検索なし」にしてください。`,
  rate: `${AI_KEY.rate}。しばらく待ってから、もう一度お試しください。`,
  network: `${AI_KEY.network}。接続を確認してから、もう一度お試しください。`,
  refusal: `${AI_KEY.refusal}。言い回しを変えるか、モデルを切り替えてください。`,
  api: (status: string | number, detail: string) => `${AI_KEY.api}（${status}）: ${detail}`,
  parse: 'AIの返答を読み取れませんでした。もう一度お試しください。',
  unsupported: 'この接続先はまだ使用できません（Phase 2で対応予定です）。Anthropic API かデモ応答をお選びください。',
  noLesson: '節が見つかりませんでした。',
  aborted: '生成をやめました。',
} as const

/**
 * 資料を渡せないときの断り文（#102）。`src/lib/material.ts` の `reason` はここから出す。
 * Help の「資料を渡せないときは」の行は `MATERIAL_KEY` の語を含む。
 */
export const MATERIAL_KEY = {
  badKind: '渡せない種類のファイルです',
  tooBig: '大きすぎて渡せません',
  unreadable: 'を読めませんでした',
} as const

export const MATERIAL_MSG = {
  badKind: (name: string) => `「${name}」は${MATERIAL_KEY.badKind}。渡せるのは .txt / .md / .pdf です。`,
  /** 「〈名前〉は」の後に付ける。ファイルと貼り付けで主語が違う */
  tooBig: (what: 'PDF' | '文字', size: string, limit: string) => `${MATERIAL_KEY.tooBig}（${size}。${what}の上限は ${limit}）。`,
  unreadable: (name: string, detail: string) => `「${name}」${MATERIAL_KEY.unreadable}。${detail}`,
} as const

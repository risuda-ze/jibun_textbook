# あとでやること

作業の管理は GitHub Issues に一本化した（追跡: https://github.com/risuda-ze/jibun_textbook/issues/7 ）。
ここには Issue になっていない Phase 2 の項目だけを残す。

## Phase 2（brainで決定済み）

- レッスン内の「AIに頼む」（定型ボタン＋自由入力1行。会話履歴なし。結果は常にAIの下書きブロックとして本文に入る）
- OpenAI互換API / ローカルモデル（PCのみ）。`src/ai/index.ts` にアダプタを足す。画面の切り替えは実装済みで「まだ使えない」と出る
- Markdown書き出し（brain vault 向け）

## Issue になっているもの（ここには書かない）

- 初回表示の JS を減らす（動的 import）: #10。本番ビルドは約 600KB（gzip 約 181KB）
- 節の並べ替え・章をまたぐ移動: #11
- 画像の説明文（alt）: #13
- refusal 時のモデル切り替え: #15
- 複数ファイルを渡す: #69

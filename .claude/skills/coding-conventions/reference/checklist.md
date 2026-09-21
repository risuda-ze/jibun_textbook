# コーディング規約チェックリスト

## 言語・命名（NFR-013）
- [ ] ソースコード内コメントは日本語
- [ ] 変数名・関数名・コンポーネント名・ファイル名は英語
- [ ] コンポーネントは PascalCase、hooks は `use` 始まりの camelCase、定数は UPPER_SNAKE_CASE

## 型（NFR-012）
- [ ] `pnpm typecheck` がエラーゼロ（strict モード）
- [ ] `any` を書かない。外部入力は zod スキーマで検証してから型付けする（型が不明な値は `unknown` + 型ガード）
- [ ] 非 null アサーション `!` を書かない。早期 return か optional chaining にする（既存の `!` は触った箇所のみ直す）
- [ ] `as` は `as const` と、外部境界で型ガードが書けない場合のみ。それ以外は zod parse か型ガードに置き換える（既存は触った箇所のみ直す）
- [ ] リテラルの型検査は `as` でなく `satisfies` を使う
- [ ] Firestore ドキュメントの型は `src/types/` の既存定義を再利用する

## TypeScript / React / Next.js の書き方
- [ ] `enum` を書かない。union 型と `as const` オブジェクトで表す
- [ ] コンポーネントは `export function Name()` の関数宣言。アロー関数への代入と `React.FC` は使わない
- [ ] default export は `src/app/` のページ・レイアウト等 Next.js が要求する箇所のみ。それ以外は named export
- [ ] オブジェクトの形は `interface`、union・関数型・ユーティリティ型は `type`
- [ ] 型のみの import は `import type`
- [ ] `'use client'` は必要な末端コンポーネントだけに付け、ページ全体に付けない
- [ ] `console.*` を書かない。ログは Sentry または既存の logger 経由
- [ ] `Date` の直接演算（`getTime()` の差分など）を書かず、date-fns の関数を使う
- [ ] `==` を書かない。`let` より `const`。未処理の Promise を残さない

## スタイル
- [ ] Prettier 設定（semi / singleQuote / trailingComma es5 / printWidth 100 / tabWidth 2）に従う
- [ ] `pnpm lint` が警告・エラーゼロ
- [ ] import は外部 → `@/` エイリアス → 相対 の順

## 配置
- [ ] ページ: `src/app/`、UI: `src/components/`、状態: `src/stores/`（zustand）
- [ ] 副作用のないロジック: `src/lib/`、共有 hooks: `src/hooks/`、型: `src/types/`
- [ ] サーバー処理: `functions/src/<機能>/`。プラン制限などの強制はバックエンドで行う（NFR-011）
- [ ] 日時は JST 基準で扱う（NFR-010）

## テスト
- [ ] ユニットテストは `tests/unit/<機能>/<対象>.test.ts(x)` に置く（vitest / jsdom / globals）
- [ ] 純粋関数・ストア・型ガードの追加・変更には対応するテストがある
- [ ] UI に影響する変更には `tests/e2e/` の該当 spec がある（smoke プロジェクトで通る）
- [ ] Firebase 依存はモックする（`tests/unit/setup.ts` と既存テストのモック方法に合わせる）

## ドキュメント同期
- [ ] 仕様変更ありの場合、正本仕様 `docs/仕様・計画/<カテゴリ>/*` の該当節が更新されている
- [ ] 新しい用語を導入した場合、`docs/共通用語/共通用語.md` に追加されている
- [ ] 変更仕様 `docs/変更仕様/<変更名>.md` の内容と実装が食い違っていない

## 変更の境界
- [ ] 指示された範囲外のリファクタを混ぜていない
- [ ] 既存の公開 API（export）を壊す変更は呼び出し元をすべて更新している
- [ ] 通知・メール送信などの失敗は握りつぶさず、エラーとして可視化している

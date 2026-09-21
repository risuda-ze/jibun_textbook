---
name: regression-check
description: 実装後の回帰確認（pnpm typecheck / lint / test、UI 変更時は E2E smoke）を定型手順で実行し、結果を固定フォーマットで報告するときに使う。報告フォーマットは reference/report-format.md にある。
---

# regression-check

## 実行手順

1. 以下を順に実行し、各コマンドの終了コードと失敗箇所を記録する
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```
2. 対象ファイルが限定される場合、`pnpm test` の前に対象テストだけを先に回してよい
   ```bash
   pnpm vitest run tests/unit/<機能>/<対象>.test.ts
   ```
3. `functions/` を変更した場合は Functions 側の型チェックも実行する
   ```bash
   npx tsc --noEmit --project functions/tsconfig.json
   ```
4. UI に影響する変更では E2E の smoke プロジェクトを実行する（emulator プロジェクトはエミュレータ起動が前提。実行できない場合はその旨を報告する）
   ```bash
   pnpm test:e2e:smoke
   ```
5. 失敗があれば直して 1 からやり直す。直せない失敗は報告に「未解決」として残す

## 報告

`reference/report-format.md` の形式で返す。失敗はコマンド出力を要約せず該当行を貼る。

# 起動指示テンプレート

いずれも変更仕様は要約せず、該当ファイルのパスと本文を渡す。

## 実装モード（complex-implementer）

- モード: 実装
- 変更単位名:
- 変更仕様: `docs/変更仕様/<変更名>.md`（本文を貼る）
- 担当する受入条件 ID: AC-x, AC-y
- 影響ファイル（想定）:
- 先行単位の成果（あれば）: 完了済み単位が作った型・関数のパス
- 完了条件: 担当受入条件を満たすテストが存在し、typecheck / lint / test（UI 変更時は E2E smoke も）が全件成功、仕様変更ありなら正本仕様と共通用語が同期済み
- 返却形式: regression-check の reference/report-format.md「実装結果」

## 修正モード（complex-implementer）

- モード: 修正
- 変更単位名:
- 変更仕様: 同上
- 実装済みの変更: 前回の実装結果（変更ファイル一覧）を貼る
- レビュー報告: 全文を貼る
- 完了条件: 全指摘に対応結果（修正／不修正と理由）が付き、修正後も上記の回帰確認が全件成功
- 返却形式: 同上（指摘への対応を含む）

## レビュー（implementation-reviewer）

- 変更仕様: 同上
- 実装結果: complex-implementer の返却を全文貼る
- 変更単位と担当受入条件 ID:
- UI 影響の有無: あり / なし（ありなら E2E smoke と Playwright 確認を求める）
- 返却形式: pt-test-design の reference/review-report.md

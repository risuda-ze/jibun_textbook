---
name: task-dispatch
description: 確定した変更仕様を実装エージェントに割り振るときに使う。変更単位への分割基準は reference/split-rules.md、担当エージェントへの起動指示の定型（実装モード・修正モード・レビュー）は reference/dispatch-template.md にある。
---

# task-dispatch

1. `reference/split-rules.md` の基準で、変更仕様の受入条件を互いに独立な「変更単位」に分ける。分けられなければ 1 単位のままにする
2. 変更単位ごとに `reference/dispatch-template.md` の実装モード指示を作り、complex-implementer を起動する。独立な単位は並列に起動する
3. 実装結果を受け取ったら、同テンプレートのレビュー指示で implementation-reviewer を起動する
4. レビュー判定が「要修正」なら、修正モード指示で complex-implementer を起動する。レビュー報告は要約せず全文を渡す
5. 起動指示・返却・判定を変更単位ごとに記録し、work-report のサイクル実績に使う

---
name: spec-authoring
description: 変更仕様の草案を書くときに使う。対話型の質問設計は reference/questioning.md、自律型の複数案設計の軸は reference/patterns.md、草案の書式は reference/spec-template.md、案の比較提示は reference/comparison.md にある。
---

# spec-authoring

1. 草案は必ず `reference/spec-template.md` の項目順・書式で書く（実装フェーズの受け入れ基準 spec-intake と同じ項目）
2. 対話型は `reference/questioning.md` の順に論点を聞き、回答をテンプレートに写す
3. 自律型は `reference/patterns.md` の軸で案を分け、各案をテンプレートで書いて `reference/comparison.md` の比較表を付ける
4. 受入条件は「入力・操作 → 観測できる結果」。曖昧語（適切に・正しく・ちゃんと・など）を使わない
5. 用語は `docs/共通用語/共通用語.md` の定義に合わせる。新語が必要なら「用語追加候補」として草案末尾に列挙する

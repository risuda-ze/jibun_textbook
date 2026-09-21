---
name: spec-review
description: 仮決定した変更仕様を市場（配信者の価値・事業計画）とアプリ制約（正本仕様・NFR・プラン・外部サービス）の観点でレビューするときに使う。観点は reference/viewpoints.md、報告形式は reference/review-report.md にある。
---

# spec-review

1. `reference/viewpoints.md` の観点を上から順にすべて確認し、観点ごとに 問題なし／指摘 を記録する
2. 指摘には必ず根拠（正本仕様の節、NFR 番号、コード位置）を付ける。根拠が示せない懸念は「要確認」にする
3. `reference/review-report.md` の形式で、判定を先頭に置いて報告する
4. 仕様の書き換えや代替案の作成はしない。修正の方向だけを示す

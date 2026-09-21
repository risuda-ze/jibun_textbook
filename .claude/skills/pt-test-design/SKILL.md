---
name: pt-test-design
description: PT（単体テスト）工程のテスト技法（同値分割・境界値・デシジョンテーブル・状態遷移・エラー推測）で受入条件からテストケースを導出し、レビュー結果を固定フォーマットで報告するときに使う。技法は reference/techniques.md、報告形式は reference/review-report.md にある。
---

# pt-test-design

1. 変更仕様の受入条件を1件ずつ取り出す
2. `reference/techniques.md` の技法を受入条件の性質に合わせて選び、テストケース表を作る
3. 各ケースを「自動化（tests/unit に追加）」「既存テストで担保」「手動確認要」に分類する
4. 自動化ケースを実行し、結果を `reference/review-report.md` の形式にまとめる

ケースは「入力 → 期待結果」が一意に決まる粒度まで分解する。期待結果が仕様から読み取れない場合は「仕様確認要」として報告する。

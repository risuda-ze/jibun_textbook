---
name: spec-intake
description: 変更仕様を受け取った際の着手前チェック（ブランチ状態・正本仕様の所在）と、仕様が実装に渡せる必須項目を満たしているかの受け入れ確認に使う。仕様を作成・補完するためのものではない。チェックは reference/precheck.md、必須項目は reference/spec-requirements.md にある。
---

# spec-intake

1. `reference/precheck.md` を上から順に実施する。満たせない項目があれば先に解消するか、ユーザーに報告する
2. 受け取った変更仕様を `reference/spec-requirements.md` の必須項目と照合する
3. 不足項目があれば、その項目名と「何が書かれていれば足りるか」を列挙してユーザーに返す。推測で補完しない
4. すべて満たしていれば、変更仕様をそのまま実装エージェントへの入力にする

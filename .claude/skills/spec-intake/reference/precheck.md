# 着手前チェック

git 運用ルールは CLAUDE.md「Gitブランチ運用」が正本。ここではその状態確認だけを行う。

1. 現在ブランチが `feature/*` であり、`develop` から切られていることを確認する
   ```bash
   git branch --show-current && git log --oneline origin/develop..HEAD
   ```
   `main` / `develop` 上、または main 起点のブランチなら CLAUDE.md に従って切り直す
2. `origin/develop` の最新に追従していることを確認する（未追従なら `git fetch origin && git rebase origin/develop`）
3. 作業ツリーが clean であることを確認する（`git status --short` が空）
4. 変更仕様が参照する正本仕様 `docs/仕様・計画/<カテゴリ>/*` が存在することを確認する
5. `docs/変更仕様/*` に同じ範囲を扱う進行中の変更が無いことを確認する

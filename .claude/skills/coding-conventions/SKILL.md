---
name: coding-conventions
description: RisukeruGG のコーディング規約（TypeScript strict / Prettier / NFR-013 / ディレクトリ配置 / テスト配置）に沿って実装・レビューするときに使う。チェックリストは reference/checklist.md にある。
---

# coding-conventions

1. 実装前に `reference/checklist.md` を読む
2. 実装後に全項目を確認し、違反があれば直してから結果を返す
3. レビュー時は同じチェックリストを全項目確認し、違反を「要修正」として指摘する

規約の根拠: `docs/仕様・計画/risukeru_gg_spec.md` の NFR 節。
設定の実体: `.prettierrc` / `eslint.config.mjs` / `tsconfig.json` / `vitest.config.ts`。

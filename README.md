# じぶん教科書

学びたいことを伝えると AI がコース設計と資料の下書きを作ります。そこに自分で確かめたこと・やったことを書き込んで、「自分なりの教科書」に育てるアプリです。
サーバーを持たない静的な PWA で、PC と Android のブラウザで動きます。使うのは1人だけを想定しています。

## できること（Phase 0 + 1）

- **5つの画面**: 本棚 / つくる / ロードマップ / レッスン / 教科書（通読）
- **コース設計**: 学びたいことを自由に書く → AI の確認質問 → Web 調査 → 章と節の設計案 → 採用するとロードマップに並ぶ
- **節の資料**: 本文（日本語）と「調べる手がかり」（検索語・一次情報リンク・確かめ方）を AI が生成する。一次情報リンクは調査で実際に見つかったページからだけ作る
- **ノート**: 本文を見たまま編集でき、行の間に自分のノート（文・貼り付け画像・手描きの図・本文の引用・出典 URL）を差し込める
- **印**: 節に「完了」と「あとで再確認」を自分のタイミングで付ける
- **設計を直す**: 節 / 章 / 全体の範囲で AI に作り直させ、差分を見て採用する。自分のノート・自分で直した文・完了の節は必ず残る
- **JSON の書き出しと読み込み**: 教科書1冊 = JSON 1ファイル。別の端末に持っていって続きを書ける
- **デモ応答**: API キーなしで動線を試せる。通しテストもこれを使う

## 動かし方

```bash
npm ci
npm run dev
```

ブラウザで表示された URL を開きます。AI を使うには「つくる」画面の「使うAI」で Anthropic API を選び、API キーを入れてください。
キーはこの端末のブラウザの中（IndexedDB）にだけ保存され、書き出す JSON には入りません。共有の端末では使わないでください。

## テスト

```bash
npm run typecheck   # 型チェック
npm test            # 単体テスト（Vitest）
npm run e2e         # 通しテスト（Playwright。初回は npx playwright install chromium）
```

Pull Request と `develop` / `production` への push のたびに CI（`.github/workflows/ci.yml`）が型チェック・単体テスト・ビルド・依存の脆弱性検査（`npm audit --audit-level=high`）・通しテストを行います。
脆弱性が high 以上で見つかると CI は失敗します。依存の更新は Dependabot が PR を出します。

## 配信

GitHub Pages で配信します: https://risuda-ze.github.io/jibun_textbook/

配信は **`v*` タグを打ったときだけ**行います（`.github/workflows/deploy.yml`）。ブランチへの push では配信しません。
Android の Chrome で上の URL を開き、メニューから「ホーム画面に追加」するとアプリのように使えます。
手順の詳細と手動で配信し直す方法は `docs/notes.md` の「CI と配信」にあります。

## データの形

- 教科書1冊 = JSON 1ファイル（`<題名>.textbook.json`）。`schemaVersion` で形式の版を管理します
- 画像は長辺 1600px・WebP に縮小して data URL で JSON の中に埋め込みます。ファイル1つで完結します
- 保存先は端末のブラウザの IndexedDB です。ブラウザやオリジン（URL のホスト）が変わると別の保存領域になるので、移すときは JSON を書き出して読み込みます
- API キーと AI の設定は JSON に含めません

## 技術構成

- Vite + React + TypeScript、PWA（vite-plugin-pwa）
- 保存: IndexedDB（idb-keyval）
- 本文: Markdown 保存。表示は marked、見たまま編集は contenteditable、確定は turndown。表示と確定の両方で DOMPurify を通します
- スキーマ検証: zod
- AI: `@anthropic-ai/sdk` をブラウザから直接呼びます。Web 調査（サーバー側の Web 検索ツール）と構造化出力は別のリクエストに分けています

## 設計の参照

- `DESIGN.md` — 見た目の正（色・書体・余白・部品の割り当て）
- `docs/notes.md` — 実装メモ。仕様で曖昧だった所の判断、CI と配信、実 API で分かったこと
- `docs/security.md` — セキュリティ要件と現状の充足状況
- `docs/markdown_roundtrip.md` — 見たまま編集の往復で記法ごとに何が保たれるか
- `docs/test_report.md` — テスト結果
- `docs/backlog.md` — あとでやること
- 仕様と意思決定の原本は別リポジトリ（brain vault）にあり、作業指示は GitHub Issues で受け取ります

## 考えるべきこと

- **ライセンス**: 未定です。リポジトリを公開しているため、決めるまでは All rights reserved（明示のライセンス無し）の扱いになります。候補は MIT。決めるのは作者です
- **スマホ以外の端末**: iOS Safari では試していません
- **共有端末**: キーと教科書がブラウザに残ります。ログアウトの仕組みはありません

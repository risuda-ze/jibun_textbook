# CLAUDE.md

## コミュニケーションルール

- 賢い原始人のように、単語と簡単な文法の身を使用
- 専門用語を簡略せず、正確に使用

## 制限

- 変更指示は`C:\dev\jibun_textbook\.claude\agents\change-orchestrator.md`が受け取る
- 車輪の再生産はしない。新しいアイデアの相談がきたら必ずGitHubにアクセスし、同様のアイデアや、より良いアイデアがないか確認すること。
- 重複した検証指示は極力行わない
- 回答は冗長にせず、50行未満とする。50行以上の回答が必ず必要な場合はファイル化すること
- 仕様の改定や作成は人間が行う
- APIキーは端末内（IndexedDB の `settings`）にだけ置く。書き出しJSON・ログ・URL・コミットに入れない。書き出しは必ず `exportJson()`を使う

## 概要

**じぶん教科書** — AIが下書きした教材に、自分で確かめたこと・やったことを書き込んで「自分の教科書」に育てるアプリ。
使うのは1人だけ。サーバーは持たない静的なPWAで、PCとAndroidで使う。端末間は教科書のJSONファイルを手で運ぶ。

仕様は以下を参照する

- 作業指示: `C:\dev\note\brain\06_briefs\jibun_textbook_2026-09-21.md`
- 決定事項と理由: `C:\dev\note\brain\01_projects\50_jibun_textbook\10_jibun_textbook_concept.md`
- 画面の構成と文言の見本: `C:\dev\note\brain\01_projects\50_jibun_textbook\30_jibun_textbook_screen_mock.html`
  （配色は古い。構成と動線だけ参照する）
- **見た目の正: このリポジトリの `DESIGN.md`**。色・書体・余白・角丸はそこから取る。末尾の「じぶん教科書での適用」に割り当てがある

## 構成

```
src/
  types.ts        教科書のスキーマ（zod）。ここが保存形式の正。schemaVersion: 1
  store.ts        状態とIndexedDBへの保存。useApp() で画面に渡す
  lib/status.ts   節の状態（未作成/AIの下書き/書き込みあり/完了）の導出。保存はしない
  lib/protect.ts  「設計を直す」の反映と差分。守る対象の機械的な保証
  lib/io.ts       JSONの書き出し・読み込み・新旧の判定
  lib/migrate.ts  版の移行（schemaVersion ごとの移行関数）と既知の不整合の修復。読み込みと起動時の両方が通る
  lib/image.ts    画像の縮小（長辺1600px・WebP）
  lib/md.ts       Markdown ⇔ HTML（見たまま編集の往復）
  ai/types.ts     AiProvider インターフェース。画面はこれだけを呼ぶ
  ai/anthropic.ts Anthropic API。調査（Web検索）→ 構造化 の2段構え
  ai/demo.ts      デモ応答。キーなしの試用と通しテストで使う
  ui/kit.tsx      共通コンポーネント（Button / Pill / Card / PageHead / Segmented）。画面に色や角丸を直接書かない
  ui/             5画面（Shelf / Create / Roadmap / LessonPage / Book）と Help、部品
  styles.css      DESIGN.md のトークンとクラス
tests/            Vitest（データ・守る対象・Markdown往復・AI層）
e2e/              Playwright（完了条件をPC幅とスマホ幅で）
docs/             実装メモ・セキュリティ・Markdown 往復の計測
```

## コマンド

```bash
npm run dev        # 開発サーバー http://localhost:5173/jibun_textbook/
npm run typecheck
npm run lint       # 整形と lint（Biome）。CI でも走る。直すのは npm run format
npm test           # 単体とAI層
npm run e2e        # 通し。初回は npx playwright install chromium
npm run build      # dist/ を作る
```

## 保存形式の規約（#65）

- 保存形式の正は `src/types.ts`。互換性が無くなる変更（項目の削除・改名・意味の変更）をする時は `schemaVersion` を1つ上げ、旧版 → 新版の移行関数を `src/lib/migrate.ts` に足す。項目の追加だけで旧版も読めるなら版は上げず、zod の `default` で埋める
- 移行は「元の版 → 次の版」を1段ずつ積む。版をまたぐ直行関数は作らない
- 読み込み（JSON 読込・端末内データ）は版を見て新版まで自動で移行する。移行できない時は理由を出し、Help の「読み込めない場合、まずはこちら」で手動で試せるようにする
- 移行関数には旧版の見本 JSON を使った単体テストを付ける。見本は `tests/fixtures/textbook_v<版>.json` に版ごとに残す

## AI層規約

- 公式SDK `@anthropic-ai/sdk` をブラウザで使う（`dangerouslyAllowBrowser: true`）。モデルIDに日付を付けない
- 調査と構造化は**別リクエスト**。Web検索の結果には出典が常に付き、構造化出力と同じリクエストでは衝突しうる
- `pause_turn` は assistant の内容をそのまま送り返して続行。検索エラーはHTTP 200の中身で分岐（例外にならない）
- 一次情報リンクは、調査で実際に見つけたページからだけ作る。AIが文章中に書いたURLをリンクにしない
- 失敗しても教科書は変えない。理由を日本語で出して、もう一度試せるようにする

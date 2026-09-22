# セキュリティ要件（2026-09-22）

ブラウザから直接 Anthropic API を呼び、ユーザー入力（Markdown・HTML の貼り付け・画像・外部 JSON）を扱うアプリとして守るべき要件と、現状の充足状況。
現状はコードと設定を読んで実測で埋めた（推測で「済」にしていない）。修正はこの文書では行わず、末尾に別 Issue の候補として列挙する。

判定: **済** = 要件を満たす / **未** = 満たしていない / **要確認** = 実機や実 API で確かめないと分からない

## 1. API キー

| 要件 | 現状（該当箇所） | 判定 | 対応方針 |
|---|---|---|---|
| 端末内にだけ保存し、書き出す JSON に絶対に含めない | キーは `AiSettings.apiKey` として IndexedDB の `settings` キーに保存（`src/store.ts` `saveSettings`）。教科書のスキーマ `TextbookZ`（`src/types.ts`）にキーの項目が無く、書き出しは `exportJson()` が `TextbookZ.parse()` を通すので構造上入らない（`src/lib/io.ts`）。e2e「完了条件7」が書き出し JSON にキーが無いことを確認 | 済 | 維持。書き出し経路を増やすときは必ず `exportJson()` を通す（`CLAUDE.md` に明記済み） |
| `dangerouslyAllowBrowser: true` を使う理由が明確で、公開ページでキーが露出する経路が無い | `src/ai/anthropic.ts` `makeClient()` で明示。理由はコメントに「自分専用でキーは端末内にだけ置く」。配信物（`dist/`）にキーは含まれず、キーは各端末で入力する。サーバーを持たないのでキーが第三者のサーバーを経由しない | 済 | 維持。共有端末では使わない前提を README に書く |
| キーを画面に表示しない | 入力欄は `type="password"`・`autoComplete="off"`（`src/ui/common.tsx`）。保存後は「設定済み / 未設定」の表示だけで値は出さない | 済 | — |
| キーをログ・エラー文・URL に混ぜない | エラー文は `toAiError()` が固定文か SDK の `e.message` を返す（`src/ai/anthropic.ts`）。`console.log` にキーを出す箇所は無い。URL パラメータは使っていない | 要確認 | SDK の `APIError.message` に認証ヘッダが含まれないことを実 API のエラーで1回確認する |
| キーを消せる | 空文字で保存すると消える（`common.tsx` の「キーを消した」） | 済 | — |

## 2. 外部から読み込む JSON

| 要件 | 現状（該当箇所） | 判定 | 対応方針 |
|---|---|---|---|
| スキーマ検証と `schemaVersion` チェック | `parseImport()` が `JSON.parse` → `schemaVersion === 1` → `TextbookZ.safeParse` の順に検証（`src/lib/io.ts`）。失敗理由を画面に出す | 済 | 版が上がったら移行処理を足す |
| 起動時に IndexedDB から読むデータも検証する | `init()` が各教科書を `TextbookZ.safeParse` で検証し、失敗したものは読み込まない（`src/store.ts`） | 済（ただし黙って捨てる。#17） | — |
| サイズ上限 | 書き出し側は 8MB 超で警告（`SIZE_WARN_BYTES`）。**読み込み側に上限が無い**。何十 MB でも `JSON.parse` する | 未 | 読み込み前に `File.size` を見て上限（例 16MB）を超えたら断る（#17 に記載） |
| 不正な `id` / 重複 / 循環 | 読み込み（`parseImport`）は `TextbookStrictZ`（`superRefine` で章・節・ブロック・画像の id の一意性を検証）で弾き、どの id が重複しているかを理由に出す。端末内のデータは `store.init` が `renumberDuplicateIds` で振り直して救済し、件数をトーストで知らせる。木構造なので循環は起きない（#36・2026-09-23） | 済 | — |
| URL 項目のスキーム検証 | スキーマ（`LinkZ.url`・`Block.source`・`Image.dataUrl`）は `z.string()` のまま弾かない（古い JSON を読めなくしないため）。描画時に `src/lib/safe.ts` の `isHttpUrl` / `isImageDataUrl` で無害化する（#35） | 済 | 描画経路を増やすときは必ずこの2関数を通す |
| 同じ `id` の教科書との衝突 | `updatedAt` を比べて新しければ自動上書き、古ければ確認（`decideImport()`）。上書きは元に戻せる | 済 | — |

## 3. Markdown → HTML の描画

| 要件 | 現状（該当箇所） | 判定 | 対応方針 |
|---|---|---|---|
| 表示する HTML を必ずサニタイズする | `mdToHtml()` が marked の出力を `DOMPurify.sanitize()` に通す（`src/lib/md.ts`）。通読・レッスンとも `dangerouslySetInnerHTML` の入力はこの関数の戻り値だけ | 済 | 維持 |
| 編集で確定する HTML もサニタイズする | `htmlToMd()` が turndown の前に `DOMPurify.sanitize()` を通す | 済 | — |
| 貼り付けた HTML が確定前に生のまま DOM に入らない | **未対応**。`Editable` に `onPaste` が無く、貼り付け直後は貼った HTML がそのまま contenteditable に入る（blur で確定するまで）。自分の貼り付けなので第三者の入力ではないが、外部サイトからコピーした HTML が一時的に生で入る | 未 | `onPaste` で `text/plain` に落とすか、貼り付け時に sanitize（#17） |
| 外部リンクの `rel="noopener noreferrer"` | 自分のコードが作る `<a target="_blank">`（出典・手がかり・一次情報）には付いている（`blocks.tsx` `LessonPage.tsx`）。Markdown 内のリンクは marked が `target` を付けないので同一タブで開く | 済 | — |
| `javascript:` / `data:` スキーム | Markdown 内のリンクは DOMPurify が `javascript:` を除去する。JSON 由来の `clues.links[].url` と出典 `b.source` は `isHttpUrl` を通ったときだけ `<a>` にし、それ以外は文字として出す。画像 `dataUrl` は `isImageDataUrl`（`data:image/…`）を通ったときだけ `<img>` にし、それ以外は「表示できない画像です」と出す（`src/lib/safe.ts`・#35） | 済 | `tests/safe.test.ts` と e2e「不正な URL と画像は無害化される」が見張る |

## 4. AI 応答の取り扱い

| 要件 | 現状（該当箇所） | 判定 | 対応方針 |
|---|---|---|---|
| AI が書いた URL をリンクにしない | 一次情報リンクは、調査で実際に返ってきた `sources[]` の**番号**を構造化出力で選ばせ、範囲外の番号は捨てる（`src/ai/anthropic.ts` 192行付近 `linkIndexes`）。AI が文中に書いた URL は Markdown のリンクとして表示されるだけで、手がかりには入らない | 済 | 維持 |
| 構造化出力を検証する | `messages.parse()` + `zodOutputFormat(schema)` で受け取り、`parsed_output == null` は失敗扱い（`structure()`） | 済 | — |
| AI 応答で教科書が壊れない | 失敗時は教科書を変えない（`src/ui/generate.ts`）。再設計は `src/lib/protect.ts` が守る対象（自分のノート・直した文・完了の節）を機械的に残し、`tests/protect.test.ts` が見張る | 済 | — |
| Web 検索の結果が入力トークンとして課金される・上限を切る | `max_uses` を渡している。`pause_turn` の続行は最大5回（`MAX_PAUSE_CONTINUES`） | 済 | 実 API で検索回数を1回実測する（`docs/notes.md`「実 API で分かったこと」） |
| 応答の切り詰め（`max_tokens`）を知らせる | `truncated` フラグは立つが画面に出ない | 未 | #17 |

## 5. 配信・ブラウザ側

| 要件 | 現状（該当箇所） | 判定 | 対応方針 |
|---|---|---|---|
| CSP（Content-Security-Policy） | `index.html` に `meta http-equiv` は無い。GitHub Pages はヘッダを設定できないので `meta` で入れるしかない。外部への接続先は Anthropic API と Google Fonts（`fonts.googleapis.com` / `fonts.gstatic.com`）だけ | 未 | `connect-src 'self' https://api.anthropic.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'` を `meta` で入れる。Vite のインライン script と PWA の登録が動くか e2e で確かめる（候補 Issue） |
| Service Worker のキャッシュに教科書データやキーが入らない | `vite-plugin-pwa` の `workbox.globPatterns` はビルド成果物（js/css/html/svg/png/woff2）だけ（`vite.config.ts`）。IndexedDB は対象外。API 応答の runtime caching は設定していない | 済 | Anthropic API を runtime cache に入れない設定を維持 |
| HTTPS 前提 | GitHub Pages は HTTPS。混在コンテンツ（`http://` のローカルモデル）は Phase 2 の課題として認識済み | 済 | — |
| 保存領域が勝手に消されない | `navigator.storage.persist()` を起動時に要求（`src/store.ts`）。許可されるかはブラウザ次第 | 要確認 | Android Chrome で「ホーム画面に追加」後に `navigator.storage.persisted()` を確認する |
| 共有端末での利用 | キーと教科書は端末のブラウザプロファイルに残る。ログアウトの概念が無い | 済（前提） | README に「自分専用の端末で使う」と書く |

## 6. 依存パッケージ

| 要件 | 現状 | 判定 | 対応方針 |
|---|---|---|---|
| 既知の脆弱性が無い | `npm audit --audit-level=high` → `found 0 vulnerabilities`（2026-09-22） | 済 | CI の `audit` ジョブで push ごとに検査。high 以上で失敗 |
| 更新を継続的に受け取る | `.github/dependabot.yml`（npm 週次・Actions 月次）。Dependabot alerts と security updates はリポジトリ設定で有効化済み（`gh api` で確認） | 済 | — |
| サニタイザの鮮度 | `dompurify ^3.4.15`。DOMPurify は脆弱性修正が多いので更新を止めない | 済 | Dependabot に任せる |
| lockfile の固定 | `package-lock.json` をコミットし、CI は `npm ci` | 済 | — |

## 7. リポジトリ（public 化の前に確認）

| 要件 | 現状 | 判定 | 対応方針 |
|---|---|---|---|
| 秘密情報がコミット履歴に無い | `git log -p --all` を `sk-ant-` で検索 → ヒットは e2e の偽キー `sk-ant-e2e-SECRET-KEY`（`e2e/flow.spec.ts` 221行）の1件のみ。本物のキーは無い。`.env` は `.gitignore` 済みで履歴にも無い | 済 | 偽キーはそのままでよい（形式だけの文字列） |
| 教科書データが無い | `*.textbook.json` は `.gitignore` 済み。履歴にも無い | 済 | — |
| 公開して問題ないファイルだけか | 追跡 79 ファイル。`src/` `tests/` `e2e/` `public/` `scripts/` `docs/` `DESIGN.md` `CLAUDE.md` `.claude/`（エージェント定義 8 件・スキル 7 件・`settings.json`）。**要判断**: (a) `DESIGN.md` は Notion のサイトを参照して書いたスタイル記述で、Notion のロゴ・画像・コードは含まない。(b) `.claude/settings.json` の allow に `C:\dev\note\brain\...` のローカルパスが入っている（個人の環境が分かる。秘密ではない）。(c) `.claude/agents` `.claude/skills` は汎用の作業手順で、個人情報は無い。`settings.local.json` はグローバル ignore で追跡外 | 要確認（人が判断） | (b) が気になるなら該当行を消す。それ以外は公開して差し支えないと判断する |
| `test-results/` `dist/` `playwright-report/` を追跡しない | `.gitignore` 済み。追跡ファイルに無い | 済 | — |
| Actions の権限が最小 | `ci.yml` は `contents: read`。`deploy.yml` は `pages: write` `id-token: write` のみ。`release.yml`（#1）は `contents: write` が要る | 済 | — |
| ブランチ保護 | Rulesets で設定済み: `develop-rule` / `production-rule` は PR 必須・線形履歴・required checks（`型・単体・ビルド` `依存の脆弱性（high 以上で失敗）` `通し（Playwright）`）。`version-rule` は `v*` タグの更新・削除を禁止 | 済 | 1人運用で詰みうる「Code Owners のレビュー必須」「最新 push の承認必須」は要見直し |

## 8. データの消去・復元

| 要件 | 現状（該当箇所） | 判定 | 対応方針 |
|---|---|---|---|
| 誤操作で消したものを戻せる | 教科書・節・ノート・文・画像の削除は直後のトーストの「元に戻す」で戻せる（`snapshot()` + `putBook()`）。トーストは 7 秒で消える | 済（範囲は限定） | 7 秒を過ぎると戻せない。書き出し JSON からの復元が唯一の手段なので、書き出し忘れの知らせ（#16）が効く |
| 端末の消去に備える | 書き出し JSON が唯一のバックアップ。本棚に「7 日以上書き出していない」知らせを出す | 済（本棚のみ） | レッスン画面にも出す（#16） |
| 保存失敗を見逃さない | `putBook()` は IndexedDB への書き込み失敗をトーストで出すが、画面の状態は更新済みのまま | 未 | #17 |
| 「別の本として追加」で元を壊さない | `asCopy()` が `id` を振り直す | 済 | — |

## 「未」「要確認」のまとめ（別 Issue の候補）

既存 Issue に含まれるもの:

- 読み込み JSON のサイズ上限 / 貼り付けの生 HTML / `truncated` の表示 / 保存失敗の扱い → #17
- 書き出し忘れの知らせをレッスン画面にも → #16
- ブランチ保護 → #8（public 化後）

新しく起こす候補:

1. ~~URL のスキーム検証~~ → #35 で対応済み（描画時に無害化）
2. ~~`id` の一意性検証~~ → #36 で対応済み
3. **CSP の導入**: `index.html` の `meta` で `connect-src` を Anthropic API に限定。PWA の登録と Google Fonts が動くことを e2e で確認
4. **実 API での確認**（人が行う）: エラー文にキーが混ざらないこと、検索回数の実測、`navigator.storage.persisted()` の結果

## 根拠

- Anthropic TypeScript SDK README「Browser support」: `dangerouslyAllowBrowser` は既定で無効。有効化はキー露出のリスクを理解したうえで行う — https://github.com/anthropics/anthropic-sdk-typescript#browser-support
- DOMPurify — https://github.com/cure53/DOMPurify
- GitHub Pages はカスタムヘッダを設定できない（CSP は `meta` のみ） — https://docs.github.com/pages
- Dependabot alerts / security updates の API — https://docs.github.com/rest/repos/repos#enable-vulnerability-alerts

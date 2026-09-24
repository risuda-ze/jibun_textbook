# 実装メモ（brainが読み取る報告）

## 経緯

2026-09-21、初回の生成物（汎用の骨組み。画面モック未移植、ノート入力がブラウザの prompt、節の生成・テスト・docsなし）を
ユーザーの指示で破棄し、作り直した。今回に限り、brainセッションが例外の許可を得て直接実装した。

## briefが報告を求めた点

| 問い | 答え |
|---|---|
| 見たまま編集を採用できたか | **採用した**。ただし Tiptap ではなく、`marked`（md→HTML）＋ `contenteditable` ＋ `turndown`（HTML→md）の往復にした。モックの操作感（クリックしてそのまま書く）と同じで、依存が軽い。編集部分は `src/ui/blocks.tsx` の `Editable` 1つに閉じてあり、後から差し替えられる |
| 往復で崩れないか | 記法ごとの結果は `docs/markdown_roundtrip.md`（`tests/md_roundtrip.test.ts` と対応）。入れ子のリストと表は意味が保たれる。表の中の改行は崩れる（#48 で直す）。貼り付けた装飾つきテキストは未計測（#17） |
| 「自分で修正」の誤判定 | 触っていないのにMarkdownの正規化で差が出ると誤判定になる。**フォーカス前後のHTMLが同じなら何もしない**ことで防いだ |
| Web検索ツールの型 | `web_search_20260209` を指定。実APIでは未確認 |
| `pause_turn` の発生有無・検索回数・トークン | **実APIを呼んでいないので不明**。続行処理は偽クライアントで確認済み。上限は5回 |
| 2段構えで問題がなかったか | 設計どおり実装。1回にまとめる試みはしていない（実APIが要る） |
| ブラウザ直呼びの問題 | 未確認（実APIが要る） |
| Androidでの確認 | 未実施。スマホ幅の表示は Playwright の Pixel 7 設定で確認 |

## 仕様で曖昧だった所と判断

- **教科書のid**: 節と章のidはuuidにし、「2-1」のような番号は位置から毎回作る。再設計で並びが変わっても参照が壊れない
- **守る節のある章**: 章名もAIに変えさせない。守る節を別の章へ動かす指示は無視し、元の章に残す
- **変更案に出てこなかった章**: 守る節があれば、その節だけ残して章を維持する。無ければ削除として差分に出す
- **差分の表示**: AIの変更案を直接見せず、「守る対象を適用した後の結果」と今を比べた差分を見せる。表示と反映が必ず一致する
- **一次情報リンク**: AIが構造化出力に書いたURLは使わない。調査で実際に返ってきたページの番号を選ばせ、範囲外の番号は捨てる
- **白紙から作る**: Phase 0（AIなしで手書き）のため、本棚に「白紙から作る」、ロードマップに章・節の追加と改名を足した
- **デモ応答**: 接続先に「デモ応答」を足した。キーなしで動線を試せる。通しテストもこれを使い、外部に一切つながない
- **手を動かすチェックリスト**: チェック状態も教科書JSONに保存する（端末をまたいで続きができるように）
- **最後の書き出し日**: 端末内にだけ持つ。自分の書き込みがあり、7日以上書き出していない（または一度も無い）ときだけ本棚に出す
- **refusal**: `claude-opus-5` / `claude-fable-5-1` 向けのサーバー側フォールバック（ベータ）は入れていない。
  応答を控えられたら、その旨とモデル切り替えを案内する
- **検索チップ**（#17）: 参考情報の検索語は Google 検索の URL に固定（`LessonPage.tsx` の `gq`）。検索エンジンの切り替えは設けない
- **`breaks: true`**（#17）: 単一改行を `<br>` にする設定の副作用は `docs/markdown_roundtrip.md` で実測済み。往復後に行末空白2つが付くが、2回目以降は安定する。変更しない
- **見たまま編集への貼り付け**（#17）: 文字だけ受け付ける。装飾つき HTML は落とし、画像は断る（ノートの「画像を入れる」を使う）
- **読み込む JSON の上限**（#17）: 16MB。超えたら `JSON.parse` の前に断る
- **保存失敗**（#17）: IndexedDB に書けなかったら画面の変更も取り消す。読めない教科書は本棚で知らせ、生データを書き出すか消せる

## リデザイン（2026-09-21）

ユーザー支給の `DESIGN.md`（暖色の紙のキャンバス・白いカード・細い罫線・青は主操作だけ）に合わせて全画面の見た目を作り直した。

- `src/ui/kit.tsx` に共通コンポーネント（Button / Pill / Card / PageHead / Segmented）を新設し、全画面の生の button / panel を置き換えた
- `src/styles.css` を DESIGN.md のトークンから全面的に書き直した。ダークテーマは廃止（DESIGN.md がライトのみのため）
- 青いボタンを1画面1つに整理。状態の色は Sky Tint / Marigold / Midnight Ink / Coral に割り当てた
- 書体は Inter ＋ Noto Sans JP、明朝は Source Serif 4 ＋ Noto Serif JP。Google Fonts から読むので、オフライン時は端末の書体に落ちる
- 割り当ての詳細は `DESIGN.md` 末尾「じぶん教科書での適用」
- 判断: 参照元のキャラクターイラストやロゴは使っていない。表示サイズ（54〜96px）は道具には大きすぎるので使っていない
- テスト: 型チェック・単体39件・通し18件は、リデザイン後も全部成功

## CI と配信（2026-09-22）

### ブランチの流れ

- default ブランチは **`production`**（配信される状態）。統合ブランチは **`develop`**
- 作業は Issue ごとに `feat/<Issue番号>_<概要>` を `develop` から切り、`develop` に向けて PR を出す。`develop → production` も PR で行う
- Rulesets により `develop` と `production` は直接 push できず、線形履歴（squash か rebase でマージ）と CI の3ジョブ成功が必須
- 配信用のタグ `vX.Y.Z` は `production` のコミットに打つ。タグは打ち直せない（`version-rule`）ので、打つ前に対象コミットを確かめる

### CI（`.github/workflows/ci.yml`）

Pull Request と `develop` / `production` への push で3つのジョブが走る。配信はしない。
（push を `develop` と `production` に絞るのは、PR を開いているブランチで push と pull_request の両方が発火して同じコミットが2回走るのを防ぐため。ブランチの検証は PR で行う）

| ジョブ | 内容 | 落ちる条件 |
|---|---|---|
| `check` | `npm run typecheck` → `npm test` → `npm run build` | 型エラー・単体テスト失敗・ビルド失敗 |
| `audit` | `npm audit --audit-level=high` | **high 以上の脆弱性が1件でもある**。moderate 以下は Dependabot の更新 PR に任せる |
| `e2e` | Playwright（Chromium）で `npm run e2e`。デモ応答だけを使い外部につながない | 通しテスト失敗。失敗時は `playwright-report/` と `test-results/` が artifact に残る |

Dependabot（`.github/dependabot.yml`）は npm を毎週月曜、GitHub Actions を毎月見て更新 PR を出す。
minor と patch は1本にまとめる。Dependabot alerts と security updates はリポジトリ設定で有効にしてある。
Rulesets: `develop-rule` と `production-rule` が PR 必須・線形履歴・required checks（CI の3ジョブ）を課す。`version-rule` は `v*` タグの更新と削除を禁止する。

### 配信（`.github/workflows/deploy.yml`）

GitHub Pages（https://risuda-ze.github.io/jibun_textbook/ ）。**`v*` タグの push と手動実行でだけ配信する**。
ブランチへの push では配信しない。配信のタイミングは人が握る。

1. リポジトリを public にする（Pages の無料枠は public が条件）
2. Settings → Pages → Source を「GitHub Actions」にする
3. `git tag vX.Y.Z && git push origin vX.Y.Z` で配信される（`release.yml` があれば Release も同時に発行される）
4. 手動で配信し直す: `gh workflow run deploy.yml -f ref=vX.Y.Z`（`ref` が空なら実行元の `production`）
5. Android の Chrome で配信 URL を開き、メニューから「ホーム画面に追加」

注意: ワークフローは**タグ先のコミットに入っている定義**で動く。古いコミットにタグを打つと、その時点に
`deploy.yml` の新しい定義が無いので自動では走らない。その場合は 4 の手動実行で `ref` にタグを指定する。
リポジトリ名を変えるなら `vite.config.ts` の `base` も変える。
- **`github-pages` 環境の配信ルールにタグの許可が要る**。環境の Deployment branches が「production ブランチだけ」だと、タグからの配信は `Tag "vX.Y.Z" is not allowed to deploy to github-pages due to environment protection rules` で失敗する（Release の方は環境を使わないので成功する）。v0.2.0 で起きたので、環境に「tag `v*`」の許可を足した。確認と追加は次のコマンド

  ```bash
  gh api repos/risuda-ze/jibun_textbook/environments/github-pages/deployment-branch-policies --jq '.branch_policies[] | "\(.type // "branch") \(.name)"'
  ```

  ```bash
  gh api -X POST repos/risuda-ze/jibun_textbook/environments/github-pages/deployment-branch-policies -f name='v*' -f type=tag
  ```

  失敗した配信は `gh run rerun <run id> --failed` で再実行できる（タグは打ち直せない）

## 文言のルール（2026-09-22・#4）

画面に出る **文** は敬体（です・ます）で統一する。**単語・句** は今のまま。

- 対象は文（述語を持つもの）: エラーメッセージ、トースト、確認ダイアログ、空状態の案内、説明文、placeholder の文
- 対象外は単語・句: ボタンのラベル（「開く」「章を足す」）、チップ（「完了」「再確認」）、見出し、eyebrow、表のセル、「読み込み中…」のような句
- 文末は「〜します」「〜しました」「〜できません」「〜してください」。体言止めの文は敬体に直す（「節がない。」→「節がありません。」）
- 語彙は変えない（「消す」を「削除する」にしない）。文体だけを揃える
- AI へのプロンプト（`src/ai/anthropic.ts` の system / user prompt）と、デモ応答が返す教科書の本文（`src/ai/demo.ts`）は画面の文言ではないので対象外。デモ応答の進行表示（「Web調査はしません」）は対象
- e2e（`e2e/flow.spec.ts`）は画面の文をそのまま照合しているので、文を変えたら追随させる

## 2026-09-22 の判断（Issue 本文に無いもの）

- #6 の警告色ボタン `Button v="danger"` は **塗りではなく赤い枠＋赤い文字**にした。`DESIGN.md` の「色面は主操作の青だけ」に合わせるため。hover で薄い赤の地
- #6 の右揃えは本棚専用の `.row.card-actions` で行い、他画面の `.row` には影響させない
- #5 の「章を足す」は詳細カード（`.detail`）の直後、右寄せの行に置いた。章が1つも無いときの空状態の「章を足す」（青）はそのまま
- e2e は「初回生成」時点で既に画面の文言（「AIと新規作成」など）とずれていた（本棚の見出しとボタン名がコミット前に変わっていたため）。#4 と合わせて追随させ、18件すべて通る状態に戻した

## 実APIで分かったこと

（キーを入れて試したら、ここに書く）

### 発行（`.github/workflows/release.yml`）

`v*` タグを打つと、その時点の `dist/` を zip にして GitHub Release に添付する（`softprops/action-gh-release`）。配信（`deploy.yml`）と同じトリガーなので、**タグ = Release + 配信**。

1. `package.json` の `version` を上げてコミットし、`production` まで入れる
2. `production` のそのコミットに `git tag vX.Y.Z && git push origin vX.Y.Z`。`release.yml` と `deploy.yml` が走る
3. タグ名は `vX.Y.Z` だけを受け付ける。両ワークフローの最初のステップで形式を確かめ、違えば何もしない
4. 手動で発行し直す: `gh workflow run release.yml --ref production -f tag=vX.Y.Z`

**v0.1.0 の発行（初回生成 `6a96429`）**: この時点のコミットに `release.yml` は無いので、タグを push しても自動では走らない。
`gh workflow run release.yml --ref production -f tag=v0.1.0` で発行する（この PR が `production` に入った後）。**配信はしない**。理由: Pages には既に新しい `production` の内容が配信されており、
v0.1.0（初回生成の状態）を配信すると画面が巻き戻るため。v0.1.0 は「この時点の状態」を固定して参照するための Release で、配信の対象は次のタグから。

zip は `base` が `/jibun_textbook/` のため、解凍して直接開いても動かない。Pages 配下で動く前提の成果物。

## 2026-09-23 の判断（#12）

- ノートの下書きは `store.ts` の `drafts`（節idごと・端末には保存しない）に置いた。`LessonPage` の state では、ロードマップへ移動した時点で画面ごと消えるため。`Composer` は制御コンポーネントにし、自分では state を持たない
- 差し込み位置を変えても引用は残す（以前は位置変更で引用を消していた）。引用は「本文のどこに書くか」ではなく「何に対して書くか」なので、位置と切り離した
- 節を切り替えると、その節の下書きは別に持つ。書き込むか空にすると消える。ページを閉じると全部消える（現状どおり）

## 2026-09-23 の判断（#35）

- URL のスキーム検証は **スキーマでは弾かず、描画時に無害化**する（`src/lib/safe.ts` の `isHttpUrl` / `isImageDataUrl`）。zod で弾くと、過去に書き出した JSON が読めなくなる可能性があるため。読み込み時のエラーで「壊れている」と言われるより、リンクにならない・画像が出ない方が失うものが少ない
- 対象は JSON 由来の3か所: 参考情報の一次情報リンク、ノートの出典、ノートの画像。Markdown 内のリンクは DOMPurify が担当
- `<img src>` は `data:image/…` だけを通す。https の画像 URL も通さない（画像は data URL で JSON に埋め込む方針のため）

## 2026-09-23 の判断（#36）

- id の一意性は **読み込み（JSON）では弾き、端末内のデータでは振り直して救済**する（この時点の判断。#65 で読み込みも「振り直して直した所を知らせる」に変え、`TextbookStrictZ` は削除した。`docs/security.md` を参照）。起動時に弾くと本棚から教科書が消えたように見えるため
- 振り直しは後ろの重複だけを新しい uuid にし、最初の1つは元のまま。件数をトーストで知らせる

## 2026-09-23 の判断（#37）

- CSP は **本番ビルドにだけ** meta で入れる（`vite.config.ts` の `cspMeta` プラグイン、`apply: 'build'`）。開発サーバーは HMR と React の preamble がインライン script を使うので、入れると動かない。本番ビルドの `index.html` にインライン script が無いことは確認済み
- `style-src` に `'unsafe-inline'` を許す。React の `style={{}}`（style 属性）が多く、外すには全部をクラスに置き換える必要がある。script は `'self'` だけなので、実害は小さい
- `frame-ancestors` は meta では無効なので書かない（Pages ではヘッダを出せない）。クリックジャッキング対策は諦める（自分専用・認証無しなので影響が小さい）

## 2026-09-23 の判断（#63・資料を渡して生成）

- 渡し方は **ファイル1つ**（主）と **文字の貼り付け**（従）。YouTube はリンクと題名だけでは本文の材料にならず、字幕はブラウザから取れない（サーバーも持たない）ので、字幕は貼り付けで受ける（相談済み）
- txt/md はブラウザで読んでプロンプトの text ブロックに入れる。PDF はブラウザで解析せず、Messages API の **document ブロック（base64・`application/pdf`）** で渡す（pdf.js を入れると初回表示の JS が大きく増えるため）。API の上限はリクエスト 32MB・ページ数はモデルの文脈長で変わる（200K 文脈で 100 ページ）。アプリ側の上限は文字 200KB・PDF 10MB
- 調査（1段目）には資料の本文を渡さず、名前だけを伝える。資料は書く段階（2段目）でだけ渡す。同じ資料を2回送ると入力トークンを二重に使うため（#79 で文字の資料も同じ扱いにした）。貼り付けた文もファイルと同じ上限（200KB）
- 「この資料だけから作る」は `web_search` ツールを付けず、プロンプトで「資料に無いことは書かない」と指示する。資料が無ければこのチェックは効かない
- 教科書の JSON には資料の**名前だけ**（`Lesson.materials`）残す。本文や base64 は入れない。項目の追加だけなので `schemaVersion` は上げない
- AI 層の `opts.materials` は最初から配列。複数ファイル（#69）は画面側を `multiple` にするだけで済むようにしてある

### 技術確認: URL を渡して取りに行く方式（web_fetch）— 後回し

- Anthropic の Web fetch ツールは `web_fetch_20260209`（Opus 5 / 4.8 / 4.7 / 4.6、Sonnet 5 / 4.6。それより古いモデルは `web_fetch_20250910`）。`web_search` と同じサーバー側ツールなので、ブラウザ直呼び・サーバー無しの構成は変えずに使える
- 取れるのは**会話の中に既にある URL** だけ（プロンプトに URL を書けば対象になる）。指定は `max_uses` / `allowed_domains` または `blocked_domains` / `citations` / `max_content_tokens`。結果は `web_fetch_tool_result` の中に `document` ブロックで返り、PDF も取れる
- `web_search_20260209` と同時に使う場合は `code_execution` を別に付けない（動的フィルタが内部で実行環境を持つため、二重になる）
- **料金は手元の資料では確認できなかった**。実装するなら公式の料金ページで「取得1回あたりの課金の有無」を確かめてから決める
- YouTube の再生ページを取っても題名と説明までで字幕は取れない見込み（字幕は別の取得経路）。この方式を足しても YouTube の本文は解決しないため、URL 入力は「必要になったら」に回した

## 2026-09-24 の判断（#87・生成は画面を離れても続ける）

- 資料の生成の進行中の状態を画面（`useState`）から **store の `running`** に移し、中止の口（`AbortController`）は `src/ui/generate.ts` のモジュールが持つ。タブを切り替えたり別の節を選び直したりしても生成は止まらず、戻れば進行中の表示が続く。止まるのは明示の「やめる」だけ
- 理由: 「調べている間に別の節を読む」自然な操作で、数十秒と課金済みの検索回数を失っていた（`useAbort` が unmount で中止していたため）
- 画面を離れている間に終わったときは、「終わった後の操作」（ロードマップならレッスンを開く）はしない。勝手に画面が変わると驚くため
- つくる（設計）と「設計を直す」は今までどおり画面を離れると中止する。結果がその画面の状態にしか無く、続けても受け取れないため

## 2026-09-24 の判断（#77・進行中の文をボタンの中に）

- `Button` の `busy={{ label, seconds, title }}` が「{現状}・{N秒}」を中に出す。幅は**進行中でない間に `useLayoutEffect` で測った値**に固定する。押した瞬間（onClick）に測らないのは、つくるの「スキップ」のように別のボタンから進行中になる経路があるため
- 検索語（`検索: …`）は `onProgress` の文のまま AI 層から受け取り、画面側の `splitDetail`（`src/ui/common.tsx`）が段階の文と分けて `hint` に入れる。`hint` はボタンの `title` と、つくるの「AIの作業」の段階の下に出す。AI 層のインターフェース（`Progress`）は変えない
- `Working` と `RunControls` は削除し、「やめる」だけの `StopButton` にした。`L.generating`（生成中…）は使う所が無くなったので削除。e2e は名前ではなく `button[aria-busy="true"]`（`e2e/helpers.ts` の `busyButton`）で進行中のボタンを探す
- 表に無い文言: つくるの確認質問を考えている間は「質問を作成中…」（秒数なし）。デモ応答の「この資料だけから作る」は「資料から作成中…」で実 API と同じ
- `role="status"` の中の文は Chrome がボタンの名前に数えない（e2e の snapshot で `button [disabled]:` と名無しになった）。読み上げで名無しにならないよう、同じ文を `aria-label` にも入れる

## 2026-09-24 の判断（#102・システムメッセージの一元化の範囲）

- 集めたのは **AI のエラー文**（`AI_KEY` / `AI_MSG`）と**資料の断り文**（`MATERIAL_KEY` / `MATERIAL_MSG`）。どちらも `src/lib/messages.ts`。Help の対処表に `code` ごとの行と「資料を渡すときに…」の行を足し、`tests/messages.test.ts` が JSON・AI・資料の全 KEY を Help に照合する
- `AI_KEY` は Help に行がある語だけ（nokey / auth / permission / rate / network / refusal / api）。行の無い文（parse・unsupported・noLesson・aborted）は `AI_MSG` にだけ置く。`AiError` の `code` は変えない（`auth` に auth と permission の2文がある）
- **トースト（30件）は集めない**。操作の結果の文で、1か所ずつ文脈に依存するため
- 進行中の文（「Web調査中…」など）は Help と無関係なので `messages.ts` ではなく `src/ai/types.ts` の `PROGRESS` に置く。デモ応答と実 API、`Button` の既定「実行中…」が同じ定数を読む。文言は変えていない

## 2026-09-24 の判断（#88 の3・5・6）

- 確認質問（`askQuestions`）も `opts.signal` で中止でき、`{ questions, usage }` を返す。つくるは `useAiRun` を質問用にもう1つ持ち（`a`）、「やめる」と中止の知らせを設計と同じ経路で扱う。使用量は質問＋設計（＋直してもらう）の合算を `UsageLine` に出す。質問をやり直すと合算は質問の分からやり直す
- 上のナビは `role="tablist"` をやめて `<nav aria-label="画面">` ＋ 押されている画面に `aria-current="page"`。`tabpanel` も矢印キー操作も無いので、タブと名乗らない方が実装と一致する。e2e は `e2e/helpers.ts` の `nav(page, /レッスン/)` で探す
- ロードマップの `.tl` は `role="region"`、`.clip` は `title` と同じ文を `aria-label` にも入れる（hover の `title` は残す）
- 見たまま編集の貼り付けは `document.execCommand('insertText')`（非推奨）をやめ、`Selection`/`Range` で差し込む（選択を消す → 文字ノードを `insertNode` → カレットをその直後へ）。改行は `<br>` にする。`marked` は `breaks: true` なので md との往復が合う。`onBeforeInput` の `insertFromPaste` にしなかったのは、結局 preventDefault して自分で差し込むのは同じで、`onPaste` の方が画像の判定（`clipboardData.files`）をそのまま使えるため。失うのは Ctrl+Z で貼り付けだけを戻す操作（確定は blur 時の HTML 比較なので保存には影響しない）

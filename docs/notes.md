# 実装メモ（brainが読み取る報告）

## 経緯

2026-09-21、初回の生成物（汎用の骨組み。画面モック未移植、ノート入力がブラウザの prompt、節の生成・テスト・docsなし）を
ユーザーの指示で破棄し、作り直した。今回に限り、brainセッションが例外の許可を得て直接実装した。

## briefが報告を求めた点

| 問い | 答え |
|---|---|
| 見たまま編集を採用できたか | **採用した**。ただし Tiptap ではなく、`marked`（md→HTML）＋ `contenteditable` ＋ `turndown`（HTML→md）の往復にした。モックの操作感（クリックしてそのまま書く）と同じで、依存が軽い。編集部分は `src/ui/blocks.tsx` の `Editable` 1つに閉じてあり、後から差し替えられる |
| 往復で崩れないか | 見出し・強調・箇条書き・コードブロック・表は `tests/md.test.ts` で確認済み。未確認: 入れ子のリスト、表の中の改行、貼り付けた装飾つきテキスト |
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

### CI（`.github/workflows/ci.yml`）

Pull Request と `master` への push で3つのジョブが走る。配信はしない。
（push を `master` に絞るのは、PR を開いているブランチで push と pull_request の両方が発火して同じコミットが2回走るのを防ぐため。ブランチの検証は PR で行う）

| ジョブ | 内容 | 落ちる条件 |
|---|---|---|
| `check` | `npm run typecheck` → `npm test` → `npm run build` | 型エラー・単体テスト失敗・ビルド失敗 |
| `audit` | `npm audit --audit-level=high` | **high 以上の脆弱性が1件でもある**。moderate 以下は Dependabot の更新 PR に任せる |
| `e2e` | Playwright（Chromium）で `npm run e2e`。デモ応答だけを使い外部につながない | 通しテスト失敗。失敗時は `playwright-report/` と `test-results/` が artifact に残る |

Dependabot（`.github/dependabot.yml`）は npm を毎週月曜、GitHub Actions を毎月見て更新 PR を出す。
minor と patch は1本にまとめる。Dependabot alerts と security updates はリポジトリ設定で有効にしてある。
public 化のあと、`master` の branch protection で `check` `audit` `e2e` を required にする（private では設定できない）。

### 配信（`.github/workflows/deploy.yml`）

GitHub Pages（https://risuda-ze.github.io/jibun_textbook/ ）。**`v*` タグの push と手動実行でだけ配信する**。
ブランチへの push では配信しない。配信のタイミングは人が握る。

1. リポジトリを public にする（Pages の無料枠は public が条件）
2. Settings → Pages → Source を「GitHub Actions」にする
3. `git tag vX.Y.Z && git push origin vX.Y.Z` で配信される（`release.yml` があれば Release も同時に発行される）
4. 手動で配信し直す: `gh workflow run deploy.yml -f ref=vX.Y.Z`（`ref` が空なら実行元の `master`）
5. Android の Chrome で配信 URL を開き、メニューから「ホーム画面に追加」

注意: ワークフローは**タグ先のコミットに入っている定義**で動く。古いコミットにタグを打つと、その時点に
`deploy.yml` の新しい定義が無いので自動では走らない。その場合は 4 の手動実行で `ref` にタグを指定する。
リポジトリ名を変えるなら `vite.config.ts` の `base` も変える。

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

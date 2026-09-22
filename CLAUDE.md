# CLAUDE.md

## これは何か

**じぶん教科書** — AIが下書きした教材に、自分で確かめたこと・やったことを書き込んで「自分の教科書」に育てるアプリ。
使うのは1人だけ。サーバーは持たない静的なPWAで、PCとAndroidで使う。端末間は教科書のJSONファイルを手で運ぶ。

仕様の正は brain 側にある（読むだけ。書き換えない）。

- 作業指示: `C:\dev\note\brain\06_briefs\jibun_textbook_2026-09-21.md`
- 決定事項と理由: `C:\dev\note\brain\01_projects\50_jibun_textbook\10_jibun_textbook_concept.md`
- 画面の構成と文言の見本: `C:\dev\note\brain\01_projects\50_jibun_textbook\30_jibun_textbook_screen_mock.html`
  （配色は古い。構成と動線だけ参照する）
- **見た目の正: このリポジトリの `DESIGN.md`**。色・書体・余白・角丸はそこから取る。末尾の「じぶん教科書での適用」に割り当てがある

## 守ること

1. **自分の教科書を守る**。自分のノート・自分で修正した文・完了の節は、AIのどんな返答でも消えない・書き換わらない。
   保証は `src/lib/protect.ts` にあり、`tests/protect.test.ts` が見張っている。ここを通さずに教科書を書き換える経路を作らない
2. **APIキーを外に出さない**。キーは端末内（IndexedDB の `settings`）にだけ置く。書き出しJSON・ログ・URL・コミットに入れない。
   書き出しは必ず `exportJson()`（スキーマを通すので教科書以外の項目は落ちる）を使う
3. **分野に依存させない**。動画編集でもプログラミングでも同じ画面。分野固有の選択肢・文言・サンプルをコードに持たない
4. **青いボタンは1画面に1つ**（`Button v="primary"`）。色面のカードも1画面に1つまで。割り当ては `DESIGN.md` 末尾
5. 公開リポジトリ。教科書のJSON（`*.textbook.json`）と `.env` はコミットしない

## 構成

```
src/
  types.ts        教科書のスキーマ（zod）。ここが保存形式の正。schemaVersion: 1
  store.ts        状態とIndexedDBへの保存。useApp() で画面に渡す
  lib/status.ts   節の状態（未作成/AIの下書き/書き込みあり/完了）の導出。保存はしない
  lib/protect.ts  「設計を直す」の反映と差分。守る対象の機械的な保証
  lib/io.ts       JSONの書き出し・読み込み・新旧の判定
  lib/image.ts    画像の縮小（長辺1600px・WebP）
  lib/md.ts       Markdown ⇔ HTML（見たまま編集の往復）
  ai/types.ts     AiProvider インターフェース。画面はこれだけを呼ぶ
  ai/anthropic.ts Anthropic API。調査（Web検索）→ 構造化 の2段構え
  ai/demo.ts      デモ応答。キーなしの試用と通しテストで使う
  ui/kit.tsx      共通コンポーネント（Button / Pill / Card / PageHead / Segmented）。画面に色や角丸を直接書かない
  ui/             5画面（Shelf / Create / Roadmap / LessonPage / Book）と部品
  styles.css      DESIGN.md のトークンとクラス
tests/            Vitest（データ・守る対象・Markdown往復・AI層）
e2e/              Playwright（完了条件をPC幅とスマホ幅で）
docs/             実装メモ・テスト結果・あとでやること
```

## コマンド

```bash
npm run dev        # 開発サーバー http://localhost:5173/jibun_textbook/
npm run typecheck
npm test           # 単体とAI層
npm run e2e        # 通し。初回は npx playwright install chromium
npm run build      # dist/ を作る
```

## AI層の約束

- 公式SDK `@anthropic-ai/sdk` をブラウザで使う（`dangerouslyAllowBrowser: true`）。モデルIDに日付を付けない
- 調査と構造化は**別リクエスト**。Web検索の結果には出典が常に付き、構造化出力と同じリクエストでは衝突しうる
- `pause_turn` は assistant の内容をそのまま送り返して続行。検索エラーはHTTP 200の中身で分岐（例外にならない）
- 一次情報リンクは、調査で実際に見つけたページからだけ作る。AIが文章中に書いたURLをリンクにしない
- 失敗しても教科書は変えない。理由を日本語で出して、もう一度試せるようにする

## 進め方

- 機能を足したくなったら `docs/backlog.md` に書いて後回しにする
- 変更したら `npm run typecheck && npm test && npm run e2e` を通す

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**自分教科書** — AIが下書きした教材に自分で書き込んで「自分の教科書」に育てるアプリ。PCとAndroidスマホで使用可能。

## 技術構成

- **フロントエンド**: TypeScript + React + Vite
- **UI**: CSS（カスタム、PWA対応）
- **AI層**: Anthropic API のみ（初期段階）
- **ストレージ**: IndexedDB（ローカル）、JSON書き出し
- **検証**: Zod スキーマ

## 主要ファイル構造

```
src/
  types.ts          — Textbook/Chapter/Section/Blockの型定義（Zod）
  db.ts             — IndexedDB操作（保存・読込・削除）
  ai.ts             — Anthropic API ラッパー（確認質問・コース設計）
  App.tsx           — 画面ナビゲーション
  main.tsx          — エントリポイント
  screens/
    Bookshelf.tsx   — 教科書一覧、新規作成、読み込み
    Create.tsx      — 自由入力 → 確認質問 → コース設計
    Roadmap.tsx     — 章×節のタイムライン（PC）/ 縦列表示（スマホ）
    Lesson.tsx      — 見たまま編集、ノート差し込み、完了印
    Textbook.tsx    — 通読表示
```

## 開発コマンド

```bash
npm install           # 依存をインストール
npm run dev           # Vite開発サーバー起動（http://localhost:5173）
npm run build         # 本番ビルド（dist/）
npm run test          # Vitest実行
npm run preview       # ビルド後の動作確認
```

## GitHub Pages デプロイ

- Vite の `base` は `/jibun_textbook/` に設定済み
- GitHub Actions（未設定）でビルド・デプロイ予定
- 環境変数（APIキー）は IndexedDB にのみ保存、JSON書き出しに含めない

## 仕様確認先

- **詳細な要件**: `C:\dev\note\brain\06_briefs\jibun_textbook_2026-09-21.md`
- **UI モック**: `C:\dev\note\brain\01_projects\50_jibun_textbook\30_jibun_textbook_screen_mock.html`
- **アーキテクチャ**: `C:\dev\note\brain\01_projects\50_jibun_textbook\20_jibun_textbook_architecture.md`

## 実装ステータス

### Phase 0（AIなし、手書き教科書作成）

- [ ] **土台**: Vite + PWA セットアップ、GitHub Pages デプロイ通し
- [ ] **データ層**: JSON スキーマ、IndexedDB、書き出し・読み込み、単体テスト
- [ ] **画面**:
  - [ ] 本棚（新規作成、削除、読み込み）
  - [ ] ロードマップ（PC タイムライン / スマホ 縦列、現在地表示）
  - [ ] レッスン（見たまま編集、ノート差し込み、完了・再確認印）
  - [ ] 教科書（通読、絞り込み、書き手印切り替え）
  - [ ] つくる（ただし AI なし）

### Phase 1（AI統合）

- [ ] **接続**: APIキー入力 UI、ブラウザ SDK 初期化
- [ ] **確認質問**: 自由入力 → AI質問生成
- [ ] **コース設計**: 入力 + 回答 → 章・節・所要時間・実践課題
- [ ] **節の生成**: Web検索 + 構造化出力（Markdown ブロック）
- [ ] **設計修正**: 範囲選択 → 差分表示 → 採用（守る対象は機械的に保証）

## 重要な実装ルール

- **見たまま編集**: ブロックをクリック → そのまま編集。エディタライブラリ統合は最大2時間、超えたら Markdown テキスト欄方式に切り替え
- **状態の導出**: 「完了 / 再確認」の印はデータに保持、状態表示は `status` + `done` + `review` から導出
- **守る対象は機械的に**: 「自分のノート」「完了した節」は AI からの変更を自動で無視する
- **検証は必須**: Zod スキーマ、読み込み時の壊れたJSON対応、API キーの安全な取り扱い

## 報告すべき内容（`docs/`）

実装完了後、以下を記録：
- エディタの採用状況（見たまま vs テキスト欄）
- Web 検索ツール型、`pause_turn` 発生有無、トークン数
- 調査・構造化の 2段階構成の是非
- Android での確認内容
- 仕様の曖昧箇所と判断結果

# My Portal

個人用ポータルサイトです。日記（日報）の表示・編集、チェックリスト、メモ、AI チャット（Gemini）などの機能を提供します。タスクは `vault/task/tasks.json` でファイル管理し、AI チャットのツール経由で操作します。

## ディレクトリ構成

work-vault と同じ「portal-app（アプリ）+ vault（データ）」の2階層構成です。

```
my-portal/
├── portal-app/        ← 静的Webアプリ本体（index.html / css / js / partials / data / manifest.json）
├── vault/             ← データ集積場所
│   ├── diary/         ← 日記（当月: YYYY-MM-DD.md / 過去月: YYYY-MM.md に月次まとめ）
│   ├── knowledge/     ← ナレッジ
│   ├── persona/       ← AI ペルソナ（persona.md / avatar.png）
│   ├── task/          ← タスク・メモ（tasks.json / memo.md）
│   ├── docs/adr/      ← ADR（設計記録）
│   └── config.json    ← アプリ設定（クイックリンク等）
└── index.html         ← 旧URL → portal-app/ へのリダイレクト
```

- **日記の月次まとめ運用**: 月が終わったら日別ファイルを `YYYY-MM.md`（`## YYYY年M月D日` 見出し・`---` 区切り）に統合し、日別ファイルは削除する。

- 公開URLは `…/my-portal/portal-app/` です（旧 `…/my-portal/` からは自動転送）。ホーム画面に追加済みの場合は開き直すと転送されます。

## セットアップ

1. **GitHub Personal Access Token（PAT）** を取得します（`repo` スコープ + Actions write が必要）。
2. リポジトリ名・ブランチは `portal-app/data/portal-config.json` の `repo` / `branch` で設定します。
3. ポータルを開き、右上の ⚙️ 設定ボタンから PAT を入力して保存します。
4. 必要に応じて Gemini API キーを設定すると AI チャット機能が利用できます。

## 機能

- 📄 **日報** — 当日の日記ファイル（`vault/diary/YYYY-MM-DD.md`）を表示・編集。「↻ 日記を再生成」で GitHub Actions（daily-report.yml）からテンプレート付きで生成
- ✅ **デイリーチェックリスト** — `portal-app/data/portal-config.json` の `dailyTasks` を毎日のチェックリストとして表示し、日記に反映
- 📝 **メモ** — `vault/task/memo.md` を主題ごとのカード（`## 見出し` 単位）で管理。「MD」ボタンで全文編集にも切替可
- 📌 **タスク** — `vault/task/tasks.json` をAIチャットのツール（get_tasks / add_task / update_task）経由で管理
- 🔗 **クイックリンク** — よく使うサービスへのショートカット（並び替え・追加対応、`vault/config.json` に保存）
- 🤖 **AI チャット** — Gemini（Function Calling 対応）を使ったコーチング・秘書機能。ペルソナは `vault/persona/persona.md` で定義
- 📔 **振り返り** — 日報をもとに AI が振り返りコメントを生成

## ネットワークエラーについて

各機能で「ネットワークエラー」と表示される場合、以下の原因が考えられます。

| 原因 | 対処方法 |
|------|----------|
| GitHub PAT が未設定または無効 | ⚙️ 設定から PAT を再登録してください |
| リポジトリ名が間違っている | `portal-app/data/portal-config.json` の `repo` を確認してください |
| PAT のスコープ不足 | `repo` スコープと Actions write 権限を付与してください |
| オフライン状態 | ネットワーク接続を確認してください |
| Gemini API キーが無効 | ⚙️ 設定で API キーを確認してください |

## PWA 対応

このポータルは PWA（Progressive Web App）として動作します。ブラウザの「ホーム画面に追加」からアプリとしてインストールできます。

## レイアウトFW試験導入（Tailwind PoC）

- Tailwind は **CDN版を最小導入** しています（ビルド工程なし）。

- 現在の適用範囲は **`.layout` / `header` / `card` / `main-tabs` / `report-tabs` のレイアウト・外枠** です。
	- モバイル: 1カラム
	- タブレット: 2カラム
	- デスクトップ: `380px 1fr 285px`
- 既存の `css/*.css` はそのまま併用し、段階的移行できる構成です。

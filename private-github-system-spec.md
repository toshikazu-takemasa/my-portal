# プライベート GitHub 活用システム 仕様書

作成日: 2026-03-02

---

## 1. 目的・背景

| 項目 | 内容 |
|------|------|
| 目的 | GitHub を個人のタスク管理・日々の記録の中心に据え、マルチデバイスで運用する |
| 現状 | Backlog でタスク管理、`docs/` に静的ポータル（GitHub Pages） |
| 変更点 | Backlog 廃止 → GitHub Issues/Projects に一本化。認証付き公開ページを整備 |

---

## 2. リポジトリ構成

### 2-1. 新規個人リポジトリを作成（推奨）

> 現リポジトリは `sprocket-inc` 組織配下のため、プライベート用途は**別リポジトリ**に分離する。

```
GitHub アカウント: 個人アカウント (例: ttakemasa)
リポジトリ名    : private-workspace
可視性          : Public（GitHub Pages 無料枠利用のため）
                  ※ 認証で保護するため Public でも機密情報は載せない
```

### 2-2. トップレベルフォルダ構成

```
private-workspace/
├── docs/                    # GitHub Pages（公開ポータル）← 現 docs/ を移植
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── data/
├── 保管庫/                   # Markdown 記録（非公開コンテンツ）
│   ├── 日報/                # 日次記録
│   ├── タスク/              # タスクメモ（Issues の補完）
│   ├── ナレッジ/            # 学習・知識蓄積
│   └── プロジェクト/        # プロジェクト別メモ
├── .github/
│   ├── ISSUE_TEMPLATE/      # Issue テンプレート
│   └── workflows/           # GitHub Actions
└── README.md
```

---

## 3. タスク管理（Backlog 代替）

### 3-1. GitHub Issues + Projects を利用

| Backlog 機能 | GitHub 代替 |
|-------------|-------------|
| 課題 | Issues |
| マイルストーン | Milestones |
| カテゴリ/種別 | Labels |
| ダッシュボード | GitHub Projects (Board/Table view) |
| 担当者 | Assignees (自分のみ) |
| 優先度 | Labels: `P1` `P2` `P3` |

### 3-2. Label 設計

```
# ステータス（自動化可）
status: todo
status: in-progress
status: done

# 種別
type: task       # 通常タスク
type: learning   # 学習
type: idea       # アイデア・メモ
type: private    # 完全プライベート

# 優先度
P1  # 高（今日中）
P2  # 中（今週中）
P3  # 低（いつか）

# 領域
area: work       # 仕事関連
area: personal   # プライベート
area: health     # 健康・習慣
```

### 3-3. Issue テンプレート

**タスク用 (.github/ISSUE_TEMPLATE/task.md)**
```markdown
---
name: タスク
about: 日常タスクの登録
labels: 'status: todo, type: task'
---

## 概要
<!-- 何をするか -->

## 完了条件
- [ ]

## メモ
```

### 3-4. GitHub Projects 設定

- **View 1: ボード** — status ラベルをカラム代わりに使用（Todo / In Progress / Done）
- **View 2: テーブル** — 期限・優先度でソート、週次タスク確認用
- **View 3: カレンダー** — 締切日ベースの見通し

---

## 4. マルチデバイス対応

### 4-1. スマートフォン

| 用途 | 手段 |
|------|------|
| タスク確認・登録 | **GitHub Mobile アプリ** (iOS/Android) |
| 日報・メモ閲覧 | ポータルページ（ブラウザ） |
| 日報・メモ編集 | GitHub Mobile の Markdown 編集 or Working Copy (iOS) |
| Issues 操作 | GitHub Mobile |

### 4-2. PC（既存）

| 用途 | 手段 |
|------|------|
| コーディング・記録 | VS Code + Claude Code（現状維持） |
| ポータル閲覧 | ブラウザ |
| Issues/Projects | GitHub Web UI |

---

## 5. 認証・アクセス制御

> ポータルページ（GitHub Pages）は Static Site のため、サーバー側認証が不可。
> 以下の方法を組み合わせて多段防御する。

### 方針: 2段階認証

```
[アクセス] → [第1段: Cloudflare Access] → [第2段: ページ内パスフレーズ]
```

---

### 5-1. 第1段: Cloudflare Access（Google アカウント認証）

**概要**
- 独自ドメイン（または pages.dev）に Cloudflare でリバースプロキシを設置
- Google OAuth でログインした人だけが通過できる

**設定手順**
1. Cloudflare アカウント作成（無料）
2. ドメイン追加（または Cloudflare Pages 利用）
3. `Zero Trust > Access > Applications` でアプリ作成
4. Identity Provider に Google を追加
5. ポリシー: `Email is ttakemasa@xxxx.com`（自分のGoogleアカウントのみ許可）

**コスト**: 無料（Zero Trust 無料枠: 50ユーザーまで）

---

### 5-2. 第2段: クライアント側パスフレーズ（オプション）

> Cloudflare Access のみでも十分だが、追加で JS ベースのパスフレーズを設けることも可能。

```javascript
// docs/js/auth.js
const PASS_HASH = 'sha256_of_your_passphrase';

function checkAuth() {
  const stored = localStorage.getItem('portal_auth');
  if (stored !== PASS_HASH) {
    const input = prompt('パスフレーズを入力してください');
    if (sha256(input) !== PASS_HASH) {
      document.body.innerHTML = '<p>アクセスできません</p>';
      return;
    }
    localStorage.setItem('portal_auth', PASS_HASH);
  }
}
```

**注意**: JS の難読化は完全ではないため、Cloudflare Access を主防線とする。

---

### 5-3. 認証レイヤーまとめ

| レイヤー | 技術 | 難易度 | 強度 |
|---------|------|--------|------|
| ① URL の秘匿 | GitHub リポジトリ名を推測しにくくする | ★☆☆ | 弱 |
| ② Cloudflare Access | Google アカウント認証 | ★★☆ | 強 |
| ③ JS パスフレーズ | localStorage チェック | ★☆☆ | 中（補助） |

---

## 6. ポータルページ（docs/）の機能拡張

現在の `docs/` をベースに以下を追加・改善する。

### 6-1. 追加機能

| 機能 | 概要 |
|------|------|
| **タスクウィジェット** | GitHub Issues の今日・今週タスクを表示 |
| **日報リンク** | 当日の日報ファイルへワンクリックで遷移 |
| **Habits トラッカー** | チェックボックス式の習慣管理 |
| **クイックメモ** | Issue を素早く作成（タイトルだけ入力して送信） |

### 6-2. スマホ最適化

- ボトムナビゲーション（タスク / 記録 / メモ / 設定）
- タップ領域を 44px 以上に統一
- PWA 対応（ホーム画面に追加可能）

---

## 7. 日報・記録管理

現在の `日記/` 運用を継続しつつ以下を整備。

### 7-1. ファイル命名規則（変更なし）

```
YYYY-MM-DD_曜日_日報.md
```

### 7-2. スマホからの日報作成

**方法A: GitHub Mobile**
- リポジトリ > 日記/ > ファイル作成（`.md`）
- テンプレートをコピー&ペーストして記入

**方法B: GitHub Actions（自動生成）**
- 毎朝 7:00 に日報ファイルを自動生成するワークフロー
- テンプレートから当日ファイルを作成して push

```yaml
# .github/workflows/daily-report.yml
name: 日報自動生成
on:
  schedule:
    - cron: '0 22 * * *'  # JST 7:00
  workflow_dispatch:       # 手動実行も可

jobs:
  create-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 日報ファイル生成
        run: |
          DATE=$(TZ=Asia/Tokyo date +%Y-%m-%d)
          DAY=$(TZ=Asia/Tokyo date +%A)
          FILE="日記/${DATE}_${DAY}_日報.md"
          cp "日記/日報テンプレート.md" "$FILE"
          sed -i "s/{{DATE}}/$DATE/g" "$FILE"
          git config user.email "action@github.com"
          git config user.name "GitHub Actions"
          git add "$FILE"
          git commit -m "📅 日報作成: $DATE" || echo "既存"
          git push
```

---

## 8. 実装ロードマップ

### Phase 1: リポジトリ・基盤整備（1週間）

- [ ] 個人アカウントに `private-workspace` リポジトリ作成
- [ ] 現 `docs/` を移植
- [ ] GitHub Issues ラベル設計・作成
- [ ] GitHub Projects 設定（ボード・テーブル）
- [ ] Issue テンプレート作成

### Phase 2: 認証設定（1日）

- [ ] Cloudflare アカウント作成
- [ ] Cloudflare Pages or ドメイン設定
- [ ] Cloudflare Access + Google OAuth 設定
- [ ] 動作確認（スマホ・PC）

### Phase 3: ポータル拡張（1週間）

- [ ] タスクウィジェット追加（GitHub Issues API）
- [ ] PWA 対応（manifest.json + Service Worker）
- [ ] スマホ向け UI 最適化
- [ ] クイックメモ（Issue 作成）機能

### Phase 4: 自動化（随時）

- [ ] 日報自動生成 Actions
- [ ] 週次タスクサマリー通知（GitHub → メール or Slack）
- [ ] Backlog からのデータ移行

---

## 9. 考慮事項・注意点

### セキュリティ

- **GitHub Pages に機密情報を直接置かない** — APIキー・個人情報はリポジトリの Secrets か非公開ファイルに
- **`保管庫/` の内容** — リポジトリが Public の場合は全世界に公開される。機密性の高い情報は記載しないか、Private リポジトリ（有料 or 個人アカウント無料枠）を使用

### Public vs. Private リポジトリの判断

| 条件 | 推奨 |
|------|------|
| 日報・メモに個人情報なし | Public（GitHub Pages 無料）|
| 日報・メモに個人情報あり | Private（GitHub Pages は有料プランが必要）|
| 独自ドメインで Cloudflare Pages 利用 | Public のまま Cloudflare で保護 |

### Backlog からの移行

- 進行中タスク → GitHub Issues に手動移行（ラベル付与）
- 完了済みタスク → アーカイブとして `保管庫/タスク/` に Markdown で保存
- スプリント・マイルストーン → GitHub Milestones に変換

---

## 10. 次のアクション（今すぐできること）

1. **個人 GitHub アカウントを確認** → `private-workspace` リポジトリを作る
2. **Cloudflare アカウント作成** → Zero Trust の設定
3. **GitHub Mobile をスマホにインストール** → 動作確認
4. **本仕様書をベースに Phase 1 から着手**

---

*この仕様書自体を GitHub Issues 化して進捗管理してもよい。*

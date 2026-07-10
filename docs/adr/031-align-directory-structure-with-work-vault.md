# ADR 031: ディレクトリ構造を work-vault と統一する

**日付**: 2026-07-10
**状態**: 採用

## コンテキスト

業務用ワークスペース（work-vault）は「portal-app（静的Webアプリ）+ vault（データ）」の
2階層構成を採っている。一方 my-portal はアプリ本体（index.html / css / js / partials / data）が
リポジトリ直下に散在しており、2つのポータルでメンタルモデルが揃っていなかった。

## 決定

my-portal も work-vault と同じ2階層構成に統一する。

1. **アプリ本体を `portal-app/` へ移動**
   - index.html / css/ / js/ / partials/ / data/ / manifest.json
   - リポジトリ直下には旧URL → `portal-app/` への自動リダイレクト用 index.html を置く
2. **vault 内のタスク系データを `vault/task/` に集約**（work-vault の `vault/task/` と対応）
   - `vault/memo.md` → `vault/task/memo.md`
   - `vault/tasks.json` → `vault/task/tasks.json`

## 影響

- **公開URL**: `…/my-portal/` → `…/my-portal/portal-app/` に変更。
  旧URLはリダイレクトで維持（インストール済みPWAも開き直せば転送される）
- **相対パス修正**: app.js の persona 読込（`../vault/…`）、avatar 参照（`../docs/images/…`）、
  persona.md frontmatter の avatarUrl
- **リポジトリ内パス修正**: MEMO_PATH / TASKS_PATH（GitHub API パスは repo 相対のため task/ 配下に更新）
- **GitHub Pages**: deploy-pages.yml はリポジトリ全体をアップロードするため変更不要
- ADR 030 が記す `vault/tasks.json` は `vault/task/tasks.json` に読み替える（本ADRが上書き）

## 代替案

- **work-vault 側を my-portal に合わせる**: work-vault の構成は CLAUDE.md・各スキルが
  前提とする標準構成のため却下
- **リダイレクトなしで移動**: ホーム画面追加済みのPWAが開けなくなるため却下

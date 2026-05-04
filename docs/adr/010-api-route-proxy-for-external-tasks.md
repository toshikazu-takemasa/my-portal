# ADR-010: 外部タスク取得を Next.js API Route 経由で行う

日付: 2026-04-12
状態: 採用

## 背景

ADR-009 で `TaskIntegrationProvider` インターフェースを定義し、外部 SaaS（Backlog / GitHub Issues）への
呼び出しを `src/domains/task/integrations/` に集約した。

しかし現状の `BacklogProvider` は `getSettings()`（localStorage）で認証情報を解決するため、
すべての外部 API 呼び出しがブラウザから直接行われている:

- Backlog API キーがブラウザの Network タブに露出する
- GitHub PAT がブラウザから直接 `api.github.com` に送信される
- CORS 設定が各外部サービスに依存する

また `/issues` ページが存在しないため `github-issues` アプリを有効化しても 404 になる。

## 検討した選択肢

1. **現状維持**（クライアントから直接外部 API を呼ぶ）
2. **Next.js API Route をプロキシとして使う**（クライアント → `/api/tasks/[source]` → 外部 API）
3. **Provider を Server Component / サーバーサイドでのみ呼ぶ**（Next.js App Router が前提）

## 決定

**Next.js API Route をプロキシとして使う（選択肢2）を採用する。**

- `pages/api/tasks/backlog.ts` — Backlog API プロキシ
- `pages/api/tasks/github.ts` — GitHub Issues API プロキシ

クライアント（ページ）は localStorage から認証情報を読み、`POST /api/tasks/[source]` に送信する。
API Route がサーバーサイドで外部サービスを呼び出し、`UnifiedTask[]` を返す。

## データフロー

```
ブラウザ (page)
  → localStorage から認証情報を読む
  → POST /api/tasks/backlog  { spaceId, apiKey }
       → [サーバー] Backlog REST API を呼び出す
       ← UnifiedTask[]
  ← タスク一覧を表示する
```

## 理由

- 外部 API キー・PAT がブラウザの Network タブに外部ドメインへの直接リクエストとして現れない
- CORS エラーを回避できる（サーバーサイドに CORS 制約はない）
- `/api/summarize.ts` で既に確立している「credentials をリクエストボディで渡す」パターンと一貫性がある
- App Router への移行前に最小変更で実現できる

## 実装方針

1. `pages/api/tasks/backlog.ts` を新規作成し、POST body `{ spaceId, apiKey }` を受け取って Backlog API を叩く
2. `pages/api/tasks/github.ts` を新規作成し、POST body `{ pat, repo }` を受け取って GitHub Issues API を叩く
3. `GithubProvider`（`src/domains/task/integrations/github.ts`）を実際に実装する
4. `pages/backlog.tsx` を `getBacklogIssues()` 直呼びから `POST /api/tasks/backlog` に変更する
5. `pages/issues.tsx` を新規作成して 404 を解消する

## 返却型

API Route はすべて `UnifiedTask[]`（ADR-008 で定義）に正規化して返す。
ソース固有の詳細（Backlog issueKey、GitHub URL）は `externalRef.key` / `externalRef.url` で補完する。

## トレードオフ・リスク

- クライアントがリクエストボディで認証情報を送信するため、HTTPS が必須（本番は必ずHTTPS）
- localStorage の認証情報は依然ブラウザに保存される（このアプリの性質上許容）
- Providers（`BacklogProvider` 等）はオーケストレーターからの直接呼び出し用として残す（二重管理）

## 将来の再評価タイミング

Next.js App Router + Server Components に移行した場合は、
API Route プロキシを廃止して Provider をサーバー側で直接呼び出す構成に変更する。

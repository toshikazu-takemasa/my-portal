# ADR-009: 外部連携を統一 Provider インターフェースで管理する

日付: 2026-04-11  
状態: 採用

## 背景

外部サービス連携（Backlog / Google Calendar / GitHub Issues）が現状バラバラに実装・設計されている:

- Backlog: `domains/ai` に直接 fetch、認証情報は `Profile` トップレベルに平置き
- Google Calendar: 未実装
- GitHub Issues: 未実装
- `StorageAdapter` は自前データ永続化に特化しており、外部 SaaS 呼び出しを扱う設計になっていない

## 検討した選択肢

1. **都度 fetch を各ドメインに書く**（現行 Backlog の延長）
2. **StorageAdapter に外部 SaaS メソッドを追加する**
3. **外部連携専用の Provider インターフェースを別途定義する**

## 決定

**外部連携専用 Provider インターフェースを別途定義する（選択肢3）を採用する。**

`StorageAdapter` は自前データ永続化（journal / config / finance）に集中させ、
外部 SaaS 呼び出しは `src/domains/task/integrations/` 配下の provider として定義する。

## 概念設計

```typescript
// src/domains/task/integrations/interface.ts
interface TaskIntegrationProvider {
  readonly sourceId: UnifiedTaskSource
  isConfigured(): boolean
  fetchTasks(query: TaskQuery): Promise<UnifiedTask[]>
}

// 実装
// src/domains/task/integrations/backlog.ts  → BacklogProvider implements TaskIntegrationProvider
// src/domains/task/integrations/calendar.ts → CalendarProvider implements TaskIntegrationProvider（stub）
// src/domains/task/integrations/github.ts   → GithubProvider implements TaskIntegrationProvider（stub）
```

認証情報は `getSettings().installedApps.find(a => a.appId === ...).settings` 経由で取得し、
`Profile` 直置きフィールド（`backlog_space_id` 等）は互換レイヤー期間中のフォールバックとして残す。

## 理由

- `StorageAdapter` に SaaS API 呼び出しを混在させると D1 移行時の差し替え境界が曖昧になる
- 統一インターフェースにより新しい外部連携追加時のボイラープレートが最小化される
- プロバイダを Task Orchestrator に渡す設計にすることで、テスト・モック・無効化が容易になる
- 認証情報の管理場所を app settings namespace に統一し、`Profile` の肥大化を防ぐ（ADR-007 と連携）

## 実装方針

1. `TaskIntegrationProvider` インターフェースを `src/domains/task/integrations/interface.ts` に定義する
2. `BacklogProvider` を `src/domains/task/integrations/backlog.ts` として実装し既存 fetch を移行する
3. `CalendarProvider` / `GithubProvider` は `isConfigured(): false` の stub として先行作成する
4. Task Orchestrator が `providers[]` を受け取る設計にし、`isConfigured()` が true のものだけ呼び出す
5. 認証情報の取得は provider 内部で `getSettings().installedApps` → `Profile` フィールドの順でフォールバックする

## 初期フェーズの同期方向

Google Calendar と GitHub Issues は **read-only（取得のみ）** から開始する。
双方向同期（完了操作・予定作成）は独立ユースケースとして別フェーズで扱う。

## トレードオフ・リスク

- Provider が増えると Orchestrator の並列呼び出し管理が複雑化するため `Promise.allSettled` + タイムアウトを設計に含める
- 各 provider が独立して認証エラーを返す場合、UI でどの連携が失敗したかを明示する必要がある

## 将来の再評価タイミング

書き込み系操作（Backlog 課題完了・Google Calendar 予定作成）が必要になった場合。

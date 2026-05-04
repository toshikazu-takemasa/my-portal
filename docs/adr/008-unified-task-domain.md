# ADR-008: タスク管理を単一ドメインに統合する

日付: 2026-04-11  
状態: 採用

## 背景

タスクに相当する概念が複数ドメインに分散しており、統合ビューが存在しない:

- `dailyTasks` / `pillars` は `src/domains/task` に存在するが、完了状態は localStorage のみ
- Backlog 課題取得は `src/domains/ai` に混在している（責務違反）
- Google Calendar 予定と GitHub Issues は未実装だが同カテゴリとして統合が求められる
- 「今日のタスクを一覧で確認する」ユースケースに応える画面・ドメインロジックがない

## 検討した選択肢

1. **現状維持**（Backlog ページ・Checklist ページを独立に継続）
2. **タスク集約ドメインへ統合**（複数ソースを UnifiedTask に正規化）
3. **新しいオーケストレーターページを追加のみ**（ドメイン再編せず表示統合のみ）

## 決定

**タスク集約ドメインへ統合（選択肢2）を採用する。**

`src/domains/task` を Task の唯一の集約境界とし、ソースごとのサブモジュールを配置する。
AI ドメインからの Backlog 取得責務を Task ドメインへ移動する。

## 概念設計

```typescript
// src/shared/types.ts に追加
type UnifiedTaskSource = 'daily' | 'backlog' | 'calendar' | 'github'
type UnifiedTaskStatus = 'open' | 'in_progress' | 'completed' | 'resolved'
type UnifiedTaskPriority = 'low' | 'medium' | 'high'

interface UnifiedTask {
  id: string
  source: UnifiedTaskSource
  title: string
  status: UnifiedTaskStatus
  dueDate?: string
  priority?: UnifiedTaskPriority
  externalRef?: { key: string; url?: string }
  labels?: string[]
}

interface TaskQuery {
  date?: string                    // YYYY-MM-DD（省略時は today）
  sources?: UnifiedTaskSource[]
}

// src/domains/task/ の構成
// ├─ checklist.ts      getDailyTaskTemplate / getPillars / get/saveTodayChecklist / getDailyTasksAsUnified
// ├─ orchestrator.ts   getTodayTasks(query, providers): UnifiedTask[]
// ├─ integrations/
// │   ├─ interface.ts  TaskIntegrationProvider
// │   ├─ backlog.ts    BacklogProvider + getBacklogIssues（後方互換）
// │   ├─ calendar.ts   CalendarProvider（stub）
// │   └─ github.ts     GithubProvider（stub）
// └─ index.ts          re-export
```

## 理由

- Backlog 取得が AI ドメインにある状態は DDD Lite の責務定義上の誤配置
- 複数ソース統合はオーケストレーター1箇所で管理することで重複排除・優先順の制御が可能
- 各サブモジュールを同一ファイル構造に置くことで Google Calendar / GitHub Issues 追加時の変更箇所が明確になる
- AI ドメインを「生成・要約・分析」に限定することで今後の责務拡張が安全になる

## 実装方針

1. `BacklogIssue` 型と `getBacklogIssues` 関数を `src/domains/task/integrations/backlog.ts` へ移動する
2. `src/domains/ai/index.ts` の Backlog 取得コードを削除し、import を更新する
3. `UnifiedTask` / `TaskQuery` 型を `src/shared/types.ts` に追加する
4. `src/domains/task/orchestrator.ts` を新規作成し `getTodayTasks()` を実装する
5. `pages/backlog.tsx` の import を `@/domains/task/integrations/backlog` から取得するよう変更する
6. Google Calendar / GitHub Issues は `isConfigured(): false` の stub として先行作成する

## トレードオフ・リスク

- Orchestrator が多ソースに依存するため、1ソース障害時に他ソースも遅延しないよう `Promise.allSettled` を使う
- `UnifiedTask` への正規化でソース固有の詳細情報（Backlog のプロジェクト等）が失われる場合は `externalRef` で補完する

## 将来の再評価タイミング

タスクの書き込み（Backlog 課題作成・完了操作）が必要になった場合は Command 系メソッドを追加して再評価する。

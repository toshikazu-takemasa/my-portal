# ADR-014: 仕事用Portalのユースケース定義とBacklogアプリ追加

日付: 2026-04-14  
状態: 採用

## 背景

これまでのADRはいずれも技術的決定を対象としており、
「誰が・何のために Portal を使うか」のユースケース定義が不足していた。

現状、仕事プロファイル（work profile）で想定されるユースケースが明文化されていないため、
実装の優先度判断・機能スコープの合意基準が曖昧になっている。

また、ADR-007〜010 で設計した AppCatalog / TaskIntegrationProvider / API Route Proxy の
各基盤は整ったが、**Backlog アプリが AppManifest として正式に登録されておらず**、
`pages/backlog.tsx` は旧実装のまま残っている。

## 決定

1. **仕事用Portalのユースケースを本ADRで定義し、実装優先度の基準とする**
2. **Backlogアプリを AppCatalog の最初の "work" カテゴリアプリとして実装する**

## 仕事用PortalのユースケースカタログU

| UC# | ユースケース | 主アクター | 優先度 | 対応アプリ |
|-----|-------------|-----------|--------|-----------|
| UC-W01 | 今日のBacklog課題を一覧確認する | 開発者 | **高** | backlog |
| UC-W02 | 課題の進捗を業務日記に反映する | 開発者 | **高** | backlog + journal |
| UC-W03 | GitHubのオープンイシューを確認する | 開発者 | 中 | github-issues |
| UC-W04 | Googleカレンダーの今日の予定を確認する | 全ユーザー | 中 | google-calendar |
| UC-W05 | 業務チェックリストの進捗を管理する | 全ユーザー | 中 | checklist |
| UC-W06 | AIに業務メモを要約・フィードバックさせる | 全ユーザー | 低 | ai-chat |
| UC-W07 | 週次振り返りを日記に記録する | 全ユーザー | 低 | journal |

**フェーズ1実装対象: UC-W01・UC-W02**

## Backlogアプリの設計

### AppManifest 定義

```typescript
// src/apps/registry.ts
{
  id: 'backlog',
  label: 'Backlog',
  icon: '📋',
  category: 'work',
  capabilities: ['task', 'external-integration'],
  defaultEnabled: false,
  requiredSettings: ['spaceId', 'apiKey'],
}
```

### アーキテクチャ（ADR-007〜010 の構成を踏襲）

```
pages/backlog.tsx
  └── POST /api/tasks/backlog  { spaceId, apiKey }
        └── pages/api/tasks/backlog.ts  （API Route プロキシ）
              └── BacklogProvider.fetchTasks()
                    └── Backlog REST API
                          ↓
              UnifiedTask[]  を返す
```

### BacklogProvider の実装場所

```
src/domains/task/integrations/
  ├── interface.ts     TaskIntegrationProvider（既存）
  ├── backlog.ts       BacklogProvider（移行・完成）
  ├── calendar.ts      CalendarProvider（stub）
  └── github.ts        GithubProvider（stub）
```

認証情報の解決順序:
1. `getSettings().installedApps.find(a => a.appId === 'backlog').settings`
2. フォールバック: `Profile.backlog_space_id` / `Profile.backlog_api_key`（互換レイヤー期間中）

### 日記への反映（UC-W02）

ADR-013 の `upsertJournalSection()` を使い、セクションヘッダー `## Backlog（YYYY-MM-DD）` で upsert する。
チェックリストの「日記に反映」と同じパターン。

```
## Backlog（2026-04-14）

- [ ] SPR-123 ○○機能の実装
- [x] SPR-456 バグ修正
```

## 他ユースケースの実装方針（中〜低優先度）

### UC-W03: GitHub Issues（中）

- `GithubProvider` は stub が存在する（ADR-009）
- `pages/issues.tsx` を新規作成（ADR-010 で言及済み）
- `AppManifest` に `github-issues` を追加する

### UC-W04: Google Calendar（中）

- `CalendarProvider` stub が存在する（ADR-009）
- OAuth2 フローが必要なため、認証設計を別ADRで決定する

### UC-W05: 業務チェックリスト（中）

- `pages/checklist.tsx` は既存
- work プロファイルでは「work専用テンプレート」を読む分岐のみ追加

### UC-W06/W07: AI要約・週次振り返り（低）

- 現行 AI ドメインで対応可能。追加設計不要。

## 実装手順（UC-W01・UC-W02）

1. `src/apps/registry.ts` に `backlog` AppManifest を追加する
2. `src/domains/task/integrations/backlog.ts` を整備し `BacklogProvider` を完成させる
3. `pages/api/tasks/backlog.ts` を新規作成（API Route プロキシ）
4. `pages/backlog.tsx` を `POST /api/tasks/backlog` 呼び出しに差し替える
5. 「日記に反映」ボタンを追加し `upsertJournalSection()` で `## Backlog（date）` セクションを upsert する
6. フィーチャーフラグ: `if (!isFeatureEnabled('backlog')) return null`

## トレードオフ

| 観点 | 内容 |
|------|------|
| 認証情報のブラウザ保存 | localStorage に spaceId / apiKey を保管（ADR-010 と同じ許容判断） |
| UC網羅性 | 中〜低優先度UCは後続ADRで個別判断。本ADRはカタログ定義のみ |
| Backlog書き込み（課題完了操作等） | 現フェーズは read-only。書き込みは UC-W08 以降として将来ADRで扱う |

## 将来の再評価タイミング

- UC-W03（GitHub Issues）実装着手時
- Google Calendar の OAuth2 設計が決まった時
- Backlog 課題の完了操作（書き込み）が必要になった時

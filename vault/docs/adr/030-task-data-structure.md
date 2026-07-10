# ADR-030: リポジトリ内でのタスク管理データ構造

## ステータス
承認済み (Accepted)

## コンテキスト
従来、タスク管理には GitHub Issues を利用していたが、データのポータビリティ向上、AIによる一括操作の容易化、および「リポジトリを唯一の正（Single Source of Truth）」とする方針（ADR-028/029）に基づき、リポジトリ内の JSON ファイルでの管理に移行する。

## 決定事項
`vault/tasks.json` を主ストレージとし、以下の構造を採用する。

### 1. ファイルパス
`vault/tasks.json`

### 2. データ構造 (JSON)
```json
{
  "tasks": [
    {
      "id": "uuid-or-timestamp",
      "title": "タスク名",
      "status": "todo | doing | done",
      "priority": "P1 | P2 | P3",
      "labels": ["work", "personal"],
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "closedAt": "ISO-8601 | null",
      "dueDate": "YYYY-MM-DD | null",
      "description": "詳細メモ"
    }
  ],
  "lastSync": "ISO-8601"
}
```

### 3. 管理ルール
- **ID**: 重複しない一意のID（作成時のタイムスタンプ等）を付与する。
- **ステータス遷移**: `todo` -> `doing` -> `done` の基本遷移に加え、不要なタスクは削除または `archived` 状態とする。
- **同期**: `GitHubStorage` を介してファイル全体を読み書きする。

## 意図される結果
- オフラインでの閲覧が可能になる（IndexedDB等へのキャッシュ時）。
- AIチャットから「期限が近い順にタスクを表示して」といった柔軟なクエリが、Issue APIの制限を受けずに高速に実行できる。
- GitHub以外のプラットフォームへの移行が容易になる。

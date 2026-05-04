# ADR-013: 日記セクションの差分登録（upsertJournalSection）

日付: 2026-04-14  
状態: 採用

## 背景

ADR-012 で導入した `appendToJournal()` は、呼び出すたびに日記の末尾へスニペットを追記する。
このため「日記に反映」ボタンを複数回押した場合（進捗ごとの中間押し、押し直しなど）、
同じセクション（`## タスク（date）`）が重複して挿入される問題があった。

ユースケースとして、進捗途中でボタンを押し、後で追加タスクを完了してから再度押す操作が
想定されており、その際は**最新の完了状態で既存セクションを上書きする**（差分登録）動作が求められた。

## 決定

**日記内に同一セクションヘッダーが既に存在する場合は追記でなく置換する `upsertJournalSection()` を導入する。**

- `appendToJournal()` は既存 API として残す（他の用途・後方互換のため）
- チェックリストの「日記に反映」は `appendToJournal()` → `upsertJournalSection()` に差し替える

## アーキテクチャ

```
pages/checklist.tsx
  └── upsertJournalSection(date, snippet, `## タスク（date）`)
        └── src/domains/journal/index.ts
              ├── upsertSection(currentContent, snippet, sectionHeader)  ← 純粋関数
              └── StorageAdapter.saveJournal() 経由で保存
```

### upsertSection の置換ロジック

1. `currentContent` 内で `sectionHeader`（例: `## タスク（2026-04-14）`）を検索
2. **見つからない場合**: `currentContent + snippet`（追記。`appendToJournal` と同じ動作）
3. **見つかった場合**:
   - `blockStart` = sectionHeader より前にある最後の `\n---\n`（なければ先頭）
   - `blockEnd`   = sectionHeader より後にある最初の `\n---\n`（なければ末尾）
   - `content[blockStart..blockEnd]` を `snippet` で置換

```
置換前:
  ...前のコンテンツ...
  \n---\n\n## タスク（2026-04-14）\n\n- [x] item1\n
  \n---\n\n## 家計（2026-04）\n...

置換後（snippet = 完了8項目）:
  ...前のコンテンツ...
  \n---\n\n## タスク（2026-04-14）\n\n- [x] item1\n- [x] item2\n...（8項目）
  \n---\n\n## 家計（2026-04）\n...
```

### SHA 競合リトライ

`upsertJournalSection()` は `appendToJournal()` と同様に 409 時に最新 SHA で1回リトライする。
`upsertSection()` は純粋関数のため、リトライ時も再取得した最新コンテンツに対して適用される。

## DDD Lite 準拠

- `upsertSection()` は `@/shared/types` に依存しない純粋な文字列操作
- `upsertJournalSection()` は `StorageAdapter` 経由のみ（直接 fetch なし）
- UI 層（`pages/checklist.tsx`）が呼び出し元（許可されている）

## トレードオフ

| 観点 | 内容 |
|------|------|
| read-modify-write | `appendToJournal()` と同じく GitHub API を2回呼ぶ。現フェーズでは許容範囲 |
| セクション識別 | `\n---\n` をセクション区切りとして使用する。`---` を本文中に書くと誤動作する可能性がある |
| 複数ソースの競合 | チェックリストと Backlog を同時に反映した場合、片方が 409 リトライで他方のセクションを上書きしない（`upsertSection` はヘッダー単位で絞るため安全） |

## 将来の再評価タイミング

- D1 移行時は `StorageAdapter.saveJournal()` の実装差し替えのみで対応可
- Backlog・GitHub Issues の「日記に反映」実装時も同じ `upsertJournalSection()` を使う
- セクション区切りを `---` 以外に変える場合は `upsertSection()` の `sep` 定数を変更する

# ADR-021: 日記反映におけるセクション重複の防止（重複から上書きへ）

日付: 2026-04-23  
状態: 提案

## 背景

ADR-013 で導入された `upsertJournalSection()` により、チェックリストの日記反映は上書き（重複防止）が実現されている。しかし、Backlog および GitHub Issues の反映において以下の問題が発生し、反映のたびに日記の内容が重複して増え続けてしまう事象が報告された。

1. **GitHub Issues**: 依然として `appendToJournal()` を使用しており、常に末尾に追記される。
2. **Backlog**: `upsertJournalSection()` を使用しているが、検索対象のヘッダー名（`## Backlog（...）`）と実際に生成される Markdown 内のヘッダー名（`## タスク（...）`）が一致していないため、既存セクションが検出されず追記扱いになる。

## 決定

**すべてのタスク系反映において `upsertJournalSection()` を正しく使用し、既存セクションを上書きする動作に統一する。**

### 1. セクションヘッダーの分離

現状、`buildTaskReflectionMarkdown()` が `## タスク（...）` という固定ヘッダーを生成している。これを各ソース（Checklist, Backlog, GitHub）ごとに独立したセクションとして扱えるよう変更する。

- **チェックリスト**: `## タスク（YYYY-MM-DD）` （既存維持）
- **Backlog**: `## Backlog（YYYY-MM-DD）`
- **GitHub Issues**: `## GitHub Issues（YYYY-MM-DD）`

### 2. 反映ロジックの修正

- `buildTaskReflectionMarkdown()` にオプションでヘッダー名を指定できるようにする、あるいは各ページ側でヘッダーを制御する。
- `pages/issues.tsx` を `appendToJournal()` から `upsertJournalSection()` に差し替える。
- `pages/backlog.tsx` および `pages/issues.tsx` で呼び出す `upsertJournalSection()` の第3引数を、それぞれのセクション名に合わせる。

## アーキテクチャ

```typescript
// pages/backlog.tsx
const header = `## Backlog（${today}）`;
const snippet = buildTaskReflectionMarkdown(today, selected, { header });
await upsertJournalSection(today, snippet, header);
```

## トレードオフ

- **セクションの細分化**: 以前は「タスク」という一つの見出しにまとめようとしていたが、ソースごとに独立して「反映（上書き）」ボタンを押すユースケースでは、ソースごとに見出しを分けたほうが実装がシンプルになり、意図しない他ソースのデータ消去も防げる。
- **日記の肥大化**: 見出しが増える分、日記の行数はわずかに増えるが、重複がなくなるメリットのほうが大きい。

## 将来の再評価タイミング

- 全ソースを一度にマージして反映する機能が求められた場合、再度 `buildTaskReflectionMarkdown` の統合ロジックを検討する。

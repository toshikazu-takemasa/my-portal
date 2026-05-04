# ADR-012: 各アプリから日記への反映機能

日付: 2026-04-12  
状態: 採用

## 背景

日記を「1日の統合記録」として機能させるため、各アプリが自分のデータを日記に書き出す接点を持つ設計が求められた。
初期設計では日記ページ側に反映ボタンを置く案があったが、「アプリが外部（日記）への接点を持つ」というモデルに再設計した。

## 確定ユースケース

| UC | 内容 |
|----|------|
| UC-09 | チェックリストの完了済みタスクを今日の日記に反映する |
| UC-09b | Backlog の選択した課題を今日の日記に反映する |
| UC-09c | GitHub Issues の選択した Issue を今日の日記に反映する |
| UC-10 | 当日の家計記録を今日の日記に反映する（リセットなし） |

## 決定

**各アプリページに「日記に反映」ボタンを配置する。日記ページは変更しない。**

| アプリ | 反映対象 | チェックを外すボタン |
|--------|----------|---------------------|
| チェックリスト | 完了済み（チェックON）のみ | あり（完了 → 未完了に戻す） |
| Backlog | ローカルでチェックONの課題 | あり（ローカルチェックをクリア） |
| GitHub Issues | ローカルでチェックONの Issue | あり（ローカルチェックをクリア） |
| 家計簿 | 当日のレコード | なし（データは変更しない） |

## アーキテクチャ

```
各アプリページ（UI層）
  ├── 各ドメインからデータ取得
  ├── buildTaskReflectionMarkdown() / buildFinanceReflectionMarkdown()
  │     └── src/domains/journal/reflection.ts（@/shared/types のみ import）
  └── appendToJournal(date, snippet)
        └── src/domains/journal/index.ts → StorageAdapter 経由で保存
```

**DDD Lite 準拠:**
- `reflection.ts` は `@/shared/types` のみ import（ドメイン間依存なし）
- `appendToJournal()` は `StorageAdapter` 経由（直接 fetch なし）
- UI層（pages/）がドメイン横断呼び出しを担う（許可されている）

## Backlog / Issues のチェックボックスについて

外部システムのタスクには「日記に反映するかどうか」を選ぶローカルチェックボックスを追加する。
このチェック状態はページのメモリ上にのみ存在し、外部システムや localStorage には保存しない。
「チェックを外す」ボタンでページ上のチェックをクリアできる。

## 家計簿の設計方針

- 月単位テーブルで収支を管理する（`vault/finance/YYYY-MM.json`）
- 「日記に反映」は当日分のレコードを今日の日記に追記する
- データの削除・リセットは行わない（反映しても finance データは残る）
- 将来：銀行API・家計簿アプリとの連携でデータ取得が自動化される

## トレードオフ

- 各アプリページが `@/domains/journal` を import するため、UI層が journal ドメインに依存する
  → UI層のドメイン横断は DDD Lite で許可されているため問題なし
- `appendToJournal()` は read → append → write の操作で GitHub API を2回呼ぶ
  → 現フェーズ（GitHub ストレージ）では許容範囲

## 将来の再評価タイミング

- D1 移行時に `appendToJournal()` の実装を `StorageAdapter` 経由で差し替えるだけでよい
- 銀行API連携が実現した場合、finance ページの反映対象は自動取得データに切り替わる

# ADR-022: 家計管理データの永続化修正（GitHub ストレージへの回帰）

日付: 2026-04-23  
状態: 提案

## 背景

ADR-017 で家計管理データの保存先を SQLite（`local-finance.db`）に移行した。しかし、Vercel 環境での運用において以下の問題が発生し、データが一定時間で消失する事象が報告された。

1. **エフェメラルなファイルシステム**: Vercel の Serverless Functions が提供する `/tmp` ディレクトリは一時的なものであり、インスタンスの再起動やリサイクルに伴って内容が消去される。
2. **書き込み制限**: プロジェクトルート（`process.cwd()`）配下はデプロイ後は読み取り専用であり、SQLite ファイルへの書き込みが制限されるため、`/tmp` を使用せざるを得なかった。

## 決定

**データの永続性を確保するため、家計管理データの保存先を一時的に GitHub ストレージ（JSONファイル）に戻す。**

- クラウドネイティブな永続化（Cloudflare D1 等）への完全移行が完了するまで、既存の `StorageAdapter`（GitHub API 経由）を利用して `vault/finance/YYYY-MM.json` に保存する方式を採用する。
- SQLite 版の実装は将来の D1 移行の参考資産として残すか、ブランチで管理する。

## 修正内容

1. `src/domains/finance/index.ts` の各関数（`getMonthRecords`, `saveRecord`, `deleteRecord`）を、`/api/finance/records` 経由ではなく、`StorageAdapter` を直接または API 経由で呼び出すように変更する。
2. 保存先パスを `vault/finance/YYYY-MM.json` とする。

## トレードオフ

- **パフォーマンス**: GitHub API 経由の読み書きは、ローカル SQLite に比べてレイテンシが大きい。しかし、現状のデータ量であれば許容範囲内である。
- **同時実行制御**: GitHub API の SHA による競合検知を利用できるため、データの整合性は維持される。

## 将来の再評価タイミング

- Cloudflare D1 への移行準備が整い次第、永続的なデータベースストレージに再移行する。

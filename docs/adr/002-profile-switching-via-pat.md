# ADR-002: PAT + リポジトリ設定によるプロファイル切り替え

日付: 2026-04-07  
状態: 採用

## 背景

仕事用（会社GitHub）と個人用（個人GitHub）でデータを完全に分離する必要がある。機密性の観点から仕事データは会社リポジトリの外に出せない。同一アプリから両方のリポジトリにアクセスできる設計が求められる。

## 検討した選択肢

1. **PAT + リポジトリ名を localStorage のプロファイルとして管理**（切り替えでAPI接続先が変わる）
2. **別々のデプロイ**（仕事用URL / 個人用URLを完全に分ける）
3. **サーバーサイド認証**（OAuth / Cloudflare Access）

## 決定

`portal_profiles` キーに複数プロファイル（work / personal）を localStorage で管理。各プロファイルに PAT とリポジトリ名を持たせ、切り替え時に全データを再取得する。

```typescript
interface Profile {
  id: 'work' | 'personal'
  gh_pat: string           // 各GitHub アカウントの PAT
  github_repo: string      // 保存先リポジトリ
  github_branch: string
  features: FeatureFlags   // 機能ON/OFF
}
```

## 理由

- バックエンドなしで実現できる
- PAT のスコープをリポジトリ単位に絞れる（仕事PATは仕事リポジトリのみ、個人PATは個人リポジトリのみ）
- 既存の `gh_pat` / `github_repo` localStorage パターンの自然な拡張
- ブラウザを閉じても設定が維持される

## トレードオフ・リスク

- PAT が localStorage に平文保存（XSS で漏洩リスク）。静的HTMLアプリの限界
- プロファイル切り替え時にページ全体が再描画される（UX的に許容範囲）
- 同じブラウザ・同じオリジンで両プロファイルのデータが混在するリスク（チェックリストのキーにプロファイルIDを含めることで軽減）

## 将来の再評価タイミング

複数人で使用する場合、または PAT 漏洩リスクが問題になる場合に Cloudflare Access + Workers KV での認証管理を検討する。

# ADR-007: 機能フラグからアプリカタログモデルへ移行する

日付: 2026-04-11  
状態: 採用

## 背景

現行の `FeatureFlags`（boolean のトグル集合）は機能の ON/OFF には十分だが、
ユーザーが自由に「アプリを追加・削除する」体験には対応できない。
具体的な課題:

- フラグ名と機能の対応が型に散在し、設定画面が機能一覧のトグル列になっている
- 新機能追加のたびに `FeatureFlags`・`FEATURE_LABELS`・`settings.tsx` の3箇所を同期更新しなければならない
- 機能ごとに異なる設定項目（Backlog ならスペース ID 等）が `Profile` 直下に平置きされ、凝集性がない

## 検討した選択肢

1. **現行 FeatureFlags を拡張**（毎回フラグとラベルを追加し続ける）
2. **App Catalog モデルへ完全置換**（FeatureFlags を廃止）
3. **互換レイヤー付き段階移行**（InstalledApps を追加し、FeatureFlags はそこから自動導出）

## 決定

**互換レイヤー付き段階移行（選択肢3）を採用する。**

`InstalledApp[]` をプロファイルの新フィールドとして追加し、`isFeatureEnabled()` は
内部で `InstalledApps` を参照するよう変更する。
既存 localStorage データとの後方互換は `getSettings()` のマイグレーションで吸収する。

## 概念設計

```typescript
// src/shared/types.ts
type AppCapability = 'task' | 'journal' | 'finance' | 'chat' | 'calendar' | 'external-integration'

interface AppManifest {
  id: string
  label: string
  icon: string
  category: 'personal' | 'work' | 'core'
  capabilities: AppCapability[]
  defaultEnabled: boolean
  requiredSettings: string[]   // app 固有の設定キー名
}

interface InstalledApp {
  appId: string
  enabled: boolean
  settings: Record<string, string>  // app 固有認証情報など
  installedAt: string
}

// Profile.features は InstalledApps から自動導出（互換レイヤー期間中のみ保持）
// Profile.backlog_space_id 等は InstalledApp('backlog').settings へ移行
```

## 理由

- アプリ追加時の変更箇所を `AppManifest` 定義1箇所に集約できる
- 設定項目をアプリスコープで凝集させることで `Profile` の肥大化を防ぐ
- 即時廃止より互換レイヤーを挟む方が既存データ移行と回帰リスクを最小化できる
- 将来のマルチプロファイル対応時にも `InstalledApp[]` で表現できる

## 実装方針

1. `AppManifest` のカタログ定義を `src/apps/registry.ts` に作成する
2. `Profile` に `installedApps?: InstalledApp[]` をオプショナルで追加する
3. `isFeatureEnabled()` を内部で `InstalledApps` を参照するよう段階的に変更する
4. `getSettings()` の localStorage マイグレーションで旧来の `features` フラグを `InstalledApps` へ変換する
5. `installApp()` / `uninstallApp()` / `setAppEnabled()` を `src/profiles/index.ts` に追加する
6. 設定画面を「トグル一覧」から「インストール済みアプリ一覧」＋「追加可能カタログ」へ再編する（Phase 2）

## トレードオフ・リスク

- 互換レイヤー期間中は `features` フラグと `InstalledApps` の2系統が存在する複雑さがある
- マイグレーション失敗時のフォールバックを `getSettings()` 内に必ず実装する必要がある

## 将来の再評価タイミング

すべての機能が `InstalledApps` ベースに移行完了した段階で `FeatureFlags` を廃止し ADR をクローズする。

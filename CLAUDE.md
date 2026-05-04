# Portal App — Claude Code

## 設計思想・計画ドキュメント

このリポジトリの設計思想・改修計画・ADRは以下を参照:

- **ADR一覧**: `docs/adr/`（portal-appから移植済み、ADR-001〜027）

## 設計原則（要約）

1. **ADR + 進化的アーキテクチャ** — 設計変更は必ずADRに記録する
2. **ユースケース → 仕様 → 実装** — 実装前にUCと型定義を先に書く
3. **DDD Lite** — `domains/` のドメイン分離と `storage/interface.ts` 経由を守る
4. **機能フラグ** — `isFeatureEnabled()` で仕事/個人の機能を制御する

## スキル

- `portal-design-review` — 「設計レビューして」「ADR書いて」「UC定義して」で起動

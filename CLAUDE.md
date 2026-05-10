# Portal App — Claude Code

## 設計思想・計画ドキュメント

このリポジトリの設計思想・改修計画・ADRは以下を参照:

- **改修計画**: `/workspaces/workspace/保管庫/ナレッジ/企画・理論/portal/redesign-plan.md`
- **設計思想の背景**: `/workspaces/workspace/保管庫/ナレッジ/企画・理論/portal/design-philosophy.md`
- **ADR一覧**: `docs/adr/`（portal-appから移植済み、ADR-001〜027）

## 設計原則（要約）

1. **ADR駆動・進化的アーキテクチャ** — 全ての変更はADR（docs/adr/）を起点とし、将来のNext.js/MCP移行を前提とした設計を行う（ADR-029）。
2. **データ・コントラクト優先** — 実装よりも先に「AIが理解できるデータ形式（Markdown/JSON）」をADRで定義し、サイロ化を防ぐ。
3. **ユースケース → 仕様 → 実装** — 実装前にUCと型定義を先に書く。
4. **DDD Lite & 分離** — ロジックをJSファイルに分離し、UI（HTML）への依存を最小限に抑える。

## スキル

- `portal-design-review` — 「設計レビューして」「ADR書いて」「UC定義して」で起動

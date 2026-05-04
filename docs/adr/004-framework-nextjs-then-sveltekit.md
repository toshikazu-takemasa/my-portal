# ADR-004: Next.js（静的出力）→ SvelteKit + Cloudflare Pages への段階移行

日付: 2026-04-07  
状態: 採用

## 背景

フレームワーク選定。現在は Vanilla HTML + JS で動作しているが、DDD Lite・プロファイル管理・将来の音声/DB機能を見据えて TypeScript + コンポーネントベースの設計が必要になった。

## 検討した選択肢

1. **Vanilla + Vite** — 現状に近い、変更最小
2. **Next.js + Vercel/Cloudflare** — 段階的に API Routes を追加できる
3. **SvelteKit + Cloudflare Pages** — D1・音声・AI との最終的な親和性が高い
4. **Astro** — コンテンツ表示特化、インタラクティブUIが増えると向かない

## 決定

**フェーズ1〜2: Next.js（静的出力 → API Routes追加）**  
**DDD Liteの設計パターンが安定したら: SvelteKit + Cloudflare Pages に移行**

## 理由

### Next.js を最初に選ぶ理由
- 静的出力（`next export`）から始められるため、今の GitHub Pages デプロイと同じ感覚で動かせる
- StorageAdapter / profiles / domains の設計パターンを確立するための実装期間に十分
- API Routes が組み込みのため、将来 Cloudflare Workers + D1 を追加するときに同一コードベースで書ける
- TypeScript・コンポーネント設計の学習コストが最も低い出発点

### SvelteKit に後で移行する理由
- DDD Lite の設計パターンが確立された後は、Cloudflare Pages との親和性・バンドルサイズ・パフォーマンスで SvelteKit が優位
- Cloudflare D1（音声機能追加時）との公式アダプターが充実している
- ドメイン境界が明確になっていれば、ファイル移行のコストは限定的

## 移行判断基準（SvelteKit へのスイッチタイミング）

以下がすべて満たされた時点で ADR-005（SvelteKit移行）を作成する:
- [ ] `storage/interface.ts` の StorageAdapter が実装済み
- [ ] `domains/` の主要ドメイン（journal / task / finance / ai）が分離済み
- [ ] `profiles/` モジュールが安定稼働している
- [ ] 音声機能追加 or D1移行の具体的な計画が立った

## トレードオフ・リスク

- Next.js → SvelteKit の移行コストが発生する（ただし DDD Lite が整っていれば domains/ の移植はファイルコピーに近い）
- Next.js の App Router は静的出力に制約があるため、Pages Router を使うか `output: 'export'` を明示する

## デプロイ先

| フェーズ | デプロイ先 |
|---|---|
| Phase 1〜2 (Next.js) | Vercel（無料枠）または Cloudflare Pages |
| Phase 3〜 (SvelteKit) | Cloudflare Pages（D1・Workers と同一エコシステム） |

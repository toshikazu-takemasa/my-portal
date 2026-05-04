# ADR-011: Cloudflare Workers (OpenNext) デプロイ構成の記録

日付: 2026-04-12
状態: 保留（現行は Vercel でデプロイ、将来の Cloudflare 移行時に参照）

## 背景

ADR-010 で導入した `pages/api/tasks/` の API Route プロキシは、Next.js の
静的エクスポート（`output: 'export'`）では動作しない。

`https://portal-app.takema1989.workers.dev/issues` で 500 エラーが発生した原因は：

1. `out/` ディレクトリ（静的ビルド成果物）に `issues.html` が存在しない
2. 静的エクスポートには `pages/api/` が含まれず、`/api/tasks/github` が存在しない
3. `next.config.ts` の `output: "standalone"` と静的デプロイが矛盾していた

## 現時点の決定

**Vercel にデプロイする（最小コストで API Route を動作させる）**

- Vercel は Next.js の親元であり `pages/api/` を設定ゼロでサーバーレス関数として扱う
- GitHub リポジトリをインポートするだけでデプロイ完了
- `next.config.ts` の `output: "standalone"` は Vercel が無視して独自アダプターを使用する

## 将来の Cloudflare (OpenNext) 移行に向けた設計記録

CLAUDE.md のロードマップ「SvelteKit + Cloudflare Pages へ移行」に備え、
OpenNext による Cloudflare Workers デプロイの構成をここに記録する。

---

## Cloudflare Workers (OpenNext) セットアップ手順

### 前提知識

| 概念 | 説明 |
|------|------|
| **Cloudflare Workers** | V8 Isolate ベースのエッジランタイム。Node.js とは異なる実行環境 |
| **OpenNext** | Next.js を各種プラットフォーム向けに変換するアダプター群 |
| **@opennextjs/cloudflare** | OpenNext の Cloudflare Workers 専用アダプター |
| **wrangler** | Cloudflare Workers のビルド・デプロイ CLI |
| **nodejs_compat** | Workers で Node.js API の一部を使えるようにする互換フラグ |

### バージョン要件（2026-04-12 時点）

```
next                    : >= 16.2.3（16.2.2 は peerDependency 外）
@opennextjs/cloudflare  : ^1.19.1
wrangler                : ^4.65.0（4.81.1 が最新）
```

### Step 1: パッケージインストール

```bash
npm install next@16.2.3
npm install --save-dev @opennextjs/cloudflare wrangler
```

### Step 2: wrangler.toml の作成

```toml
# wrangler.toml
name = "portal-app"
main = ".worker-next/handler.mjs"
compatibility_date = "2024-12-18"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".worker-next/assets"
binding = "ASSETS"
```

**ポイント:**
- `name` は Cloudflare Workers のワーカー名（`portal-app.takema1989.workers.dev` の `portal-app` に対応）
- `main` は OpenNext ビルド後の成果物パス（`.worker-next/handler.mjs`）
- `nodejs_compat` フラグが `pages/api/` の Node.js 互換 API を動作させる鍵
- `[assets]` は静的ファイル（JS/CSS/画像）の配信設定

### Step 3: next.config.ts の確認

```typescript
// next.config.ts（現状のまま変更不要）
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",  // OpenNext はこれを前提とする
}
```

`output: 'export'`（静的エクスポート）は OpenNext と競合するため使用しない。

### Step 4: package.json スクリプト更新

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:cloudflare": "opennextjs-cloudflare build",
    "preview": "opennextjs-cloudflare build && wrangler dev",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  }
}
```

### Step 5: ビルドと動作確認

```bash
# ローカルプレビュー（Wrangler で Workers を模倣）
npm run preview

# 本番デプロイ
npm run deploy
```

### Step 6: ビルド成果物の構造

```
.worker-next/
  handler.mjs          ← Workers のエントリーポイント
  assets/              ← 静的ファイル（JS/CSS/画像）
    _next/
    favicon.ico
    ...
```

---

## Node.js vs Edge Runtime の違い（学習メモ）

OpenNext を使っても `pages/api/` は Node.js 互換モードで動くが、
将来の App Router 移行時は Edge Runtime を意識した書き方が必要になる。

| API | Node.js Runtime | Edge Runtime (Workers) |
|-----|----------------|------------------------|
| `http.IncomingMessage` | ✓ | ✗（`Request` を使う） |
| `http.ServerResponse` | ✓ | ✗（`Response` を使う） |
| `fetch` | ✓ | ✓ |
| `localStorage` | ✗（ブラウザのみ） | ✗（ブラウザのみ） |
| Cloudflare KV | ✗ | ✓（binding 経由） |

`pages/api/` の `NextApiRequest` / `NextApiResponse` は `http.*` ベースのため、
将来 App Router の Route Handlers（`Request` / `Response` ベース）に移行すると
Edge Runtime でもネイティブに動作する。

---

## トレードオフ

| 項目 | Vercel（現行） | Cloudflare Workers（将来） |
|------|--------------|--------------------------|
| セットアップ | ゼロ設定 | wrangler.toml + OpenNext 必要 |
| API Routes | そのまま動く | `nodejs_compat` フラグで動く |
| コールドスタート | あり（サーバーレス） | ほぼなし（V8 Isolate） |
| SvelteKit 移行との親和性 | 間接的 | 直結（Cloudflare エコシステム共通） |
| KV / R2 / D1 利用 | 不可 | 可能 |

## 再評価タイミング

- SvelteKit + Cloudflare Pages への移行を開始するタイミング
- または Vercel の無料枠を超えた場合

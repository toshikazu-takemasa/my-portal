// =====================
// Service Worker - Private Portal
// =====================
const CACHE_NAME = 'private-portal-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/components.css',
  './css/ai-chat.css',
  './css/mobile.css',
  './js/config.js',
  './js/utils.js',
  './js/settings.js',
  './js/portal-config.js',
  './js/checklist.js',
  './js/quicklinks.js',
  './js/github.js',
  './js/report.js',
  './js/ai-chat.js',
  './js/tasks.js',
  './js/quick-memo.js',
  './manifest.json',
];

// インストール時に静的アセットをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 旧バージョンのキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ戦略
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 外部 API はネットワークのみ
  if (
    url.hostname === 'api.github.com' ||
    url.hostname === 'api.anthropic.com' ||
    url.hostname === 'www.google.com'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 常に更新が必要なファイル: ネットワークファースト
  const alwaysNetworkFiles = ['index.html', 'portal-config.json', 'daily-checklist.js', 'report.js'];
  const isAlwaysNetworkFile = alwaysNetworkFiles.some(file => event.request.url.includes(file));

  if (isAlwaysNetworkFile) {
    // ネットワークファースト戦略
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // 正常レスポンスはキャッシュに更新
          if (res.ok && event.request.method === 'GET') {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return res;
        })
        .catch(() => {
          // オフライン時のみキャッシュ使用
          return caches.match(event.request);
        })
    );
    return;
  }

  // その他の静的アセット: キャッシュファースト
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(res => {
        // 正常レスポンスはキャッシュに追加
        if (res.ok && event.request.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return res;
      }))
  );
});

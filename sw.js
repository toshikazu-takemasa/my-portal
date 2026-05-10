// =====================
// Service Worker - Private Portal
// =====================
const CACHE_NAME = 'private-portal-v13';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/components.css',
  './css/ai-chat.css',
  './css/mobile.css',
  './js/core/config.js',
  './js/core/utils.js',
  './js/core/github.js',
  './js/core/gemini.js',
  './js/ui/settings.js',
  './js/ui/checklist.js',
  './js/ui/quicklinks.js',
  './js/ui/report.js',
  './js/ui/tasks.js',
  './js/ui/issues.js',
  './js/ui/daily-checklist.js',
  './js/ui/analytics.js',
  './js/ui/finance.js',
  './js/ui/ai-ticker.js',
  './js/ui/ai-chat.js',
  './manifest.json',
  './data/portal-config.json',
  './vault/persona/persona.md',
  './vault/persona/avatar.png',
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

  const isGet = event.request.method === 'GET';
  const isSameOrigin = url.origin === self.location.origin;
  const isHtmlRequest = isSameOrigin && (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html')
  );
  const isAppShell = isSameOrigin && (
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('portal-config.json') ||
    url.pathname.endsWith('manifest.json')
  );

  if (isGet && isHtmlRequest) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' }))
        .then(res => {
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  if (isGet && isAppShell) {
    // ネットワークファースト戦略
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // 正常レスポンスはキャッシュに更新
          if (res.ok) {
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
        if (res.ok && isGet) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return res;
      }))
  );
});

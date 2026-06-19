/* -------------------------------------------------------------
 * PanTré (パントレ) - sw.js
 * PWA Service Worker (オフライン動作 & アセットキャッシュ)
 * ------------------------------------------------------------- */

const CACHE_NAME = 'pantre-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/main.js',
  './src/supabase.js',
  './src/styles/index.css',
  './src/styles/components.css',
  './src/styles/pages.css',
  './src/utils/constants.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Outfit:wght@400;600;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 1. インストール時にキャッシュを蓄積
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('PanTré: アセットのプレキャッシュを実行中...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. アクティベート時に古いキャッシュをクリア
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('PanTré: 古いキャッシュを削除します:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// 3. リクエストフェッチ時のキャッシュフォールバック
self.addEventListener('fetch', (event) => {
  // 外部API (Supabase等) へのリクエストはキャッシュしない
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // キャッシュヒット
        }

        // キャッシュになければネットワークから取得
        return fetch(event.request)
          .then((response) => {
            // 正しい応答であればキャッシュに追加
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // オフライン時のHTMLフォールバック（必要に応じて）
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

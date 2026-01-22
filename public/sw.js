/**
 * Service Worker for Wing PWA
 * 实现缓存策略和离线支持
 */

const CACHE_NAME = 'wing-pwa-v1';
const OFFLINE_PAGE = '/offline.html';

// 需要预缓存的关键资源
const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/OwlLogo.svg',
  '/owl.svg',
  '/offline.html',
  '/manifest.json'
];

/**
 * 安装 Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        // 强制激活新的 Service Worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

/**
 * 激活 Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
      .then(() => {
        // 立即控制所有客户端
        return self.clients.claim();
      })
  );
});

/**
 * 拦截网络请求
 * 策略：Network First，失败时回退到缓存
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过跨域请求（除非是 API 代理）
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 如果响应有效，克隆并缓存
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // 只缓存同源资源
            if (url.origin === location.origin) {
              cache.put(request, responseToCache);
            }
          });
        }
        return response;
      })
        .catch(() => {
        // 网络失败，尝试从缓存获取
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // 如果是导航请求且没有缓存，返回离线页面
          if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
            return caches.match(OFFLINE_PAGE).then((offlinePage) => {
              return offlinePage || new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/html; charset=utf-8'
                })
              });
            });
          }

          // 其他请求返回空响应
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

/**
 * 处理后台同步（如果浏览器支持）
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(
      // 这里可以添加后台同步逻辑，比如同步 WebDAV
      Promise.resolve()
    );
  }
});

/**
 * 处理推送通知（如果将来需要）
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  // 可以在这里添加推送通知处理逻辑
});

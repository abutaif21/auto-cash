// تم ترقية الإصدار إلى v5 لتثبيت نظام الترخيص والتفعيل وتحديث الموارد
const CACHE_NAME = 'autocash-v5-licensed';

// قائمة جميع الموارد الأساسية للعمل Offline بالكامل بدون إنترنت
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  
  // الأيقونات والوسائط
  './assets/icons/icon.png',
  './assets/icons/icon.svg',
  
  // ملفات التنسيق CSS
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/modals.css',
  
  // المكتبات المحلية (بدون إنترنت)
  './js/libs/dexie.min.js',
  './js/libs/lucide.min.js',
  
  // ملفات النواة Core والتحكم والترخيص
  './js/app.js',
  './js/router.js',
  './js/core/db.js',
  './js/core/license-manager.js',
  './js/core/auth.js',
  './js/core/storage-manager.js',
  './js/core/broadcast.js',

  // الأدوات المساعدة Utils
  './js/utils/image-compressor.js',
  './js/utils/backup-restore.js',
  './js/utils/pdf-printer.js',
  './js/utils/formatters.js',
  './js/utils/ui-feedback.js',
  
  // صفحات التطبيق والواجهات (Views)
  './js/views/auth-view.js',
  './js/views/dashboard-view.js',
  './js/views/cars-view.js',
  './js/views/car-details-view.js',
  './js/views/transactions-view.js',
  './js/views/reports-view.js'
];

// مرحلة التثبيت: حفظ الملفات محلياً في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS_TO_CACHE.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn(`[Service Worker] تعذر تخزين الملف: ${asset}`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// مرحلة التفعيل: تنظيف وحذف الإصدارات القديمة من الكاش
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// اعتراض الطلبات وتوفير الملفات من الكاش أثناء العمل Offline
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ============================================
// SERVICE WORKER — AVTOMATIK YANGILANISH
// ============================================

// Versiyani har safar kodni yangilaganingizda o'zgartirib turing (masalan v1 dan v2 ga)
const CACHE_NAME = 'kv-boshqaruv-v1';

const CACHE_FILES = [
  './',
  'index.html',
  'index.css',
  'index.js',
  'ijarachi.html',
  'ijarachi.css',
  'ijarachi.js',
  'xarajat.html',
  'xarajat.css',
  'xarajat.js',
  'hisobot.html',
  'hisobot.css',
  'hisobot.js',
  'navbatchi.html',
  'navbatchi.css',
  'navbatchi.js',
  'config.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// 1. O'rnatish — fayllarni keshga olish
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_FILES);
    })
  );
  // Yangi Service Worker darhol faollashishini kutmaslik uchun
  self.skipWaiting(); 
});

// 2. Faollashtirish — eski keshlarni tozalash
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Eski kesh o\'chirildi:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Tarmoq so'rovlarini ushlash
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase va tashqi API so'rovlarini keshlamaymiz (har doim onlayn bo'lishi kerak)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) {
    return; 
  }

  // HTML fayllar uchun: "Tarmoq birinchi, kesh zaxira" (Network First)
  // Bu GitHub'dagi eng so'nggi yangilanishlarni darhol ko'rish uchun kerak
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Yangi javobni keshga saqlash
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => {
          // Agar internet bo'lmasa, keshdan qaytarish
          return caches.match(event.request) || caches.match('index.html');
        })
    );
  } else {
    // Boshqa fayllar (CSS, JS, rasmlar) uchun: "Kesh birinchi, tarmoq zaxira" (Cache First)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        });
      })
    );
  }
});

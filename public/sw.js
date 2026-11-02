// Online-only service worker. Never cache personal data, bookings or API responses.
self.addEventListener('install', (event) => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>أنجزلي</title><body style="font-family:sans-serif;text-align:center;padding:3rem"><h1>أنت غير متصل بالإنترنت</h1><p>اتصل بالإنترنت لعرض الحجوزات ومتابعة دورك.</p><button onclick="location.reload()">إعادة المحاولة</button></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )));
});

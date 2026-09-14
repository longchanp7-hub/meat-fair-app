// Network only: never show cached, expired fair data or touch other apps' caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>肉フェア</title><h1>インターネットに接続してください</h1><p>最新のフェア情報を表示するには通信が必要です。</p><button onclick="location.reload()">再読み込み</button></html>',
    {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}}
  )));
});

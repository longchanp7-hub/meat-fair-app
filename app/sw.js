const CACHE_PREFIX='meat-fair-shell-v';
const CACHE='meat-fair-shell-v20260920-private-pages1';

const SHELL=[
  './',
  './index.html',
  './app.js',
  './install.js',
  './styles.css',
  './details.css',
  './catalog.css',
  './layout-wide.css',
  './brand-details.mjs',
  './gallery.mjs',
  './gallery-plan.mjs',
  './gallery-semantics.mjs',
  './catalog.mjs',
  './catalog-reviewed-bridge.mjs',
  './presentation.mjs',
  './status.mjs',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

const DATA_PATHS=[
  '/data/brands.json',
  '/data/fairs.json',
  '/data/stores.json',
  '/data/gallery.json',
  '/data/catalog.json',
  '/data/offers.json'
];

const sameOrigin=request=>new URL(request.url).origin===self.location.origin;
const isData=url=>DATA_PATHS.some(path=>url.pathname.endsWith(path));

async function putSafe(cache,key,response){
  if(response?.ok)await cache.put(key,response.clone());
  return response;
}

async function networkFirst(request,{timeoutMs=8000,fallbackKey=null}={}){
  const cache=await caches.open(CACHE);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(request,{cache:'no-store',signal:controller.signal});
    if(response.ok)return putSafe(cache,request,response);
    const cached=await cache.match(request) || (fallbackKey?await cache.match(fallbackKey):null);
    return cached||response;
  }catch(error){
    const cached=await cache.match(request) || (fallbackKey?await cache.match(fallbackKey):null);
    if(cached)return cached;
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!sameOrigin(event.request))return;
  const url=new URL(event.request.url);

  if(isData(url)){
    event.respondWith(networkFirst(event.request,{timeoutMs:10000}));
    return;
  }

  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,{timeoutMs:8000,fallbackKey:'./index.html'}).catch(
      ()=>caches.match('./index.html').then(r=>r||new Response(
        '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>肉フェア</title><h1>接続を確認してください</h1><p>一度オンラインで開くと、次回からアプリ本体はオフラインでも起動できます。</p><button onclick="location.reload()">再読み込み</button></html>',
        {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}
      ))
    ));
    return;
  }

  if(['script','style','manifest','image','font'].includes(event.request.destination)){
    event.respondWith(networkFirst(event.request,{timeoutMs:8000}));
  }
});

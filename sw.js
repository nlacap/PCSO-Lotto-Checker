const CACHE='pcso-lotto-v11';
const ASSETS=['./app.js','./manifest.webmanifest','./digitalrose-logo.png','./digitalrose-logo-192.png','./apple-touch-icon.png','./digitalrose-logo-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);

  // Always prefer the network for page navigations / index.html so updates
  // are not trapped behind an old service-worker cache.
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/PCSO-Lotto-Checker/')){
    event.respondWith(
      fetch(req)
        .then(resp=>{
          const copy=resp.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy));
          return resp;
        })
        .catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // Static assets can stay cache-first, with network fallback.
  event.respondWith(
    caches.match(req).then(cached=>cached || fetch(req).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(cache=>cache.put(req,copy));
      return resp;
    }))
  );
});
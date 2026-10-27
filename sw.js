const A=['./','index.html','style.css','app.js','manifest.json','icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open('shell-1').then(c=>c.addAll(A))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin===location.origin&&!u.pathname.startsWith('/offline/'))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});

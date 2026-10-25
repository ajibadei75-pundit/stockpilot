const V='stockpilot-v7',SHELL=['./','index.html','manifest.json','icon.svg','icon-192.png','icon-512.png'];
const CDN=['cdn.jsdelivr.net','cdnjs.cloudflare.com'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>Promise.all(['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js','https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'].map(u=>caches.open(V).then(c=>fetch(u).then(r=>c.put(u,r)).catch(()=>{}))))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
// App files and pinned CDN scripts are cached. Supabase API calls (business data) are never cached here.
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET')return;
 if(CDN.includes(u.hostname)){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{const c=x.clone();caches.open(V).then(ca=>ca.put(r,c));return x})));return}
 if(u.origin!==location.origin)return;
 e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(V).then(ca=>ca.put(r,c));return x}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))))});

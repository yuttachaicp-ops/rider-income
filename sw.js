/* Service Worker — บันทึกรายรับ ไรเดอร์
   แก้ไฟล์แล้วเปลี่ยนเลข VERSION ทุกครั้ง เพื่อให้เครื่องผู้ใช้ดึงเวอร์ชันใหม่ */
const VERSION = 'v1.3.0';
const CACHE = 'rider-income-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  const d = e.data;
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) {
    self.skipWaiting();
    return;
  }
  if (d && d.type === 'GET_VERSION' && e.ports && e.ports[0]) {
    e.ports[0].postMessage(VERSION);
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // หน้าเว็บ: ลองเน็ตก่อน (ได้เวอร์ชันใหม่) ถ้าไม่มีเน็ตใช้ของที่แคชไว้
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // ไฟล์อื่น: ใช้แคชก่อน แล้วอัปเดตเบื้องหลัง
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) {
      fetch(req).then(r => {
        if (r && r.ok) caches.open(CACHE).then(c => c.put(req, r));
      }).catch(() => {});
      return hit;
    }
    try {
      const r = await fetch(req);
      if (r && r.ok) (await caches.open(CACHE)).put(req, r.clone());
      return r;
    } catch (_) {
      return Response.error();
    }
  })());
});

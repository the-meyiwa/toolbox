/* ============================================================
   Toolbox Code Playground — synchronous input bridge (service worker)

   Python's input(), Lua's io.read() and JavaScript's prompt() are
   synchronous calls, but the answer comes from the terminal on the
   page. The runtime worker makes a blocking XMLHttpRequest to
   /__pg_sync/read?id=…; this service worker holds that request open
   until the page posts the student's line, then answers it.

   It intercepts ONLY /__pg_sync/* on this origin. Every other request
   is left alone, so the rest of Toolbox behaves exactly as if no
   service worker were installed.
   ============================================================ */

const PREFIX = '/__pg_sync/';
const waiting = new Map(); // id → resolve(value)
const early = new Map();   // id → value that arrived before the request

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type !== 'pg-sync-write' || !msg.id) return;
  const resolve = waiting.get(msg.id);
  if (resolve) {
    waiting.delete(msg.id);
    resolve(msg.value);
  } else {
    early.set(msg.id, msg.value);
    // Don't keep answers nobody asked for around forever.
    setTimeout(() => early.delete(msg.id), 10 * 60 * 1000);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PREFIX)) return;
  event.respondWith(handle(url));
});

async function handle(url) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const route = url.pathname.slice(PREFIX.length);
  if (route === 'ping') return new Response('pong', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  if (route === 'read') {
    const id = url.searchParams.get('id') || '';
    if (early.has(id)) {
      const value = early.get(id);
      early.delete(id);
      return new Response(JSON.stringify(value ?? null), { headers });
    }
    const value = await new Promise((resolve) => {
      waiting.set(id, resolve);
      // Browsers stop long-running fetch events after a few minutes; answer
      // with a retry hint before that so the worker simply asks again.
      setTimeout(() => {
        if (waiting.get(id) === resolve) { waiting.delete(id); resolve({ retry: true }); }
      }, 4 * 60 * 1000);
    });
    if (value && value.retry) return new Response('retry', { status: 503, headers });
    return new Response(JSON.stringify(value ?? null), { headers });
  }
  return new Response('Not found', { status: 404 });
}

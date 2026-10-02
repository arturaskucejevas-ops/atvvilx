// Service worker: leidzia puslapiui ir issaugotiems failams veikti be interneto.
// Pakeitus CACHE pavadinima, telefonuose issaugoti failai bus istrinti (ir app.js reikia pakeisti ta pati).
const CACHE = 'trasos-v1';
const PAGRINDAS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'data/trasos.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PAGRINDAS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/data/trasos.json')) {
    e.respondWith(tinklasPirma(req));
  } else {
    e.respondWith(talpyklaPirma(e));
  }
});

// Duomenys: visada bandom gauti naujausius, be rysio - paskutinius issaugotus
async function tinklasPirma(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req);
    if (r.status === 200) await c.put(req, r.clone());
    return r;
  } catch (err) {
    const m = await c.match(req, { ignoreSearch: true });
    if (m) return m;
    throw err;
  }
}

// Kiti failai: is karto rodom issaugota versija, fone atnaujinam
async function talpyklaPirma(e) {
  const req = e.request;
  const c = await caches.open(CACHE);
  const issaugota = await c.match(req, { ignoreSearch: true })
    || (req.mode === 'navigate' ? await c.match('./') : undefined);
  const is_tinklo = fetch(req).then((r) => {
    if (r.status === 200) c.put(req, r.clone());
    return r;
  }).catch(() => issaugota);
  if (issaugota) {
    e.waitUntil(is_tinklo);
    return issaugota;
  }
  return is_tinklo;
}

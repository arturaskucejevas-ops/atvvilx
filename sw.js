// Service worker: leidzia puslapiui ir issaugotiems failams veikti be interneto.
// Pakeitus CACHE pavadinima, telefonuose issaugoti failai bus istrinti (ir app.js reikia pakeisti ta pati).
const CACHE = 'trasos-v1';
const VERSIJA = '3'; // pakeitus sw.js telefonas ji atnaujina automatiskai
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

  e.respondWith(tinklasPirma(e));
});

// Kai yra rysys - visada naujausia versija is serverio (ir ji issaugoma).
// Be rysio arba jei serveris neatsako per 5 s - paskutine issaugota versija.
async function tinklasPirma(e) {
  const req = e.request;
  const c = await caches.open(CACHE);
  const navigacija = req.mode === 'navigate';
  const is_tinklo = fetch(req, navigacija ? undefined : { cache: 'no-cache' }).then((r) => {
    if (r.status === 200) c.put(req, r.clone());
    return r;
  });
  e.waitUntil(is_tinklo.catch(() => {}));

  const laikas = new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    const r = await Promise.race([is_tinklo, laikas]);
    if (r) return r;
  } catch (err) { /* nera rysio */ }

  const issaugota = await c.match(req, { ignoreSearch: true })
    || (navigacija ? await c.match('./') : undefined);
  return issaugota || is_tinklo;
}

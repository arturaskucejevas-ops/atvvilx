'use strict';

// Visa informacija imama is sio failo. Redaguokite tik ji ir aplanka "failai".
const DUOMENYS = 'data/trasos.json';
// Turi sutapti su CACHE pavadinimu sw.js faile.
const CACHE = 'trasos-v1';
// Rodoma puslapio apacioje - pagal ja matosi, ar telefone jau nauja versija.
const VERSIJA = '3';

const turinys = document.getElementById('turinys');
let duomenys = null;
let klaida = null;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// **parysktinta** ir https://nuorodos vienoje eiluteje
function eilute(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

// Paprastas tekstas: tuscia eilute = nauja pastraipa, "- " = sarasas, "## " = antraste
function tekstas(t) {
  if (Array.isArray(t)) t = t.join('\n');
  const out = [];
  let p = [];
  let ul = [];
  const flush = () => {
    if (p.length) out.push('<p>' + p.join('<br>') + '</p>');
    if (ul.length) out.push('<ul>' + ul.map((x) => '<li>' + x + '</li>').join('') + '</ul>');
    p = [];
    ul = [];
  };
  for (const raw of String(t || '').replace(/\r/g, '').split('\n')) {
    const x = raw.trim();
    let m;
    if (!x) {
      flush();
    } else if ((m = x.match(/^#{1,3}\s+(.*)/))) {
      flush();
      out.push('<h3>' + eilute(m[1]) + '</h3>');
    } else if ((m = x.match(/^[-•*]\s+(.*)/))) {
      if (p.length) flush();
      ul.push(eilute(m[1]));
    } else {
      if (ul.length) flush();
      p.push(eilute(x));
    }
  }
  flush();
  return out.join('');
}

const pletinys = (kelias) => (String(kelias).split(/[?#]/)[0].split('.').pop() || '').toLowerCase();
const NUOTRAUKOS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
const IKONOS = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', txt: '📝',
  gpx: '🧭', kml: '🧭', kmz: '🧭', fit: '🧭',
  mp4: '🎬', mov: '🎬', zip: '🗜️',
};
const href = (kelias) => (/^https?:\/\//i.test(kelias) ? kelias : encodeURI(kelias));

const geriTaskai = (t) => (t.taskai || []).filter((x) => x && isFinite(parseFloat(x.lat)) && isFinite(parseFloat(x.lng)));
const navigacija = (x) => `https://www.google.com/maps/dir/?api=1&destination=${parseFloat(x.lat)},${parseFloat(x.lng)}`;
function zemelapioUrl(x) {
  const lat = parseFloat(x.lat);
  const lng = parseFloat(x.lng);
  const d = 0.012;
  return 'https://www.openstreetmap.org/export/embed.html?layer=mapnik'
    + `&bbox=${lng - d * 1.6},${lat - d},${lng + d * 1.6},${lat + d}&marker=${lat},${lng}`;
}

function sarasas() {
  const trasos = duomenys.trasos || [];
  if (!trasos.length) return '<p class="tuscia">Trasų dar nėra. Pridėkite jas faile data/trasos.json.</p>';
  const paieska = trasos.length > 4
    ? '<input class="paieska" type="search" placeholder="Ieškoti trasos…" aria-label="Ieškoti trasos">'
    : '';
  return paieska + trasos.map((t) => {
    const failu = (t.failai || []).length;
    const meta = [t.data && '📅 ' + esc(t.data), failu && '📎 ' + failu + ' fail.'].filter(Boolean);
    const paieskai = [t.pavadinimas, t.trumpai, t.data].join(' ').toLowerCase();
    return `<a class="kortele" href="#/trasa/${encodeURIComponent(t.id)}" data-paieska="${esc(paieskai)}">
      <h2>${esc(t.pavadinimas || t.id)}</h2>
      ${meta.length ? `<div class="metaduom">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
      ${t.trumpai ? `<p>${esc(t.trumpai)}</p>` : ''}
    </a>`;
  }).join('');
}

function trasa(t, vienintele) {
  const taskai = geriTaskai(t);
  const failai = (t.failai || []).filter((f) => f && f.kelias);
  const nuotraukos = failai.filter((f) => NUOTRAUKOS.includes(pletinys(f.kelias)));
  const kiti = failai.filter((f) => !NUOTRAUKOS.includes(pletinys(f.kelias)));
  const faktai = Object.entries(Object.assign(t.data ? { Data: t.data } : {}, t.faktai || {}));
  const h = [];

  if (!vienintele) h.push('<a href="#/" class="atgal">← Visos trasos</a>');
  h.push(`<h1>${esc(t.pavadinimas || t.id)}</h1>`);
  if (t.trumpai) h.push(`<p class="trumpai">${esc(t.trumpai)}</p>`);

  h.push('<div class="mygtukai">');
  if (taskai[0]) h.push(`<a class="mygtukas" href="${navigacija(taskai[0])}" target="_blank" rel="noopener">🚗 Navigacija į startą</a>`);
  if (t.zemelapio_nuoroda) h.push(`<a class="mygtukas antrinis" href="${esc(t.zemelapio_nuoroda)}" target="_blank" rel="noopener">🗺️ Žemėlapis</a>`);
  if ('caches' in window && failai.length) h.push('<button class="mygtukas antrinis" data-veiksmas="offline">⬇️ Išsaugoti be ryšio</button>');
  h.push('<button class="mygtukas antrinis" data-veiksmas="dalintis">🔗 Dalintis</button>');
  h.push('</div>');

  if (faktai.length) {
    h.push('<section><h2>Trumpai</h2><dl class="faktai">'
      + faktai.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')
      + '</dl></section>');
  }

  if (t.aprasymas) h.push(`<section><h2>Aprašymas</h2>${tekstas(t.aprasymas)}</section>`);

  if (taskai.length) {
    h.push('<section><h2>Vietos</h2>');
    if (navigator.onLine) {
      h.push(`<iframe class="zemelapis" loading="lazy" title="Žemėlapis" src="${zemelapioUrl(taskai[0])}"></iframe>`);
    }
    h.push(taskai.map((x) => `<a class="eilute" href="${navigacija(x)}" target="_blank" rel="noopener">
      <span class="ikona">📍</span>
      <span class="vidus"><span class="vardas">${esc(x.pavadinimas || 'Taškas')}</span>
        <span class="smulkiai">${x.pastaba ? esc(x.pastaba) + ' · ' : ''}${parseFloat(x.lat).toFixed(5)}, ${parseFloat(x.lng).toFixed(5)}</span></span>
      <span class="rodykle">›</span></a>`).join(''));
    h.push('</section>');
  }

  if (kiti.length) {
    h.push('<section><h2>Failai</h2>' + kiti.map((f) => {
      const ext = pletinys(f.kelias);
      return `<a class="eilute" href="${href(f.kelias)}" target="_blank" rel="noopener">
        <span class="ikona">${IKONOS[ext] || '📎'}</span>
        <span class="vidus"><span class="vardas">${esc(f.pavadinimas || f.kelias.split('/').pop())}</span>
          <span class="smulkiai">${f.pastaba ? esc(f.pastaba) + ' · ' : ''}${esc(ext.toUpperCase())}</span></span>
        <span class="rodykle">›</span></a>`;
    }).join('') + '</section>');
  }

  if (nuotraukos.length) {
    h.push('<section><h2>Nuotraukos ir schemos</h2><div class="galerija">'
      + nuotraukos.map((f) => `<a href="${href(f.kelias)}" target="_blank" rel="noopener" title="${esc(f.pavadinimas || '')}">
          <img src="${href(f.kelias)}" alt="${esc(f.pavadinimas || '')}" loading="lazy"></a>`).join('')
      + '</div></section>');
  }

  const kontaktai = t.kontaktai || [];
  if (kontaktai.length) {
    h.push('<section><h2>Kontaktai</h2>' + kontaktai.map((k) => `<a class="eilute" href="tel:${esc(String(k.tel || '').replace(/[^\d+]/g, ''))}">
      <span class="ikona">📞</span>
      <span class="vidus"><span class="vardas">${esc(k.vardas || k.tel)}</span>
        <span class="smulkiai">${esc(k.tel || '')}${k.pastaba ? ' · ' + esc(k.pastaba) : ''}</span></span>
      <span class="rodykle">›</span></a>`).join('') + '</section>');
  }

  return h.join('\n');
}

async function issaugotiOffline(t, mygtukas) {
  const urls = [DUOMENYS, ...(t.failai || []).map((f) => f.kelias).filter((k) => k && !/^https?:\/\//i.test(k))];
  mygtukas.disabled = true;
  mygtukas.textContent = '⏳ Saugoma…';
  const c = await caches.open(CACHE);
  let pavyko = 0;
  for (const u of urls) {
    try {
      const r = await fetch(encodeURI(u), { cache: 'reload' });
      if (r.status === 200) { await c.put(encodeURI(u), r); pavyko++; }
    } catch (e) { /* praleidziam */ }
  }
  mygtukas.textContent = pavyko === urls.length ? '✓ Išsaugota telefone' : `⚠️ Išsaugota ${pavyko} iš ${urls.length}`;
  mygtukas.disabled = false;
}

async function dalintis() {
  const duom = { title: document.title, url: location.href };
  if (navigator.share) {
    try { await navigator.share(duom); } catch (e) { /* atsaukta */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(location.href);
    alert('Nuoroda nukopijuota');
  } else {
    prompt('Nukopijuokite nuorodą:', location.href);
  }
}

function rodyti() {
  if (klaida) {
    const patarimas = klaida === 'nerastas'
      ? 'Serveryje nėra šio failo. Patikrinkite, ar įkeltas aplankas <code>data</code> (mažosiomis raidėmis) ir jame failas <code>trasos.json</code>.'
      : location.protocol === 'file:'
        ? 'Puslapis atidarytas tiesiai iš disko – taip neveikia. Paleiskite paleisti-lokaliai.bat arba atidarykite interneto adresą.'
        : 'Jei ką tik redagavote šį failą – greičiausiai trūksta kablelio ar kabutės. Patikrinkite jį svetainėje jsonlint.com.';
    turinys.innerHTML = `<div class="klaida"><strong>Nepavyko įkelti duomenų.</strong>
      <p>Failas <code>${DUOMENYS}</code>: ${klaida === 'nerastas' ? 'nerastas (404)' : esc(klaida)}</p>
      <p>${patarimas}</p></div>`;
    return;
  }
  if (!duomenys) return;

  const trasos = duomenys.trasos || [];
  const [tipas, id] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  const vienintele = trasos.length === 1;
  let t = null;
  if (tipas === 'trasa' && id) t = trasos.find((x) => String(x.id) === id);
  else if (vienintele) t = trasos[0];

  if (tipas === 'trasa' && !t) {
    turinys.innerHTML = '<a href="#/" class="atgal">← Visos trasos</a><p class="tuscia">Tokia trasa nerasta.</p>';
  } else if (t) {
    turinys.innerHTML = trasa(t, vienintele);
    document.title = (t.pavadinimas || t.id) + ' – ' + (duomenys.pavadinimas || 'Trasos');
    const off = turinys.querySelector('[data-veiksmas="offline"]');
    if (off) off.addEventListener('click', () => issaugotiOffline(t, off));
    turinys.querySelector('[data-veiksmas="dalintis"]').addEventListener('click', dalintis);
  } else {
    turinys.innerHTML = sarasas();
    document.title = duomenys.pavadinimas || 'Trasos';
    const p = turinys.querySelector('.paieska');
    if (p) {
      p.addEventListener('input', () => {
        const q = p.value.trim().toLowerCase();
        turinys.querySelectorAll('.kortele').forEach((k) => { k.hidden = !k.dataset.paieska.includes(q); });
      });
    }
  }
  window.scrollTo(0, 0);
}

async function ikelti() {
  try {
    const r = await fetch(DUOMENYS, { cache: 'no-store' });
    if (r.status === 404) throw new Error('nerastas');
    if (!r.ok) throw new Error('serveris grąžino klaidą ' + r.status);
    duomenys = await r.json();
    klaida = null;
  } catch (e) {
    klaida = e.message;
  }
  if (duomenys) {
    document.getElementById('pavadinimas').textContent = duomenys.pavadinimas || 'Trasos';
  }
  document.getElementById('atnaujinta').textContent = (duomenys && duomenys.atnaujinta ? 'Atnaujinta: ' + duomenys.atnaujinta + ' · ' : '') + 'v' + VERSIJA;
  rodyti();
}

// Rysio indikatorius
const offline = document.getElementById('offline');
const rysys = () => { offline.hidden = navigator.onLine; };
window.addEventListener('online', rysys);
window.addEventListener('offline', rysys);
rysys();

// "Idiegti" mygtukas. Chrome/Edge Android'e parodo sistemos langa,
// kitur (iPhone, Samsung Internet ir kt.) - instrukcija, kaip prideti ranka.
let idiegimas = null;
const idiegti = document.getElementById('idiegti');
const patarimas = document.getElementById('idiegimo-patarimas');
const jauIdiegta = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
idiegti.hidden = jauIdiegta();

function idiegimoInstrukcija() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && /crios|fxios|edgios/i.test(ua)) {
    return '<p><strong>iPhone:</strong> nukopijuokite adresą ir atidarykite jį <strong>Safari</strong> naršyklėje.</p>'
      + '<p>Tada apačioje spauskite <strong>Bendrinti</strong> (kvadratėlis su rodykle ↑) → <strong>Į pradžios ekraną</strong> → <strong>Pridėti</strong>.</p>';
  }
  if (ios) {
    return '<p><strong>iPhone:</strong> ekrano apačioje spauskite <strong>Bendrinti</strong> (kvadratėlis su rodykle ↑).</p>'
      + '<p>Slinkite žemyn → <strong>Į pradžios ekraną</strong> (Add to Home Screen) → <strong>Pridėti</strong>.</p>';
  }
  if (/samsungbrowser/i.test(ua)) {
    return '<p><strong>Samsung naršyklė:</strong> apačioje spauskite meniu <strong>≡</strong> → <strong>Pridėti puslapį prie</strong> → <strong>Pradžios ekranas</strong>.</p>';
  }
  if (/android/i.test(ua)) {
    return '<p><strong>Android:</strong> viršuje dešinėje spauskite naršyklės meniu <strong>⋮</strong> → '
      + '<strong>Įdiegti programą</strong> arba <strong>Pridėti prie pagrindinio ekrano</strong>.</p>'
      + '<p>Jei tokio punkto nėra – atidarykite puslapį <strong>Chrome</strong> naršyklėje.</p>';
  }
  return '<p>Atidarykite šį puslapį telefone: Android – Chrome meniu <strong>⋮</strong> → <strong>Įdiegti programą</strong>; '
    + 'iPhone – Safari <strong>Bendrinti</strong> → <strong>Į pradžios ekraną</strong>.</p>';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  idiegimas = e;
  idiegti.hidden = false;
});
window.addEventListener('appinstalled', () => {
  idiegti.hidden = true;
  patarimas.hidden = true;
});
idiegti.addEventListener('click', async () => {
  if (idiegimas) {
    idiegimas.prompt();
    const pasirinkimas = await idiegimas.userChoice;
    idiegimas = null;
    if (pasirinkimas.outcome === 'accepted') { idiegti.hidden = true; return; }
  }
  patarimas.innerHTML = idiegimoInstrukcija();
  patarimas.hidden = !patarimas.hidden;
  if (!patarimas.hidden) patarimas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
window.addEventListener('hashchange', rodyti);
ikelti();

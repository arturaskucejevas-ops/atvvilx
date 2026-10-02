'use strict';

// Visa informacija imama is sio failo (redaguojama per puslapi "＋ Nauja" / "✏️ Redaguoti" arba GitHub'e).
const DUOMENYS = 'data/trasos.json';
// Turi sutapti su CACHE pavadinimu sw.js faile.
const CACHE = 'trasos-v1';
// Rodoma puslapio apacioje - pagal ja matosi, ar telefone jau nauja versija.
const VERSIJA = '5';

const turinys = document.getElementById('turinys');
let duomenys = null;
let klaida = null;
let pranesimas = '';
let paieskosZodis = '';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const dydis = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

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

// ---- Paieska (nepaiso didziuju raidziu ir lietuvisku raidziu: "zalia" randa "žalia") ----
const be = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const beZymejimo = (s) => String(s).replace(/\*\*/g, '').replace(/^\s*(#{1,3}|[-•*])\s+/gm, '');

function normalizuoti(chars) {
  let norm = '';
  const idx = [];
  chars.forEach((c, i) => {
    const n = be(c);
    for (let k = 0; k < n.length; k++) idx.push(i);
    norm += n;
  });
  return { norm, idx };
}

function zymeti(orig, zodziai) {
  if (!zodziai.length) return esc(orig);
  const chars = [...String(orig || '')];
  const { norm, idx } = normalizuoti(chars);
  const zym = new Array(chars.length).fill(false);
  for (const z of zodziai) {
    for (let p = norm.indexOf(z); p >= 0; p = norm.indexOf(z, p + z.length)) {
      for (let k = p; k < p + z.length; k++) zym[idx[k]] = true;
    }
  }
  let out = '';
  let atv = false;
  chars.forEach((c, i) => {
    if (zym[i] !== atv) { out += zym[i] ? '<mark>' : '</mark>'; atv = zym[i]; }
    out += esc(c);
  });
  return out + (atv ? '</mark>' : '');
}

function istrauka(orig, zodziai) {
  const chars = [...orig];
  const { norm, idx } = normalizuoti(chars);
  let pos = -1;
  for (const z of zodziai) {
    const p = norm.indexOf(z);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  if (pos < 0) return '';
  const c = idx[pos];
  const nuo = Math.max(0, c - 40);
  const iki = Math.min(chars.length, c + 110);
  return (nuo > 0 ? '…' : '') + zymeti(chars.slice(nuo, iki).join(''), zodziai) + (iki < chars.length ? '…' : '');
}

function kitasTekstas(t) {
  return [
    beZymejimo([].concat(t.aprasymas || []).join('\n')),
    Object.entries(t.faktai || {}).map(([k, v]) => k + ': ' + v).join(' · '),
    (t.taskai || []).map((x) => [x.pavadinimas, x.pastaba].filter(Boolean).join(' ')).join(' · '),
    (t.failai || []).map((f) => f.pavadinimas || '').join(' · '),
    (t.kontaktai || []).map((k) => [k.vardas, k.pastaba].filter(Boolean).join(' ')).join(' · '),
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

function atitinka(t, zodziai) {
  if (!zodziai.length) return true;
  const visas = be([t.pavadinimas, t.trumpai, t.data].join(' ') + ' ' + kitasTekstas(t));
  return zodziai.every((z) => visas.includes(z));
}

function kortele(t, zodziai) {
  const virsus = be([t.pavadinimas, t.trumpai, t.data].join(' '));
  const kitas = kitasTekstas(t);

  const failu = (t.failai || []).length;
  const meta = [t.data && '📅 ' + zymeti(t.data, zodziai), failu && '📎 ' + failu + ' fail.'].filter(Boolean);
  const neVirsuje = zodziai.filter((z) => !virsus.includes(z));
  const ist = neVirsuje.length ? istrauka(kitas, neVirsuje) : '';
  return `<a class="kortele" href="#/trasa/${encodeURIComponent(t.id)}">
    <h2>${zymeti(t.pavadinimas || t.id, zodziai)}</h2>
    ${meta.length ? `<div class="metaduom">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
    ${t.trumpai ? `<p>${zymeti(t.trumpai, zodziai)}</p>` : ''}
    ${ist ? `<p class="istrauka">${ist}</p>` : ''}
  </a>`;
}

// Pagrindinis langas: paieska + "Sarasas" arba "Zemelapis" (paieska veikia abiem atvejais)
let aktyvusZemelapis = null;

function sarasoLangas(rezimas) {
  const zemelapis = rezimas === 'zemelapis';
  turinys.innerHTML = `
    ${zemelapis ? '' : '<div class="herojus"><img src="icons/logo.png" alt="AtvVilx" width="132" height="132"></div>'}
    <div class="irankiai">
      <input class="paieska" type="search" enterkeyhint="search" placeholder="Ieškoti trasų…" aria-label="Paieška" value="${esc(paieskosZodis)}">
      <a class="mygtukas" href="#/nauja">＋ Nauja</a>
    </div>
    <nav class="perjungiklis">
      <a href="#/"${zemelapis ? '' : ' class="aktyvus" aria-current="page"'}>📋 Sąrašas</a>
      <a href="#/zemelapis"${zemelapis ? ' class="aktyvus" aria-current="page"' : ''}>🗺️ Žemėlapis</a>
    </nav>
    <div class="rezultatu-sk" id="rezultatu-sk"></div>
    <div id="rezultatai"></div>`;
  const laukas = turinys.querySelector('.paieska');
  const rezultatai = document.getElementById('rezultatai');
  const sk = document.getElementById('rezultatu-sk');
  const trasos = duomenys.trasos || [];
  const zodziai = () => be(paieskosZodis).split(/\s+/).filter(Boolean);

  let piesti;
  if (zemelapis) {
    rezultatai.innerHTML = '<div class="zem-didelis"></div>';
    const dezute = rezultatai.firstChild;
    let z = null;
    piesti = () => {
      const rastos = trasos.filter((t) => atitinka(t, zodziai()));
      sk.textContent = zodziai().length ? `Žemėlapyje: ${rastos.length} iš ${trasos.length}` : 'Paspauskite trasą – galėsite atsisiųsti GPX arba atidaryti aprašymą.';
      if (z) z.atnaujinti(rastos);
    };
    Zemelapis.sukurti(dezute).then((sukurtas) => {
      if (!dezute.isConnected) { sukurtas.sunaikinti(); return; }
      z = sukurtas;
      aktyvusZemelapis = sukurtas;
      piesti();
    }).catch((e) => {
      dezute.innerHTML = `<p class="tuscia">${esc(e.message)}</p>`;
    });
  } else {
    piesti = () => {
      const zz = zodziai();
      const korteles = trasos.map((t) => (atitinka(t, zz) ? kortele(t, zz) : '')).filter(Boolean);
      if (!trasos.length) {
        rezultatai.innerHTML = '<p class="tuscia">Trasų dar nėra. Spauskite „＋ Nauja“.</p>';
      } else if (!korteles.length) {
        rezultatai.innerHTML = `<p class="tuscia">Pagal „${esc(paieskosZodis)}“ nieko nerasta.</p>`;
      } else {
        rezultatai.innerHTML = korteles.join('');
      }
      sk.textContent = zz.length ? `Rasta: ${korteles.length} iš ${trasos.length}` : '';
    };
  }

  let laikmatis = null;
  laukas.addEventListener('input', () => {
    paieskosZodis = laukas.value;
    clearTimeout(laikmatis);
    laikmatis = setTimeout(piesti, zemelapis ? 350 : 0);
  });
  laukas.addEventListener('keydown', (e) => { if (e.key === 'Enter') laukas.blur(); });
  piesti();
}

// ---- Trasos langas ----
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

function trasa(t) {
  const taskai = geriTaskai(t);
  const failai = (t.failai || []).filter((f) => f && f.kelias);
  const nuotraukos = failai.filter((f) => NUOTRAUKOS.includes(pletinys(f.kelias)));
  const kiti = failai.filter((f) => !NUOTRAUKOS.includes(pletinys(f.kelias)));
  const faktai = Object.entries(Object.assign(t.data ? { Data: t.data } : {}, t.faktai || {}));
  const h = [];

  h.push('<div class="virsutine-eilute"><a href="#/" class="atgal">← Visos trasos</a>'
    + (Admin.prisijungta() ? `<a class="mygtukas antrinis mazas" href="#/redaguoti/${encodeURIComponent(t.id)}">✏️ Redaguoti</a>` : '')
    + '</div>');
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

  if (taskai.length || Zemelapis.gpxFailas(t)) {
    h.push('<section><h2>Žemėlapis</h2><div class="zem-mazas" id="trasos-zemelapis"></div>');
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

// ---- Langu perjungimas ----
function eitiI(hash) {
  if (location.hash === hash || (hash === '#/' && !location.hash)) rodyti();
  else location.hash = hash;
}

function poPrisijungimo(tekstas) {
  pranesimas = tekstas;
  history.replaceState(null, '', '#/');
  antraste();
  ikelti();
}

function poIssaugojimo(nauji, id, tekstas) {
  duomenys = nauji;
  klaida = null;
  pranesimas = tekstas;
  antraste();
  eitiI(id ? '#/trasa/' + encodeURIComponent(id) : '#/');
}

function rodyti() {
  const [tipas, id] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  const pavadinimas = (duomenys && duomenys.pavadinimas) || 'AtvVilx trasos';
  document.title = pavadinimas;
  if (aktyvusZemelapis) {
    aktyvusZemelapis.sunaikinti();
    aktyvusZemelapis = null;
  }

  if (tipas === 'nustatymai') {
    Admin.rodytiNustatymus(turinys, poPrisijungimo);
  } else if ((tipas === 'nauja' || tipas === 'redaguoti') && !Admin.prisijungta()) {
    Admin.rodytiNustatymus(turinys, poPrisijungimo);
    pranesimas = pranesimas || 'Norėdami kurti ar redaguoti trasas, pirmiausia įjunkite redagavimą šiame telefone.';
  } else if (klaida && !duomenys) {
    const patarimas = klaida === 'nerastas'
      ? 'Serveryje nėra šio failo. Patikrinkite, ar įkeltas aplankas <code>data</code> (mažosiomis raidėmis) ir jame failas <code>trasos.json</code>.'
      : location.protocol === 'file:'
        ? 'Puslapis atidarytas tiesiai iš disko – taip neveikia. Paleiskite paleisti-lokaliai.bat arba atidarykite interneto adresą.'
        : 'Jei ką tik redagavote šį failą – greičiausiai trūksta kablelio ar kabutės. Patikrinkite jį svetainėje jsonlint.com.';
    turinys.innerHTML = `<div class="klaida"><strong>Nepavyko įkelti duomenų.</strong>
      <p>Failas <code>${DUOMENYS}</code>: ${klaida === 'nerastas' ? 'nerastas (404)' : esc(klaida)}</p>
      <p>${patarimas}</p></div>`;
  } else if (!duomenys) {
    turinys.innerHTML = '<p class="kraunama">Kraunama…</p>';
    return;
  } else if (tipas === 'nauja') {
    Admin.rodytiForma(turinys, null, poIssaugojimo);
    document.title = 'Nauja trasa – ' + pavadinimas;
  } else if (tipas === 'trasa' || tipas === 'redaguoti') {
    const t = (duomenys.trasos || []).find((x) => String(x.id) === id);
    if (!t) {
      turinys.innerHTML = '<a href="#/" class="atgal">← Visos trasos</a><p class="tuscia">Tokia trasa nerasta.</p>';
    } else if (tipas === 'redaguoti') {
      Admin.rodytiForma(turinys, t, poIssaugojimo);
      document.title = 'Redaguoti – ' + (t.pavadinimas || t.id);
    } else {
      turinys.innerHTML = trasa(t);
      document.title = (t.pavadinimas || t.id) + ' – ' + pavadinimas;
      const zemDezute = document.getElementById('trasos-zemelapis');
      if (zemDezute) {
        Zemelapis.sukurti(zemDezute, { vienas: true }).then((z) => {
          if (!zemDezute.isConnected) { z.sunaikinti(); return; }
          aktyvusZemelapis = z;
          z.atnaujinti([t]);
        }).catch((e) => {
          zemDezute.innerHTML = `<p class="tuscia">${esc(e.message)}</p>`;
        });
      }
      const off = turinys.querySelector('[data-veiksmas="offline"]');
      if (off) off.addEventListener('click', () => issaugotiOffline(t, off));
      turinys.querySelector('[data-veiksmas="dalintis"]').addEventListener('click', dalintis);
    }
  } else {
    sarasoLangas(tipas);
  }

  if (pranesimas) {
    turinys.insertAdjacentHTML('afterbegin', `<div class="pranesimas">${esc(pranesimas)}</div>`);
    pranesimas = '';
  }
  window.scrollTo(0, 0);
}

function antraste() {
  document.getElementById('pavadinimas').textContent = (duomenys && duomenys.pavadinimas) || 'AtvVilx trasos';
  document.getElementById('atnaujinta').textContent =
    (duomenys && duomenys.atnaujinta ? 'Atnaujinta: ' + duomenys.atnaujinta + ' · ' : '') + 'v' + VERSIJA;
  document.getElementById('redagavimas').textContent = Admin.prisijungta() ? '✓ Redagavimas' : '🔑 Redagavimas';
}

async function ikelti() {
  // Redaguotojui - tiesiai is GitHub (matosi ka tik issaugoti pakeitimai), kitiems - is puslapio
  if (Admin.prisijungta() && navigator.onLine) {
    try {
      duomenys = await Admin.skaityti();
      klaida = null;
      antraste();
      rodyti();
      return;
    } catch (e) {
      pranesimas = '⚠️ Redagavimas neveikia: ' + e.message;
    }
  }
  try {
    const r = await fetch(DUOMENYS, { cache: 'no-store' });
    if (r.status === 404) throw new Error('nerastas');
    if (!r.ok) throw new Error('serveris grąžino klaidą ' + r.status);
    duomenys = await r.json();
    klaida = null;
  } catch (e) {
    klaida = e.message;
  }
  antraste();
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
      + '<p><strong>Xiaomi:</strong> jei nieko neatsiranda – telefono Nustatymai → Programos → Chrome → Kiti leidimai → '
      + '<strong>Pagrindinio ekrano nuorodos → Leisti</strong>.</p>';
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
antraste();
rodyti();
ikelti();

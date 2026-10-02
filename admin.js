'use strict';

// Trasu kurimas ir redagavimas is puslapio per GitHub API.
// GitHub raktas (token) saugomas tik sio telefono / narsykles atmintyje ir siunciamas tik i api.github.com.
// Naudoja pagalbines funkcijas esc() ir dydis() is app.js.
const Admin = (() => {
  const RAKTAS = 'trasos-redagavimas';
  const MAX_DYDIS = 25 * 1024 * 1024;

  function nustatymai() {
    try { return JSON.parse(localStorage.getItem(RAKTAS)) || null; } catch (e) { return null; }
  }
  function issaugotiNustatymus(n) {
    try {
      if (n) localStorage.setItem(RAKTAS, JSON.stringify(n));
      else localStorage.removeItem(RAKTAS);
      return true;
    } catch (e) {
      return false;
    }
  }
  const prisijungta = () => {
    const n = nustatymai();
    return !!(n && n.raktas && n.savininkas && n.repo);
  };

  // https://vardas.github.io/trasos/ -> vardas / trasos
  function atspetiSaugykla() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return { savininkas: '', repo: '' };
    const pirmas = location.pathname.split('/').filter(Boolean)[0];
    return { savininkas: m[1], repo: pirmas && !pirmas.includes('.') ? pirmas : m[0].toLowerCase() };
  }

  function klaidosTekstas(status) {
    if (status === 401) return 'GitHub raktas neteisingas arba nebegalioja. Susikurkite naują (🔑 Redagavimas).';
    if (status === 403) return 'Raktas neturi teisės rašyti. Kuriant raktą „Contents“ turi būti „Read and write“.';
    if (status === 404) return 'Nerasta saugykla. Patikrinkite vartotojo vardą, saugyklos pavadinimą ir ar raktui suteikta prieiga prie šios saugyklos.';
    if (status === 413 || status === 422) return 'GitHub atmetė failą (gal per didelis?).';
    return 'GitHub klaida ' + status + '. Patikrinkite interneto ryšį ir bandykite dar kartą.';
  }

  function api(kelias, opts, n) {
    n = n || nustatymai();
    const url = `https://api.github.com/repos/${encodeURIComponent(n.savininkas)}/${encodeURIComponent(n.repo)}/contents/`
      + kelias.split('/').map(encodeURIComponent).join('/');
    return fetch(url, Object.assign({ cache: 'no-store' }, opts, {
      headers: Object.assign(
        { Authorization: 'Bearer ' + n.raktas, Accept: 'application/vnd.github+json' },
        (opts && opts.headers) || {}
      ),
    }));
  }

  const isBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  function iBase64(tekstas) {
    const b = new TextEncoder().encode(tekstas);
    let x = '';
    for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(x);
  }
  const blobBase64 = (blob) => new Promise((ok, blogai) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => blogai(r.error);
    r.readAsDataURL(blob);
  });

  function klaida(status) {
    const e = new Error(klaidosTekstas(status));
    e.status = status;
    return e;
  }

  async function skaityti(n) {
    const r = await api('data/trasos.json', undefined, n);
    if (!r.ok) throw klaida(r.status);
    const j = await r.json();
    return { duomenys: JSON.parse(isBase64(j.content)), sha: j.sha };
  }

  async function rasyti(kelias, base64, zinute, sha) {
    const r = await api(kelias, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ message: zinute, content: base64 }, sha ? { sha } : {})),
    });
    if (!r.ok) throw klaida(r.status);
    return r.json();
  }

  async function trinti(kelias, zinute) {
    const r = await api(kelias);
    if (!r.ok) return;
    const { sha } = await r.json();
    await api(kelias, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: zinute, sha }),
    });
  }

  // Visada skaitom naujausia trasos.json, pakeiciam ir irasom (jei kas nors pakeite tuo paciu metu - kartojam)
  async function keistiDuomenis(keitimas, zinute) {
    for (let i = 0; i < 3; i++) {
      const { duomenys, sha } = await skaityti();
      if (!Array.isArray(duomenys.trasos)) duomenys.trasos = [];
      keitimas(duomenys);
      duomenys.atnaujinta = new Date().toISOString().slice(0, 10);
      try {
        await rasyti('data/trasos.json', iBase64(JSON.stringify(duomenys, null, 2) + '\n'), zinute, sha);
        return duomenys;
      } catch (e) {
        if (e.status !== 409) throw e;
      }
    }
    throw new Error('Nepavyko išsaugoti – bandykite dar kartą.');
  }

  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  }
  function failoVardas(vardas) {
    const m = String(vardas).match(/^(.*?)(\.[A-Za-z0-9]{1,6})?$/);
    return (slug(m[1]) || 'failas') + (m[2] ? m[2].toLowerCase() : '');
  }

  // Didelės telefono nuotraukos sumažinamos iki 2000 px (uzima ~10 kartu maziau vietos)
  async function paruostiFaila(failas) {
    const kaip_yra = { blob: failas, vardas: failas.name };
    if (!/^image\/(jpeg|webp)$/.test(failas.type) || !window.createImageBitmap) return kaip_yra;
    try {
      const img = await createImageBitmap(failas);
      const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      if (k === 1 && failas.size < 1.5e6) return kaip_yra;
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob || blob.size >= failas.size) return kaip_yra;
      return { blob, vardas: failas.name.replace(/\.[^.]+$/, '') + '.jpg' };
    } catch (e) {
      return kaip_yra;
    }
  }

  async function ikeltiFaila(failas, aplankas) {
    const { blob, vardas } = await paruostiFaila(failas);
    if (blob.size > MAX_DYDIS) throw new Error(`„${failas.name}“ per didelis (${dydis(blob.size)}). Daugiausia 25 MB.`);
    let kelias = `failai/${aplankas}/${failoVardas(vardas)}`;
    if ((await api(kelias)).ok) kelias = kelias.replace(/(\.[^./]+)?$/, '-' + Date.now().toString(36) + '$1');
    await rasyti(kelias, await blobBase64(blob), 'Įkeltas failas ' + kelias);
    return kelias;
  }

  // ---- Formos laukai <-> duomenys ----
  const eilutes = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const KOORD = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/;
  const TEL = /^\+?[\d\s()-]{6,}$/;

  function iTeksta(t) {
    return {
      aprasymas: [].concat(t.aprasymas || []).join('\n'),
      faktai: Object.entries(t.faktai || {}).map(([k, v]) => (v ? k + ': ' + v : k)).join('\n'),
      taskai: (t.taskai || []).map((x) => [x.pavadinimas || 'Taškas', x.lat + ', ' + x.lng, x.pastaba].filter(Boolean).join('; ')).join('\n'),
      kontaktai: (t.kontaktai || []).map((k) => [k.vardas, k.tel, k.pastaba].filter(Boolean).join('; ')).join('\n'),
    };
  }

  function skaitytiTaskus(s) {
    const taskai = [];
    const blogos = [];
    for (const x of eilutes(s)) {
      const dalys = x.split(';').map((d) => d.trim());
      const i = dalys.findIndex((d) => KOORD.test(d));
      if (i < 0) { blogos.push(x); continue; }
      const m = dalys[i].match(KOORD);
      const t = { pavadinimas: dalys.slice(0, i).join('; ') || 'Taškas', lat: +m[1], lng: +m[2] };
      const pastaba = dalys.slice(i + 1).filter(Boolean).join('; ');
      if (pastaba) t.pastaba = pastaba;
      taskai.push(t);
    }
    return { taskai, blogos };
  }

  function skaitytiFaktus(s) {
    const f = {};
    for (const x of eilutes(s)) {
      const i = x.indexOf(':');
      if (i > 0) f[x.slice(0, i).trim()] = x.slice(i + 1).trim();
      else f[x] = '';
    }
    return f;
  }

  function skaitytiKontaktus(s) {
    return eilutes(s).map((x) => {
      const dalys = x.split(';').map((d) => d.trim()).filter(Boolean);
      const k = {};
      const ti = dalys.findIndex((d) => TEL.test(d));
      if (ti >= 0) k.tel = dalys.splice(ti, 1)[0];
      if (dalys.length) k.vardas = dalys.shift();
      if (dalys.length) k.pastaba = dalys.join('; ');
      return k;
    });
  }

  function nustatytiLauka(obj, raktas, reiksme) {
    const tuscia = reiksme == null || reiksme === '' || (Array.isArray(reiksme) && !reiksme.length)
      || (typeof reiksme === 'object' && !Array.isArray(reiksme) && !Object.keys(reiksme).length);
    if (tuscia) delete obj[raktas];
    else obj[raktas] = reiksme;
  }

  // ---- Nustatymu langas ----
  function rodytiNustatymus(el, poPakeitimo) {
    const n = nustatymai() || {};
    const sp = atspetiSaugykla();
    const ijungta = prisijungta();
    el.innerHTML = `
      <a href="#/" class="atgal">← Atgal</a>
      <h1>Redagavimas</h1>
      ${ijungta ? `<div class="pranesimas">✓ Šiame telefone redagavimas įjungtas (<strong>${esc(n.savininkas)}/${esc(n.repo)}</strong>). Pagrindiniame lange spauskite „＋ Nauja“.</div>` : ''}
      <section>
        <h2>Kaip tai veikia</h2>
        <p>Naujos trasos ir failai išsaugomi jūsų GitHub saugykloje. Tam šis telefonas turi gauti <strong>GitHub raktą</strong> (token). Jis saugomas tik šiame telefone.</p>
        <p>Kiti lankytojai be rakto gali tik žiūrėti.</p>
      </section>
      <section>
        <h2>Kaip gauti raktą (vieną kartą)</h2>
        <ol class="zingsniai">
          <li>Atidarykite <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a> ir prisijunkite.</li>
          <li><strong>Token name:</strong> pvz. <em>trasos telefonas</em>. <strong>Expiration:</strong> pvz. 1 metai (<em>Custom</em>).</li>
          <li><strong>Repository access:</strong> <em>Only select repositories</em> → pasirinkite <strong>${esc(sp.repo || 'trasos')}</strong>.</li>
          <li><strong>Permissions</strong> → <em>Add permissions</em> → <strong>Contents</strong> → <em>Read and write</em>.</li>
          <li>Apačioje <strong>Generate token</strong> → nukopijuokite raktą (prasideda <code>github_pat_</code>) ir įklijuokite žemiau.</li>
        </ol>
      </section>
      <section class="forma">
        <h2>Prisijungimas</h2>
        <label>GitHub vartotojo vardas<input type="text" id="n-savininkas" value="${esc(n.savininkas || sp.savininkas)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
        <label>Saugyklos pavadinimas<input type="text" id="n-repo" value="${esc(n.repo || sp.repo)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
        <label>GitHub raktas<input type="password" id="n-raktas" placeholder="${n.raktas ? '•••••••• (išsaugotas)' : 'github_pat_…'}" autocomplete="off"></label>
        <div class="eiga" id="n-eiga"></div>
        <div class="formos-veiksmai">
          <button class="mygtukas" id="n-saugoti">✓ Patikrinti ir įjungti</button>
          ${ijungta ? '<button class="mygtukas pavojingas" id="n-isjungti">Išjungti šiame telefone</button>' : ''}
        </div>
      </section>`;

    const eiga = (t) => { el.querySelector('#n-eiga').textContent = t; };
    el.querySelector('#n-saugoti').addEventListener('click', async (e) => {
      const naujas = {
        savininkas: el.querySelector('#n-savininkas').value.trim(),
        repo: el.querySelector('#n-repo').value.trim(),
        raktas: el.querySelector('#n-raktas').value.trim() || n.raktas || '',
      };
      if (!naujas.savininkas || !naujas.repo || !naujas.raktas) { eiga('⚠️ Užpildykite visus laukus.'); return; }
      e.target.disabled = true;
      eiga('⏳ Tikrinama…');
      try {
        await skaityti(naujas);
        if (!issaugotiNustatymus(naujas)) throw new Error('Naršyklė neleidžia išsaugoti nustatymų (gal įjungtas privatus režimas?).');
        poPakeitimo('✓ Redagavimas įjungtas. Dabar galite kurti naujas trasas.');
      } catch (err) {
        eiga('❌ ' + err.message);
        e.target.disabled = false;
      }
    });
    const isj = el.querySelector('#n-isjungti');
    if (isj) {
      isj.addEventListener('click', () => {
        issaugotiNustatymus(null);
        poPakeitimo('Redagavimas šiame telefone išjungtas.');
      });
    }
  }

  // ---- Trasos kurimo / redagavimo forma ----
  function rodytiForma(el, t, poIssaugojimo) {
    const naujas = !t;
    t = t || {};
    const tx = iTeksta(t);
    const esami = (t.failai || []).filter((f) => f && f.kelias).map((f) => Object.assign({}, f, { salinti: false }));
    const nauji = [];

    el.innerHTML = `
      <a href="${naujas ? '#/' : '#/trasa/' + encodeURIComponent(t.id)}" class="atgal">← Atšaukti</a>
      <h1>${naujas ? 'Nauja trasa' : 'Redaguoti trasą'}</h1>
      <section class="forma">
        <label>Pavadinimas *<input type="text" id="f-pavadinimas" value="${esc(t.pavadinimas)}"></label>
        <label>Data / laikas<span class="pagalba">Nebūtina, pvz. 2026-10-12, 10:00</span><input type="text" id="f-data" value="${esc(t.data)}"></label>
        <label>Trumpai<span class="pagalba">Vienas sakinys, matomas sąraše</span><input type="text" id="f-trumpai" value="${esc(t.trumpai)}"></label>
        <label>Aprašymas<span class="pagalba">Tuščia eilutė – nauja pastraipa; „- “ eilutės pradžioje – sąrašas; „## “ – antraštė; **paryškinta**</span>
          <textarea id="f-aprasymas" rows="8">${esc(tx.aprasymas)}</textarea></label>
        <label>Trumpi faktai<span class="pagalba">Po vieną eilutėje, pvz. „Ilgis: 45 km“</span>
          <textarea id="f-faktai" rows="4" placeholder="Ilgis: 45 km&#10;Trukmė: 4 val.&#10;Sunkumas: vidutinė">${esc(tx.faktai)}</textarea></label>
        <label>Vietos žemėlapyje<span class="pagalba">Po vieną eilutėje: „Pavadinimas; 54.8857, 24.8530; pastaba“. Koordinates rasite Google Maps palaikę pirštą ant vietos.</span>
          <textarea id="f-taskai" rows="3" placeholder="Startas; 54.8857, 24.8530">${esc(tx.taskai)}</textarea></label>
        <button type="button" class="mygtukas antrinis mazas" id="f-vieta">📍 Pridėti mano dabartinę vietą</button>
        <label>Kontaktai<span class="pagalba">Po vieną eilutėje: „Vardas; telefonas; pastaba“</span>
          <textarea id="f-kontaktai" rows="2" placeholder="Jonas; +370 600 00000">${esc(tx.kontaktai)}</textarea></label>
        <label>Žemėlapio nuoroda<span class="pagalba">Nebūtina – Google My Maps, Komoot ir pan.</span>
          <input type="url" id="f-zemelapis" value="${esc(t.zemelapio_nuoroda)}" placeholder="https://…"></label>
      </section>
      <section class="forma">
        <h2>Failai</h2>
        <div class="failu-sarasas" id="f-failai"></div>
        <p><span class="mygtukas antrinis failu-mygtukas">📎 Pridėti failų<input type="file" id="f-ikelti" multiple></span></p>
        <span class="pagalba">Nuotraukos, PDF, GPX ir kt., iki 25 MB vienas. Didelės nuotraukos automatiškai sumažinamos.</span>
      </section>
      <div class="eiga" id="f-eiga"></div>
      <div class="formos-veiksmai">
        <button class="mygtukas" id="f-saugoti">💾 Išsaugoti</button>
        ${naujas ? '' : '<button class="mygtukas pavojingas" id="f-trinti">🗑️ Ištrinti trasą</button>'}
      </div>`;

    const $ = (s) => el.querySelector(s);
    const eiga = (tekstas) => { $('#f-eiga').textContent = tekstas; };
    const sarasas = $('#f-failai');

    function piestiFailus() {
      const html = [
        ...esami.map((f, i) => `<div class="failo-eilute${f.salinti ? ' salinamas' : ''}">
          <input type="text" data-esamas="${i}" value="${esc(f.pavadinimas || f.kelias.split('/').pop())}" aria-label="Failo pavadinimas">
          <button type="button" class="x" data-salinti="${i}" title="${f.salinti ? 'Grąžinti' : 'Pašalinti'}">${f.salinti ? '↺' : '✕'}</button></div>`),
        ...nauji.map((f, i) => `<div class="failo-eilute">
          <input type="text" data-naujas="${i}" value="${esc(f.pavadinimas)}" aria-label="Failo pavadinimas">
          <span class="dydis">naujas · ${dydis(f.failas.size)}</span>
          <button type="button" class="x" data-ismesti="${i}" title="Neįkelti">✕</button></div>`),
      ];
      sarasas.innerHTML = html.length ? html.join('') : '<p class="pagalba">Failų dar nėra.</p>';
    }
    piestiFailus();

    sarasas.addEventListener('input', (e) => {
      const d = e.target.dataset;
      if (d.esamas != null) esami[d.esamas].pavadinimas = e.target.value;
      if (d.naujas != null) nauji[d.naujas].pavadinimas = e.target.value;
    });
    sarasas.addEventListener('click', (e) => {
      const d = e.target.dataset;
      if (d.salinti != null) { esami[d.salinti].salinti = !esami[d.salinti].salinti; piestiFailus(); }
      if (d.ismesti != null) { nauji.splice(+d.ismesti, 1); piestiFailus(); }
    });
    $('#f-ikelti').addEventListener('change', (e) => {
      for (const failas of e.target.files) nauji.push({ failas, pavadinimas: failas.name.replace(/\.[^.]+$/, '') });
      e.target.value = '';
      piestiFailus();
    });

    $('#f-vieta').addEventListener('click', () => {
      if (!navigator.geolocation) { eiga('Šis telefonas nepalaiko vietos nustatymo.'); return; }
      eiga('⏳ Nustatoma vieta…');
      navigator.geolocation.getCurrentPosition((p) => {
        const ta = $('#f-taskai');
        const kiek = eilutes(ta.value).length;
        ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '')
          + `${kiek ? 'Taškas ' + (kiek + 1) : 'Startas'}; ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`;
        eiga(`✓ Vieta pridėta (tikslumas ~${Math.round(p.coords.accuracy)} m). Pavadinimą galite pakeisti.`);
      }, (err) => {
        eiga('❌ Nepavyko nustatyti vietos: ' + (err.code === 1 ? 'neleista naudoti vietos (leiskite naršyklės nustatymuose).' : err.message));
      }, { enableHighAccuracy: true, timeout: 20000 });
    });

    const mygtukai = () => el.querySelectorAll('.formos-veiksmai button');
    const uzrakinti = (taip) => mygtukai().forEach((b) => { b.disabled = taip; });

    $('#f-saugoti').addEventListener('click', async () => {
      const v = (s) => $(s).value.trim();
      const pavadinimas = v('#f-pavadinimas');
      if (!pavadinimas) { eiga('⚠️ Įrašykite pavadinimą.'); $('#f-pavadinimas').focus(); return; }
      const { taskai, blogos } = skaitytiTaskus($('#f-taskai').value);
      if (blogos.length) { eiga(`⚠️ Neatpažintos koordinatės: „${blogos[0]}“. Turi būti, pvz.: Startas; 54.8857, 24.8530`); return; }

      uzrakinti(true);
      try {
        let id = t.id;
        if (naujas) {
          eiga('⏳ Ruošiama…');
          const { duomenys } = await skaityti();
          const yra = new Set((duomenys.trasos || []).map((x) => String(x.id)));
          const pagrindas = slug(pavadinimas) || 'trasa';
          id = pagrindas;
          for (let i = 2; yra.has(id); i++) id = pagrindas + '-' + i;
        }

        const ikelti = [];
        for (let i = 0; i < nauji.length; i++) {
          const f = nauji[i];
          eiga(`⏳ Keliamas failas ${i + 1} iš ${nauji.length}: ${f.failas.name} (${dydis(f.failas.size)})…`);
          const kelias = await ikeltiFaila(f.failas, id);
          ikelti.push({ pavadinimas: f.pavadinimas.trim() || f.failas.name, kelias });
        }

        const trasa = Object.assign({}, naujas ? {} : t, { id, pavadinimas });
        nustatytiLauka(trasa, 'data', v('#f-data'));
        nustatytiLauka(trasa, 'trumpai', v('#f-trumpai'));
        nustatytiLauka(trasa, 'zemelapio_nuoroda', v('#f-zemelapis'));
        const apr = $('#f-aprasymas').value.replace(/\r/g, '').replace(/\s+$/, '');
        nustatytiLauka(trasa, 'aprasymas', apr ? apr.split('\n') : null);
        nustatytiLauka(trasa, 'faktai', skaitytiFaktus($('#f-faktai').value));
        nustatytiLauka(trasa, 'taskai', taskai);
        nustatytiLauka(trasa, 'kontaktai', skaitytiKontaktus($('#f-kontaktai').value));
        nustatytiLauka(trasa, 'failai', esami.filter((f) => !f.salinti).map((f) => {
          const k = Object.assign({}, f);
          delete k.salinti;
          return k;
        }).concat(ikelti));

        eiga('⏳ Saugoma informacija…');
        const duomenys = await keistiDuomenis((d) => {
          const i = d.trasos.findIndex((x) => String(x.id) === String(id));
          if (i >= 0) d.trasos[i] = trasa;
          else d.trasos.unshift(trasa);
        }, (naujas ? 'Nauja trasa: ' : 'Pakeista trasa: ') + pavadinimas);

        for (const f of esami.filter((x) => x.salinti && /^failai\//.test(x.kelias))) {
          eiga('⏳ Šalinamas failas ' + f.kelias + '…');
          try { await trinti(f.kelias, 'Pašalintas failas ' + f.kelias); } catch (e) { /* nesvarbu */ }
        }

        poIssaugojimo(duomenys, id, ikelti.length
          ? '✓ Išsaugota. Nauji failai atsidarys po 1–2 min., kol GitHub atnaujins puslapį.'
          : '✓ Išsaugota.');
      } catch (e) {
        eiga('❌ ' + e.message);
        uzrakinti(false);
      }
    });

    const trintiMygtukas = $('#f-trinti');
    if (trintiMygtukas) {
      trintiMygtukas.addEventListener('click', async () => {
        if (!confirm(`Ištrinti trasą „${t.pavadinimas}“ ir visus jos failus?`)) return;
        uzrakinti(true);
        try {
          eiga('⏳ Trinama…');
          const duomenys = await keistiDuomenis((d) => {
            d.trasos = d.trasos.filter((x) => String(x.id) !== String(t.id));
          }, 'Ištrinta trasa: ' + t.pavadinimas);
          for (const f of esami.filter((x) => /^failai\//.test(x.kelias))) {
            try { await trinti(f.kelias, 'Pašalintas failas ' + f.kelias); } catch (e) { /* nesvarbu */ }
          }
          poIssaugojimo(duomenys, null, 'Trasa ištrinta.');
        } catch (e) {
          eiga('❌ ' + e.message);
          uzrakinti(false);
        }
      });
    }
  }

  return {
    prisijungta,
    skaityti: async () => (await skaityti()).duomenys,
    rodytiNustatymus,
    rodytiForma,
  };
})();

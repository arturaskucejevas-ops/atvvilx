'use strict';

// AtvVilx nuolaidos ir nariai.
// Duomenys: data/nuolaidos.json ir data/nariai.json (sukuriami automatiskai pridejus pirma irasa).
// Naudoja esc(), tekstas(), be(), zymeti(), href(), poPrisijungimo() is app.js ir Admin is admin.js.
const Skyriai = (() => {
  const MAIKES = ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
  const TIPAI = { narys: 'Tikras narys', pretendentas: 'Pretendentas' };

  const SKYRIAI = {
    nuolaidos: {
      failas: 'data/nuolaidos.json',
      antraste: 'AtvVilx nuolaidos',
      atgal: '← Visos nuolaidos',
      naujas: 'Nauja nuolaida',
      redaguoti: 'Redaguoti nuolaidą',
      tuscia: 'Nuolaidų dar nėra.',
      paieska: 'Ieškoti įmonės, nuolaidos…',
      nuotrauka: { raktas: 'logotipas', pavadinimas: 'Įmonės logotipas ar nuotrauka', max: 800, apvali: false },
      laukai: [
        { raktas: 'imone', pavadinimas: 'Įmonės pavadinimas', privalomas: true },
        { raktas: 'nuolaida', pavadinimas: 'Nuolaida', privalomas: true, pagalba: 'Pvz. „10%“ arba „15% detalėms, 5% darbams“' },
        { raktas: 'kam', pavadinimas: 'Kam taikoma', pagalba: 'Pvz. „visoms detalėms ir priedams“' },
        { raktas: 'kategorija', pavadinimas: 'Kategorija', sarasas: true, pagalba: 'Pvz. Detalės, Servisas, Kuras, Apgyvendinimas' },
        { raktas: 'salygos', pavadinimas: 'Kaip gauti nuolaidą', tipas: 'textarea', eil: 2, pagalba: 'Pvz. „parodyti, kad esi AtvVilx narys“, „nuolaidos kodas ATVVILX“' },
        { raktas: 'galioja', pavadinimas: 'Galioja iki', pagalba: 'Nebūtina, pvz. 2026-12-31' },
        { raktas: 'adresas', pavadinimas: 'Adresas', pagalba: 'Kur yra įmonė – bus nuoroda į Google Maps' },
        { raktas: 'tel', pavadinimas: 'Telefonas', tipas: 'tel' },
        { raktas: 'svetaine', pavadinimas: 'Svetainė', tipas: 'url', vieta: 'https://…' },
        { raktas: 'el_pastas', pavadinimas: 'El. paštas', tipas: 'email' },
        { raktas: 'aprasymas', pavadinimas: 'Informacija apie įmonę', tipas: 'textarea', eil: 6, pagalba: 'Tuščia eilutė – nauja pastraipa; „- “ eilutės pradžioje – sąrašas' },
      ],
      vardas: (x) => x.imone || '',
      rikiuoti: (a, b) => (a.imone || '').localeCompare(b.imone || '', 'lt'),
    },
    nariai: {
      failas: 'data/nariai.json',
      antraste: 'AtvVilx nariai',
      atgal: '← Visi nariai',
      naujas: 'Naujas narys',
      redaguoti: 'Redaguoti narį',
      tuscia: 'Narių dar nėra.',
      paieska: 'Ieškoti pagal vardą, pavardę…',
      nuotrauka: { raktas: 'foto', pavadinimas: 'Nuotrauka', max: 1000, apvali: true },
      laukai: [
        { raktas: 'vardas', pavadinimas: 'Vardas', privalomas: true },
        { raktas: 'pavarde', pavadinimas: 'Pavardė', privalomas: true },
        { raktas: 'tipas', pavadinimas: 'Narystė', tipas: 'select', parinktys: [['narys', TIPAI.narys], ['pretendentas', TIPAI.pretendentas]] },
        { raktas: 'nuo', pavadinimas: 'Klube nuo', pagalba: 'Nebūtina, pvz. 2026-05-01' },
        { raktas: 'maikes_dydis', pavadinimas: 'Maikės dydis', tipas: 'select', parinktys: MAIKES.map((d) => [d, d || '—']) },
        { raktas: 'maikes_info', pavadinimas: 'Maikės info', pagalba: 'Pvz. užrašas ant nugaros, numeris, ar jau išduota' },
        { raktas: 'technika', pavadinimas: 'Technika', pagalba: 'Nebūtina, pvz. CFMOTO CForce 1000' },
        { raktas: 'pastabos', pavadinimas: 'Pastabos', tipas: 'textarea', eil: 3 },
      ],
      vardas: (x) => [x.vardas, x.pavarde].filter(Boolean).join(' '),
      rikiuoti: (a, b) => (a.pavarde || '').localeCompare(b.pavarde || '', 'lt') || (a.vardas || '').localeCompare(b.vardas || '', 'lt'),
    },
  };

  const atmintis = {};       // skyrius -> irasu masyvas
  const filtras = { nuolaidos: '', nariai: '' };
  const paieska = { nuolaidos: '', nariai: '' };
  let pranesimas = '';

  // ---- Duomenys ----
  async function ikelti(skyrius) {
    const s = SKYRIAI[skyrius];
    if (Admin.prisijungta() && navigator.onLine) {
      try {
        const r = await Admin.skaitytiFaila(s.failas);
        return (r && r.duomenys[skyrius]) || [];
      } catch (e) {
        pranesimas = '⚠️ Redagavimas neveikia: ' + e.message;
      }
    }
    const r = await fetch(s.failas, { cache: 'no-store' });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('serveris grąžino klaidą ' + r.status);
    return (await r.json())[skyrius] || [];
  }

  const paieskosTekstas = (s, x) => s.laukai.map((f) => {
    const v = x[f.raktas];
    if (f.raktas === 'tipas') return TIPAI[v] || '';
    return v == null ? '' : String(v);
  }).join(' ');

  const pasibaigusi = (x) => /^\d{4}-\d{2}-\d{2}/.test(x.galioja || '') && x.galioja.slice(0, 10) < new Date().toISOString().slice(0, 10);

  // ---- Bendri gabaliukai ----
  function raidesIrSpalva(x) {
    const r = ((x.vardas || x.imone || '?')[0] + (x.pavarde ? x.pavarde[0] : '')).toUpperCase();
    let h = 0;
    for (const c of String(x.id || r)) h = (h * 31 + c.charCodeAt(0)) | 0;
    const spalvos = ['#f47b20', '#3e7b3a', '#2e86de', '#8e44ad', '#c2185b', '#16a085', '#d35400'];
    return { r, c: spalvos[Math.abs(h) % spalvos.length] };
  }
  function inicialai(x, klase) {
    const { r, c } = raidesIrSpalva(x);
    return `<span class="inicialai ${klase}" style="background:${c}">${esc(r)}</span>`;
  }
  // Jei nuotrauka dar neatsiunciama (pvz. ka tik ikelta) - rodom raides
  function paveiksliukas(s, x, klase) {
    const kelias = x[s.nuotrauka.raktas];
    if (!kelias) return inicialai(x, klase);
    const { r, c } = raidesIrSpalva(x);
    return `<img class="${klase}" src="${href(kelias)}" alt="" loading="lazy" data-r="${esc(r)}" data-c="${c}">`;
  }
  document.addEventListener('error', (e) => {
    const i = e.target;
    if (i.tagName !== 'IMG' || !i.dataset.r) return;
    const s = document.createElement('span');
    s.className = i.className + ' inicialai';
    s.style.background = i.dataset.c;
    s.textContent = i.dataset.r;
    i.replaceWith(s);
  }, true);
  const zenklas = (tipas) => `<span class="zenklas ${tipas === 'pretendentas' ? 'pretendentas' : 'narys'}">${esc(TIPAI[tipas] || TIPAI.narys)}</span>`;

  // ---- Sarasas ----
  function kortele(skyrius, x, zz) {
    const s = SKYRIAI[skyrius];
    const nuoroda = `#/${skyrius}/${encodeURIComponent(x.id)}`;
    if (skyrius === 'nuolaidos') {
      const sena = pasibaigusi(x);
      return `<a class="kortele su-paveiksliuku${sena ? ' pasibaigusi' : ''}" href="${nuoroda}">
        ${paveiksliukas(s, x, 'miniatiura')}
        <span class="vidus">
          <h2>${zymeti(x.imone, zz)}</h2>
          ${x.kam ? `<p>${zymeti(x.kam, zz)}</p>` : ''}
          <span class="metaduom">${x.kategorija ? `<span>🏷️ ${zymeti(x.kategorija, zz)}</span>` : ''}${x.adresas ? `<span>📍 ${zymeti(x.adresas, zz)}</span>` : ''}${sena ? '<span>⚠️ nebegalioja</span>' : ''}</span>
        </span>
        <span class="nuolaidos-zenklas">${zymeti(x.nuolaida, zz)}</span>
      </a>`;
    }
    const meta = [x.maikes_dydis && '👕 ' + esc(x.maikes_dydis), x.technika && '🏍️ ' + zymeti(x.technika, zz)].filter(Boolean);
    return `<a class="kortele su-paveiksliuku" href="${nuoroda}">
      ${paveiksliukas(s, x, 'miniatiura apvali')}
      <span class="vidus">
        <h2>${zymeti(s.vardas(x), zz)}</h2>
        <span class="metaduom">${zenklas(x.tipas)}${meta.map((m) => `<span>${m}</span>`).join('')}</span>
      </span>
      <span class="rodykle">›</span>
    </a>`;
  }

  function filtruIrankis(skyrius, visi) {
    let parinktys;
    if (skyrius === 'nariai') {
      const kiek = (t) => visi.filter((x) => (x.tipas || 'narys') === t).length;
      parinktys = [['', `Visi (${visi.length})`], ['narys', `Tikri nariai (${kiek('narys')})`], ['pretendentas', `Pretendentai (${kiek('pretendentas')})`]];
    } else {
      const kat = [...new Set(visi.map((x) => x.kategorija).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'lt'));
      if (!kat.length) return '';
      parinktys = [['', 'Visos'], ...kat.map((k) => [k, k])];
    }
    return '<div class="filtrai">' + parinktys.map(([v, t]) => `<button type="button" data-filtras="${esc(v)}"${filtras[skyrius] === v ? ' class="aktyvus"' : ''}>${esc(t)}</button>`).join('') + '</div>';
  }

  function sarasas(el, skyrius, visi) {
    const s = SKYRIAI[skyrius];
    if (skyrius === 'nuolaidos' && filtras.nuolaidos && !visi.some((x) => x.kategorija === filtras.nuolaidos)) filtras.nuolaidos = '';
    el.innerHTML = `
      <h1 class="skyriaus-antraste">${esc(s.antraste)}</h1>
      <div class="irankiai">
        <input class="paieska" type="search" enterkeyhint="search" placeholder="${esc(s.paieska)}" aria-label="Paieška" value="${esc(paieska[skyrius])}">
        <a class="mygtukas" href="#/${skyrius}/nauja">＋ Nauja${skyrius === 'nariai' ? 's' : ''}</a>
      </div>
      ${filtruIrankis(skyrius, visi)}
      <div class="rezultatu-sk"></div>
      <div class="rezultatai"></div>`;
    const laukas = el.querySelector('.paieska');
    const rez = el.querySelector('.rezultatai');
    const sk = el.querySelector('.rezultatu-sk');

    const piesti = () => {
      const zz = be(paieska[skyrius]).split(/\s+/).filter(Boolean);
      const f = filtras[skyrius];
      const rastos = visi
        .filter((x) => !f || (skyrius === 'nariai' ? (x.tipas || 'narys') === f : x.kategorija === f))
        .filter((x) => { const t = be(paieskosTekstas(s, x)); return zz.every((z) => t.includes(z)); })
        .sort(skyrius === 'nuolaidos' ? (a, b) => pasibaigusi(a) - pasibaigusi(b) || s.rikiuoti(a, b) : s.rikiuoti);
      if (!visi.length) rez.innerHTML = `<p class="tuscia">${esc(s.tuscia)} Spauskite „＋ Nauja${skyrius === 'nariai' ? 's' : ''}“.</p>`;
      else if (!rastos.length) rez.innerHTML = '<p class="tuscia">Nieko nerasta.</p>';
      else rez.innerHTML = rastos.map((x) => kortele(skyrius, x, zz)).join('');
      sk.textContent = zz.length || f ? `Rasta: ${rastos.length} iš ${visi.length}` : '';
    };
    laukas.addEventListener('input', () => { paieska[skyrius] = laukas.value; piesti(); });
    laukas.addEventListener('keydown', (e) => { if (e.key === 'Enter') laukas.blur(); });
    el.querySelectorAll('[data-filtras]').forEach((b) => b.addEventListener('click', () => {
      filtras[skyrius] = b.dataset.filtras;
      el.querySelectorAll('[data-filtras]').forEach((x) => x.classList.toggle('aktyvus', x === b));
      piesti();
    }));
    piesti();
  }

  // ---- Perziura ----
  function perziura(el, skyrius, x) {
    const s = SKYRIAI[skyrius];
    const h = [];
    h.push(`<div class="virsutine-eilute"><a href="#/${skyrius}" class="atgal">${esc(s.atgal)}</a>`
      + (Admin.prisijungta() ? `<a class="mygtukas antrinis mazas" href="#/${skyrius}/${encodeURIComponent(x.id)}/redaguoti">✏️ Redaguoti</a>` : '')
      + '</div>');

    if (skyrius === 'nuolaidos') {
      h.push(`<div class="imones-virsus">${x.logotipas ? paveiksliukas(s, x, 'logotipas') : ''}
        <div><h1>${esc(x.imone)}</h1>${x.kategorija ? `<span class="zenklas narys">${esc(x.kategorija)}</span>` : ''}</div></div>`);
      h.push(`<section><h2>Nuolaida</h2><div class="didelis-zenklas">${esc(x.nuolaida)}</div>
        ${x.kam ? `<p><strong>Kam taikoma:</strong> ${esc(x.kam)}</p>` : ''}
        ${x.salygos ? `<p><strong>Kaip gauti:</strong></p>${tekstas(x.salygos)}` : ''}
        ${x.galioja ? `<p>${pasibaigusi(x) ? '⚠️ <strong>Nebegalioja</strong> (galiojo iki ' + esc(x.galioja) + ')' : '📅 Galioja iki <strong>' + esc(x.galioja) + '</strong>'}</p>` : ''}
      </section>`);
      if (x.aprasymas) h.push(`<section><h2>Apie įmonę</h2>${tekstas(x.aprasymas)}</section>`);
      const k = [];
      if (x.adresas) k.push(eilute('📍', x.adresas, 'Atidaryti žemėlapyje', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.adresas)}`, true));
      if (x.tel) k.push(eilute('📞', x.tel, 'Skambinti', 'tel:' + String(x.tel).replace(/[^\d+]/g, '')));
      if (x.svetaine) k.push(eilute('🌐', x.svetaine.replace(/^https?:\/\//, '').replace(/\/$/, ''), 'Svetainė', /^https?:\/\//i.test(x.svetaine) ? x.svetaine : 'https://' + x.svetaine, true));
      if (x.el_pastas) k.push(eilute('✉️', x.el_pastas, 'Rašyti laišką', 'mailto:' + x.el_pastas));
      if (k.length) h.push(`<section><h2>Kontaktai</h2>${k.join('')}</section>`);
    } else {
      h.push(`<div class="profilis">${paveiksliukas(s, x, 'didele')}<h1>${esc(s.vardas(x))}</h1>${zenklas(x.tipas)}</div>`);
      const faktai = [
        ['Narystė', TIPAI[x.tipas] || TIPAI.narys], ['Klube nuo', x.nuo], ['Maikės dydis', x.maikes_dydis],
        ['Maikės info', x.maikes_info], ['Technika', x.technika],
      ].filter(([, v]) => v);
      h.push('<section><h2>Informacija</h2><dl class="faktai">'
        + faktai.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl></section>');
      if (x.pastabos) h.push(`<section><h2>Pastabos</h2>${tekstas(x.pastabos)}</section>`);
    }
    el.innerHTML = h.join('\n');
  }

  function eilute(ikona, vardas, smulkiai, nuoroda, naujas) {
    return `<a class="eilute" href="${esc(nuoroda)}"${naujas ? ' target="_blank" rel="noopener"' : ''}>
      <span class="ikona">${ikona}</span>
      <span class="vidus"><span class="vardas">${esc(vardas)}</span><span class="smulkiai">${esc(smulkiai)}</span></span>
      <span class="rodykle">›</span></a>`;
  }

  // ---- Forma ----
  function laukoHtml(f, reiksme, pasiulymai) {
    const id = 'l-' + f.raktas;
    const virsus = `${esc(f.pavadinimas)}${f.privalomas ? ' *' : ''}${f.pagalba ? `<span class="pagalba">${esc(f.pagalba)}</span>` : ''}`;
    if (f.tipas === 'textarea') return `<label>${virsus}<textarea id="${id}" rows="${f.eil || 3}">${esc(reiksme)}</textarea></label>`;
    if (f.tipas === 'select') {
      return `<label>${virsus}<select id="${id}">${f.parinktys.map(([v, t]) => `<option value="${esc(v)}"${String(reiksme || '') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    const tipas = { tel: 'tel', url: 'url', email: 'email' }[f.tipas] || 'text';
    const sarasas = f.sarasas && pasiulymai.length
      ? `<datalist id="${id}-pasiulymai">${pasiulymai.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>` : '';
    return `<label>${virsus}<input type="${tipas}" id="${id}" value="${esc(reiksme)}"${sarasas ? ` list="${id}-pasiulymai"` : ''}${f.vieta ? ` placeholder="${esc(f.vieta)}"` : ''}></label>${sarasas}`;
  }

  function forma(el, skyrius, x, visi) {
    const s = SKYRIAI[skyrius];
    const naujas = !x;
    x = x || (skyrius === 'nariai' ? { tipas: 'narys' } : {});
    const nf = s.nuotrauka;
    let naujaNuotrauka = null;
    let salintiNuotrauka = false;
    let perziurosUrl = null;

    el.innerHTML = `
      <a href="${naujas ? '#/' + skyrius : '#/' + skyrius + '/' + encodeURIComponent(x.id)}" class="atgal">← Atšaukti</a>
      <h1>${esc(naujas ? s.naujas : s.redaguoti)}</h1>
      <section class="forma">
        <label>${esc(nf.pavadinimas)}</label>
        <div class="nuotraukos-laukas">
          <span id="f-nuotrauka"></span>
          <span class="mygtukas antrinis mazas failu-mygtukas">📷 Pasirinkti<input type="file" id="f-nuotraukos-failas" accept="image/*"></span>
          <button type="button" class="mygtukas antrinis mazas" id="f-nuotraukos-salinti">✕ Pašalinti</button>
        </div>
        ${s.laukai.map((f) => laukoHtml(f, x[f.raktas], [...new Set(visi.map((y) => y[f.raktas]).filter(Boolean))])).join('')}
      </section>
      <div class="eiga" id="f-eiga"></div>
      <div class="formos-veiksmai">
        <button class="mygtukas" id="f-saugoti">💾 Išsaugoti</button>
        ${naujas ? '' : '<button class="mygtukas pavojingas" id="f-trinti">🗑️ Ištrinti</button>'}
      </div>`;

    const $ = (q) => el.querySelector(q);
    const eiga = (t, blogai) => {
      const e = $('#f-eiga');
      e.textContent = t;
      e.classList.toggle('klaida', !!blogai);
      if (blogai) e.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    function piestiNuotrauka() {
      const klase = nf.apvali ? 'apvali' : '';
      let html;
      if (naujaNuotrauka) html = `<img class="${klase}" src="${perziurosUrl}" alt="">`;
      else if (x[nf.raktas] && !salintiNuotrauka) html = `<img class="${klase}" src="${href(x[nf.raktas])}" alt="">`;
      else html = inicialai(x, klase);
      $('#f-nuotrauka').innerHTML = html;
      $('#f-nuotraukos-salinti').hidden = !(naujaNuotrauka || (x[nf.raktas] && !salintiNuotrauka));
    }
    piestiNuotrauka();

    $('#f-nuotraukos-failas').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { eiga('⚠️ Pasirinkite nuotrauką (jpg, png).', true); return; }
      if (perziurosUrl) URL.revokeObjectURL(perziurosUrl);
      naujaNuotrauka = f;
      perziurosUrl = URL.createObjectURL(f);
      piestiNuotrauka();
    });
    $('#f-nuotraukos-salinti').addEventListener('click', () => {
      if (naujaNuotrauka) { naujaNuotrauka = null; URL.revokeObjectURL(perziurosUrl); perziurosUrl = null; } else salintiNuotrauka = true;
      piestiNuotrauka();
    });

    const uzrakinti = (taip) => el.querySelectorAll('.formos-veiksmai button').forEach((b) => { b.disabled = taip; });

    $('#f-saugoti').addEventListener('click', async () => {
      const reiksmes = {};
      for (const f of s.laukai) reiksmes[f.raktas] = $('#l-' + f.raktas).value.replace(/\r/g, '').trim();
      const truksta = s.laukai.find((f) => f.privalomas && !reiksmes[f.raktas]);
      if (truksta) { eiga(`⚠️ Užpildykite lauką „${truksta.pavadinimas}“.`, true); $('#l-' + truksta.raktas).focus(); return; }

      uzrakinti(true);
      try {
        let id = x.id;
        if (naujas) {
          eiga('⏳ Ruošiama…');
          const esami = await Admin.skaitytiFaila(s.failas);
          const yra = new Set(((esami && esami.duomenys[skyrius]) || []).map((y) => String(y.id)));
          const pagrindas = Admin.slug(s.vardas(reiksmes)) || skyrius;
          id = pagrindas;
          for (let i = 2; yra.has(id); i++) id = pagrindas + '-' + i;
        }

        const irasas = Object.assign({}, naujas ? {} : x, { id });
        for (const f of s.laukai) Admin.nustatytiLauka(irasas, f.raktas, reiksmes[f.raktas]);

        const senaNuotrauka = x[nf.raktas];
        if (naujaNuotrauka) {
          eiga('⏳ Keliama nuotrauka…');
          irasas[nf.raktas] = await Admin.ikeltiFaila(naujaNuotrauka, `${skyrius}/${id}`, nf.max);
        } else if (salintiNuotrauka) {
          delete irasas[nf.raktas];
        }

        eiga('⏳ Saugoma…');
        const duomenys = await Admin.keistiDuomenis((d) => {
          const i = d[skyrius].findIndex((y) => String(y.id) === String(id));
          if (i >= 0) d[skyrius][i] = irasas;
          else d[skyrius].push(irasas);
        }, `${naujas ? 'Naujas įrašas' : 'Pakeistas įrašas'} (${skyrius}): ${s.vardas(irasas)}`, s.failas, skyrius);

        if (senaNuotrauka && (naujaNuotrauka || salintiNuotrauka) && /^failai\//.test(senaNuotrauka)) {
          try { await Admin.trinti(senaNuotrauka, 'Pašalinta nuotrauka ' + senaNuotrauka); } catch (e) { /* nesvarbu */ }
        }

        atmintis[skyrius] = duomenys[skyrius];
        pranesimas = naujaNuotrauka ? '✓ Išsaugota. Nauja nuotrauka matysis po 1–2 min., kol GitHub atnaujins puslapį.' : '✓ Išsaugota.';
        eitiI(`#/${skyrius}/${encodeURIComponent(id)}`);
      } catch (e) {
        eiga('❌ ' + e.message, true);
        uzrakinti(false);
      }
    });

    const trinti = $('#f-trinti');
    if (trinti) {
      trinti.addEventListener('click', async () => {
        if (!confirm(`Ištrinti „${s.vardas(x)}“?`)) return;
        uzrakinti(true);
        try {
          eiga('⏳ Trinama…');
          const duomenys = await Admin.keistiDuomenis((d) => {
            d[skyrius] = d[skyrius].filter((y) => String(y.id) !== String(x.id));
          }, `Ištrintas įrašas (${skyrius}): ${s.vardas(x)}`, s.failas, skyrius);
          if (x[nf.raktas] && /^failai\//.test(x[nf.raktas])) {
            try { await Admin.trinti(x[nf.raktas], 'Pašalinta nuotrauka ' + x[nf.raktas]); } catch (e) { /* nesvarbu */ }
          }
          atmintis[skyrius] = duomenys[skyrius];
          pranesimas = 'Ištrinta.';
          eitiI('#/' + skyrius);
        } catch (e) {
          eiga('❌ ' + e.message, true);
          uzrakinti(false);
        }
      });
    }
  }

  // ---- Ieejimas: #/nuolaidos, #/nuolaidos/nauja, #/nuolaidos/<id>, #/nuolaidos/<id>/redaguoti ----
  async function rodyti(el, skyrius, id, veiksmas) {
    const s = SKYRIAI[skyrius];
    document.title = s.antraste;
    const redaguoti = id === 'nauja' || veiksmas === 'redaguoti';
    if (redaguoti && !Admin.prisijungta()) {
      Admin.rodytiNustatymus(el, poPrisijungimo);
      el.insertAdjacentHTML('afterbegin', '<div class="pranesimas">Norėdami pridėti ar redaguoti, pirmiausia įjunkite redagavimą šiame telefone.</div>');
      return;
    }

    const hash = location.hash;
    if (!atmintis[skyrius]) {
      el.innerHTML = '<p class="kraunama">Kraunama…</p>';
      try {
        atmintis[skyrius] = await ikelti(skyrius);
      } catch (e) {
        if (location.hash !== hash) return;
        el.innerHTML = `<div class="klaida"><strong>Nepavyko įkelti duomenų.</strong><p>${esc(e.message)}</p>
          <p>${navigator.onLine ? 'Bandykite atnaujinti puslapį.' : 'Nėra interneto ryšio.'}</p></div>`;
        return;
      }
      if (location.hash !== hash) return;
    }
    const visi = atmintis[skyrius];

    if (id === 'nauja') {
      forma(el, skyrius, null, visi);
      document.title = s.naujas;
    } else if (id) {
      const x = visi.find((y) => String(y.id) === id);
      if (!x) {
        el.innerHTML = `<a href="#/${skyrius}" class="atgal">${esc(s.atgal)}</a><p class="tuscia">Įrašas nerastas.</p>`;
      } else if (veiksmas === 'redaguoti') {
        forma(el, skyrius, x, visi);
        document.title = s.redaguoti;
      } else {
        perziura(el, skyrius, x);
        document.title = s.vardas(x) + ' – ' + s.antraste;
      }
    } else {
      sarasas(el, skyrius, visi);
    }

    if (pranesimas) {
      el.insertAdjacentHTML('afterbegin', `<div class="pranesimas">${esc(pranesimas)}</div>`);
      pranesimas = '';
    }
    window.scrollTo(0, 0);
  }

  // Po prisijungimo / atsijungimo - duomenis perskaityti is naujo
  const pamirsti = () => { Object.keys(atmintis).forEach((k) => delete atmintis[k]); };

  return { rodyti, pamirsti };
})();

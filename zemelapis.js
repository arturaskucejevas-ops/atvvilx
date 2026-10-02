'use strict';

// Zemelapis su trasomis (Leaflet + OpenStreetMap). GPX failai nuskaitomi tiesiai narsykleje.
// Naudoja esc(), href(), geriTaskai(), navigacija() is app.js.
const Zemelapis = (() => {
  const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  const SPALVOS = ['#f47b20', '#2e86de', '#e63946', '#2a9d8f', '#8e44ad', '#e9b308', '#16a085', '#d35400', '#c2185b', '#3e7b3a'];
  const SLUOKSNIO_RAKTAS = 'trasos-zemelapio-tipas';

  let ikeliama = null;
  function ikeltiLeaflet() {
    if (window.L) return Promise.resolve();
    if (ikeliama) return ikeliama;
    ikeliama = new Promise((ok, blogai) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET + 'leaflet.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = LEAFLET + 'leaflet.js';
      s.onload = () => ok();
      s.onerror = () => {
        ikeliama = null;
        s.remove();
        blogai(new Error('Nepavyko įkelti žemėlapio – reikia interneto ryšio.'));
      };
      document.head.appendChild(s);
    });
    return ikeliama;
  }

  // ---- GPX ----
  const gpxFailas = (t) => (t.failai || []).find((f) => f && f.kelias && /\.gpx$/i.test(String(f.kelias).split(/[?#]/)[0]));
  const gpxAtmintis = new Map();

  function atstumasKm(a, b) {
    const R = 6371;
    const r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r;
    const dLng = (b[1] - a[1]) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Labai ilgus GPX supaprastinam, kad zemelapis telefone neletetu
  function supaprastinti(pts, max = 1500) {
    if (pts.length <= max) return pts;
    const k = Math.ceil(pts.length / max);
    const out = pts.filter((_, i) => i % k === 0);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }

  function skaitytiGpx(kelias) {
    if (gpxAtmintis.has(kelias)) return gpxAtmintis.get(kelias);
    const p = (async () => {
      const r = await fetch(href(kelias));
      if (!r.ok) throw new Error('GPX ' + r.status);
      const xml = new DOMParser().parseFromString(await r.text(), 'application/xml');
      if (xml.getElementsByTagName('parsererror').length) throw new Error('Netinkamas GPX');
      const visi = (el, vardas) => [...el.getElementsByTagNameNS('*', vardas)];
      const koord = (el) => [parseFloat(el.getAttribute('lat')), parseFloat(el.getAttribute('lon'))];
      const geras = (p) => isFinite(p[0]) && isFinite(p[1]);

      const segmentai = [];
      visi(xml, 'trkseg').forEach((seg) => segmentai.push(visi(seg, 'trkpt').map(koord).filter(geras)));
      visi(xml, 'rte').forEach((rte) => segmentai.push(visi(rte, 'rtept').map(koord).filter(geras)));
      const linijos = segmentai.filter((s) => s.length > 1);

      let ilgis = 0;
      linijos.forEach((s) => { for (let i = 1; i < s.length; i++) ilgis += atstumasKm(s[i - 1], s[i]); });

      const taskai = visi(xml, 'wpt').map((w) => {
        const v = visi(w, 'name')[0];
        return { latlng: koord(w), vardas: v ? v.textContent.trim() : '' };
      }).filter((x) => geras(x.latlng));

      return { linijos: linijos.map((s) => supaprastinti(s)), taskai, ilgis };
    })();
    gpxAtmintis.set(kelias, p);
    p.catch(() => gpxAtmintis.delete(kelias));
    return p;
  }

  function spalva(t) {
    let h = 0;
    for (const c of String(t.id)) h = (h * 31 + c.charCodeAt(0)) | 0;
    return SPALVOS[Math.abs(h) % SPALVOS.length];
  }

  function langelis(t, gpx, duom, vienas) {
    const ilgis = duom && duom.ilgis > 0.05 ? duom.ilgis.toFixed(1) + ' km' : (t.faktai && t.faktai.Ilgis) || '';
    const pradzia = duom && duom.linijos[0] ? { lat: duom.linijos[0][0][0], lng: duom.linijos[0][0][1] } : geriTaskai(t)[0];
    return `<div class="zem-langelis">
      <strong>${esc(t.pavadinimas || t.id)}</strong>
      ${ilgis ? `<div>📏 ${esc(ilgis)}</div>` : ''}
      ${t.data ? `<div>📅 ${esc(t.data)}</div>` : ''}
      <div class="zem-langelio-mygtukai">
        ${gpx ? `<a class="mygtukas mazas" href="${href(gpx.kelias)}" download>⬇️ Atsisiųsti GPX</a>` : ''}
        ${pradzia ? `<a class="mygtukas antrinis mazas" href="${navigacija(pradzia)}" target="_blank" rel="noopener">🚗 Navigacija į startą</a>` : ''}
        ${vienas ? '' : `<a class="mygtukas antrinis mazas" href="#/trasa/${encodeURIComponent(t.id)}">Atidaryti trasą ›</a>`}
      </div></div>`;
  }

  // ---- Zemelapis ----
  // el - tuscias elementas; opts.vienas = true - vienos trasos zemelapis (rodomi ir visi jos taskai)
  async function sukurti(el, opts = {}) {
    el.classList.add('zem-dezute');
    el.innerHTML = '<div class="zem-zemelapis"></div><div class="zem-busena">Kraunamas žemėlapis…</div>';
    const busenosEl = el.querySelector('.zem-busena');
    const busena = (tekstas) => { busenosEl.textContent = tekstas; busenosEl.hidden = !tekstas; };

    await ikeltiLeaflet();
    const map = L.map(el.querySelector('.zem-zemelapis'), { zoomControl: true }).setView([55.2, 23.9], 7);

    const sluoksniai = {
      'Žemėlapis': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
      'Topografinis': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17, subdomains: 'abc', attribution: '© OpenStreetMap, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      }),
      'Palydovinis': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics',
      }),
    };
    let tipas = 'Žemėlapis';
    try { tipas = localStorage.getItem(SLUOKSNIO_RAKTAS) || tipas; } catch (e) { /* nesvarbu */ }
    (sluoksniai[tipas] || sluoksniai['Žemėlapis']).addTo(map);
    L.control.layers(sluoksniai, null, { position: 'topright' }).addTo(map);
    map.on('baselayerchange', (e) => { try { localStorage.setItem(SLUOKSNIO_RAKTAS, e.name); } catch (err) { /* nesvarbu */ } });

    const grupe = L.featureGroup().addTo(map);
    const rodytiVisas = (animuoti = true) => {
      if (grupe.getLayers().length) map.fitBounds(grupe.getBounds(), { padding: [30, 30], maxZoom: 15, animate: animuoti });
    };

    // Mygtukai: mano vieta ir rodyti visas trasas
    let vieta = null;
    const Mygtukai = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const d = L.DomUtil.create('div', 'leaflet-bar zem-mygtukai');
        const mygtukas = (tekstas, pavadinimas, veiksmas) => {
          const a = L.DomUtil.create('a', '', d);
          a.href = '#';
          a.title = pavadinimas;
          a.setAttribute('role', 'button');
          a.setAttribute('aria-label', pavadinimas);
          a.textContent = tekstas;
          L.DomEvent.on(a, 'click', (e) => { L.DomEvent.stop(e); veiksmas(); });
        };
        mygtukas('📍', 'Mano vieta', () => {
          busena('⏳ Nustatoma jūsų vieta…');
          map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true, timeout: 20000 });
        });
        mygtukas('⤢', 'Rodyti visas trasas', () => rodytiVisas());
        L.DomEvent.disableClickPropagation(d);
        return d;
      },
    });
    new Mygtukai().addTo(map);
    map.on('locationfound', (e) => {
      if (vieta) vieta.remove();
      vieta = L.layerGroup([
        L.circle(e.latlng, { radius: e.accuracy, color: '#2e86de', weight: 1, fillOpacity: 0.1, interactive: false }),
        L.circleMarker(e.latlng, { radius: 8, color: '#fff', weight: 3, fillColor: '#2e86de', fillOpacity: 1 }).bindTooltip('Jūs esate čia'),
      ]).addTo(map);
      busena('');
    });
    map.on('locationerror', (e) => {
      busena(e.code === 1 ? '⚠️ Neleista naudoti vietos (leiskite naršyklės nustatymuose)' : '⚠️ Nepavyko nustatyti vietos');
      setTimeout(() => busena(''), 5000);
    });

    let versija = 0;
    async function atnaujinti(trasos, pritaikyti = true) {
      const mano = ++versija;
      grupe.clearLayers();
      if (!trasos.length) { busena('Nėra trasų pagal paiešką'); return; }
      busena('⏳ Kraunamos trasos…');
      let blogu = 0;
      let beVietos = 0;

      await Promise.all(trasos.map(async (t) => {
        const gpx = gpxFailas(t);
        let duom = null;
        if (gpx) {
          try { duom = await skaitytiGpx(gpx.kelias); } catch (e) { blogu++; }
        }
        if (mano !== versija) return;
        const turinys = () => langelis(t, gpx, duom, opts.vienas);
        const sp = spalva(t);

        if (duom && duom.linijos.length) {
          duom.linijos.forEach((linija) => {
            L.polyline(linija, { color: '#000', weight: 8, opacity: 0.25, interactive: false }).addTo(grupe);
            L.polyline(linija, { color: sp, weight: 5, opacity: 0.95 }).bindPopup(turinys).addTo(grupe);
            // platesne nematoma linija - kad butu lengva paspausti pirstu
            L.polyline(linija, { color: sp, weight: 22, opacity: 0 }).bindPopup(turinys).addTo(grupe);
          });
          const pirmas = duom.linijos[0][0];
          const paskutine = duom.linijos[duom.linijos.length - 1];
          const galas = paskutine[paskutine.length - 1];
          L.circleMarker(pirmas, { radius: 7, color: '#fff', weight: 2, fillColor: '#2e9e44', fillOpacity: 1 })
            .bindTooltip('Startas: ' + (t.pavadinimas || t.id)).bindPopup(turinys).addTo(grupe);
          if (atstumasKm(pirmas, galas) > 0.05) {
            L.circleMarker(galas, { radius: 7, color: '#fff', weight: 2, fillColor: '#d62828', fillOpacity: 1 })
              .bindTooltip('Finišas: ' + (t.pavadinimas || t.id)).bindPopup(turinys).addTo(grupe);
          }
          if (opts.vienas) {
            duom.taskai.forEach((w) => L.circleMarker(w.latlng, { radius: 5, color: '#fff', weight: 2, fillColor: sp, fillOpacity: 1 })
              .bindTooltip(esc(w.vardas || 'Taškas')).addTo(grupe));
          }
        }

        const taskai = geriTaskai(t);
        const rodytiTaskus = opts.vienas ? taskai : (duom && duom.linijos.length ? [] : taskai.slice(0, 1));
        rodytiTaskus.forEach((x) => {
          const m = L.circleMarker([parseFloat(x.lat), parseFloat(x.lng)], { radius: 8, color: '#fff', weight: 2, fillColor: sp, fillOpacity: 1 });
          if (opts.vienas) {
            m.bindPopup(`<div class="zem-langelis"><strong>${esc(x.pavadinimas || 'Taškas')}</strong>${x.pastaba ? `<div>${esc(x.pastaba)}</div>` : ''}
              <div class="zem-langelio-mygtukai"><a class="mygtukas mazas" href="${navigacija(x)}" target="_blank" rel="noopener">🚗 Navigacija</a></div></div>`);
          } else {
            m.bindPopup(turinys);
          }
          m.bindTooltip(esc(opts.vienas ? x.pavadinimas || 'Taškas' : t.pavadinimas || t.id)).addTo(grupe);
        });
        if (!(duom && duom.linijos.length) && !rodytiTaskus.length) beVietos++;
      }));

      if (mano !== versija) return;
      const pastabos = [];
      if (blogu) pastabos.push(`⚠️ nepavyko nuskaityti ${blogu} GPX`);
      if (beVietos && !opts.vienas) pastabos.push(`${beVietos} trasos be GPX/koordinačių nerodomos`);
      busena(pastabos.join(' · '));
      if (pritaikyti) rodytiVisas(false);
    }

    return {
      atnaujinti,
      sunaikinti() { versija++; map.remove(); },
    };
  }

  return { sukurti, gpxFailas };
})();

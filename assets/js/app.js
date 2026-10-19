/* SIANSAR KP — logika analisis & visualisasi */
(function () {
  'use strict';

  const { SATDIK, KATALOG, UMUR, generate } = window.SARPRAS;
  const NOW = new Date().getFullYear();
  const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

  // Bobot Indeks Kondisi Sarpras (IKS) — Baik=100, Rusak Ringan=70, Rusak Berat=0
  const W = { 'Baik': 100, 'Rusak Ringan': 70, 'Rusak Berat': 0 };
  const KCOL = { 'Baik': '#16a34a', 'Rusak Ringan': '#eab308', 'Rusak Berat': '#dc2626' };
  const KCLS = { 'Baik': 'b-baik', 'Rusak Ringan': 'b-rr', 'Rusak Berat': 'b-rb' };
  const CRITICAL = ['Penangkapan Ikan', 'Permesinan Kapal', 'Budidaya', 'Pengolahan'];
  const KAT_ORDER = Object.keys(UMUR);
  const PALETTE = ['#0f4c75', '#0ea5a4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b', '#14b8a6'];

  // Standar rasio (asumsi kerja — sesuaikan dengan regulasi/standar internal yang berlaku)
  const STD = [
    { key: 'kelas', label: 'Taruna/Kelas', item: 'ruang kelas', sat: 'ruang', max: 40, re: /ruang\s*(kelas|belajar|kuliah|penghantar)/i },
    { key: 'lab', label: 'Taruna/Lab', item: 'laboratorium', sat: 'ruang', max: 100, re: /laboratorium|workshop/i, not: /peralatan/i },
    { key: 'pc', label: 'Taruna/PC', item: 'komputer', sat: 'unit', max: 10, re: /komputer|laptop|\bpc\b/i },
    { key: 'kapal', label: 'Taruna/Kapal Latih', item: 'kapal latih', sat: 'unit', max: 300, re: /kapal\s*latih/i },
    { key: 'asrama', label: 'Taruna/Asrama', item: 'gedung asrama', sat: 'gedung', max: 250, re: /asrama/i }
  ];
  const SIM_RE = /simulator\s*navigasi|full\s*mission|bridge\s*simulator|workshop\s*simulator|ecdis|radar/i;
  const LAYAK = r => r.kondisi === 'Baik' || r.kondisi === 'Rusak Ringan';

  const LS = { rows: 'siansar_rows_v1', src: 'siansar_src_v1', taruna: 'siansar_taruna_v1' };

  // ---------- State ----------
  let ALL = [];
  let SOURCE = 'sample';
  let META = {};
  let TARUNA = {};
  const F = { jenis: '', prov: '', satdik: '', kat: '' };
  const charts = {};
  let map = null, mapLayer = null;
  const tableState = { profil: { key: 'iks', dir: 1 }, data: { key: null, dir: 1, page: 1, q: '' } };

  // ---------- Helpers ----------
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('id-ID');
  const fmtNum = v => nf.format(Math.round(v));
  const f1 = v => isFinite(v) ? v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
  const pct = v => isFinite(v) ? f1(v * 100) + '%' : '–';
  const sum = (arr, k) => arr.reduce((a, r) => a + (typeof k === 'function' ? k(r) : r[k]), 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const katIdx = k => { const i = KAT_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  const short = n => String(n).replace('Politeknik KP ', 'Poltek KP ').replace('Politeknik AUP', 'Poltek AUP').replace('Akademi Komunitas KP', 'AK KP');
  const nameOf = k => META[k] ? META[k].nama : k;


  function groupBy(arr, fn) {
    const m = new Map();
    for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return m;
  }
  function iksLevel(v) { return v >= 80 ? 'Baik' : v >= 65 ? 'Cukup' : v >= 50 ? 'Kurang' : 'Kritis'; }
  function iksColor(v) { return v >= 80 ? '#16a34a' : v >= 65 ? '#eab308' : v >= 50 ? '#f97316' : '#dc2626'; }
  function iksBadge(v) {
    const c = v >= 80 ? 'b-baik' : v >= 65 ? 'b-rr' : v >= 50 ? 'b-rs' : 'b-rb';
    return `<span class="badge ${c}">${iksLevel(v)}</span>`;
  }
  function heat(v) {
    const h = Math.max(0, Math.min(1, (v - 30) / 65)) * 120;
    return `background:hsl(${h},75%,86%);color:hsl(${h},70%,22%)`;
  }
  function bar(v, color) {
    return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></div>`;
  }
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function agg(rows) {
    const a = { unit: 0, w: 0, age: 0, over: 0, k: { 'Baik': 0, 'Rusak Ringan': 0, 'Rusak Berat': 0 } };
    for (const r of rows) {
      const age = NOW - r.tahun;
      a.unit += r.jumlah; a.w += r.jumlah * (W[r.kondisi] ?? 0);
      if (a.k[r.kondisi] !== undefined) a.k[r.kondisi] += r.jumlah;
      a.age += r.jumlah * age;
      if (age > (UMUR[r.kategori] || 20)) a.over += r.jumlah;
    }
    a.iks = a.unit ? a.w / a.unit : NaN;
    a.avgAge = a.unit ? a.age / a.unit : NaN;
    return a;
  }

  // ---------- Data & filter ----------
  function buildMeta() {
    META = {};
    SATDIK.forEach(s => { META[s.kode] = { ...s }; });
    ALL.forEach(r => {
      if (!META[r.kode]) META[r.kode] = { kode: r.kode, nama: r.satdik, jenis: r.jenis, provinsi: r.provinsi, lat: null, lng: null, taruna: 0 };
    });
    const saved = JSON.parse(localStorage.getItem(LS.taruna) || '{}');
    TARUNA = {};
    Object.values(META).forEach(m => { TARUNA[m.kode] = saved[m.kode] ?? m.taruna ?? 0; });
  }

  function filtered(unitOnly) {
    return ALL.filter(r =>
      (!F.jenis || r.jenis === F.jenis) &&
      (!F.prov || r.provinsi === F.prov) &&
      (!F.satdik || r.kode === F.satdik) &&
      (unitOnly || !F.kat || r.kategori === F.kat));
  }

  function fillSelect(el, items, allLabel, val) {
    el.innerHTML = `<option value="">${allLabel}</option>` + items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    el.value = items.some(i => i[0] === val) ? val : '';
  }
  function fillFilters() {
    const uniq = f => [...new Set(ALL.map(f))].filter(Boolean).sort((a, b) => String(a).localeCompare(b)).map(v => [v, v]);
    fillSelect($('fJenis'), uniq(r => r.jenis), 'Semua jenis', F.jenis);
    fillSelect($('fProv'), uniq(r => r.provinsi), 'Semua provinsi', F.prov);
    const sat = [...new Map(ALL.filter(r => (!F.jenis || r.jenis === F.jenis) && (!F.prov || r.provinsi === F.prov)).map(r => [r.kode, r.satdik]))]
      .sort((a, b) => a[1].localeCompare(b[1]));
    fillSelect($('fSatdik'), sat, 'Semua satuan pendidikan', F.satdik);
    fillSelect($('fKat'), uniq(r => r.kategori).sort((a, b) => katIdx(a[0]) - katIdx(b[0])), 'Semua Program Studi', F.kat);

    const user = window.SARPRAS_AUTH ? window.SARPRAS_AUTH.getUser() : null;
    if (user && user.role === 'operator_satdik' && user.accessibleSatdik && user.accessibleSatdik !== 'ALL') {
      F.satdik = user.accessibleSatdik;
      if ($('fSatdik')) {
        $('fSatdik').value = user.accessibleSatdik;
        $('fSatdik').disabled = true;
      }
    } else if ($('fSatdik')) {
      $('fSatdik').disabled = false;
    }

    F.jenis = $('fJenis').value; F.prov = $('fProv').value; F.satdik = $('fSatdik').value;
    F.kat = $('fKat').value;
  }

  // ---------- Charts ----------
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#475569';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.maintainAspectRatio = false;
  Chart.register({
    id: 'stdLine',
    afterDatasetsDraw(c, _a, o) {
      if (o == null || o.value == null) return;
      const x = c.scales.x.getPixelForValue(o.value);
      const { top, bottom } = c.chartArea, ctx = c.ctx;
      ctx.save();
      ctx.strokeStyle = '#dc2626'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.fillStyle = '#dc2626'; ctx.font = "600 11px 'Plus Jakarta Sans'";
      ctx.fillText('Standar ≤ ' + o.value, x + 4, top - 4);
      ctx.restore();
    }
  });
  function chart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart($(id), cfg);
    return charts[id];
  }

  const stackedPctDatasets = (groups) => KONDISI.map(k => ({
    label: k, backgroundColor: KCOL[k], borderRadius: 2,
    data: groups.map(g => g.a.unit ? g.a.k[k] / g.a.unit * 100 : 0)
  }));
  const pctTooltip = { callbacks: { label: c => `${c.dataset.label}: ${f1(c.raw)}%` } };

  // ---------- Analytics ----------
  function ratioFor(kode, rs) {
    const t = +TARUNA[kode] || 0;
    if (!t) return null;
    const res = { taruna: t, vals: {}, sim: null };
    let pass = 0, tot = 0;
    for (const s of STD) {
      const layak = sum(rs.filter(r => s.re.test(r.nama) && !(s.not && s.not.test(r.nama)) && LAYAK(r)), 'jumlah');
      const ratio = layak ? t / layak : Infinity;
      const ok = ratio <= s.max;
      res.vals[s.key] = { layak, ratio, ok, need: ok ? 0 : Math.ceil(t / s.max - layak) };
      tot++; if (ok) pass++;
    }
    if (META[kode] && META[kode].jenis === 'Politeknik') {
      res.sim = rs.some(r => SIM_RE.test(r.nama) && LAYAK(r));
      tot++; if (res.sim) pass++;
    }
    res.score = pass / tot * 100;
    return res;
  }

  function priorityList(rows) {
    return [...groupBy(rows, r => r.kode)].map(([k, rs]) => {
      const a = agg(rs);
      const cr = rs.filter(r => CRITICAL.includes(r.kategori));
      const crU = sum(cr, 'jumlah');
      const crit = crU ? sum(cr.filter(r => r.kondisi === 'Rusak Berat'), 'jumlah') / crU * 100 : 0;
      const R = ratioFor(k, rs);
      const gap = R ? 100 - R.score : 0;
      const score = 0.45 * (100 - a.iks) + 0.35 * crit + 0.20 * gap;
      return { k, a, crit, gap, R, score, rs };
    }).sort((x, y) => y.score - x.score);
  }
  function prioLevel(s) {
    if (s >= 35) return [1, 'Prioritas I · Mendesak'];
    if (s >= 27) return [2, 'Prioritas II · Tinggi'];
    if (s >= 20) return [3, 'Prioritas III · Sedang'];
    return [4, 'Pemeliharaan Rutin'];
  }

  function recommendations(p) {
    const out = [];
    const byKat = [...groupBy(p.rs, r => r.kategori)].map(([k, x]) => ({ k, a: agg(x) })).sort((a, b) => a.a.iks - b.a.iks);
    byKat.filter(o => o.a.iks < 60).slice(0, 2).forEach(o =>
      out.push(`Rehabilitasi <b>${esc(o.k)}</b> (IKS ${f1(o.a.iks)}).`));
    const rb = [...groupBy(p.rs.filter(r => r.kondisi === 'Rusak Berat'), r => r.nama)]
      .map(([n, x]) => ({ n, q: sum(x, 'jumlah'), sat: x[0].satuan, crit: CRITICAL.includes(x[0].kategori) }))
      .sort((a, b) => (b.crit - a.crit) || (b.q - a.q));
    if (rb.length) out.push(`Usulan penghapusan BMN & penggantian: ${rb.slice(0, 3).map(i => `${fmtNum(i.q)} ${esc(i.sat)} ${esc(i.n)}`).join(', ')} (rusak berat).`);
    if (p.R) {
      STD.forEach(s => {
        const v = p.R.vals[s.key];
        if (!v.ok) out.push(`Penambahan ${s.item}: rasio ${v.ratio === Infinity ? 'tidak tersedia' : f1(v.ratio)} taruna/${s.sat} (standar ≤ ${s.max}); kebutuhan ±${fmtNum(v.need)} ${s.sat}.`);
      });
      if (p.R.sim === false) out.push('Pengadaan/revitalisasi <b>Simulator Navigasi</b> layak operasi untuk pemenuhan standar diklat STCW.');
    }
    byKat.filter(o => o.a.avgAge > (UMUR[o.k] || 20)).forEach(o =>
      out.push(`Peremajaan <b>${esc(o.k)}</b>: rata-rata usia ${f1(o.a.avgAge)} th melampaui umur ekonomis ${UMUR[o.k] || 20} th.`));
    if (!out.length) out.push('Kondisi sarpras baik — pertahankan pemeliharaan rutin dan pemutakhiran data SIMAK-BMN.');
    return out.slice(0, 5);
  }

  function insights(rows) {
    const A = agg(rows);
    if (!A.unit) return [['warn', '⚠️', 'Tidak ada data pada kombinasi filter ini.']];
    const out = [];
    out.push([A.iks >= 80 ? 'good' : A.iks >= 65 ? '' : A.iks >= 50 ? 'warn' : 'bad', '📊',
      `Indeks Kondisi Sarpras keseluruhan <b>${f1(A.iks)}</b> (kategori <b>${iksLevel(A.iks)}</b>): ${pct(A.k['Baik'] / A.unit)} unit kondisi baik, ${pct(A.k['Rusak Berat'] / A.unit)} rusak berat.`]);

    const bySat = [...groupBy(rows, r => r.kode)].map(([k, rs]) => ({ k, a: agg(rs) })).sort((x, y) => x.a.iks - y.a.iks);
    if (bySat.length > 1) {
      const lo = bySat[0], hi = bySat[bySat.length - 1];
      out.push(['bad', '🔻', `IKS terendah di <b>${esc(nameOf(lo.k))}</b> (${f1(lo.a.iks)}), selisih ${f1(hi.a.iks - lo.a.iks)} poin dari tertinggi <b>${esc(nameOf(hi.k))}</b> (${f1(hi.a.iks)}).`]);
      const low = bySat.filter(s => s.a.iks < 65).length;
      if (low) out.push(['warn', '🏫', `<b>${low} dari ${bySat.length}</b> satuan pendidikan memiliki IKS di bawah 65 (Kurang/Kritis) dan perlu menjadi fokus intervensi anggaran.`]);
    }
    const byKat = [...groupBy(rows, r => r.kategori)].map(([k, rs]) => { const a = agg(rs); return { k, rb: a.k['Rusak Berat'] / a.unit }; }).sort((x, y) => y.rb - x.rb);
    if (byKat.length) out.push(['warn', '🛠️', `Proporsi rusak berat tertinggi pada program studi <b>${esc(byKat[0].k)}</b> (${pct(byKat[0].rb)})${byKat[1] ? `, disusul <b>${esc(byKat[1].k)}</b> (${pct(byKat[1].rb)})` : ''}.`]);

    const byJenis = [...groupBy(rows, r => r.jenis)].map(([k, rs]) => [k, agg(rs).iks]).sort((a, b) => b[1] - a[1]);
    if (byJenis.length > 1) out.push(['', '🎓', 'IKS per jenis satdik: ' + byJenis.map(([k, v]) => `${esc(k)} <b>${f1(v)}</b>`).join(' · ') + '.']);

    const geo = groupBy(rows.filter(r => META[r.kode] && META[r.kode].lng != null), r => META[r.kode].lng >= 118.5 ? 'T' : 'B');
    if (geo.has('T') && geo.has('B')) {
      const t = agg(geo.get('T')).iks, b = agg(geo.get('B')).iks, d = b - t;
      out.push([d > 3 ? 'warn' : '', '🧭', `Satdik di Kawasan Timur Indonesia ber-IKS <b>${f1(t)}</b> vs <b>${f1(b)}</b> di Kawasan Barat (${d >= 0 ? 'lebih rendah' : 'lebih tinggi'} ${f1(Math.abs(d))} poin) — indikasi kesenjangan pemeliharaan antarwilayah.`]);
    }
    out.push([A.over / A.unit > 0.25 ? 'warn' : '', '⏳', `${pct(A.over / A.unit)} unit telah melampaui umur ekonomis; rata-rata usia aset ${f1(A.avgAge)} tahun.`]);
    return out;
  }

  // ---------- Pages ----------
  const PAGES = {
    ringkasan: ['Ringkasan Eksekutif', 'Gambaran umum kondisi sarana prasarana satuan pendidikan lingkup KKP'],
    kondisi: ['Analisis Program Studi', 'Distribusi kondisi, usia aset sarpras per program studi, dan tren perolehan aset'],
    satdik: ['Per Satuan Pendidikan', 'Perbandingan kondisi sarpras antar Politeknik dan Akademi Komunitas'],
    kecukupan: ['Rasio & Kecukupan', 'Ketersediaan sarpras layak pakai terhadap jumlah peserta didik'],
    prioritas: ['Prioritas & Rekomendasi', 'Pemeringkatan kebutuhan intervensi dan rekomendasi kebijakan'],
    peta: ['Peta Sebaran', 'Sebaran geografis satuan pendidikan dan indeks kondisi sarpras'],
    data: ['Data & Impor', 'Kelola, impor, dan ekspor data sarana prasarana']
  };
  let current = 'ringkasan';
  const dirty = new Set(Object.keys(PAGES));
  const RENDER = {};

  RENDER.ringkasan = function () {
    const rows = filtered(), A = agg(rows);
    const kodes = [...new Set(rows.map(r => r.kode))];
    $('kSatdik').textContent = fmtNum(kodes.length);
    $('kSatdikF').textContent = [...groupBy(kodes, k => META[k].jenis)].map(([j, l]) => `${l.length} ${j}`).join(' · ');
    $('kUnit').textContent = fmtNum(A.unit);
    $('kUnitF').textContent = `${fmtNum(new Set(rows.map(r => r.nama)).size)} jenis item · ${fmtNum(rows.length)} baris`;
    $('kBaik').textContent = pct(A.k['Baik'] / A.unit);
    $('kBaikF').innerHTML = `Rusak berat: <span class="down">${pct(A.k['Rusak Berat'] / A.unit)}</span>`;
    $('kIks').textContent = f1(A.iks);
    $('kIksF').innerHTML = A.unit ? iksBadge(A.iks) + ' skala 0–100' : '';

    $('insights').innerHTML = insights(rows).map(([c, i, t]) => `<li class="${c}"><span class="i-ico">${i}</span><span>${t}</span></li>`).join('');

    chart('cKondisi', {
      type: 'doughnut',
      data: { labels: KONDISI, datasets: [{ data: KONDISI.map(k => A.k[k]), backgroundColor: KONDISI.map(k => KCOL[k]), borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.label}: ${fmtNum(c.raw)} unit (${pct(c.raw / A.unit)})` } } } }
    });

    const sat = [...groupBy(rows, r => r.kode)].map(([k, rs]) => ({ k, a: agg(rs) })).sort((x, y) => x.a.iks - y.a.iks);
    chart('cIksSatdik', {
      type: 'bar',
      data: { labels: sat.map(s => short(nameOf(s.k))), datasets: [{ label: 'IKS', data: sat.map(s => +s.a.iks.toFixed(1)), backgroundColor: sat.map(s => iksColor(s.a.iks)), borderRadius: 4 }] },
      options: {
        indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `IKS ${f1(c.raw)} (${iksLevel(c.raw)})` } } },
        scales: { x: { min: 0, max: 100 }, y: { grid: { display: false } } },
        onClick: (_e, els) => { if (els.length) { F.satdik = sat[els[0].index].k; fillFilters(); refresh(); toast('Filter: ' + nameOf(F.satdik)); } },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
      }
    });
  };

  RENDER.kondisi = function () {
    const rows = filtered();
    const kat = [...groupBy(rows, r => r.kategori)].map(([k, rs]) => ({ k, a: agg(rs), rs })).sort((a, b) => katIdx(a.k) - katIdx(b.k));

    chart('cKatKondisi', {
      type: 'bar',
      data: { labels: kat.map(x => x.k), datasets: stackedPctDatasets(kat) },
      options: { indexAxis: 'y', plugins: { tooltip: pctTooltip, legend: { position: 'bottom' } }, scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + '%' } }, y: { stacked: true, grid: { display: false } } } }
    });

    chart('cUsia', {
      type: 'bar',
      data: {
        labels: kat.map(x => x.k),
        datasets: [
          { label: 'Rata-rata usia aset', data: kat.map(x => +x.a.avgAge.toFixed(1)), backgroundColor: kat.map(x => x.a.avgAge > (UMUR[x.k] || 20) ? '#dc2626' : '#0ea5a4'), borderRadius: 4 },
          { label: 'Umur ekonomis', data: kat.map(x => UMUR[x.k] || 20), backgroundColor: '#cbd5e1', borderRadius: 4 }
        ]
      },
      options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${f1(c.raw)} th` } } }, scales: { y: { grid: { display: false } }, x: { title: { display: true, text: 'tahun' } } } }
    });

    if (rows.length) {
      const years = rows.map(r => r.tahun);
      const y0 = Math.floor(Math.min(...years) / 5) * 5, y1 = Math.max(...years);
      const bins = [];
      for (let y = y0; y <= y1; y += 5) bins.push(y);
      const data = bins.map(b => {
        const rs = rows.filter(r => r.tahun >= b && r.tahun < b + 5), a = agg(rs);
        return { label: b + 4 > y1 ? `${b}–${y1}` : `${b}–${b + 4}`, unit: a.unit, rb: a.unit ? a.k['Rusak Berat'] / a.unit * 100 : 0 };
      });
      chart('cTren', {
        data: {
          labels: data.map(d => d.label),
          datasets: [
            { type: 'line', label: '% rusak berat (kondisi kini)', data: data.map(d => +d.rb.toFixed(1)), borderColor: '#dc2626', backgroundColor: '#dc2626', yAxisID: 'y1', tension: .3 },
            { type: 'bar', label: 'Unit diperoleh', data: data.map(d => d.unit), backgroundColor: '#0f4c75', borderRadius: 4, yAxisID: 'y' }
          ]
        },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'unit' } }, y1: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } } }
      });
    }

    const items = [...groupBy(rows, r => r.nama)].map(([n, rs]) => {
      const a = agg(rs), rbRows = rs.filter(r => r.kondisi === 'Rusak Berat');
      return { n, kat: rs[0].kategori, sat: rs[0].satuan, unit: a.unit, rb: a.k['Rusak Berat'], rbp: a.k['Rusak Berat'] / a.unit, nSat: new Set(rbRows.map(r => r.kode)).size };
    }).filter(i => i.rb > 0).sort((a, b) => (b.rb - a.rb) || (b.rbp - a.rbp)).slice(0, 15);
    $('tTopRusak').innerHTML = `<thead><tr><th>#</th><th>Item Sarpras</th><th>Program Studi</th><th class="num">Total Unit</th><th class="num">Rusak Berat</th><th>% RB</th><th class="num">Satdik Terdampak</th></tr></thead><tbody>` +
      (items.map((i, x) => `<tr><td>${x + 1}</td><td><b>${esc(i.n)}</b></td><td>${esc(i.kat)}</td><td class="num">${fmtNum(i.unit)} ${esc(i.sat)}</td><td class="num">${fmtNum(i.rb)}</td><td>${bar(i.rbp * 100, '#dc2626')} <span class="small">${pct(i.rbp)}</span></td><td class="num">${i.nSat}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Tidak ada item rusak berat.</td></tr>') + '</tbody>';
  };

  RENDER.satdik = function () {
    const rows = filtered();
    const kats = [...new Set(rows.map(r => r.kategori))].sort((a, b) => katIdx(a) - katIdx(b));
    const sats = [...groupBy(rows, r => r.kode)].map(([k, rs]) => ({ k, rs, a: agg(rs) })).sort((x, y) => x.a.iks - y.a.iks);

    $('tHeat').innerHTML = `<thead><tr><th>Satuan Pendidikan</th>${kats.map(k => `<th>${esc(k)}</th>`).join('')}<th>Total</th></tr></thead><tbody>` +
      sats.map(s => {
        const bk = groupBy(s.rs, r => r.kategori);
        return `<tr><td><b>${esc(short(nameOf(s.k)))}</b></td>` + kats.map(k => {
          if (!bk.has(k)) return '<td class="muted">–</td>';
          const a = agg(bk.get(k));
          return `<td style="${heat(a.iks)}" title="${esc(k)}: ${fmtNum(a.unit)} unit, RB ${pct(a.k['Rusak Berat'] / a.unit)}">${f1(a.iks)}</td>`;
        }).join('') + `<td style="${heat(s.a.iks)}">${f1(s.a.iks)}</td></tr>`;
      }).join('') + '</tbody>';

    const data = sats.map(s => ({
      kode: s.k, nama: nameOf(s.k), jenis: META[s.k].jenis, prov: META[s.k].provinsi, taruna: +TARUNA[s.k] || 0,
      unit: s.a.unit, baik: s.a.k['Baik'] / s.a.unit * 100, rb: s.a.k['Rusak Berat'] / s.a.unit * 100,
      usia: s.a.avgAge, iks: s.a.iks
    }));
    renderTable($('tProfil'), [
      { key: 'nama', label: 'Satuan Pendidikan', fmt: v => `<b>${esc(v)}</b>` },
      { key: 'jenis', label: 'Jenis' },
      { key: 'prov', label: 'Provinsi' },
      { key: 'taruna', label: 'Taruna', num: 1, fmt: fmtNum },
      { key: 'unit', label: 'Unit', num: 1, fmt: fmtNum },
      { key: 'baik', label: '% Baik', num: 1, fmt: v => f1(v) + '%' },
      { key: 'rb', label: '% RB', num: 1, fmt: v => f1(v) + '%' },
      { key: 'usia', label: 'Usia Rata² (th)', num: 1, fmt: f1 },
      { key: 'iks', label: 'IKS', fmt: v => `<div style="display:flex;gap:8px;align-items:center">${bar(v, iksColor(v))}<b>${f1(v)}</b>${iksBadge(v)}</div>` }
    ], data, tableState.profil, { onSort: RENDER.satdik });

    const st = [...sats].sort((x, y) => (x.a.k['Baik'] / x.a.unit) - (y.a.k['Baik'] / y.a.unit));
    chart('cSatdikStack', {
      type: 'bar',
      data: { labels: st.map(s => short(nameOf(s.k))), datasets: stackedPctDatasets(st) },
      options: { indexAxis: 'y', plugins: { tooltip: pctTooltip, legend: { position: 'bottom' } }, scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + '%' } }, y: { stacked: true, grid: { display: false } } } }
    });
  };

  RENDER.kecukupan = function () {
    const rows = filtered(true);
    $('stdNote').innerHTML = 'Standar acuan (asumsi kerja, dapat disesuaikan): ' + STD.map(s => `${s.label} ≤ ${s.max}`).join(' · ') + ' · Politeknik wajib memiliki Simulator Navigasi layak. <i>Filter program studi tidak berlaku pada analisis ini.</i>';
    const list = [...groupBy(rows, r => r.kode)].map(([k, rs]) => ({ k, R: ratioFor(k, rs) })).filter(x => x.R).sort((a, b) => a.R.score - b.R.score);
    const cell = v => v.ok
      ? `<span class="badge b-ok">${f1(v.ratio)}</span>`
      : `<span class="badge b-no">${v.ratio === Infinity ? 'tidak ada' : f1(v.ratio)}</span> <span class="small muted">+${fmtNum(v.need)}</span>`;
    $('tRasio').innerHTML = `<thead><tr><th>Satuan Pendidikan</th><th class="num">Taruna</th>${STD.map(s => `<th>${s.label} (≤${s.max})</th>`).join('')}<th>Simulator Navigasi</th><th>Skor Kecukupan</th></tr></thead><tbody>` +
      (list.map(({ k, R }) => `<tr><td><b>${esc(short(nameOf(k)))}</b></td><td class="num">${fmtNum(R.taruna)}</td>` +
        STD.map(s => `<td>${cell(R.vals[s.key])}</td>`).join('') +
        `<td>${R.sim === null ? '<span class="muted small">n/a</span>' : R.sim ? '<span class="badge b-ok">Tersedia</span>' : '<span class="badge b-no">Tidak layak</span>'}</td>` +
        `<td><div style="display:flex;gap:8px;align-items:center">${bar(R.score, iksColor(R.score))}<b>${Math.round(R.score)}%</b></div></td></tr>`).join('') ||
        '<tr><td colspan="9" class="muted">Isi data jumlah taruna pada menu Data & Impor.</td></tr>') + '</tbody>';

    const ratioChart = (id, key) => {
      const s = STD.find(x => x.key === key);
      const d = list.map(({ k, R }) => ({ k, v: R.vals[key].ratio })).sort((a, b) => b.v - a.v);
      chart(id, {
        type: 'bar',
        data: { labels: d.map(x => short(nameOf(x.k))), datasets: [{ data: d.map(x => isFinite(x.v) ? +x.v.toFixed(1) : null), backgroundColor: d.map(x => x.v > s.max ? '#dc2626' : '#0ea5a4'), borderRadius: 4 }] },
        options: { indexAxis: 'y', layout: { padding: { top: 16 } }, plugins: { legend: { display: false }, stdLine: { value: s.max }, tooltip: { callbacks: { label: c => `${f1(c.raw)} taruna per ${s.sat}` } } }, scales: { y: { grid: { display: false } }, x: { beginAtZero: true, suggestedMax: s.max * 1.15 } } }
      });
    };
    ratioChart('cRasioPC', 'pc');
    ratioChart('cRasioKelas', 'kelas');
  };

  RENDER.prioritas = function () {
    const P = priorityList(filtered(true));
    $('tPrioritas').innerHTML = `<thead><tr><th>#</th><th>Satuan Pendidikan</th><th class="num">IKS</th><th class="num">Defisit Kritis</th><th class="num">Gap Rasio</th><th>Skor Prioritas</th><th>Level</th></tr></thead><tbody>` +
      P.map((p, i) => {
        const [l, t] = prioLevel(p.score);
        return `<tr><td>${i + 1}</td><td><b>${esc(short(nameOf(p.k)))}</b><div class="small muted">${esc(META[p.k].provinsi)}</div></td><td class="num">${f1(p.a.iks)}</td><td class="num">${f1(p.crit)}%</td><td class="num">${f1(p.gap)}%</td>` +
          `<td><div style="display:flex;gap:8px;align-items:center">${bar(p.score / 60 * 100, ['', '#dc2626', '#f97316', '#eab308', '#16a34a'][l])}<b>${f1(p.score)}</b></div></td><td><span class="lvl lvl-${l}">${t}</span></td></tr>`;
      }).join('') + '</tbody>';

    $('recoGrid').innerHTML = P.map(p => {
      const [l, t] = prioLevel(p.score);
      return `<div class="reco"><div class="reco-h"><div><b>${esc(nameOf(p.k))}</b><div class="small muted">${esc(META[p.k].jenis)} · ${esc(META[p.k].provinsi)} · IKS ${f1(p.a.iks)}</div></div><span class="lvl lvl-${l}">${t}</span></div><ul>${recommendations(p).map(x => `<li>${x}</li>`).join('')}</ul></div>`;
    }).join('');
  };

  RENDER.peta = function () {
    if (typeof L === 'undefined') { $('map').innerHTML = '<p class="muted" style="padding:20px">Peta memerlukan koneksi internet (Leaflet).</p>'; return; }
    if (!map) {
      map = L.map('map', { scrollWheelZoom: false }).setView([-2.5, 118], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
      mapLayer = L.layerGroup().addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 50);
    mapLayer.clearLayers();
    const sats = [...groupBy(filtered(), r => r.kode)].map(([k, rs]) => ({ k, rs, a: agg(rs), m: META[k] })).filter(s => s.m.lat != null);
    const maxN = Math.max(1, ...sats.map(s => s.a.unit));
    const bounds = [];
    sats.forEach(s => {
      const worst = [...groupBy(s.rs, r => r.kategori)].map(([k, x]) => ({ k, i: agg(x).iks })).sort((a, b) => a.i - b.i)[0];
      L.circleMarker([s.m.lat, s.m.lng], { radius: 7 + Math.sqrt(s.a.unit / maxN) * 16, color: '#fff', weight: 2, fillColor: iksColor(s.a.iks), fillOpacity: 0.88 })
        .bindPopup(`<b>${esc(s.m.nama)}</b><br><span style="color:#64748b">${esc(s.m.jenis)} · ${esc(s.m.kota || '')}, ${esc(s.m.provinsi)}</span><hr style="border:0;border-top:1px solid #e2e8f0">
          IKS: <b>${f1(s.a.iks)}</b> ${iksBadge(s.a.iks)}<br>Taruna: ${fmtNum(+TARUNA[s.k] || 0)}<br>Unit sarpras: ${fmtNum(s.a.unit)} (baik ${pct(s.a.k['Baik'] / s.a.unit)})<br>
          Kategori terlemah: <b>${esc(worst.k)}</b> (${f1(worst.i)})`)
        .bindTooltip(short(s.m.nama))
        .addTo(mapLayer);
      bounds.push([s.m.lat, s.m.lng]);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    else if (bounds.length === 1) map.setView(bounds[0], 8);
  };

  RENDER.data = function () {
    const st = tableState.data;
    const q = st.q.toLowerCase();
    const rows = filtered().filter(r => !q || `${r.satdik} ${r.kategori} ${r.nama} ${r.kondisi} ${r.provinsi} ${r.prodi || ''}`.toLowerCase().includes(q));
    $('rowCount').textContent = `(${fmtNum(rows.length)} baris)`;
    const pages = Math.max(1, Math.ceil(rows.length / 25));
    st.page = Math.min(st.page, pages);
    renderTable($('tData'), [
      { key: 'satdik', label: 'Satuan Pendidikan', fmt: v => esc(short(v)) },
      { key: 'kategori', label: 'Program Studi' },
      { key: 'nama', label: 'Nama Sarpras', fmt: v => `<b>${esc(v)}</b>` },
      { key: 'jumlah', label: 'Jumlah', num: 1, fmt: fmtNum },
      { key: 'satuan', label: 'Satuan' },
      { key: 'kondisi', label: 'Kondisi', fmt: v => `<span class="badge ${KCLS[v]}">${v}</span>`, sort: r => W[r.kondisi] },
      { key: 'tahun', label: 'Th. Perolehan', num: 1 }
    ], rows, st, { onSort: RENDER.data, page: st.page, pageSize: 25 });

    const pg = $('pager');
    const btn = (p, label, dis, on) => `<button data-p="${p}" ${dis ? 'disabled' : ''} class="${on ? 'on' : ''}">${label}</button>`;
    let h = btn(st.page - 1, '‹', st.page === 1);
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - st.page) <= 2) h += btn(p, p, false, p === st.page);
      else if (Math.abs(p - st.page) === 3) h += '<span class="muted">…</span>';
    }
    pg.innerHTML = h + btn(st.page + 1, '›', st.page === pages) + `<span class="muted small">hal. ${st.page}/${pages}</span>`;
    pg.querySelectorAll('button').forEach(b => b.onclick = () => { st.page = +b.dataset.p; RENDER.data(); });

    const metas = Object.values(META).filter(m => ALL.some(r => r.kode === m.kode) && (!F.jenis || m.jenis === F.jenis) && (!F.prov || m.provinsi === F.prov));
    $('tTaruna').innerHTML = '<thead><tr><th>Satuan Pendidikan</th><th>Jenis</th><th class="num">Jumlah Taruna</th></tr></thead><tbody>' +
      metas.map(m => `<tr><td>${esc(m.nama)}</td><td>${esc(m.jenis)}</td><td class="num"><input type="number" min="0" step="10" data-k="${esc(m.kode)}" value="${+TARUNA[m.kode] || 0}"></td></tr>`).join('') + '</tbody>';
    $('tTaruna').querySelectorAll('input').forEach(inp => inp.onchange = () => {
      TARUNA[inp.dataset.k] = Math.max(0, +inp.value || 0);
      localStorage.setItem(LS.taruna, JSON.stringify(TARUNA));
      Object.keys(PAGES).forEach(p => p !== 'data' && dirty.add(p));
      toast('Jumlah taruna diperbarui');
    });
  };

  function renderTable(el, cols, data, st, opts) {
    opts = opts || {};
    let d = data;
    if (st && st.key) {
      const c = cols.find(c => c.key === st.key);
      const f = (c && c.sort) || (r => r[st.key]);
      d = [...data].sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * st.dir; });
    }
    if (opts.pageSize) d = d.slice((opts.page - 1) * opts.pageSize, opts.page * opts.pageSize);
    el.innerHTML = '<thead><tr>' + cols.map(c => `<th class="${c.num ? 'num' : ''}" data-k="${c.key}">${c.label}${st && st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr></thead><tbody>' +
      (d.map(r => '<tr>' + cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key])}</td>`).join('') + '</tr>').join('') ||
        `<tr><td colspan="${cols.length}" class="muted">Tidak ada data.</td></tr>`) + '</tbody>';
    if (st) el.querySelectorAll('th').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      st.dir = st.key === k ? -st.dir : 1; st.key = k;
      opts.onSort && opts.onSort();
    });
  }

  // ---------- Navigation ----------
  function activate(page) {
    current = page;
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    $('pageTitle').textContent = PAGES[page][0];
    $('pageSub').textContent = PAGES[page][1];
    $('sidebar').classList.remove('open');
  }
  function show(page) {
    if (window.SARPRAS_AUTH && !window.SARPRAS_AUTH.isAuthenticated()) {
      renderAuthState();
      return;
    }
    if (!PAGES[page]) page = 'ringkasan';
    activate(page);
    if (dirty.has(page)) { dirty.delete(page); RENDER[page](); }
    else if (page === 'peta' && map) setTimeout(() => map.invalidateSize(), 50);
  }
  function refresh() {
    Object.keys(PAGES).forEach(p => dirty.add(p));
    dirty.delete(current);
    RENDER[current]();
  }

  // ---------- Import / Export ----------
  const ALIAS = {
    kode: ['kode', 'kode satdik', 'kode satker'],
    satdik: ['satdik', 'satuan pendidikan', 'nama satdik', 'nama satuan pendidikan', 'sekolah', 'unit kerja'],
    jenis: ['jenis', 'jenis satdik', 'jenjang'],
    provinsi: ['provinsi', 'prov'],
    kategori: ['kategori', 'kelompok', 'kelompok sarpras', 'jenis sarpras'],
    nama: ['nama', 'nama sarpras', 'nama barang', 'sarpras', 'item', 'uraian'],
    satuan: ['satuan'],
    jumlah: ['jumlah', 'qty', 'volume', 'jml', 'kuantitas'],
    kondisi: ['kondisi'],
    tahun: ['tahun', 'tahun perolehan', 'th perolehan', 'tahun pengadaan']
  };
  const normKey = s => String(s).toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  function normKondisi(v) {
    const s = String(v).toLowerCase().trim();
    if (/berat|^rb$/.test(s)) return 'Rusak Berat';
    if (/ringan|^rr$/.test(s)) return 'Rusak Ringan';
    if (/baik|^b$/.test(s)) return 'Baik';
    return null;
  }
  function num(v) {
    if (typeof v === 'number') return v;
    let s = String(v).replace(/rp|\s/gi, '');
    if (!s) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
    return parseFloat(s);
  }
  function inferJenis(n) { return /politeknik/i.test(n) ? 'Politeknik' : /akademi/i.test(n) ? 'Akademi Komunitas' : /supm|sekolah/i.test(n) ? 'SUPM' : 'Lainnya'; }

  function normalizeRows(json) {
    if (!json.length) return { rows: [], skipped: 0, warn: 0, missing: Object.keys(ALIAS) };
    const map = {};
    Object.keys(json[0]).forEach(h => {
      const n = normKey(h);
      for (const [k, al] of Object.entries(ALIAS)) if (!map[k] && al.includes(n)) map[k] = h;
    });
    const missing = ['nama', 'jumlah', 'kondisi'].filter(k => !map[k]).concat(!map.satdik && !map.kode ? ['satdik/kode'] : []);
    if (missing.length) return { rows: [], skipped: json.length, warn: 0, missing };
    const katOf = Object.fromEntries(KATALOG.map(k => [k[1].toLowerCase(), [k[0], k[2]]]));
    const byName = Object.fromEntries(SATDIK.map(s => [s.nama.toLowerCase(), s]));
    const rows = []; let skipped = 0, warn = 0, id = 1;
    for (const o of json) {
      const g = k => map[k] ? o[map[k]] : '';
      const nama = String(g('nama')).trim(), jumlah = num(g('jumlah')), kondisi = normKondisi(g('kondisi'));
      let satdik = String(g('satdik')).trim(), kode = String(g('kode')).trim();
      if (!nama || !(jumlah > 0) || !kondisi || (!satdik && !kode)) { skipped++; continue; }
      const ref = SATDIK.find(s => s.kode === kode) || byName[satdik.toLowerCase()];
      if (!kode) kode = ref ? ref.kode : satdik.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
      if (!satdik) satdik = ref ? ref.nama : kode;
      let tahun = parseInt(g('tahun'), 10);
      if (!(tahun > 1900 && tahun <= NOW)) { tahun = NOW; warn++; }
      const cat = katOf[nama.toLowerCase()];
      rows.push({
        id: id++, kode, satdik,
        jenis: String(g('jenis')).trim() || (ref ? ref.jenis : inferJenis(satdik)),
        provinsi: String(g('provinsi')).trim() || (ref ? ref.provinsi : '-'),
        kategori: String(g('kategori')).trim() || (cat ? cat[0] : 'Lainnya'),
        nama, satuan: String(g('satuan')).trim() || (cat ? cat[1] : 'unit'),
        jumlah, kondisi, tahun
      });
    }
    return { rows, skipped, warn, missing: [] };
  }

  function handleFile(file) {
    const msg = $('importMsg');
    msg.innerHTML = 'Memproses <b>' + esc(file.name) + '</b>…';
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const res = normalizeRows(json);
        if (res.missing.length) { msg.innerHTML = `<span class="down">Gagal: kolom wajib tidak ditemukan — ${res.missing.join(', ')}.</span>`; return; }
        if (!res.rows.length) { msg.innerHTML = '<span class="down">Tidak ada baris valid yang dapat diimpor.</span>'; return; }
        setData(res.rows, 'import');
        msg.innerHTML = `<span class="up">✔ ${fmtNum(res.rows.length)} baris berhasil diimpor</span> dari ${esc(file.name)}.` +
          (res.skipped ? `<br>${res.skipped} baris dilewati (nama/jumlah/kondisi/satdik tidak valid).` : '') +
          (res.warn ? `<br>${res.warn} baris tanpa tahun perolehan valid (diasumsikan ${NOW}).` : '');
      } catch (err) {
        msg.innerHTML = '<span class="down">Gagal membaca file: ' + esc(err.message) + '</span>';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const EXPORT_COLS = ['kode', 'satdik', 'jenis', 'provinsi', 'prodi', 'kategori', 'nama', 'satuan', 'jumlah', 'kondisi', 'tahun'];
  const toExport = rows => rows.map(r => Object.fromEntries(EXPORT_COLS.map(c => [c, r[c]])));
  function exportData(type) {
    const ws = XLSX.utils.json_to_sheet(toExport(filtered()), { header: EXPORT_COLS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sarpras');
    if (type === 'xlsx') {
      const P = priorityList(filtered(true)).map((p, i) => ({
        peringkat: i + 1, satdik: nameOf(p.k), jenis: META[p.k].jenis, provinsi: META[p.k].provinsi,
        iks: +p.a.iks.toFixed(1), defisit_kritis_pct: +p.crit.toFixed(1), gap_rasio_pct: +p.gap.toFixed(1),
        skor_prioritas: +p.score.toFixed(1), level: prioLevel(p.score)[1]
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(P), 'Prioritas');
    }
    XLSX.writeFile(wb, `sarpras_satdik_kkp_${new Date().toISOString().slice(0, 10)}.${type}`, { bookType: type });
  }
  function downloadTemplate() {
    const sampleSource = (window.DATA_CONTOH_EXCEL && window.DATA_CONTOH_EXCEL.length) ? window.DATA_CONTOH_EXCEL : ALL;
    const sample = toExport(sampleSource.slice(0, 10));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample, { header: EXPORT_COLS }), 'Data');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Kolom', 'Wajib', 'Keterangan'],
      ['kode', 'Ya*', 'Kode satdik (mis. PAUP, SUPMTG). *Wajib salah satu: kode atau satdik'],
      ['satdik', 'Ya*', 'Nama satuan pendidikan'],
      ['jenis', 'Tidak', 'Politeknik / Akademi Komunitas / SUPM'],
      ['provinsi', 'Tidak', 'Nama provinsi'],
      ['prodi', 'Tidak', 'Nama program studi / bidang'],
      ['kategori', 'Tidak', KAT_ORDER.join(' / ')],
      ['nama', 'Ya', 'Nama item sarpras (mis. Ruang Kelas, Komputer / PC, Kapal Latih < 30 GT)'],
      ['satuan', 'Tidak', 'unit / ruang / gedung / set / petak'],
      ['jumlah', 'Ya', 'Jumlah unit (angka > 0)'],
      ['kondisi', 'Ya', 'Baik / Rusak Ringan / Rusak Berat (boleh B, RR, RB)'],
      ['tahun', 'Disarankan', 'Tahun perolehan (YYYY)']
    ]), 'Petunjuk');
    XLSX.writeFile(wb, 'template_sarpras_satdik_kkp.xlsx');
  }

  function setData(rows, source) {
    ALL = rows; SOURCE = source;
    if (source === 'import') {
      try { localStorage.setItem(LS.rows, JSON.stringify(rows)); localStorage.setItem(LS.src, 'import'); }
      catch (e) { toast('Data terlalu besar untuk disimpan di browser; hanya berlaku sesi ini.'); }
    } else { localStorage.removeItem(LS.rows); localStorage.removeItem(LS.src); }
    const b = $('srcBadge');
    if (b) {
      b.textContent = source === 'import' ? `Data impor · ${fmtNum(rows.length)} baris` : `Data Contoh.xlsx · ${fmtNum(rows.length)} baris`;
      b.classList.add('real');
    }
    buildMeta();
    Object.keys(F).forEach(k => F[k] = '');
    tableState.data.page = 1;
    fillFilters();
    refresh();
  }

  // ---------- Otentikasi & Antarmuka Pengguna ----------
  function renderAuthState() {
    const authScreen = $('authScreen');
    const appLayout = $('appLayout');

    // Bypass login: sembunyikan authScreen dan tampilkan langsung dashboard aplikasi
    if (authScreen) {
      authScreen.style.display = 'none';
      authScreen.classList.add('hidden');
    }
    if (appLayout) {
      appLayout.classList.remove('hidden');
    }

    const defaultUser = {
      name: 'Pusdik KP (Akses Penuh)',
      role: 'admin_pusdik',
      roleLabel: 'Administrator Pusat',
      avatar: 'PK',
      unitKerja: 'Pusat Pendidikan Kelautan dan Perikanan',
      accessibleSatdik: 'ALL',
      permissions: ['all']
    };
    const user = (window.SARPRAS_AUTH ? window.SARPRAS_AUTH.getUser() : null) || defaultUser;

    // Update Topbar
    const initials = user.avatar || 'PK';
    if ($('topUserName')) $('topUserName').textContent = user.name;
    if ($('topUserRole')) $('topUserRole').textContent = user.roleLabel || 'Admin Pusat';
    if ($('userAvatar')) $('userAvatar').textContent = initials;
    if ($('dropUserFullName')) $('dropUserFullName').textContent = user.name;
    if ($('dropUserNip')) $('dropUserNip').textContent = 'Mode: Akses Langsung (Tanpa Login)';
    if ($('dropUserDept')) $('dropUserDept').textContent = user.unitKerja || 'Pusat Pendidikan KP';

    // Update Sidebar
    if ($('sidebarUserName')) $('sidebarUserName').textContent = user.name;
    if ($('sidebarUserRole')) $('sidebarUserRole').textContent = user.roleLabel || 'Admin Pusat';
    if ($('sidebarAvatar')) $('sidebarAvatar').textContent = initials;

    const banner = $('roleBanner');
    if (banner) banner.style.display = 'none';
    if ($('fSatdik')) $('fSatdik').disabled = false;

    return true;
  }

  function closeUserDropdown() {
    const d = $('userDropdown');
    const b = $('userMenuToggle');
    if (d) d.classList.remove('show');
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  function toggleUserDropdown() {
    const d = $('userDropdown');
    const b = $('userMenuToggle');
    if (!d || !b) return;
    const isShown = d.classList.toggle('show');
    b.setAttribute('aria-expanded', String(isShown));
  }

  function openModal(id) {
    const el = $(id);
    if (el) el.classList.add('show');
  }

  function closeModal(id) {
    const el = $(id);
    if (el) el.classList.remove('show');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('show'));
  }

  function setupAuthEvents() {
    // 1. Submit login form
    const loginForm = $('loginForm');
    if (loginForm) {
      loginForm.onsubmit = async e => {
        e.preventDefault();
        const alertEl = $('loginAlert');
        const spinner = $('loginSpinner');
        const submitBtn = $('btnSubmitLogin');
        const userInput = $('loginUser');
        const passInput = $('loginPass');
        const rememberInput = $('loginRemember');

        if (alertEl) alertEl.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
        if (submitBtn) submitBtn.disabled = true;

        try {
          const user = await window.SARPRAS_AUTH.login(
            userInput.value,
            passInput.value,
            rememberInput ? rememberInput.checked : false
          );
          renderAuthState();
          fillFilters();
          refresh();
          activate(PAGES[location.hash.slice(1)] ? location.hash.slice(1) : 'ringkasan');
          toast(`Selamat datang, ${user.name}!`);
          loginForm.reset();
        } catch (err) {
          if (alertEl) {
            alertEl.className = 'auth-alert error';
            alertEl.innerHTML = `<span>⚠️</span> ${esc(err.message || 'Login gagal.')}`;
            alertEl.style.display = 'flex';
          }
        } finally {
          if (spinner) spinner.style.display = 'none';
          if (submitBtn) submitBtn.disabled = false;
        }
      };
    }

    // 2. Demo Account buttons (1-klik login)
    document.querySelectorAll('.demo-chip').forEach(btn => {
      btn.onclick = () => {
        const u = btn.dataset.user;
        const p = btn.dataset.pass;
        if ($('loginUser')) $('loginUser').value = u;
        if ($('loginPass')) $('loginPass').value = p;
        if (loginForm) {
          loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      };
    });

    // 3. Password visibility toggle
    const togglePass = $('btnTogglePass');
    if (togglePass) {
      togglePass.onclick = () => {
        const p = $('loginPass');
        if (!p) return;
        if (p.type === 'password') {
          p.type = 'text';
          togglePass.textContent = '🙈';
          togglePass.title = 'Sembunyikan sandi';
        } else {
          p.type = 'password';
          togglePass.textContent = '👁️';
          togglePass.title = 'Tampilkan sandi';
        }
      };
    }

    // 4. Forgot password link
    const forgotBtn = $('btnForgotPass');
    if (forgotBtn) {
      forgotBtn.onclick = e => {
        e.preventDefault();
        openModal('modalForgotPass');
      };
    }

    // 5. User menu toggle
    const userToggle = $('userMenuToggle');
    if (userToggle) {
      userToggle.onclick = e => {
        e.stopPropagation();
        toggleUserDropdown();
      };
    }

    // Close dropdown on click outside
    document.addEventListener('click', e => {
      const menu = $('userProfileMenu');
      if (menu && !menu.contains(e.target)) {
        closeUserDropdown();
      }
    });

    // 6. Logout buttons
    const doLogout = () => {
      toast('Fitur login sedang dinonaktifkan sementara.');
    };
    if ($('btnLogout')) $('btnLogout').onclick = doLogout;
    if ($('sidebarLogout')) $('sidebarLogout').onclick = doLogout;

    // 7. Modal triggers
    if ($('btnOpenAccountModal')) {
      $('btnOpenAccountModal').onclick = () => {
        closeUserDropdown();
        const user = window.SARPRAS_AUTH.getUser();
        if (!user) return;
        $('profName').textContent = user.name;
        $('profNip').textContent = user.nip || '-';
        $('profEmail').textContent = user.email;
        $('profRole').textContent = user.roleLabel || user.role;
        $('profDept').textContent = (user.jabatan ? user.jabatan + ' · ' : '') + user.unitKerja;
        $('profSatdik').textContent = user.satdikName || 'Semua Satdik (Akses Nasional)';
        const pContainer = $('profPerms');
        if (pContainer) {
          const permLabels = {
            all: 'Akses Penuh Semua Modul',
            manage_sarpras: 'Kelola Aset Sarpras',
            import_data: 'Impor & Ekspor Data Riil',
            edit_taruna: 'Edit Taruna & Analisis Rasio',
            export_reports: 'Cetak & Unduh Laporan',
            view_campus: 'Akses Data Kampus Mandiri',
            edit_campus: 'Input/Update Sarpras Kampus',
            view_all: 'Lihat Semua Satdik Nasional',
            executive_summary: 'Ringkasan Eksekutif & IKS',
            view_policy_reco: 'Rekomendasi Kebijakan Sarpras'
          };
          pContainer.innerHTML = (user.permissions || ['all']).map(p =>
            `<span class="tag-perm">✓ ${esc(permLabels[p] || p)}</span>`
          ).join(' ');
        }
        openModal('modalProfile');
      };
    }

    if ($('btnOpenChangePassModal')) {
      $('btnOpenChangePassModal').onclick = () => {
        closeUserDropdown();
        $('formChangePass').reset();
        const alertEl = $('changePassAlert');
        if (alertEl) alertEl.style.display = 'none';
        openModal('modalChangePass');
      };
    }

    // Modal close triggers [data-close]
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.onclick = () => closeModal(btn.dataset.close);
    });

    // Close modal on click backdrop
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.onclick = e => {
        if (e.target === modal) closeModal(modal.id);
      };
    });

    // Form change password submit
    const formPass = $('formChangePass');
    if (formPass) {
      formPass.onsubmit = async e => {
        e.preventDefault();
        const oldP = $('oldPass').value;
        const newP = $('newPass').value;
        const confP = $('confirmPass').value;
        const alertEl = $('changePassAlert');
        const submitBtn = $('btnSubmitChangePass');

        if (newP !== confP) {
          if (alertEl) {
            alertEl.className = 'auth-alert error';
            alertEl.innerHTML = '<span>⚠️</span> Kata sandi baru dan konfirmasi tidak cocok.';
            alertEl.style.display = 'flex';
          }
          return;
        }

        if (submitBtn) submitBtn.disabled = true;

        try {
          await window.SARPRAS_AUTH.changePassword(oldP, newP);
          if (alertEl) {
            alertEl.className = 'auth-alert success';
            alertEl.innerHTML = '<span>✅</span> Kata sandi berhasil diubah.';
            alertEl.style.display = 'flex';
          }
          toast('Kata sandi berhasil diperbarui.');
          setTimeout(() => closeModal('modalChangePass'), 1200);
        } catch (err) {
          if (alertEl) {
            alertEl.className = 'auth-alert error';
            alertEl.innerHTML = `<span>⚠️</span> ${esc(err.message || 'Gagal mengubah kata sandi.')}`;
            alertEl.style.display = 'flex';
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      };
    }
  }

  // ---------- Init ----------
  function init() {
    let rows = null;
    if (localStorage.getItem(LS.src) === 'import') {
      try { rows = JSON.parse(localStorage.getItem(LS.rows)); } catch (e) { rows = null; }
    } else {
      try { localStorage.removeItem(LS.rows); localStorage.removeItem(LS.src); } catch (e) {}
    }
    $('lastUpdate').textContent = 'Per ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    ['fJenis', 'fProv', 'fSatdik', 'fKat'].forEach((id, i) => {
      const key = ['jenis', 'prov', 'satdik', 'kat'][i];
      $(id).addEventListener('change', e => { F[key] = e.target.value; tableState.data.page = 1; fillFilters(); refresh(); });
    });
    $('btnReset').onclick = () => {
      const u = window.SARPRAS_AUTH ? window.SARPRAS_AUTH.getUser() : null;
      Object.keys(F).forEach(k => F[k] = '');
      if (u && u.role === 'operator_satdik' && u.accessibleSatdik && u.accessibleSatdik !== 'ALL') {
        F.satdik = u.accessibleSatdik;
      }
      fillFilters();
      refresh();
    };
    $('menuToggle').onclick = () => $('sidebar').classList.toggle('open');
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));

    $('search').addEventListener('input', e => { tableState.data.q = e.target.value; tableState.data.page = 1; RENDER.data(); });
    $('btnExportXlsx').onclick = () => exportData('xlsx');
    $('btnExportCsv').onclick = () => exportData('csv');
    $('btnTemplate').onclick = downloadTemplate;
    $('btnSample').onclick = () => { 
      const real = (window.DATA_CONTOH_EXCEL && window.DATA_CONTOH_EXCEL.length) 
        ? window.DATA_CONTOH_EXCEL.slice() 
        : (window.SARPRAS && window.SARPRAS.getData ? window.SARPRAS.getData() : generate());
      setData(real, 'excel'); 
      $('importMsg').innerHTML = ''; 
      toast('Reset ke data resmi Data Contoh.xlsx'); 
    };
    $('fileInput').onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; };
    const drop = $('drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

    // Inisialisasi Otentikasi
    if (window.SARPRAS_AUTH) {
      window.SARPRAS_AUTH.init();
      setupAuthEvents();
    }
    const isAuth = renderAuthState();

    const defaultData = (window.DATA_CONTOH_EXCEL && window.DATA_CONTOH_EXCEL.length)
      ? window.DATA_CONTOH_EXCEL.slice()
      : (window.SARPRAS && window.SARPRAS.getData ? window.SARPRAS.getData() : generate());
    setData(rows && rows.length ? rows : defaultData, rows && rows.length ? 'import' : 'excel');

    if (isAuth) {
      activate(PAGES[location.hash.slice(1)] ? location.hash.slice(1) : 'ringkasan');
    }

    // Re-measure chart labels once the web font has loaded (prevents clipped axis labels).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => refresh());
    }
  }

  init();
})();

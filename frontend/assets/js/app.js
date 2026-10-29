/* SIANSAR KP — logika analisis & visualisasi */
(function () {
  'use strict';

  const { SATDIK, KATALOG, UMUR, generate } = window.SARPRAS;
  const NOW = new Date().getFullYear();
  const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

  // Bobot Indeks Kondisi Sarpras (IKS) — Baik=100, Rusak Ringan=70, Rusak Berat=0
  const W = { 'Baik': 100, 'Rusak Ringan': 70, 'Rusak Berat': 0 };
  const KCOL = { 'Baik': '#10b981', 'Rusak Ringan': '#0ea5e9', 'Rusak Berat': '#f43f5e' };
  const KCLS = { 'Baik': 'b-baik', 'Rusak Ringan': 'b-rr', 'Rusak Berat': 'b-rb' };
  const CRITICAL = ['Penangkapan Ikan', 'Permesinan Kapal', 'Budidaya', 'Pengolahan'];
  const KAT_ORDER = Object.keys(UMUR);
  const PALETTE = ['#06b6d4', '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b', '#14b8a6'];

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

  const LS = { rows: 'siansar_rows_v1', src: 'siansar_src_v1', taruna: 'siansar_taruna_v1', dosen: 'siansar_dosen_v1' };

  // ---------- State ----------
  let ALL = [];
  let SOURCE = 'sample';
  let META = {};
  let TARUNA = {};
  const F = { jenis: '', prov: '', satdik: '', kat: '' };
  const charts = {};
  let map = null, mapLayer = null;
  let DOSEN_LIST = [];
  const F_DOSEN = { jenis: '', satdik: '', prodi: '', jafung: '', q: '' };
  const JAFUNG_LIST = ['Tenaga Pengajar', 'Asisten Ahli', 'Lektor', 'Lektor Kepala', 'Guru Besar'];
  const tableState = { profil: { key: 'iks', dir: 1 }, data: { key: null, dir: 1, page: 1, q: '' }, dosen: { key: null, dir: 1, page: 1 } };

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
  const JENIS_ORDER = ['Politeknik', 'Akademi Komunitas', 'SUPM'];
  const formatSatdikSummary = list => {
    const g = groupBy(list, x => (x && x.m ? x.m.jenis : (x && x.jenis) ? x.jenis : (META[x] ? META[x].jenis : '')));
    const orderedKeys = [...JENIS_ORDER.filter(j => g.has(j)), ...[...g.keys()].filter(j => j && !JENIS_ORDER.includes(j))];
    return orderedKeys.map(j => `${g.get(j).length} ${j}`).join(' · ');
  };
  function iksLevel(v) { return v >= 80 ? 'Baik' : v >= 65 ? 'Cukup' : v >= 50 ? 'Kurang' : 'Kritis'; }
  function isDark() { return !document.documentElement.classList.contains('light'); }
  function iksColor(v) { return v >= 80 ? '#10b981' : v >= 65 ? '#0ea5e9' : v >= 50 ? '#f59e0b' : '#f43f5e'; }
  function iksBadge(v) {
    const c = v >= 80 ? 'b-baik' : v >= 65 ? 'b-rr' : v >= 50 ? 'b-rs' : 'b-rb';
    return `<span class="badge ${c}">${iksLevel(v)}</span>`;
  }
  function heat(v) {
    const h = Math.max(0, Math.min(1, (v - 30) / 65)) * 120;
    return isDark() ? `background:hsla(${h},75%,45%,.22);color:hsl(${h},85%,76%)` : `background:hsl(${h},75%,86%);color:hsl(${h},70%,22%)`;
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
    const metas = Object.values(META);
    const uniqArr = arr => [...new Set(arr)].filter(Boolean).sort((a, b) => String(a).localeCompare(b)).map(v => [v, v]);
    const uniq = f => [...new Set(ALL.map(f))].filter(Boolean).sort((a, b) => String(a).localeCompare(b)).map(v => [v, v]);
    fillSelect($('fJenis'), uniqArr([...metas.map(m => m.jenis), ...ALL.map(r => r.jenis)]), 'Semua jenis', F.jenis);
    F.jenis = $('fJenis').value;
    fillSelect($('fProv'), uniqArr([
      ...metas.filter(m => !F.jenis || m.jenis === F.jenis).map(m => m.provinsi),
      ...ALL.filter(r => !F.jenis || r.jenis === F.jenis).map(r => r.provinsi)
    ]), 'Semua provinsi', F.prov);
    F.prov = $('fProv').value;
    const satMap = new Map();
    metas.filter(m => (!F.jenis || m.jenis === F.jenis) && (!F.prov || m.provinsi === F.prov)).forEach(m => satMap.set(m.kode, m.nama));
    ALL.filter(r => (!F.jenis || r.jenis === F.jenis) && (!F.prov || r.provinsi === F.prov)).forEach(r => { if (!satMap.has(r.kode)) satMap.set(r.kode, r.satdik); });
    const sat = [...satMap]
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
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.maintainAspectRatio = false;
  function applyChartTheme() {
    const dk = isDark();
    Chart.defaults.color = dk ? '#cbd5e1' : '#090d16';
    Chart.defaults.borderColor = dk ? 'rgba(51, 65, 85, 0.45)' : '#cbd5e1';
  }
  applyChartTheme();
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
    beranda: ['Beranda — Ringkasan 3 Modul', 'Sintesis terpadu kondisi Sarana Prasarana (Sarpras), Data Pokok Pendidikan (Dapodik), dan Kemitraan Industri (Mitra) BPPSDM KP'],
    ringkasan: ['Ringkasan Sarana & Prasarana', 'Gambaran umum kondisi sarana prasarana satuan pendidikan lingkup KKP'],
    kondisi: ['Analisis Program Studi', 'Distribusi kondisi, usia aset sarpras per program studi, dan tren perolehan aset'],
    satdik: ['Per Satuan Pendidikan', 'Perbandingan kondisi sarpras antar satuan pendidikan KKP (Politeknik, Akademi Komunitas, dan SUPM)'],
    kecukupan: ['Rasio & Kecukupan', 'Ketersediaan sarpras layak pakai terhadap jumlah peserta didik'],
    prioritas: ['Prioritas & Rekomendasi', 'Pemeringkatan kebutuhan intervensi dan rekomendasi kebijakan'],
    peta: ['Peta Sebaran', 'Sebaran geografis satuan pendidikan dan indeks kondisi sarpras'],
    data: ['Data & Impor', 'Kelola, impor, dan ekspor data sarana prasarana'],
    dapodik: ['Ringkasan Dapodik', 'Data pokok peserta didik (taruna/siswa), tenaga pendidik, dan program studi lingkup BPPSDM KP'],
    'dapo-pd': ['Peserta Didik', 'Jumlah, jenis kelamin, dan sebaran tingkat taruna/siswa aktif per satuan pendidikan'],
    'dapo-dosen': ['Data Dosen', 'Data pokok dosen satuan pendidikan lingkup BPPSDM KP (NIDN, kualifikasi pendidikan, jabatan fungsional, dan sertifikasi)'],
    'dapo-ptk': ['Pendidik & Tenaga Kependidikan', 'Komposisi dosen/guru, instruktur praktik, tenaga kependidikan, dan rasio terhadap peserta didik'],
    'dapo-prodi': ['Rombel & Program Studi', 'Program studi/kompetensi keahlian, satdik penyelenggara, dan estimasi rombongan belajar'],
    'dapo-satdik': ['Rekap Satuan Pendidikan', 'Rekapitulasi data pokok pendidikan per satuan pendidikan KKP'],
    mitra: ['Ringkasan Kemitraan', 'Gambaran umum mitra kerja sama industri, instansi, dan lembaga internasional'],
    'mitra-dir': ['Direktori Mitra', 'Daftar mitra industri & instansi kerja sama (DUDI) satuan pendidikan KKP'],
    'mitra-mou': ['MoU & Perjanjian Kerja Sama', 'Pemantauan masa berlaku dokumen MoU/PKS dan kebutuhan perpanjangan'],
    'mitra-magang': ['Magang & Praktik Laut', 'Kuota dan realisasi penempatan magang/Prala taruna di mitra'],
    'mitra-serapan': ['Serapan Lulusan', 'Hasil tracer study: lulusan bekerja, wirausaha, studi lanjut, dan belum terserap']
  };
  const MODULES = {
    beranda: ['beranda'],
    sarpras: ['ringkasan', 'kondisi', 'satdik', 'kecukupan', 'prioritas', 'peta', 'data'],
    dapodik: ['dapodik', 'dapo-pd', 'dapo-dosen', 'dapo-ptk', 'dapo-prodi', 'dapo-satdik'],
    mitra: ['mitra', 'mitra-dir', 'mitra-mou', 'mitra-magang', 'mitra-serapan']
  };
  const moduleOf = p => Object.keys(MODULES).find(k => MODULES[k].includes(p)) || 'beranda';
  let current = 'beranda';
  const lastPage = { beranda: 'beranda', sarpras: 'ringkasan', dapodik: 'dapodik', mitra: 'mitra' };
  const dirty = new Set(Object.keys(PAGES));
  const RENDER = {};

  RENDER.ringkasan = function () {
    const rows = filtered(), A = agg(rows);
    const activeMetas = Object.values(META).filter(m => (!F.jenis || m.jenis === F.jenis) && (!F.prov || m.provinsi === F.prov) && (!F.satdik || m.kode === F.satdik));
    $('kSatdik').textContent = fmtNum(activeMetas.length);
    $('kSatdikF').textContent = formatSatdikSummary(activeMetas);
    $('kUnit').textContent = fmtNum(A.unit);
    $('kUnitF').textContent = `${fmtNum(new Set(rows.map(r => r.nama)).size)} jenis item · ${fmtNum(rows.length)} baris`;
    $('kBaik').textContent = pct(A.k['Baik'] / A.unit);
    $('kBaikF').innerHTML = `Rusak berat: <span class="down">${pct(A.k['Rusak Berat'] / A.unit)}</span>`;
    $('kIks').textContent = f1(A.iks);
    $('kIksF').innerHTML = A.unit ? iksBadge(A.iks) + ' skala 0–100' : '';

    $('insights').innerHTML = insights(rows).map(([c, i, t]) => `<li class="${c}"><span class="i-ico">${i}</span><span>${t}</span></li>`).join('');

    // Peringatan dini bila ada sarpras rusak berat (mengikuti ExecutiveDashboard.jsx)
    const alertRB = $('alertRB');
    if (alertRB) {
      if (A.k['Rusak Berat'] > 0) {
        const rbRow = [...rows].filter(r => r.kondisi === 'Rusak Berat').sort((a, b) => b.jumlah - a.jumlah)[0];
        alertRB.style.display = 'flex';
        $('alertRBTitle').textContent = `Peringatan Dini: ${fmtNum(A.k['Rusak Berat'])} Unit Sarpras Rusak Berat (${pct(A.k['Rusak Berat'] / A.unit)})!`;
        $('alertRBText').innerHTML = rbRow ? `Contoh: <b>${esc(rbRow.nama)}</b> (${esc(short(rbRow.satdik))}) — ${fmtNum(rbRow.jumlah)} ${esc(rbRow.satuan)} rusak berat.` : '';
      } else {
        alertRB.style.display = 'none';
      }
    }
    const prioBadge = $('tabBadgePrio');
    if (prioBadge) {
      const nKrit = [...groupBy(rows, r => r.kode)].filter(([, rs]) => agg(rs).iks < 65).length;
      prioBadge.style.display = nKrit > 0 ? 'inline-block' : 'none';
      prioBadge.textContent = nKrit;
    }
    if ($('donutTotal')) $('donutTotal').textContent = fmtNum(A.unit) + ' Unit Total';
    if ($('donutPct')) $('donutPct').textContent = pct(A.k['Baik'] / A.unit);
    if ($('donutStats')) {
      $('donutStats').innerHTML = [
        ['Baik (Layak)', A.k['Baik'], 'var(--emerald-t)'],
        ['Rusak Ringan', A.k['Rusak Ringan'], 'var(--sky-t)'],
        ['Rusak Berat', A.k['Rusak Berat'], 'var(--rose-t)']
      ].map(([l, v, col]) => `<div class="mini-stat"><span>${l}</span><b style="color:${col}">${fmtNum(v)} <small>(${pct(v / A.unit)})</small></b></div>`).join('');
    }
    if ($('iksAvgNote')) $('iksAvgNote').textContent = 'Rata-rata IKS: ' + f1(A.iks);

    chart('cKondisi', {
      type: 'doughnut',
      data: { labels: KONDISI, datasets: [{ data: KONDISI.map(k => A.k[k]), backgroundColor: KONDISI.map(k => KCOL[k]), borderWidth: 2, borderColor: isDark() ? '#1e293b' : '#fff', hoverOffset: 6 }] },
      options: { cutout: '68%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtNum(c.raw)} unit (${pct(c.raw / A.unit)})` } } } }
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
          { label: 'Umur ekonomis', data: kat.map(x => UMUR[x.k] || 20), backgroundColor: isDark() ? '#475569' : '#cbd5e1', borderRadius: 4 }
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
            { type: 'line', label: '% rusak berat (kondisi kini)', data: data.map(d => +d.rb.toFixed(1)), borderColor: '#f43f5e', backgroundColor: '#f43f5e', yAxisID: 'y1', tension: .3 },
            { type: 'bar', label: 'Unit diperoleh', data: data.map(d => d.unit), backgroundColor: '#06b6d4', borderRadius: 4, yAxisID: 'y' }
          ]
        },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'unit' } }, y1: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } } }
      });
    }

    if (!rows.length) chart('cTren', { type: 'bar', data: { labels: [], datasets: [] } });
    const items = [...groupBy(rows, r => r.nama)].map(([n, rs]) => {
      const a = agg(rs), rbRows = rs.filter(r => r.kondisi === 'Rusak Berat');
      return { n, kat: rs[0].kategori, sat: rs[0].satuan, unit: a.unit, rb: a.k['Rusak Berat'], rbp: a.k['Rusak Berat'] / a.unit, nSat: new Set(rbRows.map(r => r.kode)).size };
    }).filter(i => i.rb > 0).sort((a, b) => (b.rb - a.rb) || (b.rbp - a.rbp)).slice(0, 15);
    $('tTopRusak').innerHTML = `<thead><tr><th>#</th><th>Item Sarpras</th><th>Program Studi</th><th class="num">Total Unit</th><th class="num">Rusak Berat</th><th>% RB</th><th class="num">Satdik Terdampak</th></tr></thead><tbody>` +
      (items.map((i, x) => `<tr><td>${x + 1}</td><td><b>${esc(i.n)}</b></td><td>${esc(i.kat)}</td><td class="num">${fmtNum(i.unit)} ${esc(i.sat)}</td><td class="num">${fmtNum(i.rb)}</td><td>${bar(i.rbp * 100, '#f43f5e')} <span class="small">${pct(i.rbp)}</span></td><td class="num">${i.nSat}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Tidak ada item rusak berat.</td></tr>') + '</tbody>';
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

    if (!sats.length) $('tHeat').innerHTML = '<thead><tr><th>Satuan Pendidikan</th><th>Total</th></tr></thead><tbody><tr><td colspan="2" class="muted">Tidak ada data sarpras pada kombinasi filter ini.</td></tr></tbody>';
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
          `<td><div style="display:flex;gap:8px;align-items:center">${bar(p.score / 60 * 100, ['', '#f43f5e', '#f59e0b', '#0ea5e9', '#10b981'][l])}<b>${f1(p.score)}</b></div></td><td><span class="lvl lvl-${l}">${t}</span></td></tr>`;
      }).join('') + '</tbody>';

    if (!P.length) $('tPrioritas').innerHTML = '<thead><tr><th>#</th><th>Satuan Pendidikan</th><th class="num">IKS</th><th class="num">Defisit Kritis</th><th class="num">Gap Rasio</th><th>Skor Prioritas</th><th>Level</th></tr></thead><tbody><tr><td colspan="7" class="muted">Tidak ada data sarpras pada kombinasi filter ini.</td></tr></tbody>';
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

    const metas = Object.values(META).filter(m => (!F.jenis || m.jenis === F.jenis) && (!F.prov || m.provinsi === F.prov)).sort((a, b) => a.nama.localeCompare(b.nama));
    $('tTaruna').innerHTML = '<thead><tr><th>Satuan Pendidikan</th><th>Jenis</th><th class="num">Jumlah Taruna</th></tr></thead><tbody>' +
      metas.map(m => `<tr><td>${esc(m.nama)}</td><td>${esc(m.jenis)}</td><td class="num"><input type="number" min="0" step="10" data-k="${esc(m.kode)}" value="${+TARUNA[m.kode] || 0}"></td></tr>`).join('') + '</tbody>';
    $('tTaruna').querySelectorAll('input').forEach(inp => inp.onchange = () => {
      TARUNA[inp.dataset.k] = Math.max(0, +inp.value || 0);
      localStorage.setItem(LS.taruna, JSON.stringify(TARUNA));
      Object.keys(PAGES).forEach(p => p !== 'data' && dirty.add(p));
      toast('Jumlah taruna diperbarui');
    });
  };

  // ================= MODUL DAPODIK =================
  // Angka turunan (PTK, L/P, tingkat, rombel) bersifat ilustratif & deterministik per satdik.
  const seed = (s, n) => {
    let h = 2166136261;
    for (const c of String(s) + '|' + n) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  };
  const dapoLevels = j => /politeknik/i.test(j) ? 4 : /akademi/i.test(j) ? 2 : 3;
  const ROMAN = ['I', 'II', 'III', 'IV'];
  const dapoMetas = () => Object.values(META).sort((a, b) => a.nama.localeCompare(b.nama));
  function dapoStats(m) {
    const taruna = +TARUNA[m.kode] || 0;
    const laki = Math.round(taruna * (0.7 + seed(m.kode, 'lp') * 0.15));
    const lv = dapoLevels(m.jenis);
    const w = Array.from({ length: lv }, (_, i) => 1 + seed(m.kode, 'tk' + i) * 0.35);
    const ws = w.reduce((a, b) => a + b, 0);
    const tingkat = w.map(x => Math.round(taruna * x / ws));
    const dosen = Math.max(12, Math.round(taruna / (14 + seed(m.kode, 'ds') * 10)));
    const instruktur = Math.round(dosen * (0.25 + seed(m.kode, 'in') * 0.2));
    const tendik = Math.round(dosen * (0.6 + seed(m.kode, 'tdk') * 0.3));
    const pendidik = dosen + instruktur;
    let prodis = [...new Set(ALL.filter(r => r.kode === m.kode).map(r => r.kategori).filter(Boolean))];
    if (!prodis.length) prodis = ['Penangkapan Ikan', 'Permesinan Kapal', 'Budidaya', 'Pengolahan'];
    return {
      m, taruna, laki, perempuan: taruna - laki, lv, tingkat, dosen, instruktur, tendik, pendidik,
      ptk: pendidik + tendik, rasio: pendidik ? taruna / pendidik : 0,
      rombel: Math.max(4, Math.ceil(taruna / 30)), prodis
    };
  }

  RENDER.dapodik = function () {
    const S = dapoMetas().map(dapoStats);
    const totalTaruna = sum(S, 'taruna');
    $('dapoSatdik').textContent = fmtNum(S.length);
    $('dapoSatdikF').textContent = formatSatdikSummary(S);
    $('dapoTaruna').textContent = fmtNum(totalTaruna);
    $('dapoPendidik').textContent = fmtNum(sum(S, 'ptk'));
    $('dapoProdi').textContent = fmtNum(new Set(ALL.map(r => r.kategori).filter(Boolean)).size);

    const byJenis = JENIS_ORDER.filter(j => S.some(s => s.m.jenis === j)).map(j => [j, sum(S.filter(s => s.m.jenis === j), 'taruna')]);
    chart('cDapoJenis', {
      type: 'doughnut',
      data: { labels: byJenis.map(x => x[0]), datasets: [{ data: byJenis.map(x => x[1]), backgroundColor: PALETTE, borderWidth: 2, borderColor: isDark() ? '#1e293b' : '#fff' }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtNum(c.raw)} (${pct(c.raw / totalTaruna)})` } } } }
    });
    const top = [...S].sort((a, b) => b.taruna - a.taruna).slice(0, 10);
    chart('cDapoTop', {
      type: 'bar',
      data: { labels: top.map(s => short(s.m.nama)), datasets: [{ label: 'Peserta didik', data: top.map(s => s.taruna), backgroundColor: '#06b6d4', borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { y: { grid: { display: false } } } }
    });
  };

  RENDER['dapo-pd'] = function () {
    const S = dapoMetas().map(dapoStats);
    const prov = [...groupBy(S, s => s.m.provinsi)].map(([p, l]) => [p, sum(l, 'taruna')]).sort((a, b) => b[1] - a[1]);
    chart('cDapoProv', {
      type: 'bar',
      data: { labels: prov.map(x => x[0]), datasets: [{ label: 'Peserta didik', data: prov.map(x => x[1]), backgroundColor: '#3b82f6', borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } }
    });
    $('tDapoPD').innerHTML = `<thead><tr><th>Satuan Pendidikan</th><th>Jenis</th><th>Provinsi</th><th class="num">Total</th><th class="num">Laki-laki</th><th class="num">Perempuan</th><th>% Perempuan</th><th>Sebaran Tingkat</th><th class="num">Rombel</th></tr></thead><tbody>` +
      (S.map(s => `<tr><td><b>${esc(short(s.m.nama))}</b></td><td>${esc(s.m.jenis)}</td><td>${esc(s.m.provinsi)}</td>` +
        `<td class="num"><b>${fmtNum(s.taruna)}</b></td><td class="num">${fmtNum(s.laki)}</td><td class="num">${fmtNum(s.perempuan)}</td>` +
        `<td><div style="display:flex;gap:8px;align-items:center">${bar(s.taruna ? s.perempuan / s.taruna * 100 : 0, '#ec4899')}<span class="small">${pct(s.taruna ? s.perempuan / s.taruna : NaN)}</span></div></td>` +
        `<td class="small">${s.tingkat.map((t, i) => `Tk ${ROMAN[i]}: <b>${fmtNum(t)}</b>`).join(' · ')}</td><td class="num">${fmtNum(s.rombel)}</td></tr>`).join('') ||
        '<tr><td colspan="9" class="muted">Tidak ada data.</td></tr>') + '</tbody>';
  };

  // ---------- Dapodik: Data Dosen (Tanpa Data Dummy) ----------
  function loadDosen() {
    try {
      const saved = localStorage.getItem(LS.dosen);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          DOSEN_LIST = parsed;
          return;
        }
      }
    } catch (e) {}
    DOSEN_LIST = (window.SARPRAS && Array.isArray(window.SARPRAS.DOSEN)) ? window.SARPRAS.DOSEN.slice() : [];
  }

  function saveDosen() {
    try { localStorage.setItem(LS.dosen, JSON.stringify(DOSEN_LIST)); }
    catch (e) { toast('Gagal menyimpan data dosen ke penyimpanan lokal.'); }
  }

  function dosenSatdikOptions(jenisFilter) {
    const base = Object.values(META);
    const list = (base.length ? base : SATDIK).filter(m => !jenisFilter || m.jenis === jenisFilter);
    return [...list].sort((a, b) => a.nama.localeCompare(b.nama));
  }

  function dosenProdiOptions() {
    const set = new Set([...KAT_ORDER, ...ALL.map(r => r.kategori).filter(Boolean), ...DOSEN_LIST.map(d => d.prodi).filter(Boolean)]);
    return [...set].sort((a, b) => katIdx(a) - katIdx(b) || String(a).localeCompare(b));
  }

  function fillDosenFilters() {
    const baseMetas = Object.values(META);
    const jenisSource = baseMetas.length ? baseMetas : SATDIK;
    const jenisOpts = [...new Set(jenisSource.map(m => m.jenis))].filter(Boolean).sort((a, b) => String(a).localeCompare(b)).map(j => [j, j]);
    if ($('fDosenJenis')) {
      fillSelect($('fDosenJenis'), jenisOpts, 'Semua jenis', F_DOSEN.jenis);
      F_DOSEN.jenis = $('fDosenJenis').value;
    }
    const sats = dosenSatdikOptions(F_DOSEN.jenis).map(m => [m.kode, m.nama]);
    const prodis = dosenProdiOptions().map(p => [p, p]);
    const jafungs = JAFUNG_LIST.map(j => [j, j]);
    if ($('fDosenSatdik')) {
      fillSelect($('fDosenSatdik'), sats, 'Semua satuan pendidikan', F_DOSEN.satdik);
      F_DOSEN.satdik = $('fDosenSatdik').value;
    }
    if ($('fDosenProdi')) fillSelect($('fDosenProdi'), prodis, 'Semua program studi', F_DOSEN.prodi);
    if ($('fDosenJafung')) fillSelect($('fDosenJafung'), jafungs, 'Semua jabatan fungsional', F_DOSEN.jafung);

    const user = window.SARPRAS_AUTH ? window.SARPRAS_AUTH.getUser() : null;
    if (user && user.role === 'operator_satdik' && user.accessibleSatdik && user.accessibleSatdik !== 'ALL') {
      F_DOSEN.satdik = user.accessibleSatdik;
      if ($('fDosenSatdik')) {
        $('fDosenSatdik').value = user.accessibleSatdik;
        $('fDosenSatdik').disabled = true;
      }
      if ($('fDosenJenis')) $('fDosenJenis').disabled = true;
    } else {
      if ($('fDosenSatdik')) $('fDosenSatdik').disabled = false;
      if ($('fDosenJenis')) $('fDosenJenis').disabled = false;
    }
  }

  function filteredDosen() {
    const q = (F_DOSEN.q || '').toLowerCase().trim();
    return DOSEN_LIST.filter(d => {
      const dJenis = (META[d.kode] && META[d.kode].jenis) || inferJenis(d.satdik);
      return (!F_DOSEN.jenis || dJenis === F_DOSEN.jenis) &&
        (!F_DOSEN.satdik || d.kode === F_DOSEN.satdik) &&
        (!F_DOSEN.prodi || d.prodi === F_DOSEN.prodi) &&
        (!F_DOSEN.jafung || d.jafung === F_DOSEN.jafung) &&
        (!q || `${d.nama} ${d.nidn} ${d.nip} ${d.prodi} ${d.satdik} ${d.jafung} ${d.pendidikan}`.toLowerCase().includes(q));
    });
  }

  RENDER['dapo-dosen'] = function () {
    fillDosenFilters();
    const list = filteredDosen();
    const total = list.length;
    const s3 = list.filter(d => /^s3|doktor/i.test(d.pendidikan)).length;
    const s2 = list.filter(d => /^s2|magister/i.test(d.pendidikan)).length;
    const lektorPlus = list.filter(d => /lektor|guru besar|profesor/i.test(d.jafung)).length;
    const serdos = list.filter(d => d.sertifikasi === 'Tersertifikasi').length;
    const nSatdik = new Set(list.map(d => d.kode).filter(Boolean)).size;

    if ($('dosenTotal')) $('dosenTotal').textContent = fmtNum(total);
    if ($('dosenTotalF')) $('dosenTotalF').textContent = total ? `${fmtNum(nSatdik)} Satuan Pendidikan` : 'Belum ada data dosen';
    if ($('dosenS3')) $('dosenS3').textContent = fmtNum(s3);
    if ($('dosenS3F')) $('dosenS3F').textContent = total ? `S2: ${fmtNum(s2)} · S3: ${fmtNum(s3)} (${pct(s3 / total)})` : 'S2: 0 · S3: 0';
    if ($('dosenJafung')) $('dosenJafung').textContent = fmtNum(lektorPlus);
    if ($('dosenJafungF')) $('dosenJafungF').textContent = total ? `${pct(lektorPlus / total)} dari total dosen` : 'Lektor, Lektor Kepala & Guru Besar';
    if ($('dosenSerdos')) $('dosenSerdos').textContent = fmtNum(serdos);
    if ($('dosenSerdosF')) $('dosenSerdosF').textContent = total ? `${pct(serdos / total)} telah tersertifikasi` : 'Dosen Bersertifikat Pendidik';
    if ($('dosenRowCount')) $('dosenRowCount').textContent = `(${fmtNum(total)} data)`;
    if ($('btnClearDosen')) $('btnClearDosen').style.display = DOSEN_LIST.length > 0 ? '' : 'none';

    // Grafik 1: Sebaran Dosen per Satdik
    if (total === 0) {
      if (charts.cDosenSatdik) { charts.cDosenSatdik.destroy(); delete charts.cDosenSatdik; }
      if ($('cDosenSatdik')) $('cDosenSatdik').style.display = 'none';
      if ($('emptyDosenSatdik')) $('emptyDosenSatdik').style.display = 'flex';

      if (charts.cDosenJafung) { charts.cDosenJafung.destroy(); delete charts.cDosenJafung; }
      if ($('cDosenJafung')) $('cDosenJafung').style.display = 'none';
      if ($('emptyDosenJafung')) $('emptyDosenJafung').style.display = 'flex';
    } else {
      if ($('emptyDosenSatdik')) $('emptyDosenSatdik').style.display = 'none';
      if ($('cDosenSatdik')) $('cDosenSatdik').style.display = 'block';
      const bySat = [...groupBy(list, d => d.kode || d.satdik)]
        .map(([k, arr]) => [short(nameOf(k) || arr[0].satdik || k), arr.length])
        .sort((a, b) => b[1] - a[1]);
      chart('cDosenSatdik', {
        type: 'bar',
        data: { labels: bySat.map(x => x[0]), datasets: [{ label: 'Jumlah Dosen', data: bySat.map(x => x[1]), backgroundColor: '#06b6d4', borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { y: { grid: { display: false } }, x: { beginAtZero: true, ticks: { precision: 0 } } } }
      });

      if ($('emptyDosenJafung')) $('emptyDosenJafung').style.display = 'none';
      if ($('cDosenJafung')) $('cDosenJafung').style.display = 'block';
      const byJf = [...groupBy(list, d => d.jafung || 'Tenaga Pengajar')].map(([j, arr]) => [j, arr.length]);
      chart('cDosenJafung', {
        type: 'doughnut',
        data: { labels: byJf.map(x => x[0]), datasets: [{ data: byJf.map(x => x[1]), backgroundColor: PALETTE, borderWidth: 2, borderColor: isDark() ? '#1e293b' : '#fff' }] },
        options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtNum(c.raw)} (${pct(c.raw / total)})` } } } }
      });
    }

    // Tabel Data Dosen
    const tbl = $('tDapoDosen');
    const pg = $('dosenPager');
    const cols = [
      { key: '_no', label: '#', num: 1 },
      { key: 'nama', label: 'Nama Dosen', fmt: v => `<b>${esc(v)}</b>` },
      { key: 'nidn', label: 'NIDN / NUPTK', fmt: v => `<span class="mono small">${esc(v || '-')}</span>` },
      { key: 'nip', label: 'NIP', fmt: v => `<span class="mono small">${esc(v || '-')}</span>` },
      { key: 'jk', label: 'L/P' },
      { key: 'pendidikan', label: 'Pendidikan', fmt: v => `<span class="badge ${/^s3|doktor/i.test(v) ? 'b-baik' : 'b-rr'}">${esc(v || '-')}</span>` },
      { key: 'jafung', label: 'Jabatan Fungsional' },
      { key: 'prodi', label: 'Program Studi' },
      { key: 'satdik', label: 'Satuan Pendidikan', fmt: (v, r) => esc(short(v || nameOf(r.kode))) },
      { key: 'sertifikasi', label: 'Sertifikasi', fmt: v => `<span class="badge ${v === 'Tersertifikasi' ? 'b-baik' : 'b-rs'}">${esc(v || 'Belum')}</span>` },
      { key: 'status', label: 'Status', fmt: v => `<span class="badge ${v === 'Aktif' ? 'b-ok' : 'b-rr'}">${esc(v || 'Aktif')}</span>` },
      { key: '_aksi', label: 'Aksi', nosort: 1 }
    ];

    if (total === 0) {
      tbl.innerHTML = '<thead><tr>' + cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.label}</th>`).join('') + '</tr></thead>' +
        `<tbody><tr><td colspan="${cols.length}" class="empty-cell"><div class="empty-box">` +
        `<svg class="ico-svg"><use href="#i-user-check"/></svg>` +
        `<b>Belum Ada Data Dosen</b>` +
        `<span>Data dosen saat ini masih kosong. Klik tombol <b>Tambah Dosen</b> atau <b>Impor Excel/CSV</b> untuk menambahkan data.</span>` +
        `</div></td></tr></tbody>`;
      if (pg) pg.innerHTML = '';
      return;
    }

    const st = tableState.dosen;
    let sorted = list;
    if (st.key && st.key !== '_no' && st.key !== '_aksi') {
      sorted = [...list].sort((a, b) => String(a[st.key] ?? '').localeCompare(String(b[st.key] ?? '')) * st.dir);
    }
    const pageSize = 25;
    const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
    st.page = Math.min(st.page, pages);
    const startIdx = (st.page - 1) * pageSize;
    const slice = sorted.slice(startIdx, startIdx + pageSize);

    tbl.innerHTML = '<thead><tr>' + cols.map(c =>
      `<th class="${c.num ? 'num' : ''}" ${c.nosort ? '' : `data-k="${c.key}"`}>${c.label}${!c.nosort && st.key === c.key ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`
    ).join('') + '</tr></thead><tbody>' +
      slice.map((r, idx) => `<tr>` +
        `<td class="num">${startIdx + idx + 1}</td>` +
        `<td><b>${esc(r.nama)}</b></td>` +
        `<td class="mono small">${esc(r.nidn || '-')}</td>` +
        `<td class="mono small">${esc(r.nip || '-')}</td>` +
        `<td>${esc(r.jk || '-')}</td>` +
        `<td><span class="badge ${/^s3|doktor/i.test(r.pendidikan) ? 'b-baik' : 'b-rr'}">${esc(r.pendidikan || '-')}</span></td>` +
        `<td>${esc(r.jafung || '-')}</td>` +
        `<td>${esc(r.prodi || '-')}</td>` +
        `<td>${esc(short(r.satdik || nameOf(r.kode)))}</td>` +
        `<td><span class="badge ${r.sertifikasi === 'Tersertifikasi' ? 'b-baik' : 'b-rs'}">${esc(r.sertifikasi || 'Belum')}</span></td>` +
        `<td><span class="badge ${r.status === 'Aktif' ? 'b-ok' : 'b-rr'}">${esc(r.status || 'Aktif')}</span></td>` +
        `<td><div class="btn-row" style="gap:4px;flex-wrap:nowrap">` +
          `<button type="button" class="btn btn-ghost btn-sm" data-edit-dosen="${esc(r.id)}">Edit</button>` +
          `<button type="button" class="btn btn-danger btn-sm" data-del-dosen="${esc(r.id)}">Hapus</button>` +
        `</div></td>` +
      `</tr>`).join('') + '</tbody>';

    tbl.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      if (k === '_no') return;
      st.dir = st.key === k ? -st.dir : 1;
      st.key = k;
      RENDER['dapo-dosen']();
    });
    tbl.querySelectorAll('[data-edit-dosen]').forEach(btn => btn.onclick = () => openDosenModal(btn.dataset.editDosen));
    tbl.querySelectorAll('[data-del-dosen]').forEach(btn => btn.onclick = () => {
      const id = String(btn.dataset.delDosen);
      DOSEN_LIST = DOSEN_LIST.filter(d => String(d.id) !== id);
      saveDosen();
      RENDER['dapo-dosen']();
      toast('Data dosen dihapus.');
    });

    if (pg) {
      const btn = (p, label, dis, on) => `<button data-p="${p}" ${dis ? 'disabled' : ''} class="${on ? 'on' : ''}">${label}</button>`;
      let h = btn(st.page - 1, '‹', st.page === 1);
      for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || Math.abs(p - st.page) <= 2) h += btn(p, p, false, p === st.page);
        else if (Math.abs(p - st.page) === 3) h += '<span class="muted">…</span>';
      }
      pg.innerHTML = h + btn(st.page + 1, '›', st.page === pages) + `<span class="muted small">hal. ${st.page}/${pages}</span>`;
      pg.querySelectorAll('button').forEach(b => b.onclick = () => { st.page = +b.dataset.p; RENDER['dapo-dosen'](); });
    }
  };

  function openDosenModal(editId) {
    const sats = dosenSatdikOptions();
    const prodis = dosenProdiOptions();
    if ($('inpDosenSatdik')) {
      $('inpDosenSatdik').innerHTML = sats.map(m => `<option value="${esc(m.kode)}">${esc(m.nama)}</option>`).join('');
    }
    if ($('inpDosenProdi')) {
      $('inpDosenProdi').innerHTML = prodis.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    }
    const form = $('formDosen');
    if (form) form.reset();

    const existing = editId != null ? DOSEN_LIST.find(d => String(d.id) === String(editId)) : null;
    if ($('modalDosenTitle')) $('modalDosenTitle').textContent = existing ? 'Edit Data Dosen' : 'Tambah Data Dosen';
    if ($('dosenId')) $('dosenId').value = existing ? existing.id : '';

    if (existing) {
      if ($('inpDosenNama')) $('inpDosenNama').value = existing.nama || '';
      if ($('inpDosenNidn')) $('inpDosenNidn').value = existing.nidn || '';
      if ($('inpDosenNip')) $('inpDosenNip').value = existing.nip || '';
      if ($('inpDosenSatdik') && existing.kode) $('inpDosenSatdik').value = existing.kode;
      if ($('inpDosenProdi') && existing.prodi) $('inpDosenProdi').value = existing.prodi;
      if ($('inpDosenJk')) $('inpDosenJk').value = existing.jk || 'L';
      if ($('inpDosenPendidikan')) $('inpDosenPendidikan').value = existing.pendidikan || 'S2';
      if ($('inpDosenJafung')) $('inpDosenJafung').value = existing.jafung || 'Asisten Ahli';
      if ($('inpDosenSerdos')) $('inpDosenSerdos').value = existing.sertifikasi || 'Belum';
      if ($('inpDosenStatus')) $('inpDosenStatus').value = existing.status || 'Aktif';
    } else if (F_DOSEN.satdik && $('inpDosenSatdik')) {
      $('inpDosenSatdik').value = F_DOSEN.satdik;
    }
    openModal('modalDosen');
  }

  const DOSEN_COLS = ['kode', 'satdik', 'prodi', 'nama', 'nidn', 'nip', 'jk', 'pendidikan', 'jafung', 'sertifikasi', 'status'];
  const DOSEN_ALIAS = {
    kode: ['kode', 'kode satdik', 'kode kampus'],
    satdik: ['satdik', 'satuan pendidikan', 'nama satdik', 'kampus', 'perguruan tinggi'],
    prodi: ['prodi', 'program studi', 'homebase', 'jurusan'],
    nama: ['nama', 'nama dosen', 'nama lengkap'],
    nidn: ['nidn', 'nuptk', 'nidn nuptk', 'nidk'],
    nip: ['nip'],
    jk: ['jk', 'jenis kelamin', 'lp', 'l p', 'gender'],
    pendidikan: ['pendidikan', 'pendidikan terakhir', 'jenjang', 'kualifikasi'],
    jafung: ['jafung', 'jabatan fungsional', 'jabatan akademik', 'jabatan'],
    sertifikasi: ['sertifikasi', 'serdos', 'status sertifikasi'],
    status: ['status', 'status keaktifan', 'keaktifan']
  };

  function handleDosenFile(file) {
    const msg = $('dosenImportMsg');
    if (msg) { msg.style.display = 'block'; msg.innerHTML = 'Memproses <b>' + esc(file.name) + '</b>…'; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!json.length) {
          if (msg) msg.innerHTML = '<span class="down">File kosong: tidak ada baris data dosen untuk diimpor.</span>';
          return;
        }
        const map = {};
        Object.keys(json[0]).forEach(h => {
          const n = normKey(h);
          for (const [k, al] of Object.entries(DOSEN_ALIAS)) if (!map[k] && al.includes(n)) map[k] = h;
        });
        if (!map.nama) {
          if (msg) msg.innerHTML = '<span class="down">Gagal: kolom wajib <b>nama</b> (Nama Dosen) tidak ditemukan.</span>';
          return;
        }
        const byName = Object.fromEntries(SATDIK.map(s => [s.nama.toLowerCase(), s]));
        let added = 0, skipped = 0;
        let nextId = DOSEN_LIST.reduce((m, d) => Math.max(m, +d.id || 0), 0) + 1;
        for (const o of json) {
          const g = k => map[k] ? String(o[map[k]] ?? '').trim() : '';
          const nama = g('nama');
          if (!nama) { skipped++; continue; }
          let kode = g('kode').toUpperCase();
          let satdik = g('satdik');
          const ref = SATDIK.find(s => s.kode === kode) || byName[satdik.toLowerCase()] || (satdik ? SATDIK.find(s => s.nama.toLowerCase().includes(satdik.toLowerCase())) : null);
          if (ref) { kode = ref.kode; satdik = ref.nama; }
          else if (!satdik && kode) { satdik = nameOf(kode); }
          const rawJk = g('jk').toUpperCase();
          const jk = /^P|PEREMPUAN|WANITA/.test(rawJk) ? 'P' : 'L';
          const rawSerdos = g('sertifikasi');
          const sertifikasi = /sudah|ya|tersertifikasi|lulus/i.test(rawSerdos) ? 'Tersertifikasi' : 'Belum';
          DOSEN_LIST.push({
            id: nextId++,
            kode: kode || '',
            satdik: satdik || '-',
            prodi: g('prodi') || '-',
            nama,
            nidn: g('nidn'),
            nip: g('nip'),
            jk,
            pendidikan: g('pendidikan') || 'S2',
            jafung: g('jafung') || 'Tenaga Pengajar',
            sertifikasi,
            status: g('status') || 'Aktif'
          });
          added++;
        }
        if (!added) {
          if (msg) msg.innerHTML = '<span class="down">Tidak ada baris data dosen valid yang dapat diimpor.</span>';
          return;
        }
        saveDosen();
        tableState.dosen.page = 1;
        RENDER['dapo-dosen']();
        if (msg) msg.innerHTML = `<span class="up">✔ ${fmtNum(added)} data dosen berhasil diimpor</span> dari ${esc(file.name)}.` + (skipped ? ` (${skipped} baris kosong dilewati)` : '');
        toast(`${fmtNum(added)} data dosen diimpor`);
      } catch (err) {
        if (msg) msg.innerHTML = '<span class="down">Gagal membaca file: ' + esc(err.message) + '</span>';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadDosenTemplate() {
    const wb = XLSX.utils.book_new();
    // Sheet kosong (hanya header kolom, tanpa data dummy)
    const ws = XLSX.utils.aoa_to_sheet([DOSEN_COLS]);
    XLSX.utils.book_append_sheet(wb, ws, 'Data Dosen');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Kolom', 'Wajib', 'Keterangan'],
      ['kode', 'Disarankan', 'Kode satdik (mis. PAUP, PKPSDA, PKPBTG, AKKPWK)'],
      ['satdik', 'Ya*', 'Nama satuan pendidikan (*isi salah satu: kode atau satdik)'],
      ['prodi', 'Ya', 'Program studi / homebase dosen'],
      ['nama', 'Ya', 'Nama lengkap dosen beserta gelar akademik'],
      ['nidn', 'Tidak', 'Nomor Induk Dosen Nasional (NIDN) / NUPTK'],
      ['nip', 'Tidak', 'Nomor Induk Pegawai (NIP)'],
      ['jk', 'Tidak', 'L atau P'],
      ['pendidikan', 'Tidak', 'S2 / S3 / Sp-1'],
      ['jafung', 'Tidak', 'Tenaga Pengajar / Asisten Ahli / Lektor / Lektor Kepala / Guru Besar'],
      ['sertifikasi', 'Tidak', 'Tersertifikasi / Belum'],
      ['status', 'Tidak', 'Aktif / Tugas Belajar / Cuti']
    ]), 'Petunjuk');
    XLSX.writeFile(wb, 'template_data_dosen_kkp.xlsx');
  }

  function exportDosenData() {
    const list = filteredDosen().map(d => Object.fromEntries(DOSEN_COLS.map(c => [c, d[c] ?? ''])));
    const ws = list.length
      ? XLSX.utils.json_to_sheet(list, { header: DOSEN_COLS })
      : XLSX.utils.aoa_to_sheet([DOSEN_COLS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Dosen');
    XLSX.writeFile(wb, `data_dosen_kkp_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  RENDER['dapo-ptk'] = function () {
    const S = dapoMetas().map(dapoStats).sort((a, b) => b.ptk - a.ptk);
    chart('cDapoPTK', {
      type: 'bar',
      data: {
        labels: S.map(s => short(s.m.nama)),
        datasets: [
          { label: 'Dosen / Guru', data: S.map(s => s.dosen), backgroundColor: '#06b6d4', borderRadius: 2 },
          { label: 'Instruktur Praktik', data: S.map(s => s.instruktur), backgroundColor: '#8b5cf6', borderRadius: 2 },
          { label: 'Tenaga Kependidikan', data: S.map(s => s.tendik), backgroundColor: '#f59e0b', borderRadius: 2 }
        ]
      },
      options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, grid: { display: false } } } }
    });
    const MAXR = 20;
    $('tDapoPTK').innerHTML = `<thead><tr><th>Satuan Pendidikan</th><th class="num">Dosen / Guru</th><th class="num">Instruktur</th><th class="num">Tendik</th><th class="num">Total PTK</th><th class="num">Peserta Didik</th><th>Rasio PD : Pendidik</th></tr></thead><tbody>` +
      [...S].sort((a, b) => b.rasio - a.rasio).map(s => `<tr><td><b>${esc(short(s.m.nama))}</b></td><td class="num">${fmtNum(s.dosen)}</td><td class="num">${fmtNum(s.instruktur)}</td><td class="num">${fmtNum(s.tendik)}</td><td class="num"><b>${fmtNum(s.ptk)}</b></td><td class="num">${fmtNum(s.taruna)}</td>` +
        `<td><span class="badge ${s.rasio <= MAXR ? 'b-ok' : 'b-no'}">1 : ${f1(s.rasio)}</span>${s.rasio > MAXR ? ` <span class="small muted">+${fmtNum(Math.ceil(s.taruna / MAXR - s.pendidik))} pendidik</span>` : ''}</td></tr>`).join('') + '</tbody>';
  };

  RENDER['dapo-prodi'] = function () {
    const S = Object.fromEntries(dapoMetas().map(m => [m.kode, dapoStats(m)]));
    const prodiMap = new Map();
    Object.values(S).forEach(s => {
      s.prodis.forEach(k => {
        if (!k) return;
        if (!prodiMap.has(k)) prodiMap.set(k, new Set());
        prodiMap.get(k).add(s.m.kode);
      });
    });
    ALL.forEach(r => {
      if (r.kategori && S[r.kode]) {
        if (!prodiMap.has(r.kategori)) prodiMap.set(r.kategori, new Set());
        prodiMap.get(r.kategori).add(r.kode);
      }
    });
    const rows = [...prodiMap.entries()].map(([k, kodeSet]) => {
      const kodes = [...kodeSet];
      const peserta = kodes.reduce((a, c) => a + S[c].taruna / Math.max(1, S[c].prodis.length), 0);
      return { k, kodes, peserta, rombel: Math.ceil(peserta / 30) };
    }).sort((a, b) => katIdx(a.k) - katIdx(b.k));
    const maxP = Math.max(1, ...rows.map(r => r.peserta));
    $('tDapoProdi').innerHTML = `<thead><tr><th>#</th><th>Program Studi / Keahlian</th><th class="num">Satdik Penyelenggara</th><th class="num">Est. Peserta Didik</th><th class="num">Est. Rombel</th><th>Proporsi</th><th>Contoh Penyelenggara</th></tr></thead><tbody>` +
      rows.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.k)}</b></td><td class="num">${fmtNum(r.kodes.length)}</td><td class="num">${fmtNum(r.peserta)}</td><td class="num">${fmtNum(r.rombel)}</td>` +
        `<td>${bar(r.peserta / maxP * 100, '#10b981')}</td><td class="small">${r.kodes.slice(0, 3).map(c => esc(short(nameOf(c)))).join(', ')}${r.kodes.length > 3 ? ` <span class="muted">+${r.kodes.length - 3}</span>` : ''}</td></tr>`).join('') + '</tbody>';
  };

  RENDER['dapo-satdik'] = function () {
    const S = dapoMetas().map(dapoStats);
    $('tDapodik').innerHTML = `<thead><tr><th>#</th><th>Satuan Pendidikan</th><th>Jenjang / Jenis</th><th>Provinsi</th><th class="num">Peserta Didik</th><th class="num">Pendidik &amp; Tendik</th><th class="num">Rombel</th><th>Program Studi / Keahlian</th><th>Status Dapodik</th></tr></thead><tbody>` +
      S.map((s, idx) => `<tr><td>${idx + 1}</td><td><b>${esc(s.m.nama)}</b><div class="small muted">${esc(s.m.kode)}</div></td><td><span class="badge b-rr">${esc(s.m.jenis)}</span></td><td>${esc(s.m.provinsi)}</td>` +
        `<td class="num"><b>${fmtNum(s.taruna)}</b></td><td class="num">${fmtNum(s.ptk)}</td><td class="num">${fmtNum(s.rombel)}</td>` +
        `<td>${s.prodis.slice(0, 3).map(p => `<span class="tag-perm">${esc(p)}</span>`).join(' ')}${s.prodis.length > 3 ? ` <span class="muted small">+${s.prodis.length - 3}</span>` : ''}</td>` +
        `<td><span class="badge b-baik">Aktif · Sinkron</span></td></tr>`).join('') + '</tbody>';
  };

  // ================= MODUL MITRA =================
  // Daftar mitra contoh (ilustratif) — ganti dengan data resmi bila tersedia.
  const MITRA = [
    { nama: 'PT Perikanan Indonesia (Persero)', jenis: 'BUMN Perikanan', bidang: 'Penangkapan, Pengolahan & Logistik Cold Storage', satdik: 'Poltek AUP Jakarta, Poltek KP Sidoarjo, Poltek KP Bitung', kuota: 120, dok: 'MoU', mulai: '2024-03-01', akhir: '2028-02-29' },
    { nama: 'PT Central Proteina Prima Tbk (CP Prima)', jenis: 'Industri Budidaya', bidang: 'Budidaya Perikanan, Pakan & Kesehatan Ikan', satdik: 'Poltek KP Sidoarjo, Poltek KP Karawang, Poltek KP Bone', kuota: 85, dok: 'PKS', mulai: '2023-07-10', akhir: '2027-07-09' },
    { nama: 'PT Samudera Indonesia Tbk', jenis: 'Pelayaran & Maritim', bidang: 'Permesinan Kapal, Nautika & Kepelautan Niaga/Perikanan', satdik: 'Poltek AUP Jakarta, Poltek KP Sorong, Poltek KP Kupang', kuota: 64, dok: 'PKS', mulai: '2024-01-15', akhir: '2027-01-14' },
    { nama: 'Japan International Cooperation Agency (JICA)', jenis: 'Mitra Internasional', bidang: 'Magang Kapal Perikanan Luar Negeri & Transfer Teknologi', satdik: 'Seluruh Politeknik KP & SUPM KKP', kuota: 150, dok: 'MoU', mulai: '2023-05-20', akhir: '2028-05-19' },
    { nama: 'PT Kelola Mina Laut (KML Food)', jenis: 'Industri Pengolahan', bidang: 'Pengolahan Hasil Laut, Mutu (HACCP) & Ekspor', satdik: 'Poltek KP Sidoarjo, Poltek KP Jembrana, Poltek KP Dumai', kuota: 70, dok: 'PKS', mulai: '2024-02-01', akhir: '2027-01-31' },
    { nama: 'PT Phillips Seafoods Indonesia', jenis: 'Industri Pengolahan', bidang: 'Pengolahan Rajungan & Produk Perikanan Ekspor', satdik: 'Poltek KP Pangandaran, Poltek KP Sidoarjo, SUPM Tegal', kuota: 55, dok: 'PKS', mulai: '2023-01-01', akhir: '2026-12-31' },
    { nama: 'PT Suri Tani Pemuka (JAPFA Aquaculture)', jenis: 'Industri Budidaya', bidang: 'Hatchery, Tambak Udang Intensif & Pakan Akuakultur', satdik: 'Poltek KP Jembrana, Poltek KP Sidoarjo, AK KP Wakatobi', kuota: 60, dok: 'PKS', mulai: '2024-06-01', akhir: '2027-05-31' },
    { nama: 'Asosiasi Tuna Longline Indonesia (ATLI)', jenis: 'Asosiasi Industri', bidang: 'Praktik Laut (Prala) Kapal Penangkap Ikan & Sertifikasi Awak Kapal', satdik: 'Poltek KP Bitung, Poltek KP Jembrana, Poltek AUP Jakarta', kuota: 110, dok: 'MoU', mulai: '2024-04-01', akhir: '2028-03-31' },
    { nama: 'Tokyo University of Marine Science and Technology', jenis: 'Mitra Internasional', bidang: 'Riset Terapan, Pertukaran Dosen & Taruna', satdik: 'Poltek AUP Jakarta, Poltek KP Sidoarjo', kuota: 20, dok: 'MoU', mulai: '2022-09-01', akhir: '2027-08-31' },
    { nama: 'Balai Besar Penangkapan Ikan (BBPI) Semarang', jenis: 'Instansi Pemerintah', bidang: 'Uji Alat Tangkap, Praktik Teknologi Penangkapan Ikan', satdik: 'Poltek KP Tegal, SUPM Tegal', kuota: 40, dok: 'PKS', mulai: '2021-08-01', akhir: '2025-07-31' }
  ];
  const TODAY = new Date();
  const monthsLeft = d => (new Date(d) - TODAY) / (1000 * 60 * 60 * 24 * 30.44);
  const fmtDate = d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  function mouStatus(m) {
    const ml = monthsLeft(m.akhir);
    if (ml < 0) return { ml, label: 'Perlu Perpanjangan', cls: 'b-rb' };
    if (ml <= 6) return { ml, label: 'Segera Berakhir', cls: 'b-rs' };
    return { ml, label: 'Aktif', cls: 'b-baik' };
  }
  function updateMouBadge() {
    const b = $('tabBadgeMou');
    if (!b) return;
    const n = MITRA.filter(m => mouStatus(m).label !== 'Aktif').length;
    b.style.display = n ? 'inline-block' : 'none';
    b.textContent = n;
  }
  function magangStats() {
    return dapoMetas().map(m => {
      const taruna = +TARUNA[m.kode] || 0;
      const kuota = Math.round(taruna * (0.18 + seed(m.kode, 'kq') * 0.1));
      const placed = Math.round(kuota * (0.6 + seed(m.kode, 'pl') * 0.38));
      const ln = Math.round(placed * (0.08 + seed(m.kode, 'ln') * 0.15));
      return { m, kuota, placed, ln, dn: placed - ln, nMitra: 2 + Math.floor(seed(m.kode, 'nm') * 7), real: kuota ? placed / kuota : 0 };
    });
  }
  function serapanStats() {
    return dapoMetas().map(m => {
      const lulusan = Math.round((+TARUNA[m.kode] || 0) / dapoLevels(m.jenis));
      const pb = 0.55 + seed(m.kode, 'bk') * 0.25, pw = 0.04 + seed(m.kode, 'wr') * 0.06, ps = 0.03 + seed(m.kode, 'st') * 0.06;
      const bekerja = Math.round(lulusan * pb), wira = Math.round(lulusan * pw), studi = Math.round(lulusan * ps);
      const belum = Math.max(0, lulusan - bekerja - wira - studi);
      return { m, lulusan, bekerja, wira, studi, belum, serap: lulusan ? (bekerja + wira + studi) / lulusan : 0 };
    });
  }

  RENDER.mitra = function () {
    const S = serapanStats();
    const lul = sum(S, 'lulusan');
    $('mitraTotal').textContent = fmtNum(MITRA.length);
    $('mitraDudi').textContent = fmtNum(MITRA.filter(m => !/internasional|pemerintah/i.test(m.jenis)).length);
    $('mitraSerapan').textContent = pct(lul ? (sum(S, 'bekerja') + sum(S, 'wira') + sum(S, 'studi')) / lul : NaN);
    $('mitraMou').textContent = fmtNum(MITRA.filter(m => mouStatus(m).ml >= 0).length);
    updateMouBadge();

    const kat = [...groupBy(MITRA, m => m.jenis)].map(([j, l]) => [j, l.length]);
    chart('cMitraKat', {
      type: 'doughnut',
      data: { labels: kat.map(x => x[0]), datasets: [{ data: kat.map(x => x[1]), backgroundColor: PALETTE, borderWidth: 2, borderColor: isDark() ? '#1e293b' : '#fff' }] },
      options: { cutout: '60%', plugins: { legend: { position: 'bottom' } } }
    });
    const kq = [...MITRA].sort((a, b) => b.kuota - a.kuota);
    chart('cMitraKuota', {
      type: 'bar',
      data: { labels: kq.map(m => m.nama.replace(/\s*\(.*\)/, '')), datasets: [{ label: 'Kuota magang/thn', data: kq.map(m => m.kuota), backgroundColor: '#10b981', borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { y: { grid: { display: false }, ticks: { callback: function (v) { const l = this.getLabelForValue(v); return l.length > 28 ? l.slice(0, 27) + '…' : l; } } } } }
    });
  };

  RENDER['mitra-dir'] = function () {
    const q = (($('mitraSearch') && $('mitraSearch').value) || '').toLowerCase();
    const list = MITRA.filter(m => !q || `${m.nama} ${m.jenis} ${m.bidang} ${m.satdik}`.toLowerCase().includes(q));
    $('tMitra').innerHTML = `<thead><tr><th>#</th><th>Nama Mitra / Lembaga</th><th>Kategori</th><th>Bidang Kerja Sama</th><th>Satdik Terkait</th><th class="num">Kuota Magang/Thn</th><th>Status</th></tr></thead><tbody>` +
      (list.map((m, i) => { const s = mouStatus(m); return `<tr><td>${i + 1}</td><td><b>${esc(m.nama)}</b></td><td><span class="badge b-rr">${esc(m.jenis)}</span></td><td>${esc(m.bidang)}</td><td class="small">${esc(m.satdik)}</td><td class="num"><b>${fmtNum(m.kuota)}</b></td><td><span class="badge ${s.cls}">${s.label}</span></td></tr>`; }).join('') ||
        '<tr><td colspan="7" class="muted">Mitra tidak ditemukan.</td></tr>') + '</tbody>';
  };

  RENDER['mitra-mou'] = function () {
    updateMouBadge();
    const list = MITRA.map((m, i) => ({ m, i, s: mouStatus(m) })).sort((a, b) => a.s.ml - b.s.ml);
    $('tMitraMou').innerHTML = `<thead><tr><th>No. Dokumen</th><th>Mitra</th><th>Jenis</th><th>Mulai</th><th>Berakhir</th><th>Masa Berjalan</th><th class="num">Sisa</th><th>Status</th></tr></thead><tbody>` +
      list.map(({ m, i, s }) => {
        const tot = new Date(m.akhir) - new Date(m.mulai), el = Math.min(1, Math.max(0, (TODAY - new Date(m.mulai)) / tot));
        const col = s.cls === 'b-rb' ? '#f43f5e' : s.cls === 'b-rs' ? '#f59e0b' : '#06b6d4';
        return `<tr><td class="mono small">${m.dok}/${String(i + 1).padStart(3, '0')}/BPPSDMKP/${m.mulai.slice(0, 4)}</td><td><b>${esc(m.nama)}</b></td><td><span class="badge b-rr">${m.dok}</span></td>` +
          `<td>${fmtDate(m.mulai)}</td><td>${fmtDate(m.akhir)}</td><td><div style="display:flex;gap:8px;align-items:center">${bar(el * 100, col)}<span class="small">${Math.round(el * 100)}%</span></div></td>` +
          `<td class="num">${s.ml < 0 ? `<span class="down">lewat ${Math.ceil(-s.ml)} bln</span>` : `${Math.floor(s.ml)} bln`}</td><td><span class="badge ${s.cls}">${s.label}</span></td></tr>`;
      }).join('') + '</tbody>';
  };

  RENDER['mitra-magang'] = function () {
    const S = magangStats().sort((a, b) => b.kuota - a.kuota);
    chart('cMitraMagang', {
      type: 'bar',
      data: {
        labels: S.map(s => short(s.m.nama)),
        datasets: [
          { label: 'Kuota mitra', data: S.map(s => s.kuota), backgroundColor: isDark() ? '#475569' : '#cbd5e1', borderRadius: 3 },
          { label: 'Taruna ditempatkan', data: S.map(s => s.placed), backgroundColor: '#06b6d4', borderRadius: 3 }
        ]
      },
      options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { display: false } } } }
    });
    $('tMitraMagang').innerHTML = `<thead><tr><th>Satuan Pendidikan</th><th class="num">Jumlah Mitra</th><th class="num">Kuota</th><th class="num">Ditempatkan</th><th class="num">Dalam Negeri</th><th class="num">Luar Negeri</th><th>Realisasi</th></tr></thead><tbody>` +
      S.map(s => `<tr><td><b>${esc(short(s.m.nama))}</b></td><td class="num">${s.nMitra}</td><td class="num">${fmtNum(s.kuota)}</td><td class="num"><b>${fmtNum(s.placed)}</b></td><td class="num">${fmtNum(s.dn)}</td><td class="num">${fmtNum(s.ln)}</td>` +
        `<td><div style="display:flex;gap:8px;align-items:center">${bar(s.real * 100, iksColor(s.real * 100))}<b>${pct(s.real)}</b></div></td></tr>`).join('') + '</tbody>';
  };

  RENDER['mitra-serapan'] = function () {
    const S = serapanStats().sort((a, b) => a.serap - b.serap);
    const P = (s, k) => s.lulusan ? s[k] / s.lulusan * 100 : 0;
    chart('cMitraSerapan', {
      type: 'bar',
      data: {
        labels: S.map(s => short(s.m.nama)),
        datasets: [
          { label: 'Bekerja', data: S.map(s => P(s, 'bekerja')), backgroundColor: '#10b981' },
          { label: 'Wirausaha', data: S.map(s => P(s, 'wira')), backgroundColor: '#8b5cf6' },
          { label: 'Studi Lanjut', data: S.map(s => P(s, 'studi')), backgroundColor: '#0ea5e9' },
          { label: 'Belum Terserap', data: S.map(s => P(s, 'belum')), backgroundColor: '#f43f5e' }
        ]
      },
      options: { indexAxis: 'y', plugins: { tooltip: pctTooltip, legend: { position: 'bottom' } }, scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + '%' } }, y: { stacked: true, grid: { display: false } } } }
    });
    $('tMitraSerapan').innerHTML = `<thead><tr><th>Satuan Pendidikan</th><th class="num">Lulusan/Thn</th><th class="num">Bekerja</th><th class="num">Wirausaha</th><th class="num">Studi Lanjut</th><th class="num">Belum Terserap</th><th>Keterserapan</th></tr></thead><tbody>` +
      S.map(s => `<tr><td><b>${esc(short(s.m.nama))}</b></td><td class="num">${fmtNum(s.lulusan)}</td><td class="num">${fmtNum(s.bekerja)}</td><td class="num">${fmtNum(s.wira)}</td><td class="num">${fmtNum(s.studi)}</td><td class="num">${fmtNum(s.belum)}</td>` +
        `<td><div style="display:flex;gap:8px;align-items:center">${bar(s.serap * 100, iksColor(s.serap * 100))}<b>${pct(s.serap)}</b></div></td></tr>`).join('') + '</tbody>';
  };

  // ================= BERANDA: RINGKASAN TERPADU 3 MODUL =================
  RENDER.beranda = function () {
    const A = agg(ALL);
    const metas = dapoMetas();
    const D = metas.map(dapoStats);
    const M = magangStats();
    const S = serapanStats();

    const totalTaruna = sum(D, 'taruna');
    const totalPTK = sum(D, 'ptk');
    const totalRombel = sum(D, 'rombel');
    const totalProdi = new Set(ALL.map(r => r.kategori).filter(Boolean)).size;
    const totalLulusan = sum(S, 'lulusan');
    const totalTerserap = sum(S, 'bekerja') + sum(S, 'wira') + sum(S, 'studi');
    const pctSerapan = totalLulusan ? totalTerserap / totalLulusan : 0;
    const activeMou = MITRA.filter(m => mouStatus(m).ml >= 0).length;
    const dudiCount = MITRA.filter(m => !/internasional|pemerintah/i.test(m.jenis)).length;

    // 1. 4 KPI Utama Lintas Modul
    if ($('allSatdik')) $('allSatdik').textContent = fmtNum(metas.length);
    if ($('allSatdikF')) $('allSatdikF').textContent = formatSatdikSummary(metas);
    if ($('allIks')) $('allIks').textContent = f1(A.iks);
    if ($('allIksF')) $('allIksF').innerHTML = `${iksBadge(A.iks)} · ${fmtNum(A.unit)} unit (${pct(A.k['Baik'] / A.unit)} baik)`;
    if ($('allTaruna')) $('allTaruna').textContent = fmtNum(totalTaruna);
    if ($('allTarunaF')) $('allTarunaF').textContent = `${fmtNum(totalPTK)} PTK · ${fmtNum(totalRombel)} Rombel · ${fmtNum(totalProdi)} Prodi`;
    if ($('allSerapan')) $('allSerapan').textContent = pct(pctSerapan);
    if ($('allSerapanF')) $('allSerapanF').textContent = `${fmtNum(MITRA.length)} Mitra Aktif · ${fmtNum(sum(M, 'placed'))} Taruna Magang`;

    // 2. 3 Kartu Pilar Ringkasan (Sarpras, Dapodik, Mitra)
    if ($('sumSarprasBadge')) $('sumSarprasBadge').textContent = `IKS ${f1(A.iks)} (${iksLevel(A.iks)})`;
    if ($('sumSarprasStats')) {
      $('sumSarprasStats').innerHTML = [
        ['Total Unit', fmtNum(A.unit), 'var(--text-strong)'],
        ['Kondisi Baik', pct(A.k['Baik'] / A.unit), 'var(--emerald-t)'],
        ['Rusak Berat', pct(A.k['Rusak Berat'] / A.unit), 'var(--rose-t)']
      ].map(([l, v, col]) => `<div class="mini-stat"><span>${l}</span><b style="color:${col}">${v}</b></div>`).join('');
    }
    if ($('sumSarprasNote')) $('sumSarprasNote').textContent = `Rata-rata usia aset: ${f1(A.avgAge)} tahun`;

    if ($('sumDapoStats')) {
      $('sumDapoStats').innerHTML = [
        ['Peserta Didik', fmtNum(totalTaruna), 'var(--sky-t)'],
        ['Pendidik & Tendik', fmtNum(totalPTK), 'var(--emerald-t)'],
        ['Rombel Aktif', fmtNum(totalRombel), 'var(--amber-t)']
      ].map(([l, v, col]) => `<div class="mini-stat"><span>${l}</span><b style="color:${col}">${v}</b></div>`).join('');
    }
    if ($('sumDapoNote')) $('sumDapoNote').textContent = `${fmtNum(totalProdi)} Program Studi / Keahlian`;

    if ($('sumMitraBadge')) $('sumMitraBadge').textContent = `${fmtNum(activeMou)} MoU/PKS Aktif`;
    if ($('sumMitraStats')) {
      $('sumMitraStats').innerHTML = [
        ['Mitra DUDI', `${fmtNum(dudiCount)} / ${fmtNum(MITRA.length)}`, 'var(--accent)'],
        ['Magang/Prala', fmtNum(sum(M, 'placed')), 'var(--sky-t)'],
        ['Terserap Kerja', pct(pctSerapan), 'var(--emerald-t)']
      ].map(([l, v, col]) => `<div class="mini-stat"><span>${l}</span><b style="color:${col}">${v}</b></div>`).join('');
    }
    if ($('sumMitraNote')) $('sumMitraNote').textContent = `Kuota mitra: ${fmtNum(sum(M, 'kuota'))} taruna/thn`;

    // 3. Data Gabungan per Satdik untuk Grafik & Tabel Matriks
    const byKodeSarpras = groupBy(ALL, r => r.kode);
    const dapoByKode = Object.fromEntries(D.map(d => [d.m.kode, d]));
    const magangByKode = Object.fromEntries(M.map(m => [m.m.kode, m]));
    const serapByKode = Object.fromEntries(S.map(s => [s.m.kode, s]));

    const combined = metas.map(m => {
      const sRows = byKodeSarpras.get(m.kode) || [];
      const sa = agg(sRows);
      const dp = dapoByKode[m.kode];
      const mg = magangByKode[m.kode];
      const sr = serapByKode[m.kode];
      return { m, sa, dp, mg, sr };
    }).sort((a, b) => ((isFinite(b.sa.iks) ? b.sa.iks : -1) - (isFinite(a.sa.iks) ? a.sa.iks : -1)));

    chart('cAllKomparasi', {
      type: 'bar',
      data: {
        labels: combined.map(x => short(x.m.nama)),
        datasets: [
          { label: 'IKS Sarpras (0–100)', data: combined.map(x => isFinite(x.sa.iks) ? +x.sa.iks.toFixed(1) : null), backgroundColor: '#06b6d4', borderRadius: 3 },
          { label: '% Keterserapan Lulusan (Mitra)', data: combined.map(x => +(x.sr.serap * 100).toFixed(1)), backgroundColor: '#10b981', borderRadius: 3 }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { min: 0, max: 100 }, y: { grid: { display: false } } }
      }
    });

    const byTaruna = [...combined].sort((a, b) => b.dp.taruna - a.dp.taruna);
    chart('cAllDistribusi', {
      type: 'bar',
      data: {
        labels: byTaruna.map(x => short(x.m.nama)),
        datasets: [
          { label: 'Peserta Didik (Dapodik)', data: byTaruna.map(x => x.dp.taruna), backgroundColor: '#3b82f6', borderRadius: 3 },
          { label: 'Kuota Magang (Mitra)', data: byTaruna.map(x => x.mg.kuota), backgroundColor: '#f59e0b', borderRadius: 3 }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { grid: { display: false } } }
      }
    });

    if ($('tAllSummary')) {
      $('tAllSummary').innerHTML = `<thead><tr>
        <th>#</th>
        <th>Satuan Pendidikan</th>
        <th>Jenis</th>
        <th class="num">Unit Sarpras</th>
        <th>IKS (Sarpras)</th>
        <th class="num">Peserta Didik (Dapodik)</th>
        <th class="num">PTK (Dapodik)</th>
        <th class="num">Rombel</th>
        <th class="num">Magang Ditempatkan (Mitra)</th>
        <th>Serapan Lulusan (Mitra)</th>
      </tr></thead><tbody>` +
        combined.map((x, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(short(x.m.nama))}</b><div class="small muted">${esc(x.m.provinsi)}</div></td>
          <td><span class="badge b-rr">${esc(x.m.jenis)}</span></td>
          <td class="num">${x.sa.unit ? fmtNum(x.sa.unit) : '<span class="muted">–</span>'}</td>
          <td>${x.sa.unit ? `<div style="display:flex;gap:8px;align-items:center">${bar(x.sa.iks, iksColor(x.sa.iks))}<b>${f1(x.sa.iks)}</b></div>` : '<span class="muted small">Belum terdata</span>'}</td>
          <td class="num"><b>${fmtNum(x.dp.taruna)}</b></td>
          <td class="num">${fmtNum(x.dp.ptk)}</td>
          <td class="num">${fmtNum(x.dp.rombel)}</td>
          <td class="num">${fmtNum(x.mg.placed)} / ${fmtNum(x.mg.kuota)}</td>
          <td><span class="badge b-baik">${pct(x.sr.serap)}</span></td>
        </tr>`).join('') + '</tbody>';
    }
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
  function closeMobileSidebar() {
    if ($('sidebar')) $('sidebar').classList.remove('open');
    if ($('sidebarBackdrop')) $('sidebarBackdrop').classList.remove('show');
  }

  function activate(page) {
    if (page === 'sarpras') page = lastPage.sarpras;
    if (!PAGES[page]) page = 'beranda';
    current = page;

    const activeModule = moduleOf(page);
    lastPage[activeModule] = page;

    // Update halaman aktif
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    // Update chip bar, sub-menu sidebar & mobile nav
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    // Update item aktif di Sidenavbar (Beranda, Sarpras, Dapodik, Mitra)
    document.querySelectorAll('.sidenav-item').forEach(a => a.classList.toggle('active', a.dataset.module === activeModule));

    // Tampilkan navigasi milik modul aktif saja
    document.querySelectorAll('.module-tabs, .sidenav-secondary').forEach(el => {
      el.style.display = el.dataset.module === activeModule ? '' : 'none';
    });
    document.querySelectorAll('.mobile-nav[data-module]').forEach(el => {
      el.classList.toggle('hidden-mod', el.dataset.module !== activeModule);
    });
    // Filter data hanya berlaku untuk modul Sarpras
    if ($('sarprasFilters')) $('sarprasFilters').style.display = activeModule === 'sarpras' ? '' : 'none';

    // Update Hero chip, judul & subjudul
    if ($('heroChip')) {
      const chips = {
        beranda: 'Executive Portal · Ringkasan 3 Modul (Sarpras · Dapodik · Mitra)',
        sarpras: 'National Sarpras Overview · BPPSDM KP',
        dapodik: 'Data Pokok Pendidikan · BPPSDM KP',
        mitra: 'Kemitraan & Dunia Industri · BPPSDM KP'
      };
      $('heroChip').textContent = chips[activeModule];
    }
    $('pageTitle').textContent = PAGES[page][0];
    $('pageSub').textContent = PAGES[page][1];
    closeMobileSidebar();
  }
  function show(page) {
    if (window.SARPRAS_AUTH && !window.SARPRAS_AUTH.isAuthenticated()) {
      renderAuthState();
      return;
    }
    if (page === 'sarpras') page = lastPage.sarpras;
    if (!PAGES[page]) page = 'beranda';
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
          activate(PAGES[location.hash.slice(1)] ? location.hash.slice(1) : 'beranda');
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
            executive_summary: 'Ringkasan Sarana & Prasarana & IKS',
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
    const toggleSidebar = () => {
      const sb = $('sidebar');
      const bd = $('sidebarBackdrop');
      if (!sb) return;
      if (window.innerWidth <= 767) {
        const isOpen = sb.classList.toggle('open');
        if (bd) bd.classList.toggle('show', isOpen);
      } else {
        const isCollapsed = sb.classList.toggle('collapsed');
        try { localStorage.setItem('kkp_sidebar_collapsed', isCollapsed ? '1' : '0'); } catch (e) {}
        if (current === 'peta' && map) setTimeout(() => map.invalidateSize(), 250);
      }
    };
    if ($('menuToggle')) $('menuToggle').onclick = toggleSidebar;
    if ($('sidebarCollapseBtn')) $('sidebarCollapseBtn').onclick = toggleSidebar;
    if ($('sidebarBackdrop')) $('sidebarBackdrop').onclick = closeMobileSidebar;
    try {
      if (localStorage.getItem('kkp_sidebar_collapsed') === '1' && window.innerWidth > 767 && $('sidebar')) {
        $('sidebar').classList.add('collapsed');
      }
    } catch (e) {}
    document.querySelectorAll('.brand').forEach(brand => {
      brand.addEventListener('click', e => {
        e.preventDefault();
        if (location.hash.slice(1) !== 'beranda') {
          location.hash = 'beranda';
        } else {
          show('beranda');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    document.querySelectorAll('.sidenav-item').forEach(item => {
      item.addEventListener('click', e => {
        const mod = item.dataset.module;
        if (mod) {
          e.preventDefault();
          const targetHash = lastPage[mod] || mod;
          if (location.hash.slice(1) !== targetHash) {
            location.hash = targetHash;
          } else {
            show(targetHash);
          }
        }
      });
    });
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.addEventListener('click', e => {
        const targetPage = link.dataset.page;
        if (targetPage && PAGES[targetPage]) {
          e.preventDefault();
          if (location.hash.slice(1) !== targetPage) {
            location.hash = targetPage;
          } else {
            show(targetPage);
          }
        }
      });
    });
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));

    $('search').addEventListener('input', e => { tableState.data.q = e.target.value; tableState.data.page = 1; RENDER.data(); });
    loadDosen();
    ['fDosenJenis', 'fDosenSatdik', 'fDosenProdi', 'fDosenJafung'].forEach((id, i) => {
      const key = ['jenis', 'satdik', 'prodi', 'jafung'][i];
      if ($(id)) $(id).addEventListener('change', e => { F_DOSEN[key] = e.target.value; tableState.dosen.page = 1; RENDER['dapo-dosen'](); });
    });
    if ($('dosenSearch')) {
      $('dosenSearch').addEventListener('input', e => { F_DOSEN.q = e.target.value; tableState.dosen.page = 1; RENDER['dapo-dosen'](); });
    }
    if ($('btnResetDosen')) {
      $('btnResetDosen').onclick = () => {
        const u = window.SARPRAS_AUTH ? window.SARPRAS_AUTH.getUser() : null;
        F_DOSEN.jenis = '';
        F_DOSEN.satdik = (u && u.role === 'operator_satdik' && u.accessibleSatdik && u.accessibleSatdik !== 'ALL') ? u.accessibleSatdik : '';
        F_DOSEN.prodi = '';
        F_DOSEN.jafung = '';
        F_DOSEN.q = '';
        if ($('dosenSearch')) $('dosenSearch').value = '';
        tableState.dosen.page = 1;
        RENDER['dapo-dosen']();
      };
    }
    if ($('btnAddDosen')) $('btnAddDosen').onclick = () => openDosenModal(null);
    if ($('btnTemplateDosen')) $('btnTemplateDosen').onclick = downloadDosenTemplate;
    if ($('btnExportDosen')) $('btnExportDosen').onclick = exportDosenData;
    if ($('dosenFileInput')) {
      $('dosenFileInput').onchange = e => { if (e.target.files[0]) handleDosenFile(e.target.files[0]); e.target.value = ''; };
    }
    if ($('btnClearDosen')) {
      $('btnClearDosen').onclick = () => {
        if (!DOSEN_LIST.length) return;
        if (!window.confirm('Kosongkan seluruh data dosen yang tersimpan?')) return;
        DOSEN_LIST = [];
        try { localStorage.removeItem(LS.dosen); } catch (e) {}
        if ($('dosenImportMsg')) { $('dosenImportMsg').style.display = 'none'; $('dosenImportMsg').innerHTML = ''; }
        tableState.dosen.page = 1;
        RENDER['dapo-dosen']();
        toast('Data dosen dikosongkan.');
      };
    }
    if ($('formDosen')) {
      $('formDosen').onsubmit = e => {
        e.preventDefault();
        const nama = ($('inpDosenNama') && $('inpDosenNama').value || '').trim();
        if (!nama) return;
        const kode = $('inpDosenSatdik') ? $('inpDosenSatdik').value : '';
        const satdik = nameOf(kode) || kode;
        const editId = $('dosenId') ? $('dosenId').value : '';
        const record = {
          id: editId ? (+editId || editId) : (DOSEN_LIST.reduce((m, d) => Math.max(m, +d.id || 0), 0) + 1),
          kode,
          satdik,
          prodi: $('inpDosenProdi') ? $('inpDosenProdi').value : '-',
          nama,
          nidn: ($('inpDosenNidn') && $('inpDosenNidn').value || '').trim(),
          nip: ($('inpDosenNip') && $('inpDosenNip').value || '').trim(),
          jk: $('inpDosenJk') ? $('inpDosenJk').value : 'L',
          pendidikan: $('inpDosenPendidikan') ? $('inpDosenPendidikan').value : 'S2',
          jafung: $('inpDosenJafung') ? $('inpDosenJafung').value : 'Tenaga Pengajar',
          sertifikasi: $('inpDosenSerdos') ? $('inpDosenSerdos').value : 'Belum',
          status: $('inpDosenStatus') ? $('inpDosenStatus').value : 'Aktif'
        };
        if (editId) {
          const idx = DOSEN_LIST.findIndex(d => String(d.id) === String(editId));
          if (idx >= 0) DOSEN_LIST[idx] = record;
          else DOSEN_LIST.push(record);
        } else {
          DOSEN_LIST.push(record);
        }
        saveDosen();
        closeModal('modalDosen');
        RENDER['dapo-dosen']();
        toast(editId ? 'Data dosen diperbarui.' : 'Data dosen ditambahkan.');
      };
    }
    if ($('mitraSearch')) {
      $('mitraSearch').addEventListener('input', () => RENDER['mitra-dir']());
    }
    $('btnExportXlsx').onclick = () => exportData('xlsx');
    if ($('btnTopExport')) $('btnTopExport').onclick = () => exportData('xlsx');
    if ($('themeToggle')) {
      $('themeToggle').onclick = () => {
        const root = document.documentElement;
        const nextLight = !root.classList.contains('light');
        root.classList.toggle('light', nextLight);
        root.classList.toggle('dark', !nextLight);
        try { localStorage.setItem('kkp_theme_mode', nextLight ? 'light' : 'dark'); } catch (e) {}
        applyChartTheme();
        refresh();
      };
    }
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
      show(location.hash.slice(1) || 'beranda');
    }

    // Re-measure chart labels once the web font has loaded (prevents clipped axis labels).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => refresh());
    }
  }

  init();
})();

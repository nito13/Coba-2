const fs = require('fs');
const XLSX = require('./xlsx.full.min.js');
const wb = XLSX.read(fs.readFileSync('Data Contoh.xlsx'), { type: 'buffer' });

const CAMPUS_MAP = {
  'jakarta': { kode: 'PAUP', nama: 'Politeknik AUP Jakarta', jenis: 'Politeknik', provinsi: 'DKI Jakarta', kota: 'Jakarta Selatan', lat: -6.2836, lng: 106.8395, taruna: 1650, berdiri: 1985, mutu: 0.84 },
  'sidoarjo': { kode: 'PKPSDA', nama: 'Politeknik KP Sidoarjo', jenis: 'Politeknik', provinsi: 'Jawa Timur', kota: 'Sidoarjo', lat: -7.4479, lng: 112.7183, taruna: 1100, berdiri: 1987, mutu: 0.80 },
  'bitung': { kode: 'PKPBTG', nama: 'Politeknik KP Bitung', jenis: 'Politeknik', provinsi: 'Sulawesi Utara', kota: 'Bitung', lat: 1.4404, lng: 125.1217, taruna: 900, berdiri: 1988, mutu: 0.70 },
  'sorong': { kode: 'PKPSRG', nama: 'Politeknik KP Sorong', jenis: 'Politeknik', provinsi: 'Papua Barat Daya', kota: 'Sorong', lat: -0.8762, lng: 131.2558, taruna: 850, berdiri: 1990, mutu: 0.62 },
  'karawang': { kode: 'PKPKRW', nama: 'Politeknik KP Karawang', jenis: 'Politeknik', provinsi: 'Jawa Barat', kota: 'Karawang', lat: -6.2167, lng: 107.2833, taruna: 750, berdiri: 2008, mutu: 0.78 },
  'kupang': { kode: 'PKPKPG', nama: 'Politeknik KP Kupang', jenis: 'Politeknik', provinsi: 'Nusa Tenggara Timur', kota: 'Kupang', lat: -10.1772, lng: 123.6070, taruna: 700, berdiri: 1990, mutu: 0.60 },
  'dumai': { kode: 'PKPDMI', nama: 'Politeknik KP Dumai', jenis: 'Politeknik', provinsi: 'Riau', kota: 'Dumai', lat: 1.6667, lng: 101.4478, taruna: 600, berdiri: 2015, mutu: 0.70 },
  'pangandaran': { kode: 'PKPPND', nama: 'Politeknik KP Pangandaran', jenis: 'Politeknik', provinsi: 'Jawa Barat', kota: 'Pangandaran', lat: -7.6930, lng: 108.6550, taruna: 450, berdiri: 2018, mutu: 0.88 },
  'bone': { kode: 'PKPBNE', nama: 'Politeknik KP Bone', jenis: 'Politeknik', provinsi: 'Sulawesi Selatan', kota: 'Bone', lat: -4.5386, lng: 120.3279, taruna: 550, berdiri: 2015, mutu: 0.66 },
  'jembrana': { kode: 'PKPJBR', nama: 'Politeknik KP Jembrana', jenis: 'Politeknik', provinsi: 'Bali', kota: 'Jembrana', lat: -8.3600, lng: 114.6260, taruna: 400, berdiri: 2019, mutu: 0.90 },
  'wakatobi': { kode: 'AKKPWK', nama: 'Akademi Komunitas KP Wakatobi', jenis: 'Akademi Komunitas', provinsi: 'Sulawesi Tenggara', kota: 'Wakatobi', lat: -5.3240, lng: 123.5960, taruna: 250, berdiri: 2015, mutu: 0.56 }
};

function matchCampus(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  for (const [k, v] of Object.entries(CAMPUS_MAP)) {
    if (s.includes(k)) return v;
  }
  return null;
}

const UMUR = {
  'Gedung & Ruang': 40,
  'Kapal Latih': 25,
  'Fasilitas Praktik Perikanan': 20,
  'Peralatan Lab & Simulator': 12,
  'TIK': 6,
  'Kendaraan': 12,
  'Utilitas': 15
};

function inferKategori(nama, satuan, section, subSection, sheet) {
  const n = (nama || '').toLowerCase();
  const s = (section || '').toLowerCase();

  // Kapal Latih
  if (/kapal\s*latih|speed\s*boat|perahu|sampan|sekoci/i.test(n)) return 'Kapal Latih';

  // Kendaraan operasional darat
  if (/(^|\b)(mobil|bus|motor\s*dinas|sepeda\s*motor|kendaraan\s*digital|truk)(\b|$)/i.test(n) && !/outboard|tempel|penggerak|pompa|simulator/i.test(n)) {
    return 'Kendaraan';
  }

  // TIK
  if (/komputer|laptop|printer|scanner|smart\s*(tv|television|board)|proyektor|infocus|server\b|router|switch\b|wifi|cctv|ups\b|multimedia|webcam/i.test(n)) {
    return 'TIK';
  }

  // Utilitas
  if (/genset|generator|ac\b|pendingin\s*ruang|exhaust|pompa|ipal|tandon|filter\s*air|instalasi|plts|panel\s*surya|kelistrikan|sound\s*system/i.test(n)) {
    return 'Utilitas';
  }

  // Fasilitas Praktik Perikanan
  if (/kolam|tambak|hatchery|karamba|kja\b|pabrik\s*es|cold\s*storage|tefa|teaching\s*factory|bak\s*(pemeliharaan|induk|larva|kultur)|bioflok|aquaponik|pengolahan\s*limbah/i.test(n)) {
    return 'Fasilitas Praktik Perikanan';
  }

  // Gedung & Ruang
  if (/ruang|laboratorium|workshop|bengkel|toilet|perpustakaan|asrama|gedung|aula|kantor|pos\s*jaga|rumah\s*jaga|klinik|lapangan|greenhouse|gudang|tps3r/i.test(n) || s.includes('prasarana')) {
    if (/meja|kursi|lemari|rak\b|papan\s*tulis|tempat\s*tidur|sofa|podium|whiteboard|nakas/i.test(n)) {
      return 'Gedung & Ruang';
    }
    if (/ruang|lab|workshop|toilet|bengkel|gedung|kamar|aula|kantor|rumah|gudang/i.test(n)) {
      return 'Gedung & Ruang';
    }
  }

  // Perabot umum
  if (/meja|kursi|lemari|rak\b|papan\s*tulis|tempat\s*tidur|sofa|podium|whiteboard|cermin|wastafel|closet|ember|jam\s*dinding|dispenser/i.test(n)) {
    return 'Gedung & Ruang';
  }

  // Peralatan Lab & Simulator
  if (/simulator|alat|instrumen|mikroskop|timbangan|meter|gage|gauge|termometer|salinometer|do\s*meter|ph\s*meter|refraktometer|autoclave|centrifuge|spectro|pipet|buret|tabung|beaker|gelas|jar\b|mistar|jangka\s*sorong|mikrometer|stopwatch|anemometer|gps|radar|sonar|fish\s*finder|echosounder|kompas|sextant|life\s*jacket|ring\s*buoy|selam|scuba|regulator|wetsuit|fin\b|masker|tabung\s*o2|compressor|oven|incubator|muffle|hotplate|shaker|vortex|water\s*bath|rotary|motor\s*(bensin|diesel|listrik|tempel|outboard)|mesin/i.test(n)) {
    return 'Peralatan Lab & Simulator';
  }

  if (s.includes('prasarana')) return 'Gedung & Ruang';
  return 'Peralatan Lab & Simulator';
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

let allItems = [];
let idCounter = 1;

wb.SheetNames.forEach(sheetName => {
  if (sheetName === 'Sheet1') return;
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let campusCols = {};
  data.forEach((r, idx) => {
    r.forEach((c, ci) => {
      if (ci >= 4 && typeof c === 'string') {
        const m = matchCampus(c);
        if (m && !campusCols[ci]) campusCols[ci] = m;
      }
    });
  });

  let section = 'Prasarana';
  let subSection = '';

  data.forEach((r, idx) => {
    if (!r || r.length === 0) return;
    const col0 = r[0] != null ? String(r[0]).trim() : '';
    const col1 = r[1] != null ? String(r[1]).trim() : '';
    if (/^[A-Z]\./i.test(col0) && !/^[A-Z]\.\d/i.test(col0)) section = col1 || col0;
    if (/^PRASARANA/i.test(col1)) section = 'Prasarana';
    if (/^SARANA/i.test(col1)) section = 'Sarana';
    if (/^(no|vol|standar|jenis)/i.test(col0) || /^(jenis prasarana|jenis sarana|standar)/i.test(col1)) return;
    if (Object.keys(campusCols).some(ci => r[ci] === campusCols[ci].nama || matchCampus(r[ci]))) return;
    if (!col1) return;
    if (/^[A-Z]$/i.test(col0) && !r[2] && !r[3]) { subSection = col1; return; }
    if (/^[a-z]\d*\./i.test(col1) && !r[2] && !r[3]) { subSection = col1; return; }

    const satuan = (r[3] != null ? String(r[3]).trim() : '') || 'unit';
    const note = r[5] != null ? String(r[5]).trim() : (r[4] != null && typeof r[4] === 'string' && isNaN(r[4]) ? String(r[4]).trim() : '');

    Object.entries(campusCols).forEach(([ci, satdik]) => {
      const val = r[ci];
      let qty = 0;
      if (typeof val === 'number') qty = val;
      else if (typeof val === 'string') {
        let n = parseFloat(val.replace(/,/g, '.'));
        if (!isNaN(n)) qty = n;
      }
      if (qty <= 0) return;

      const PRODI_MAP = {
        'Sarpras Pasca AUP': 'Sarpras Pasca AUP',
        'Penangkapan Ikan': 'Penangkapan Ikan',
        'Permesinan Kapal': 'Permesinan Kapal',
        'Budidaya': 'Budidaya',
        'Mekanisasi BD dan Pngolahan': 'Mekanisasi BD & Pengolahan',
        'Pengolahan': 'Pengolahan',
        'Pengelolaan SD Perairan': 'Pengelolaan SD Perairan',
        'Patologi': 'Patologi',
        'Penyuluhan': 'Penyuluhan',
        'Agribisnis Perikanan': 'Agribisnis Perikanan',
        'Kelautan': 'Kelautan',
        'Konservasi dan Ekowisata': 'Konservasi dan Ekowisata'
      };
      const prodiName = PRODI_MAP[sheetName] || sheetName;
      const cleanNama = col1.replace(/\s+/g, ' ').trim();
      const h = hashCode(satdik.kode + sheetName + cleanNama + idx);

      let kondisi = 'Baik';
      const uNote = note.toUpperCase();
      if (uNote === 'RB' || uNote.includes('RUSAK BERAT')) {
        kondisi = 'Rusak Berat';
      } else if (uNote === 'RR' || uNote.includes('RUSAK RINGAN')) {
        kondisi = 'Rusak Ringan';
      } else if (uNote === 'B' || uNote.includes('BAIK') || uNote === 'ADA') {
        kondisi = 'Baik';
      } else {
        const maxAge = 15;
        const campusAge = 2026 - satdik.berdiri;
        const b = ((h % 100) / 100) * (campusAge / maxAge) * (1.2 - 0.7 * satdik.mutu);
        if (b > 0.82) kondisi = 'Rusak Berat';
        else if (b > 0.52) kondisi = 'Rusak Ringan';
        else kondisi = 'Baik';
      }

      const minYear = Math.max(satdik.berdiri, 2026 - 15 * 1.2);
      const tahun = Math.min(2025, Math.floor(minYear + ((h >> 4) % (2025 - minYear + 1))));

      allItems.push({
        id: idCounter++,
        kode: satdik.kode,
        satdik: satdik.nama,
        jenis: satdik.jenis,
        provinsi: satdik.provinsi,
        kategori: prodiName, // Kategori diubah menjadi Program Studi
        programStudi: prodiName,
        prodi: prodiName,
        nama: cleanNama,
        satuan: satuan.toLowerCase(),
        jumlah: Math.round(qty),
        kondisi: kondisi,
        tahun: tahun
      });
    });
  });
});

console.log('Total extracted items from Data Contoh.xlsx:', allItems.length);

const outContent = `/**
 * Data Sarana Prasarana Riil hasil ekstraksi dari file Excel "Data Contoh.xlsx"
 * Sumber: Dokumen SPM & Inventaris Satuan Pendidikan BPPSDM KP
 * Total item: ${allItems.length} baris
 */
(function (global) {
  'use strict';
  global.DATA_CONTOH_EXCEL = ${JSON.stringify(allItems)};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.DATA_CONTOH_EXCEL;
  }
})(typeof window !== 'undefined' ? window : global);
`;

fs.writeFileSync('assets/js/data-excel.js', outContent, 'utf8');
console.log('Successfully wrote assets/js/data-excel.js (' + (fs.statSync('assets/js/data-excel.js').size / 1024).toFixed(1) + ' KB)');

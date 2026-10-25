/**
 * Data referensi Satuan Pendidikan KKP & Sarana Prasarana Riil.
 *
 * Sumber data: File resmi "Data Contoh.xlsx" lingkup BPPSDM KP.
 * Data simulasi telah dihilangkan dan digantikan sepenuhnya dengan data riil Excel.
 */
(function (global) {
  'use strict';

  const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

  // Satuan pendidikan lingkup BPPSDM KP aktif berdasarkan data inventaris Data Contoh.xlsx
  const SATDIK = [
    { kode: 'PAUP',   nama: 'Politeknik AUP Jakarta',        jenis: 'Politeknik',        provinsi: 'DKI Jakarta',         kota: 'Jakarta Selatan', lat: -6.2836,  lng: 106.8395, taruna: 1650, berdiri: 1985, mutu: 0.84 },
    { kode: 'PKPSDA', nama: 'Politeknik KP Sidoarjo',        jenis: 'Politeknik',        provinsi: 'Jawa Timur',          kota: 'Sidoarjo',        lat: -7.4479,  lng: 112.7183, taruna: 1100, berdiri: 1987, mutu: 0.80 },
    { kode: 'PKPBTG', nama: 'Politeknik KP Bitung',          jenis: 'Politeknik',        provinsi: 'Sulawesi Utara',      kota: 'Bitung',          lat: 1.4404,   lng: 125.1217, taruna: 900,  berdiri: 1988, mutu: 0.70 },
    { kode: 'PKPSRG', nama: 'Politeknik KP Sorong',          jenis: 'Politeknik',        provinsi: 'Papua Barat Daya',    kota: 'Sorong',          lat: -0.8762,  lng: 131.2558, taruna: 850,  berdiri: 1990, mutu: 0.62 },
    { kode: 'PKPKRW', nama: 'Politeknik KP Karawang',        jenis: 'Politeknik',        provinsi: 'Jawa Barat',          kota: 'Karawang',        lat: -6.2167,  lng: 107.2833, taruna: 750,  berdiri: 2008, mutu: 0.78 },
    { kode: 'PKPKPG', nama: 'Politeknik KP Kupang',          jenis: 'Politeknik',        provinsi: 'Nusa Tenggara Timur', kota: 'Kupang',          lat: -10.1772, lng: 123.6070, taruna: 700,  berdiri: 1990, mutu: 0.60 },
    { kode: 'PKPDMI', nama: 'Politeknik KP Dumai',           jenis: 'Politeknik',        provinsi: 'Riau',                kota: 'Dumai',           lat: 1.6667,   lng: 101.4478, taruna: 600,  berdiri: 2015, mutu: 0.70 },
    { kode: 'PKPPND', nama: 'Politeknik KP Pangandaran',     jenis: 'Politeknik',        provinsi: 'Jawa Barat',          kota: 'Pangandaran',     lat: -7.6930,  lng: 108.6550, taruna: 450,  berdiri: 2018, mutu: 0.88 },
    { kode: 'PKPBNE', nama: 'Politeknik KP Bone',            jenis: 'Politeknik',        provinsi: 'Sulawesi Selatan',    kota: 'Bone',            lat: -4.5386,  lng: 120.3279, taruna: 550,  berdiri: 2015, mutu: 0.66 },
    { kode: 'PKPJBR', nama: 'Politeknik KP Jembrana',        jenis: 'Politeknik',        provinsi: 'Bali',                kota: 'Jembrana',        lat: -8.3600,  lng: 114.6260, taruna: 400,  berdiri: 2019, mutu: 0.90 },
    { kode: 'AKKPWK', nama: 'Akademi Komunitas KP Wakatobi', jenis: 'Akademi Komunitas', provinsi: 'Sulawesi Tenggara',   kota: 'Wakatobi',        lat: -5.3240,  lng: 123.5960, taruna: 250,  berdiri: 2015, mutu: 0.56 },
    { kode: 'SUPMLD', nama: 'SUPM Ladong',                   jenis: 'SUPM',              provinsi: 'Aceh',                kota: 'Aceh Besar',      lat: 5.5990,   lng: 95.4880,  taruna: 520,  berdiri: 1986, mutu: 0.70 },
    { kode: 'SUPMPR', nama: 'SUPM Pariaman',                 jenis: 'SUPM',              provinsi: 'Sumatera Barat',      kota: 'Pariaman',        lat: -0.6260,  lng: 100.1200, taruna: 480,  berdiri: 1987, mutu: 0.65 },
    { kode: 'SUPMKA', nama: 'SUPM Kotaagung',                jenis: 'SUPM',              provinsi: 'Lampung',             kota: 'Tanggamus',       lat: -5.4970,  lng: 104.6230, taruna: 500,  berdiri: 1989, mutu: 0.74 },
    { kode: 'SUPMTG', nama: 'SUPM Tegal',                    jenis: 'SUPM',              provinsi: 'Jawa Tengah',         kota: 'Tegal',           lat: -6.8600,  lng: 109.1400, taruna: 560,  berdiri: 1985, mutu: 0.82 },
    { kode: 'SUPMPT', nama: 'SUPM Pontianak',                jenis: 'SUPM',              provinsi: 'Kalimantan Barat',    kota: 'Pontianak',       lat: -0.0260,  lng: 109.3420, taruna: 470,  berdiri: 1988, mutu: 0.62 },
    { kode: 'SUPMWH', nama: 'SUPM Waiheru',                  jenis: 'SUPM',              provinsi: 'Maluku',              kota: 'Ambon',           lat: -3.6370,  lng: 128.2370, taruna: 430,  berdiri: 1990, mutu: 0.55 },
    { kode: 'SUPMSR', nama: 'SUPM Sorong',                   jenis: 'SUPM',              provinsi: 'Papua Barat Daya',    kota: 'Sorong',          lat: -0.8783,  lng: 131.2622, taruna: 450,  berdiri: 1979, mutu: 0.60 }
  ];

  // Umur ekonomis (tahun) per Program Studi — dipakai untuk analisis usia aset
  const UMUR = {
    'Penangkapan Ikan': 15,
    'Permesinan Kapal': 15,
    'Budidaya': 15,
    'Pengolahan': 12,
    'Pengelolaan SD Perairan': 12,
    'Kelautan': 12,
    'Konservasi dan Ekowisata': 12,
    'Mekanisasi BD & Pengolahan': 15,
    'Patologi': 12,
    'Penyuluhan': 10,
    'Agribisnis Perikanan': 10,
    'Sarpras Pasca AUP': 15
  };

  // [kategori, nama, satuan, min, max (skala Politeknik), harga satuan (Rp juta), hanyaUntuk]
  const KATALOG = [
    ['Gedung & Ruang', 'Ruang Kelas', 'ruang', 20, 40, 450],
    ['Gedung & Ruang', 'Laboratorium', 'ruang', 8, 18, 900],
    ['Gedung & Ruang', 'Perpustakaan', 'unit', 1, 2, 1500],
    ['Gedung & Ruang', 'Asrama Taruna', 'gedung', 3, 8, 6500],
    ['Gedung & Ruang', 'Gedung Administrasi', 'gedung', 1, 2, 5000],
    ['Gedung & Ruang', 'Aula / Gedung Serbaguna', 'gedung', 1, 2, 4000],
    ['Gedung & Ruang', 'Workshop / Bengkel', 'unit', 2, 6, 1800],
    ['Gedung & Ruang', 'Rumah Dinas / Mess', 'unit', 4, 12, 450],
    ['Gedung & Ruang', 'Klinik Kesehatan', 'unit', 1, 1, 800],
    ['Gedung & Ruang', 'Sarana Olahraga', 'unit', 2, 5, 600],

    ['Kapal Latih', 'Kapal Latih >= 30 GT', 'unit', 1, 3, 25000, ['Politeknik']],
    ['Kapal Latih', 'Kapal Latih < 30 GT', 'unit', 1, 4, 3500],
    ['Kapal Latih', 'Speedboat / Perahu Praktik', 'unit', 2, 6, 350],

    ['Fasilitas Praktik Perikanan', 'Kolam Budidaya', 'petak', 10, 40, 60],
    ['Fasilitas Praktik Perikanan', 'Tambak Praktik', 'petak', 4, 12, 250],
    ['Fasilitas Praktik Perikanan', 'Hatchery', 'unit', 1, 3, 2500],
    ['Fasilitas Praktik Perikanan', 'Keramba Jaring Apung', 'unit', 2, 8, 150],
    ['Fasilitas Praktik Perikanan', 'Teaching Factory Pengolahan', 'unit', 1, 2, 3000],
    ['Fasilitas Praktik Perikanan', 'Cold Storage', 'unit', 1, 2, 1800],
    ['Fasilitas Praktik Perikanan', 'Pabrik Es Mini', 'unit', 0, 1.6, 1200],

    ['Peralatan Lab & Simulator', 'Simulator Navigasi (Full Mission)', 'unit', 1, 1.4, 18000, ['Politeknik']],
    ['Peralatan Lab & Simulator', 'Engine Room Simulator', 'unit', 0, 1.6, 12000, ['Politeknik']],
    ['Peralatan Lab & Simulator', 'Simulator GMDSS', 'unit', 1, 1, 2500],
    ['Peralatan Lab & Simulator', 'Peralatan Lab Kualitas Air', 'set', 3, 8, 150],
    ['Peralatan Lab & Simulator', 'Peralatan Lab Mikrobiologi', 'set', 2, 6, 250],
    ['Peralatan Lab & Simulator', 'Peralatan Lab Pengolahan Hasil', 'set', 2, 6, 200],
    ['Peralatan Lab & Simulator', 'Peralatan Selam & Keselamatan', 'set', 5, 20, 45],

    ['TIK', 'Komputer / PC', 'unit', 80, 220, 12],
    ['TIK', 'Laptop', 'unit', 20, 80, 15],
    ['TIK', 'Proyektor / Smart Board', 'unit', 20, 50, 18],
    ['TIK', 'Server & Jaringan', 'set', 1, 4, 350],

    ['Kendaraan', 'Bus Taruna', 'unit', 1, 3, 1500],
    ['Kendaraan', 'Mobil Operasional', 'unit', 3, 8, 450],
    ['Kendaraan', 'Sepeda Motor', 'unit', 5, 15, 25],

    ['Utilitas', 'Genset', 'unit', 1, 4, 450],
    ['Utilitas', 'IPAL', 'unit', 1, 2, 900],
    ['Utilitas', 'Instalasi Air Bersih / RO', 'unit', 1, 3, 350],
    ['Utilitas', 'PLTS Atap', 'unit', 0, 2, 750]
  ];

  /**
   * Mengembalikan data riil sarpras hasil pembacaan Data Contoh.xlsx.
   * Menggantikan generator simulasi acak sebelumnya.
   */
  function getData() {
    if (global.DATA_CONTOH_EXCEL && Array.isArray(global.DATA_CONTOH_EXCEL) && global.DATA_CONTOH_EXCEL.length > 0) {
      return global.DATA_CONTOH_EXCEL.slice();
    }
    return [];
  }

  // Fungsi generate kini mengembalikan data riil dari Data Contoh.xlsx
  function generate() {
    return getData();
  }

  global.SARPRAS = { SATDIK, KATALOG, KONDISI, UMUR, generate, getData };
})(window);

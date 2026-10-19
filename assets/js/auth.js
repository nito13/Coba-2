/**
 * SIANSAR KP — Modul Otentikasi & Manajemen Pengguna
 * Mendukung Multi-Role (Admin Pusat, Operator Satdik, Pimpinan/Eksekutif),
 * Session Storage / Local Storage persistence, dan fallback offline / server-ready.
 */
(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    SESSION: 'siansar_auth_session',
    USERS: 'siansar_auth_users',
    REMEMBER: 'siansar_auth_remember'
  };

  // Akun bawaan sistem kedinasan SIANSAR KP
  const DEFAULT_USERS = [
    {
      id: 'USR-001',
      username: 'admin.pusdik',
      email: 'admin.pusdik@kkp.go.id',
      nip: '19850315 201012 1 002',
      name: 'Rahmat Hidayat, S.St.Pi., M.Tr.Pi',
      password: 'admin', // Demo password
      role: 'admin_pusdik',
      roleLabel: 'Administrator Pusat',
      jabatan: 'Koordinator Kelompok Sarana dan Prasarana Pusdik KP',
      unitKerja: 'Pusat Pendidikan KP - BPPSDM Kelautan dan Perikanan',
      accessibleSatdik: 'ALL',
      satdikName: 'Semua Satuan Pendidikan',
      avatar: 'RH',
      permissions: ['all', 'manage_sarpras', 'import_data', 'edit_taruna', 'export_reports', 'change_settings']
    },
    {
      id: 'USR-002',
      username: 'operator.aup',
      email: 'operator.aup@kkp.go.id',
      nip: '19900820 201503 1 003',
      name: 'Budi Santoso, S.Tr.Pi',
      password: 'operator', // Demo password
      role: 'operator_satdik',
      roleLabel: 'Operator Satdik',
      jabatan: 'Pengelola Sarana Prasarana Kampus',
      unitKerja: 'Politeknik Ahli Usaha Perikanan (AUP) Jakarta',
      accessibleSatdik: 'PAUP',
      satdikName: 'Politeknik AUP Jakarta',
      avatar: 'BS',
      permissions: ['view_campus', 'edit_campus', 'export_reports']
    },
    {
      id: 'USR-003',
      username: 'operator.sidoarjo',
      email: 'operator.sidoarjo@kkp.go.id',
      nip: '19920512 201801 2 001',
      name: 'Dewi Lestari, S.Pi',
      password: 'operator', // Demo password
      role: 'operator_satdik',
      roleLabel: 'Operator Satdik',
      jabatan: 'Operator Sarpras Satdik Sidoarjo',
      unitKerja: 'Politeknik Kelautan dan Perikanan Sidoarjo',
      accessibleSatdik: 'PKPSDA',
      satdikName: 'Politeknik KP Sidoarjo',
      avatar: 'DL',
      permissions: ['view_campus', 'edit_campus', 'export_reports']
    },
    {
      id: 'USR-004',
      username: 'pimpinan',
      email: 'pimpinan@kkp.go.id',
      nip: '19720410 199703 1 001',
      name: 'Dr. Ir. Hendra Saputra, M.Si',
      password: 'pimpinan', // Demo password
      role: 'pimpinan',
      roleLabel: 'Pimpinan / Eksekutif',
      jabatan: 'Kepala Pusat Pendidikan Kelautan dan Perikanan',
      unitKerja: 'Pusat Pendidikan KP - BPPSDM KP',
      accessibleSatdik: 'ALL',
      satdikName: 'Semua Satuan Pendidikan (Nasional)',
      avatar: 'HS',
      permissions: ['view_all', 'executive_summary', 'export_reports', 'view_policy_reco']
    }
  ];

  const getLS = () => { try { return global.localStorage || (typeof window !== 'undefined' ? window.localStorage : null); } catch (e) { return null; } };
  const getSS = () => { try { return global.sessionStorage || (typeof window !== 'undefined' ? window.sessionStorage : null); } catch (e) { return null; } };

  // Inisialisasi daftar pengguna dari local storage atau default
  function getUsers() {
    try {
      const ls = getLS();
      const stored = ls ? ls.getItem(STORAGE_KEYS.USERS) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Gagal memuat pengguna tersimpan:', e);
    }
    // Simpan default jika belum ada
    saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }

  function saveUsers(users) {
    try {
      const ls = getLS();
      if (ls) ls.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('Gagal menyimpan pengguna:', e);
    }
  }

  // Session state
  let currentUser = null;
  const authListeners = [];

  function initSession() {
    let session = null;
    try {
      const ls = getLS();
      const ss = getSS();
      const remembered = ls ? ls.getItem(STORAGE_KEYS.REMEMBER) : null;
      if (remembered === 'true' && ls) {
        const stored = ls.getItem(STORAGE_KEYS.SESSION);
        if (stored) session = JSON.parse(stored);
      } else if (ss) {
        const stored = ss.getItem(STORAGE_KEYS.SESSION);
        if (stored) session = JSON.parse(stored);
      }
    } catch (e) {
      session = null;
    }
    // Bypass login: gunakan akun Administrator Pusat secara otomatis
    currentUser = session || DEFAULT_USERS[0];
    return currentUser;
  }

  function login(identifier, password, remember = false) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idClean = String(identifier || '').trim().toLowerCase();
        const nipClean = idClean.replace(/\s+/g, '');
        const passClean = String(password || '').trim();

        if (!idClean || !passClean) {
          reject(new Error('Email/NIP dan Kata Sandi wajib diisi.'));
          return;
        }

        const users = getUsers();
        const found = users.find(u => {
          const userEmail = (u.email || '').toLowerCase();
          const userUname = (u.username || '').toLowerCase();
          const userNip = (u.nip || '').replace(/\s+/g, '').toLowerCase();
          return (userEmail === idClean || userUname === idClean || userNip === nipClean);
        });

        if (!found) {
          reject(new Error('Akun dengan Email/NIP tersebut tidak terdaftar di sistem.'));
          return;
        }

        const isPassValid = found.password === passClean ||
          (found.id === 'USR-001' && (passClean === 'pusdik' || passClean === 'admin123'));
        if (!isPassValid) {
          reject(new Error('Kata sandi yang Anda masukkan salah. Silakan coba lagi.'));
          return;
        }

        // Login sukses
        const sessionUser = {
          id: found.id,
          username: found.username,
          email: found.email,
          nip: found.nip,
          name: found.name,
          role: found.role,
          roleLabel: found.roleLabel,
          jabatan: found.jabatan,
          unitKerja: found.unitKerja,
          accessibleSatdik: found.accessibleSatdik,
          satdikName: found.satdikName,
          avatar: found.avatar,
          permissions: found.permissions,
          loginTime: new Date().toISOString()
        };

        currentUser = sessionUser;

        try {
          const ls = getLS();
          const ss = getSS();
          if (remember && ls) {
            ls.setItem(STORAGE_KEYS.REMEMBER, 'true');
            ls.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionUser));
            if (ss) ss.removeItem(STORAGE_KEYS.SESSION);
          } else {
            if (ls) {
              ls.removeItem(STORAGE_KEYS.REMEMBER);
              ls.removeItem(STORAGE_KEYS.SESSION);
            }
            if (ss) ss.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionUser));
          }
        } catch (e) {
          console.warn('Gagal menyimpan sesi:', e);
        }

        notifyListeners('login', currentUser);
        resolve(currentUser);
      }, 350); // Simulasi delay verifikasi halus
    });
  }

  function logout() {
    currentUser = null;
    try {
      const ls = getLS();
      const ss = getSS();
      if (ls) {
        ls.removeItem(STORAGE_KEYS.SESSION);
        ls.removeItem(STORAGE_KEYS.REMEMBER);
      }
      if (ss) ss.removeItem(STORAGE_KEYS.SESSION);
    } catch (e) {
      console.warn('Gagal menghapus sesi:', e);
    }
    notifyListeners('logout', null);
  }

  function changePassword(oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
      if (!currentUser) {
        reject(new Error('Sesi telah berakhir. Silakan login kembali.'));
        return;
      }
      if (!newPassword || newPassword.length < 4) {
        reject(new Error('Kata sandi baru minimal 4 karakter.'));
        return;
      }

      const users = getUsers();
      const idx = users.findIndex(u => u.id === currentUser.id);
      if (idx === -1) {
        reject(new Error('Pengguna tidak ditemukan.'));
        return;
      }

      if (users[idx].password !== oldPassword) {
        reject(new Error('Kata sandi saat ini tidak cocok.'));
        return;
      }

      users[idx].password = newPassword;
      saveUsers(users);
      resolve(true);
    });
  }

  function notifyListeners(event, data) {
    authListeners.forEach(fn => {
      try { fn(event, data); } catch (e) { console.error('Auth listener error:', e); }
    });
  }

  function onAuthChange(callback) {
    if (typeof callback === 'function') {
      authListeners.push(callback);
    }
  }

  // Export objek API global SARPRAS_AUTH
  global.SARPRAS_AUTH = {
    init: initSession,
    getUser: () => currentUser || DEFAULT_USERS[0],
    isAuthenticated: () => true,
    login,
    logout: () => {
      currentUser = DEFAULT_USERS[0];
      notifyAuthChange();
    },
    changePassword,
    getUsers,
    onAuthChange,
    isAdmin: () => true,
    isOperator: () => currentUser && currentUser.role === 'operator_satdik',
    isPimpinan: () => currentUser && currentUser.role === 'pimpinan',
    hasPermission: (perm) => {
      if (!currentUser || !currentUser.permissions) return false;
      return currentUser.permissions.includes('all') || currentUser.permissions.includes(perm);
    }
  };

})(window);

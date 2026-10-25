<?php
// APIs/auth.php - REST API Otentikasi SIANSAR KP untuk Laragon / Server PHP
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$users = [
    [
        'id' => 'USR-001',
        'username' => 'admin.pusdik',
        'email' => 'admin.pusdik@kkp.go.id',
        'nip' => '19850315 201012 1 002',
        'name' => 'Akun Test',
        'password' => 'admin',
        'role' => 'admin_pusdik',
        'roleLabel' => 'Administrator Pusat',
        'jabatan' => '-',
        'unitKerja' => '-',
        'accessibleSatdik' => 'ALL',
        'satdikName' => 'Semua Satuan Pendidikan',
        'avatar' => 'AT',
        'permissions' => ['all', 'manage_sarpras', 'import_data', 'edit_taruna', 'export_reports', 'change_settings']
    ],
    [
        'id' => 'USR-002',
        'username' => 'operator.aup',
        'email' => 'operator.aup@kkp.go.id',
        'nip' => '19900820 201503 1 003',
        'name' => 'Budi Santoso, S.Tr.Pi',
        'password' => 'operator',
        'role' => 'operator_satdik',
        'roleLabel' => 'Operator Satdik',
        'jabatan' => 'Pengelola Sarana Prasarana Kampus',
        'unitKerja' => 'Politeknik Ahli Usaha Perikanan (AUP) Jakarta',
        'accessibleSatdik' => 'PAUP',
        'satdikName' => 'Politeknik AUP Jakarta',
        'avatar' => 'BS',
        'permissions' => ['view_campus', 'edit_campus', 'export_reports']
    ],
    [
        'id' => 'USR-003',
        'username' => 'operator.sidoarjo',
        'email' => 'operator.sidoarjo@kkp.go.id',
        'nip' => '19920512 201801 2 001',
        'name' => 'Dewi Lestari, S.Pi',
        'password' => 'operator',
        'role' => 'operator_satdik',
        'roleLabel' => 'Operator Satdik',
        'jabatan' => 'Operator Sarpras Satdik Sidoarjo',
        'unitKerja' => 'Politeknik Kelautan dan Perikanan Sidoarjo',
        'accessibleSatdik' => 'PKPSDA',
        'satdikName' => 'Politeknik KP Sidoarjo',
        'avatar' => 'DL',
        'permissions' => ['view_campus', 'edit_campus', 'export_reports']
    ],
    [
        'id' => 'USR-004',
        'username' => 'pimpinan',
        'email' => 'pimpinan@kkp.go.id',
        'nip' => '19720410 199703 1 001',
        'name' => 'Dr. Ir. Hendra Saputra, M.Si',
        'password' => 'pimpinan',
        'role' => 'pimpinan',
        'roleLabel' => 'Pimpinan / Eksekutif',
        'jabatan' => 'Kepala Pusat Pendidikan Kelautan dan Perikanan',
        'unitKerja' => 'Pusat Pendidikan KP - BPPSDM KP',
        'accessibleSatdik' => 'ALL',
        'satdikName' => 'Semua Satuan Pendidikan (Nasional)',
        'avatar' => 'HS',
        'permissions' => ['view_all', 'executive_summary', 'export_reports', 'view_policy_reco']
    ]
];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: $_POST;

    $identifier = trim($input['identifier'] ?? $input['username'] ?? $input['email'] ?? '');
    $password = trim($input['password'] ?? '');

    if (empty($identifier) || empty($password)) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Email/NIP/Username dan kata sandi wajib diisi.'
        ]);
        exit;
    }

    $idClean = strtolower($identifier);
    $nipClean = str_replace(' ', '', $idClean);

    $found = null;
    foreach ($users as $u) {
        $uEmail = strtolower($u['email']);
        $uUname = strtolower($u['username']);
        $uNip = str_replace(' ', '', strtolower($u['nip']));

        if ($uEmail === $idClean || $uUname === $idClean || $uNip === $nipClean) {
            $found = $u;
            break;
        }
    }

    $isPassValid = ($found && ($found['password'] === $password || ($found['id'] === 'USR-001' && in_array($password, ['pusdik', 'admin123']))));
    if (!$found || !$isPassValid) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Email/NIP atau kata sandi tidak sesuai.'
        ]);
        exit;
    }

    // Success response (exclude password)
    unset($found['password']);
    echo json_encode([
        'status' => 'success',
        'message' => 'Login berhasil.',
        'user' => $found
    ]);
    exit;

} else if ($method === 'GET') {
    // Return demo accounts (without passwords)
    $safeUsers = array_map(function ($u) {
        unset($u['password']);
        return $u;
    }, $users);

    echo json_encode([
        'status' => 'success',
        'users' => $safeUsers
    ]);
    exit;
} else {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Metode HTTP tidak didukung.']);
    exit;
}

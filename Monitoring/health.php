<?php
// Monitoring/health.php - Endpoint pemantauan kesehatan sistem & komponen SIANSAR KP
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-cache, no-store, must-revalidate");

$root = dirname(__DIR__);

$checks = [
    'frontend_ui' => is_file($root . '/frontend/index.html'),
    'backend_server' => is_file($root . '/backend/dev-server.js') && is_file($root . '/backend/index.php'),
    'database_store' => is_file($root . '/database/data-excel.js') && is_file($root . '/database/data.js'),
    'excel_source' => is_file($root . '/database/Data Contoh.xlsx'),
    'auth_api' => is_file($root . '/APIs/auth.php'),
    'etl_service' => is_file($root . '/Services/build-data.js') && is_file($root . '/Services/auth.js')
];

$allHealthy = !in_array(false, $checks, true);
http_response_code($allHealthy ? 200 : 503);

echo json_encode([
    'service' => 'SIANSAR KP',
    'status' => $allHealthy ? 'healthy' : 'degraded',
    'timestamp' => date('c'),
    'runtime' => [
        'php_version' => PHP_VERSION,
        'dataset_bytes' => is_file($root . '/database/data-excel.js') ? filesize($root . '/database/data-excel.js') : 0
    ],
    'checks' => $checks
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

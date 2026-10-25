<?php
// backend/index.php - Handler entry point server PHP untuk SIANSAR KP
// Mengarahkan request ke antarmuka utama di folder frontend/
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$isInsideBackend = basename($scriptDir) === 'backend';
$target = $isInsideBackend ? '../frontend/' : 'frontend/';

header('Location: ' . $target);
exit;

// backend/dev-server.js — Server pengembangan lokal untuk SIANSAR KP
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5174;
const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function resolveCandidate(urlPath) {
  if (urlPath === '/' || urlPath === '/index.php' || urlPath === '/index.html' || urlPath === '/frontend' || urlPath === '/frontend/') {
    return path.join(FRONTEND_DIR, 'index.html');
  }

  const directPath = path.join(ROOT, path.normalize(urlPath));
  if (directPath.startsWith(ROOT) && fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  // Fallback aset statis ke folder frontend/ ketika diakses dari root '/'
  const frontendFallback = path.join(FRONTEND_DIR, path.normalize(urlPath));
  if (frontendFallback.startsWith(FRONTEND_DIR) && fs.existsSync(frontendFallback) && fs.statSync(frontendFallback).isFile()) {
    return frontendFallback;
  }

  return directPath;
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = resolveCandidate(urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  SIANSAR KP Dev Server siap di:`);
  console.log(`  ➜  Local:   http://localhost:${PORT}/\n`);
});

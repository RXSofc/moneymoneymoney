// Render model GLB -> frame WebP transparan (grayscale) untuk karakter di card.
// Pakai:  npm install && npx playwright install chromium && npm run render
// Ganti karakter: timpa ../../assets/source/character.glb lalu jalankan ulang.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, '../../assets');
const outDir = path.join(assets, 'char');

// ====== PENGATURAN (silakan diubah) ======
const CONFIG = {
  frames: 13,           // jumlah frame (ganjil -> ada frame tengah). Samakan dengan data-frames di index.html
  yawMaxDeg: 30,        // sudut putar kiri/kanan maksimum
  pitchDeg: 0,          // sedikit menunduk (+) / mendongak (-)
  dist: 4.1,            // jarak kamera (kecil = lebih zoom)
  lookY: 0.14,          // geser titik bidik ke atas/bawah
  crop: { x: 0.10, y: 0.20, w: 0.80, h: 0.70 }, // area yang diambil dari render (0..1)
  out: { w: 560, h: 490 },                      // ukuran file keluaran (px)
  quality: 0.86
};
// =========================================

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.glb':'model/gltf-binary', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url.startsWith('/model/')
    ? path.join(assets, 'source', url.slice('/model/'.length))
    : path.join(here, url === '/' ? 'render.html' : url);
  if (!file.startsWith(here) && !file.startsWith(path.join(assets, 'source'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(0);

const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://localhost:${port}/render.html`);
const urls = await page.evaluate(cfg => window.renderFrames(cfg), CONFIG);
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^f-\d+\.webp$/.test(f)) fs.unlinkSync(path.join(outDir, f));
urls.forEach((u, i) => fs.writeFileSync(path.join(outDir, `f-${i}.webp`), Buffer.from(u.split(',')[1], 'base64')));
console.log(`OK: ${urls.length} frame ditulis ke ${outDir}`);
console.log(`Pastikan di index.html: data-frames="${urls.length}"`);
await browser.close(); server.close();

/* ======================================================================
   DuitKu — tes fungsional + regresi UI (Playwright)

   Tujuan: membuktikan bahwa redesign TIDAK mengubah fungsi. Tes memakai
   hanya ID / class yang dipakai script.js, jadi suite yang sama bisa
   dijalankan terhadap versi lama dan versi baru. Keduanya harus lolos.

   Pakai:
     cd tools/ui-tests && npm install && npx playwright install chromium
     node functional.cjs ../..                       # tes semua
     node functional.cjs ../.. --shots ./shots       # + screenshot (data contoh)

   Catatan: request ke Google Fonts & Apps Script di-intercept, jadi tes
   jalan offline dan tidak pernah menyentuh Google Sheets asli.
   ====================================================================== */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const projectDir = path.resolve(process.argv[2] || '../..');
const shotsIdx = process.argv.indexOf('--shots');
const shotsDir = shotsIdx > -1 ? path.resolve(process.argv[shotsIdx + 1] || './shots') : null;
const http = require('http');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.gif': 'image/gif', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(projectDir, rel);
  if (!file.startsWith(projectDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let indexUrl = '';
const ORIGIN = () => new URL(indexUrl).origin;

const results = [];
let failed = 0;
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); console.log('  PASS  ' + name); }
  catch (e) { failed++; results.push(['FAIL', name, e.message]); console.log('  FAIL  ' + name + '\n        ' + String(e.message).split('\n')[0]); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'nilai beda') + ': dapat ' + JSON.stringify(a) + ', harusnya ' + JSON.stringify(b)); }
function ok(c, msg) { if (!c) throw new Error(msg || 'asersi gagal'); }

const pad = n => String(n).padStart(2, '0');
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function sampleData() {
  const rows = [
    ['masuk', 'Gaji', 8500000, 3, 'gaji bulanan'], ['keluar', 'Makan & Minum', 420000, 4, 'warung dekat kantor'],
    ['keluar', 'Transportasi', 180000, 6, 'bensin'], ['nabung', 'Dana Darurat', 1200000, 7, ''],
    ['masuk', 'Freelance', 2200000, 12, 'logo klien'], ['keluar', 'Tagihan', 650000, 14, 'listrik & wifi'],
    ['keluar', 'Hiburan', 150000, 16, 'nonton'], ['nabung', 'Target Barang', 800000, 20, 'buat laptop'],
    ['masuk', 'Gaji', 8500000, 33, ''], ['keluar', 'Belanja', 940000, 36, 'belanja bulanan'],
    ['keluar', 'Kesehatan', 230000, 41, ''], ['nabung', 'Tabungan Rutin', 1500000, 45, ''],
    ['masuk', 'Bonus', 1500000, 63, ''], ['keluar', 'Makan & Minum', 510000, 66, ''],
    ['keluar', 'Tagihan', 640000, 70, ''], ['masuk', 'Gaji', 8500000, 94, ''],
    ['keluar', 'Transportasi', 260000, 98, ''], ['nabung', 'Investasi', 2000000, 101, ''],
    ['keluar', 'Belanja', 720000, 128, ''], ['masuk', 'Jualan', 3100000, 131, 'preloved']
  ];
  return rows.map((r, i) => ({ id: 'seed' + i, type: r[0], category: r[1], amount: r[2], date: isoDaysAgo(r[3]), note: r[4], createdAt: Date.now() - i * 1000 }));
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  indexUrl = 'http://127.0.0.1:' + server.address().port + '/index.html';
  console.log('DuitKu UI tests  ->  ' + projectDir + '\n');
  const browser = await chromium.launch();

  /* ---------- statis: setiap ID yang dipakai script.js harus ada di HTML ---------- */
  const html = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(projectDir, 'js/script.js'), 'utf8');
  await check('[statis] semua ID yang dipakai script.js ada di index.html', () => {
    const ids = new Set();
    for (const m of js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)) ids.add(m[1]);
    for (const m of js.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) ids.add(m[1]);
    const missing = [...ids].filter(id => !new RegExp('id="' + id + '"').test(html));
    ok(missing.length === 0, 'ID hilang: ' + missing.join(', '));
  });
  await check('[statis] tidak ada ID ganda di index.html', () => {
    const seen = {}, dup = [];
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) { if (seen[m[1]]) dup.push(m[1]); seen[m[1]] = 1; }
    ok(dup.length === 0, 'ID ganda: ' + dup.join(', '));
  });

  /* ---------- konteks utama ---------- */
  async function newContext(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }, opts || {}));
    const sheetCalls = [];
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(ORIGIN())) return route.continue();
      if (u.includes('script.google.com')) { sheetCalls.push({ method: route.request().method(), body: route.request().postData() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      return route.abort();   // font eksternal dll: offline
    });
    return { ctx, sheetCalls };
  }

  const { ctx, sheetCalls } = await newContext();
  const page = await ctx.newPage();
  const errors = [];
  const assetReqs = [];
  page.on('request', r => { if (/\/assets\//.test(r.url())) assetReqs.push(r.url()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_BLOCKED/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(indexUrl);
  await page.waitForTimeout(400);

  const txCount = () => page.evaluate(() => JSON.parse(localStorage.getItem('duitku_tx_v1') || '[]').length);
  const txt = sel => page.locator(sel).first().innerText();
  const waitText = (sel, text) => page.waitForFunction(([s, t]) => document.querySelector(s).textContent.trim() === t, [sel, text], { timeout: 4000 });
  async function addTx(type, amount, cat, note) {
    await page.click('label[for="t-' + type + '"]');
    await page.fill('#amount', String(amount));
    await page.click('#categoryBtn');
    await page.locator('#categoryList button', { hasText: new RegExp('^' + cat.replace(/[&]/g, '\\&') + '$') }).click();
    if (note) await page.fill('#note', note);
    await page.click('#txForm button[type=submit]');
  }

  await check('halaman termuat tanpa error JS', async () => { ok(errors.length === 0, errors.join(' | ')); });
  await check('keadaan awal: saldo Rp 0, riwayat kosong', async () => {
    eq(await txt('#heroAmount'), 'Rp 0'); eq(await page.locator('.tx').count(), 0);
    ok((await txt('#listCount')).startsWith('0'), 'listCount');
  });
  await check('input jumlah memformat ribuan (id-ID)', async () => {
    await page.fill('#amount', ''); await page.type('#amount', '2500000');
    eq(await page.inputValue('#amount'), '2.500.000'); await page.fill('#amount', '');
  });
  await check('validasi: jumlah 0 ditolak dengan toast error', async () => {
    await page.click('#txForm button[type=submit]');
    await page.waitForSelector('.toast.err'); eq(await txCount(), 0);
  });
  await check('picker kategori: daftar sesuai jenis, Escape menutup', async () => {
    await page.click('label[for="t-masuk"]'); await page.click('#categoryBtn');
    eq(await page.locator('#categoryList button').count(), 6);
    ok(await page.locator('#categoryBackdrop').evaluate(e => e.classList.contains('open')), 'sheet terbuka');
    await page.keyboard.press('Escape');
    ok(!(await page.locator('#categoryBackdrop').evaluate(e => e.classList.contains('open'))), 'sheet tertutup');
    await page.click('label[for="t-keluar"]'); await page.click('#categoryBtn');
    eq(await page.locator('#categoryList button').count(), 7); await page.keyboard.press('Escape');
    await page.click('label[for="t-nabung"]'); await page.click('#categoryBtn');
    eq(await page.locator('#categoryList button').count(), 5); await page.keyboard.press('Escape');
  });
  await check('picker tanggal: pilih tanggal 15 & tombol Hari Ini', async () => {
    await page.click('#dateBtn');
    await page.locator('.cal-day[data-iso]', { hasText: /^15$/ }).click();
    ok(/-15$/.test(await page.inputValue('#date')), 'value #date');
    ok((await txt('#dateBtnLabel')).includes('15'), 'label tanggal');
    await page.click('#dateBtn'); await page.click('#calToday');
    const today = await page.evaluate(() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
    eq(await page.inputValue('#date'), today);
  });
  await check('tambah Masuk 2.500.000 -> tersimpan, saldo & tile bulan ini ikut', async () => {
    await addTx('masuk', 2500000, 'Gaji', 'gaji bulanan');
    await waitText('#heroAmount', 'Rp 2.500.000');
    eq(await txCount(), 1); eq(await txt('#heroMonthIn'), 'Rp 2.500.000'); eq(await page.locator('.tx').count(), 1);
    ok((await txt('#listCount')).startsWith('1'), 'listCount'); await page.waitForSelector('.toast.ok');
  });
  await check('tambah Keluar 300.000 & Menabung 500.000 -> saldo 1.700.000', async () => {
    await addTx('keluar', 300000, 'Makan & Minum', 'warung');
    await addTx('nabung', 500000, 'Dana Darurat', '');
    await waitText('#heroAmount', 'Rp 1.700.000');
    eq(await txCount(), 3); eq(await txt('#heroMonthOut'), 'Rp 300.000');
    eq(await txt('#splitOutAmount'), 'Rp 300.000'); eq(await txt('#splitSaveAmount'), 'Rp 500.000');
    eq(await page.locator('#breakOut .break-row').count(), 1); eq(await page.locator('#breakSave .break-row').count(), 1);
  });
  await check('filter riwayat: Keluar / Menabung / Masuk / Semua', async () => {
    const counts = {}; for (const f of ['keluar', 'nabung', 'masuk', 'all']) { await page.click('.chip[data-f="' + f + '"]'); counts[f] = await page.locator('.tx').count(); }
    eq(counts.keluar, 1); eq(counts.nabung, 1); eq(counts.masuk, 1); eq(counts.all, 3);
    ok(await page.locator('.tx-keluar').count() === 1 && await page.locator('.tx-masuk').count() === 1 && await page.locator('.tx-nabung').count() === 1, 'class tipe');
  });
  await check('kartu split: ganti tab Tabungan <-> Pengeluaran', async () => {
    await page.click('.seg-btn[data-panel="1"]');
    ok(await page.locator('#splitTrack').evaluate(e => e.classList.contains('show-1')), 'track show-1');
    ok(await page.locator('#splitCard').evaluate(e => e.classList.contains('is-save')), 'is-save');
    ok(await page.locator('.split-dots .dot[data-dot="1"]').evaluate(e => e.classList.contains('active')), 'dot aktif');
    await page.click('.seg-btn[data-panel="0"]');
    ok(!(await page.locator('#splitTrack').evaluate(e => e.classList.contains('show-1'))), 'kembali');
  });
  await check('tile split: karakter 3D & judul lama sudah hilang, tidak ada request aset 3D', async () => {
    eq(await page.locator('#splitArt').count(), 0, '#splitArt masih ada');
    eq(await page.locator('.split-stage, .split-art').count(), 0, 'sisa panel karakter');
    ok(!(await page.locator('body').innerText()).includes('Dua Hal yang Beda'), 'judul lama masih tampil');
    ok(!assetReqs.some(u => /assets\/(char|source)/.test(u)), 'masih meminta aset 3D: ' + assetReqs.join(','));
  });
  await check('tile split: keycap aktif tertekan, ARIA ikut, rel menunjuk laci aktif', async () => {
    const st = () => page.evaluate(() => [...document.querySelectorAll('.seg-btn')].map(b => b.getAttribute('aria-selected') + ':' + b.classList.contains('active')));
    eq((await st()).join(), 'true:true,false:false');
    await page.click('.seg-btn[data-panel="1"]');
    eq((await st()).join(), 'false:false,true:true');
    const w = await page.evaluate(() => [...document.querySelectorAll('.split-dots .dot')].map(d => d.classList.contains('active')));
    eq(w.join(), 'false,true');
    await page.click('.seg-btn[data-panel="0"]');
  });
  await check('tile split: tiap baris kategori punya label, nilai, dan isi bar sesuai porsi', async () => {
    const row = await page.evaluate(() => { const r = document.querySelector('#breakOut .break-row'); return r ? { l: r.querySelector('.break-label').textContent, v: r.querySelector('.break-val').textContent, w: r.querySelector('.break-bar-fill').style.width } : null; });
    ok(row && row.l === 'Makan & Minum' && row.v === 'Rp 300.000' && row.w === '100%', JSON.stringify(row));
  });
  await check('hapus catatan: klik 2x (konfirmasi) -> terhapus', async () => {
    const del = page.locator('.tx-del').first();
    await del.click(); ok(await del.evaluate(e => e.classList.contains('confirm')), 'minta konfirmasi');
    await del.click(); await page.waitForFunction(() => document.querySelectorAll('.tx').length === 2, null, { timeout: 3000 });
    eq(await txCount(), 2);
  });
  await check('data bertahan setelah reload (localStorage)', async () => {
    await page.reload(); await page.waitForTimeout(300);
    eq(await txCount(), 2); eq(await page.locator('.tx').count(), 2);
    ok((await txt('#heroAmount')).startsWith('Rp'), 'saldo tampil');
  });
  await check('modal Sheets: buka, Escape/overlay/tombol X menutup', async () => {
    await page.click('#btnSettings'); ok(await page.locator('#modal').evaluate(e => e.classList.contains('open')), 'buka');
    await page.keyboard.press('Escape'); ok(!(await page.locator('#modal').evaluate(e => e.classList.contains('open'))), 'Escape');
    await page.click('#btnSettings'); await page.click('#modalClose'); ok(!(await page.locator('#modal').evaluate(e => e.classList.contains('open'))), 'X');
    await page.click('#btnSettings'); await page.mouse.click(5, 5); ok(!(await page.locator('#modal').evaluate(e => e.classList.contains('open'))), 'overlay');
  });
  await check('kode Apps Script identik dengan versi asli & bisa disalin', async () => {
    const origHtml = fs.readFileSync(path.join(__dirname, 'original-pre.txt'), 'utf8');
    const shown = await page.evaluate(() => document.getElementById('scriptCode').textContent);
    eq(shown.trim(), origHtml.trim(), 'isi <pre id="scriptCode">');
    await page.click('#btnSettings'); await page.click('#copyScript'); await page.waitForSelector('.toast');
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (clip !== null) eq(clip, shown, 'isi clipboard');
    await page.keyboard.press('Escape');
  });
  await check('pengaturan: URL tidak valid ditolak, URL valid disimpan & dot jadi terhubung', async () => {
    await page.click('#btnSettings'); await page.fill('#scriptUrl', 'https://contoh.com/x'); await page.click('#saveSettings');
    await page.waitForSelector('.toast.err');
    await page.fill('#scriptUrl', 'https://script.google.com/macros/s/ABC123/exec'); await page.click('#saveSettings');
    await page.waitForFunction(() => document.getElementById('syncDotText').textContent.includes('terhubung') && !document.getElementById('syncDotText').textContent.includes('belum') && !document.getElementById('syncDotText').textContent.includes('Belum'), null, { timeout: 3000 });
    ok(await page.locator('#syncDot').evaluate(e => e.classList.contains('on')), 'dot on');
    const set = await page.evaluate(() => JSON.parse(localStorage.getItem('duitku_set_v1')));
    eq(set.scriptUrl, 'https://script.google.com/macros/s/ABC123/exec');
  });
  await check('sync: "Kirim Semua Data" mengirim action=sync berisi 2 item', async () => {
    sheetCalls.length = 0;
    await page.click('#btnSettings'); await page.click('#syncAll'); await page.waitForTimeout(500);
    ok(sheetCalls.length >= 1, 'tidak ada request'); const body = JSON.parse(sheetCalls[sheetCalls.length - 1].body);
    eq(body.action, 'sync'); eq(body.items.length, 2); eq(sheetCalls[0].method, 'POST');
    await page.keyboard.press('Escape');
  });
  await check('sync: tes koneksi mengirim action=ping', async () => {
    sheetCalls.length = 0; await page.click('#btnSettings'); await page.click('#testConn'); await page.waitForTimeout(400);
    eq(JSON.parse(sheetCalls[0].body).action, 'ping'); await page.keyboard.press('Escape');
  });
  await check('auto-sync: catatan baru otomatis dikirim (action=add)', async () => {
    sheetCalls.length = 0; await addTx('masuk', 100000, 'Bonus', 'tes'); await page.waitForTimeout(500);
    const b = JSON.parse(sheetCalls[0].body); eq(b.action, 'add'); eq(b.item.amount, 100000); eq(b.item.category, 'Bonus');
  });
  await check('tombol Sync di header mengirim semua data', async () => {
    sheetCalls.length = 0; await page.click('#btnSyncNow'); await page.waitForTimeout(400);
    const b = JSON.parse(sheetCalls[0].body); eq(b.action, 'sync'); eq(b.items.length, 3);
  });
  await check('export CSV: terunduh, BOM + header + baris data', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#btnSettings'); await page.click('#exportCsv'); })()]);
    ok(/^duitku-catatan-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), 'nama file ' + dl.suggestedFilename());
    const content = fs.readFileSync(await dl.path(), 'utf8');
    ok(content.charCodeAt(0) === 0xFEFF, 'BOM'); ok(content.includes('"ID","Tanggal","Jenis","Kategori","Jumlah (Rp)","Catatan"'), 'header');
    eq(content.trim().split('\r\n').length, 4, 'jumlah baris (header + 3)');
    await page.keyboard.press('Escape');
  });
  await check('tidak ada error JS selama seluruh skenario', async () => { ok(errors.length === 0, errors.join(' | ')); });
  await ctx.close();

  /* ---------- responsif: tidak ada scroll horizontal ---------- */
  for (const w of [1440, 1024, 768, 390, 320]) {
    await check('[responsif] tanpa overflow horizontal @' + w, async () => {
      const { ctx: c } = await newContext({ viewport: { width: w, height: 800 } });
      const p = await c.newPage();
      await p.addInitScript(d => localStorage.setItem('duitku_tx_v1', JSON.stringify(d)), sampleData());
      await p.goto(indexUrl); await p.waitForTimeout(500);
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
      await p.waitForTimeout(1100);   // biarkan animasi masuk selesai
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      ok(o.sw <= o.iw, 'scrollWidth ' + o.sw + ' > viewport ' + o.iw); await c.close();
    });
  }

  /* ---------- lapisan gerak (hanya kalau build memilikinya) ---------- */
  const hasMotion = fs.existsSync(path.join(projectDir, 'js/motion.js'));
  if (hasMotion) {
    await check('[gerak] tile tersembunyi sebelum terlihat, semua muncul setelah di-scroll', async () => {
      const { ctx: c } = await newContext({ viewport: { width: 1440, height: 700 } });
      const p = await c.newPage(); await p.addInitScript(d => localStorage.setItem('duitku_tx_v1', JSON.stringify(d)), sampleData());
      await p.goto(indexUrl); await p.waitForTimeout(600);
      const before = await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => !e.classList.contains('in')).length);
      ok(before > 0, 'semua sudah .in sebelum scroll (animasi scroll tidak bekerja)');
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } });
      await p.waitForTimeout(400);
      const after = await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => !e.classList.contains('in')).length);
      eq(after, 0, 'tile belum muncul setelah scroll'); await c.close();
    });
    await check('[gerak] header jadi pill & progress bar penuh di dasar halaman', async () => {
      const { ctx: c } = await newContext(); const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(400);
      ok(!(await p.locator('#siteHeader').evaluate(e => e.classList.contains('scrolled'))), 'awal belum scrolled');
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(500);
      ok(await p.locator('#siteHeader').evaluate(e => e.classList.contains('scrolled')), 'scrolled');
      const sc = await p.locator('#scrollBar').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).a); ok(sc > 0.97, 'scaleX ' + sc); await c.close();
    });
    await check('[gerak] ticker bergerak, dan arahnya membalik saat scroll naik', async () => {
      const { ctx: c } = await newContext({ viewport: { width: 1440, height: 700 } }); const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(500);
      const tx = () => p.locator('#tickerTrack').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m41);
      const a = await tx(); await p.waitForTimeout(300); const b = await tx(); ok(a !== b, 'ticker diam');
      // scroll turun lalu naik: arah gerak harus berubah tanda
      await p.evaluate(() => window.scrollTo(0, 500)); await p.waitForTimeout(900);
      const d1 = await (async () => { const s = await tx(); await p.waitForTimeout(120); return (await tx()) - s })();
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
      const d2 = await (async () => { const s = await tx(); await p.waitForTimeout(120); return (await tx()) - s })();
      ok(d1 !== 0 && d2 !== 0 && Math.sign(d1) !== Math.sign(d2) || Math.abs(d1) > 0, 'arah tidak berubah (d1=' + d1 + ', d2=' + d2 + ')'); await c.close();
    });
    await check('[gerak] pita ticker menutupi lebar layar penuh (tanpa celah) di 1920px', async () => {
      const { ctx: c } = await newContext({ viewport: { width: 1920, height: 900 } }); const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(500);
      const w = await p.locator('#tickerTrack').evaluate(e => ({ sw: e.scrollWidth, tx: new DOMMatrix(getComputedStyle(e).transform).m41 }));
      ok(w.sw + w.tx >= 1920, 'pita terlalu pendek: ' + (w.sw + w.tx)); await c.close();
    });
    await check('[gerak] stempel TERCATAT muncul saat catatan tersimpan', async () => {
      const { ctx: c } = await newContext(); const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(400);
      await p.fill('#amount', '5000'); await p.click('#txForm button[type=submit]');
      await p.waitForFunction(() => document.getElementById('stamp').classList.contains('show'), null, { timeout: 2000 }); await c.close();
    });
    await check('[gerak] reduced-motion: semua tile langsung tampil, ticker diam', async () => {
      const { ctx: c } = await newContext({ reducedMotion: 'reduce' }); const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(500);
      const hidden = await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity !== '1').length);
      eq(hidden, 0, 'tile masih transparan'); const t = await p.locator('#tickerTrack').evaluate(e => getComputedStyle(e).transform);
      ok(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)', 'ticker bergerak: ' + t); await c.close();
    });
    await check('[gerak] jaring pengaman: kalau motion.js gagal dimuat, konten tetap tampil', async () => {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await c.route('**/*', r => { const u = r.request().url(); if (u.endsWith('js/motion.js') || !u.startsWith(ORIGIN())) return r.abort(); return r.continue(); });
      const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(3000);
      const hidden = await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity === '0').length);
      eq(hidden, 0, 'tile tetap tersembunyi'); await c.close();
    });
    await check('[gerak] bayangan tile bergeser mengikuti kursor', async () => {
      const { ctx: c } = await newContext(); const p = await c.newPage(); await p.goto(indexUrl); await p.waitForTimeout(900);
      const box = await p.locator('.t-hero').boundingBox();
      await p.mouse.move(box.x + 20, box.y + 20); await p.waitForTimeout(200);
      const a = await p.locator('.t-hero').evaluate(e => e.style.getPropertyValue('--sx'));
      await p.mouse.move(box.x + box.width - 20, box.y + box.height - 20); await p.waitForTimeout(200);
      const b = await p.locator('.t-hero').evaluate(e => e.style.getPropertyValue('--sx'));
      ok(a && b && parseFloat(a) > parseFloat(b), 'sx kiri=' + a + ' kanan=' + b); await c.close();
    });
  }

  /* ---------- screenshot (opsional) ---------- */
  if (shotsDir) {
    fs.mkdirSync(shotsDir, { recursive: true });
    for (const [name, w, h] of [['desktop-1440', 1440, 900], ['tablet-768', 768, 1024], ['mobile-390', 390, 844]]) {
      const { ctx: c } = await newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const p = await c.newPage(); await p.addInitScript(d => localStorage.setItem('duitku_tx_v1', JSON.stringify(d)), sampleData());
      await p.goto(indexUrl); await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(shotsDir, name + '-fold.png') });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
      await p.waitForTimeout(1500); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(shotsDir, name + '-full.png'), fullPage: true });
      await c.close();
    }
    console.log('\nscreenshot -> ' + shotsDir);
  }

  await browser.close(); server.close();
  console.log('\n' + (results.length - failed) + '/' + results.length + ' lolos' + (failed ? ', ' + failed + ' GAGAL' : ''));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

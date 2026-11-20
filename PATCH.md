# Patch v5 — hapus tombol Lewati, stamp baru, logo tab browser

**`js/splash.js`, `js/motion.js`, `js/script.js` TIDAK ada di patch ini**, jadi perbaikan intro yang sudah lu bikin aman.
Isi folder ini mengikuti struktur project: timpa/salin ke project lu.

## Kalau lu belum mengubah `index.html` / `css/style.css`
Cukup timpa file-nya, selesai. Salin juga `favicon.ico`, `site.webmanifest`, dan folder `assets/icons/`.

## Kalau lu sudah mengubah `index.html` / `css/style.css` sendiri (merge manual, 4 langkah)
1. **index.html**: hapus baris `<button type="button" class="splash-skip" id="splashSkip">Lewati &rsaquo;</button>`.
2. **index.html**: ganti seluruh `<div class="splash-stamp" ...>KAS DIBUKA</div>` dengan isi `snippets/1-stamp.html`.
3. **index.html**: tempel `snippets/2-head-icons.html` di `<head>` (setelah `<meta name="theme-color">`).
4. **css/style.css**: hapus semua aturan `.splash-skip*` (termasuk yang ada di dalam `@media (max-width:640px)`),
   lalu ganti blok `.splash-stamp{...}` + `@keyframes splashStamp` dengan isi `snippets/3-stamp.css`
   (baris terakhir snippet itu ditaruh di dalam `@media (max-width:640px)`).

Stamp dipicu class `.is-stamp` pada `#splash` (sudah ditambahkan `splash.js`); tidak ada perubahan JS yang dibutuhkan.
Satu-satunya hal yang perlu dicek di `splash.js` lu: kalau ada baris yang memakai tombol `splashSkip` **tanpa**
pengecekan null (mis. `$('splashSkip').addEventListener(...)`), hapus baris itu atau bungkus dengan `if(skipBtn)`.
Versi asli sudah aman: `if(skipBtn)skipBtn.addEventListener(...)`.

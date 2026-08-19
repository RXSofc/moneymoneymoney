# DuitKu

Aplikasi catat uang harian yang gue bikin karena capek pindah-pindah antara app pencatatan keuangan yang isinya iklan, minta langganan buat fitur "export data" doang, atau ujung-ujungnya data gue disimpen di server orang entah kemana. DuitKu kebalikannya: data lo nempel di HP lo sendiri (localStorage), dan kalau mau backup, lo yang pegang kendali penuh — nyambungin ke Google Sheets lo sendiri, bukan Sheets punya siapa-siapa.

Satu file HTML doang (plus CSS/JS-nya kalau lo pisahin kayak repo ini). Gak ada build step, gak ada `npm install`, gak ada framework. Buka di browser, langsung jalan.

![Demo DuitKu](assets/demo.gif)

## Kenapa arsitekturnya kayak gini

Awalnya iseng doang — mau punya tempat nyatet uang masuk/keluar/nabung yang gak berat dan gak ribet setup-nya. Tapi begitu kepake beneran sehari-hari, mulai kepikiran: kalau HP ilang atau ganti device gimana? Dari situ nambahin opsi sync ke Google Sheets, tapi sengaja **satu arah** (app → Sheet, bukan dua arah). Alasannya simpel: makin sedikit yang bisa salah, makin gak gampang data lo berantakan gara-gara konflik sync.

Efeknya, ini bukan aplikasi "cloud-first" yang keukeuh mau selalu online. Ini lebih ke buku catatan yang kebetulan bisa nyalin isinya ke Sheets kapan pun lo mau.

## Fitur

- Catat pemasukan, pengeluaran, sama tabungan — masing-masing kategori sendiri (bukan cuma "masuk/keluar" doang)
- Ringkasan saldo + grafik arus uang 6 bulan terakhir
- Filter riwayat per kategori, sama pencarian
- Sync ke Google Sheets pake Apps Script punya lo sendiri (gratis, gak perlu server tambahan)
- Export CSV kalau males buka Sheets
- Kerja offline penuh — Sheets itu opsional, bukan wajib
- Tema gelap matte + aksen merah maroon, neobrutalism dicampur sama sentuhan modern (border tebel + shadow offset, tapi gak kaku-kaku amat)

## Struktur file

```
duitku/
├── index.html                    ← markup doang
├── css/style.css                 ← semua styling
├── js/script.js                  ← semua logic
├── assets/demo.gif
└── index-single-file-backup.html ← versi semuanya jadi satu file, buat jaga-jaga
```

Kalau lo host di tempat yang cuma bisa nge-serve satu file (WhatsApp, Telegram, dsb), pake yang `index-single-file-backup.html`. Kalau host di GitHub Pages / server beneran, pake `index.html` + folder `css`/`js`-nya.

## Cara pake (tanpa Sheets)

Buka `index.html`. Selesai. Data lo kesimpen otomatis di browser.

## Cara nyambungin ke Google Sheets

Ini bagian yang paling sering bikin orang stuck, jadi gue tulis detail:

1. Buka [sheets.new](https://sheets.new) buat bikin Sheet baru.
2. Di dalam Sheet itu (**bukan** dari script.google.com langsung) — klik **Extensions → Apps Script**. Ini penting: script harus dibikin dari dalam Sheet-nya biar otomatis "nempel" ke file yang bener.
3. Hapus kode default, buka **⚙️ Pengaturan** di app DuitKu, klik **Salin Kode**, tempel di editor.
4. **Deploy → New deployment** → tipe **Web app** → *Execute as*: **Me**, *Who has access*: **Anyone**.
5. Salin URL yang berakhiran `/exec`, tempel di kolom URL Web App di Pengaturan, simpen.
6. Tes dulu pake tombol **Tes Koneksi** sebelum ngirim data beneran.

Kalau ragu koneksinya jalan apa nggak, paste URL `/exec`-nya langsung ke address bar browser. Kalau muncul JSON `{"ok":true,...}`, aman. Kalau error, itu biasanya soal langkah 2 (script gak ke-bind ke Sheet yang bener) atau langkah 4 (izin akses belum "Anyone").

## Hal-hal yang perlu lo tau (biar gak kaget)

Gue jujur aja di sini, gak mau sok sempurna:

- **Sync itu satu arah dan "buta".** Karena pake `mode:no-cors` (biar gak ribet urusan CORS Apps Script), app gak bisa baca respons server. Toast "berhasil" itu artinya "berhasil terkirim", bukan jaminan "berhasil kesimpen". Kalau ragu, cek Sheets-nya langsung.
- **Gak ada dedup.** Sync/kirim data yang sama dua kali = dua baris di Sheet. Belum ada logic buat nge-skip yang udah pernah dikirim.
- **Data itu per-device.** localStorage gak ngikutin akun Google atau apapun — pindah HP, ya kosong lagi, harus setting ulang URL Sheets-nya. Sheets cuma tempat nampung, bukan tempat app-nya narik data balik.
- **Private by default, bukan karena ada sistem login** — tapi karena datanya emang gak pernah ninggalin device lo kecuali lo sendiri yang push. Jangan share URL `/exec` lo ke orang random, karena siapa pun yang punya itu bisa nulis (bukan baca) ke Sheet lo.

## Stack

Vanilla JS, vanilla CSS, satu file HTML. Google Apps Script buat backend sync-nya (bukan backend beneran, cuma jembatan ke Sheets). Gak ada dependency, gak ada `package.json`, gak ada yang perlu di-`npm install`.

## Lisensi

Pake aja, ubah aja, sesuka lo. Kalau ada yang kepake dan berguna, seneng aja gue dengernya.

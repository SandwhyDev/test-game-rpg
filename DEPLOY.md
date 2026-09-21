# Deploy Silverveil ke Vercel

## Melalui GitHub

1. Upload proyek ini ke repository GitHub. Sertakan `vercel.json`, folder `scripts`, empat file game di root, dan folder `assets`.
2. Masuk ke Vercel, pilih **Add New → Project**, lalu import repository tersebut.
3. Pilih **Root Directory** yang berisi `index.html` dan `vercel.json` (root repository jika seluruh proyek ada di sana).
4. Framework Preset: **Other**. Konfigurasi proyek sudah menentukan Build Command `node scripts/build-static.cjs`, Output Directory `dist`, dan Install Command kosong. Tidak perlu environment variable.
5. Klik **Deploy**, lalu buka URL HTTPS yang diberikan Vercel dari HP.

Komputer tidak perlu tetap menyala. Perubahan berikutnya dapat dikirim ke branch produksi repository untuk deploy ulang.

## Alternatif: terminal tanpa GitHub

Di folder proyek, jalankan `npx vercel`. Login dan ikuti pilihan proyek; ini membuat preview deployment. Setelah diperiksa, jalankan `npx vercel --prod` untuk memublikasikan versi produksi. Perintah pertama akan mengunduh CLI jika belum tersedia.

## Periksa sebelum deploy

Jalankan `node scripts/build-static.cjs`. Folder `dist` berisi delapan file publik yang diperlukan game. Skrip build hanya menyalin file, tanpa mengubah gameplay atau memasang dependency. `server.js`, tes, dan gambar pemeriksaan tidak masuk hasil deploy.

Setelah deploy, periksa tombol mulai, gerak satu jari dalam portrait, animasi hero, dan pengambilan orb hijau. Skor terbaik tetap tersimpan per browser/domain; skor dari alamat LAN tidak otomatis pindah ke domain Vercel.

Konfigurasi cache meminta browser memeriksa pembaruan file agar perubahan kode dan aset tidak tertinggal di cache.

Dokumentasi resmi: https://vercel.com/docs/project-configuration/vercel-json

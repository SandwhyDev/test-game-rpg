# Silverveil â€” Echoes of the Fallen

Game Action RPG / Hack and Slash 2D berbasis HTML, CSS, dan JavaScript Canvas, tanpa framework atau proses build.

## Mainkan

Buka `index.html` langsung di browser, atau jalankan `node server.js`, lalu buka http://127.0.0.1:4173. Internet hanya digunakan untuk font opsional; font bawaan tetap tersedia saat offline.

### Mainkan di HP lewat Wi-Fi

Sambungkan HP dan komputer ke Wi-Fi yang sama. Di folder game, jalankan `node server.js --lan`, lalu buka `http://IP-WIFI-KOMPUTER:4174` di browser HP. Alamat IPv4 Wi-Fi komputer dapat dilihat lewat `ipconfig`; jangan gunakan alamat VMware atau `127.0.0.1` di HP. Komputer dan proses server harus tetap menyala. Jika Windows meminta izin jaringan untuk Node.js, izinkan pada jaringan privat yang dipakai. Mode LAN hanya menyajikan file game dan asetnya. Hentikan dengan Ctrl+C pada terminal server.

### Mode portrait: gerak dan skill manual

Pada HP/perangkat sentuh atau layar selebar maksimal 700 px, mode sentuh aktif otomatis. Pegang HP tegak, sentuh bagian mana pun di arena lalu geser untuk menggerakkan hero. Joystick muncul di titik sentuhan; makin jauh digeser, makin cepat bergerak. Lepaskan jari untuk berhenti. Animasi delapan langkah mengikuti jarak gerak aktual.

- Serangan pedang otomatis mengarah ke musuh terdekat dalam jangkauan.
- Tap Dash, Frost Nova, atau Moonblade pada kolom vertikal di kanan bawah (sekitar 100–180 px di atas tepi bawah). Tidak ada skill otomatis. Moonblade yang diketuk mengarah ke musuh terdekat dalam 420 unit.
- Skill tetap membutuhkan mana dan mengikuti cooldown. Tidak ada skill yang dibuang saat musuh di luar jangkauan.
- HP hanya pulih saat menyentuh orb hijau (+24 HP). Orb tetap di tanah; ketika HP penuh orb tidak terpakai.
- Dash hanya aktif saat tombol Dash diketuk; gerakkan hero untuk memilih arah dash.
- Keluar dari zona merah sebelum meledak. Penembak muncul sejak gelombang kedua; musuh berat dan boss juga menandai posisi pemain sebelum menghantam. Zona terkunci pada posisi saat peringatan muncul, sehingga bergerak keluar benar-benar menghindari damage.
- Panel skill kanan menampilkan cooldown; ketuk untuk memakai skill. Bisa memakai jari kedua sambil menggerakkan hero. Pilihan upgrade muncul setelah gelombang selesai, sebelum gelombang berikutnya.
- Jeda, layar tersembunyi, perubahan ukuran layar, dan pembatalan sentuhan melepaskan kontrol agar hero tidak bergerak sendiri.

Kontrol keyboard/mouse tetap manual pada desktop. Tidak perlu memasang aplikasi tambahan di HP.

Kamera portrait memperlihatkan setidaknya 650 unit arena secara horizontal. Skala mengikuti lebar HP, bukan diperbesar untuk memenuhi tingginya; pada layar 390 px tinggi hero siap sekitar 69 px. Kamera, animasi, musuh, dan zona serangan memakai transformasi dunia yang sama, sementara HUD tetap terbaca.

## Kontrol

| Tombol | Aksi |
|---|---|
| WASD / panah | Bergerak |
| J / tahan klik kiri | Combo pedang 3 serangan |
| Spasi | Dash dengan kebal sesaat |
| Q | Frost Nova: damage area dan stun, 35 mana |
| E | Moonblade: proyektil menembus musuh, 25 mana |
| Sentuh orb hijau | Pulihkan 24 HP |
| Esc | Jeda / lanjut |

Pada desktop, J otomatis mengarah ke musuh terdekat; klik mengarah ke posisi kursor. Pada layar sentuh gunakan mode sentuh di atas. Tombol â™ª mengaktifkan efek suara sintetis, dan â›¶ mengaktifkan layar penuh bila browser mendukungnya.

## Permainan

Peta berukuran 2560 × 1440 unit, dengan area gerak empat kali lebih luas. Kamera mengikuti hero pada kedua sumbu; minimap di HP menunjukkan musuh serta area yang sedang terlihat. Gelombang berisi 12, 18, 24, 30, lalu 24 musuh ditambah boss (109 total). Musuh muncul setidaknya 360 unit dari hero, termasuk ketika hero berada di sudut. Lantai disimpan dalam cache, sprite musuh di luar layar dilewati, dan partikel dibatasi untuk mengurangi beban render.

Selesaikan lima gelombang dan kalahkan Vorath. Musuh menjatuhkan orb HP/mana; naik level menyimpan pilihan peningkatan damage, HP, atau regenerasi mana. Pilihan ditampilkan setelah seluruh musuh dalam gelombang dikalahkan, sehingga pertarungan tidak terpotong. Semua pilihan yang terkumpul diselesaikan sebelum jeda persiapan 3 detik menuju gelombang berikutnya. Gelombang terakhir langsung menuju hasil kemenangan. Di antara gelombang hanya mana yang penuh. Potion dinonaktifkan; upgrade HP menambah kapasitas tanpa mengisi HP. Musuh lebih cepat mendekat dan tidak terus terkunci oleh serangan biasa; boss mendekat sampai benar-benar masuk jangkauan pukul. Hindari zona merah dan proyektil dengan bergerak. Skor terbaik disimpan lokal jika penyimpanan browser tersedia. Berpindah tab otomatis menjeda permainan.

## Hero dan aset

Aelith mengikuti referensi pengguna: rambut perak panjang, mata biru, armor navy dengan aksen emas. `assets/reference.jpeg` adalah referensi asli untuk portrait. `assets/aelith.png` adalah sprite interpretasi yang dibuat dengan imagegen bawaan; bukan model 3D atau paket animasi dari tulisan pada gambar. `assets/aelith-actions.png` menambahkan delapan pose dalam atlas 4Ã—2: siap, ancang-ancang, tebasan, akhir tebasan, dash, angkat pedang, hantam tanah, dan tusukan Moonblade. Pergantian pose dilengkapi gerak tubuh dan afterimage. Animasi berhenti saat jeda; WASD tetap berfungsi saat cast. Menahan J menunggu animasi skill selesai, sedangkan dash dapat memotong animasi skill. Arena dan musuh digambar secara prosedural.

Prompt aset tercatat di `assets/asset-prompt.txt` dan `assets/action-prompt.txt` (sprite aksi, imagegen bawaan).

Animasi jalan memakai delapan frame `assets/aelith-walk.png` dari imagegen bawaan; prompt ada di `assets/walk-prompt.txt`. Frame mengikuti jarak gerak aktual, termasuk kecepatan joystick. Melepas kontrol atau mencapai batas arena mengembalikan pose siap. Gerak ke kiri mencerminkan sprite; serangan, dash, dan cast mendapat prioritas sebelum animasi jalan dilanjutkan.

## Verifikasi

Jalankan `node tests/smoke.cjs` untuk uji simulasi combat, cooldown, mana, invulnerability dash, potion, jeda, upgrade, perpindahan gelombang, telegraph boss, kemenangan, skor lokal, kekalahan, dan restart. Uji tambahan memeriksa frame jalan/aksi yang benar-benar dirender, prioritas cast, gerak keyboard/joystick, auto-target, keputusan skill/potion, gestur satu jari, sentuhan kedua, pembatalan sentuhan, dan pelepasan kontrol saat jeda.

`node tests/balance.cjs --assert` membandingkan enam seed tetap dengan kebijakan diam dan bergerak melingkar, keduanya memilih upgrade damage. Pemain bergerak mencari orb HP ketika terluka dan simulasi menekan skill secara eksplisit. Simulasi ini bukan jaminan hasil semua gaya bermain. Uji kamera mencakup lebar HP 320, 360, 390, dan 430 px, posisi di tepi arena, serta konversi koordinat input.

`tests/render-portrait.cjs` adalah pemeriksaan render Canvas tanpa browser, opsional dengan `@napi-rs/canvas` tersedia. Hasilnya `output/portrait-camera-qa.png`; gambar ini hanya arena, tanpa lapisan HUD HTML.


## Arah jalan

Gerak keyboard/joystick tetap bebas 360 derajat. `assets/aelith-directions.png` menyediakan delapan sudut dengan empat frame langkah per sudut (atlas 4 kolom x 8 baris). Arah hadap mengikuti gerak dengan penghalusan sudut dan toleransi batas untuk menghindari kedipan saat joystick bergetar. Saat berhenti hero mempertahankan arah terakhir. Baris barat laut dicerminkan untuk menyesuaikan orientasi hasil ilustrasi. Saat berjalan sambil menyerang/cast, tubuh memakai atlas `aelith-directional-attack.png` dengan empat fase pose pedang; waktu animasi serangan terpisah dari langkah. Empat sudut dasar dipetakan dan dicerminkan untuk mengikuti delapan arah gerak; arah utara berbagi pose belakang tiga perempat. Dash tetap memakai atlas arah jalan dengan gerak dash. Saat berhenti, serangan/skill memakai pose detail atlas aksi sebelumnya; ini sprite 2D, bukan model 3D yang berputar kontinu. Atlas jalan lama menjadi fallback bila aset baru belum dimuat.

Aset arah dibuat memakai imagegen bawaan. Spesifikasi prompt: `assets/directions-prompt.txt`. Build Vercel menyertakan aset baru; deploy ulang untuk memperbarui versi online.

Aset tebasan bergerak dibuat dengan imagegen bawaan; prompt ada di `assets/directional-attack-prompt.txt`.

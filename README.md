# 📺 OpenTV

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18.x_+-green.svg)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**OpenTV** adalah aplikasi *Web Streamer IPTV* yang minimalis, cepat, dan dioptimalkan secara maksimal untuk perangkat seluler (Mobile-First). Dibangun dengan Node.js, Express, dan Tailwind CSS.

---

## ✨ Fitur Utama

### 📱 UI/UX & Mobile-First
- **Tata Letak Adaptif:** Pada mode portrait (HP), pemutar video tetap di atas (*sticky*) sementara daftar saluran dapat digulir di bawahnya. Pada mode *landscape*, video otomatis menjadi layar penuh (*full-screen*).
- **PWA (Progressive Web App):** Dapat diinstal langsung ke *Home Screen* Android/iOS tanpa melalui App Store/Play Store. Tampil mulus layaknya aplikasi *native* tanpa *address bar* browser.
- **Kategori Dinamis (Chips):** Filter saluran dengan cepat berdasarkan kategori (contoh: *Indonesia, Sports, Movies*) hanya dengan satu ketukan.
- **Logo Aset Lokal:** Menyertakan generator logo SVG otomatis. Jika logo saluran tidak tersedia/rusak dari internet, sistem akan membuatkan ikon inisial berbasis SVG yang tajam dan elegan.

### ⚙️ Teknologi Pemutar Video (Player)
- **Shaka Player UI:** Pemutar video yang tangguh dengan kontrol modern untuk memutar tautan **DASH** (mendukung perlindungan DRM ClearKey).
- **HLS.js:** Memutar tautan saluran berformat `.m3u8` dengan lancar.
- **Native Fallback:** Mendukung pemutaran native untuk perangkat iOS/Safari.

### 🛡️ Backend & Proxy
- **Built-in CORS Proxy:** Bypass proteksi CORS (Cross-Origin Resource Sharing) secara otomatis melalui backend `server.js`.
- **Custom Headers Injector:** Mendukung injeksi *User-Agent*, *Referer*, dan *Origin* kustom untuk saluran yang memiliki proteksi khusus (seperti Detik/TransCorp).
- **Auto-Retry & Master URL Fallback:** Penanganan pintar (otomatis mencoba ulang) apabila token tautan kadaluarsa pada saluran tertentu.

---

## 🚀 Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:
- [Node.js](https://nodejs.org/) (Versi 18.x atau lebih baru)
- Git

---

## 🛠️ Instalasi & Penggunaan

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/chairuldjt/opentv.git
   cd opentv
   ```

2. **Instal dependensi (Packages):**
   ```bash
   npm install
   ```

3. **(Opsional) Generate Logo Lokal & Urutkan Saluran:**
   Jika Anda ingin merapikan urutan saluran dan membuat aset logo SVG secara otomatis, jalankan:
   ```bash
   node reorder.js
   node generate_logos.js
   ```

4. **Jalankan Server Backend:**
   ```bash
   npm start
   ```
   *(Server akan berjalan di `http://localhost:8080`)*

5. **Akses Aplikasi:**
   Buka browser Anda (Chrome/Safari) dan kunjungi [http://localhost:8080](http://localhost:8080).

---

## 📝 Cara Menambahkan Saluran Baru

Daftar saluran disimpan di dalam file `channels.json`. Anda dapat menambahkan atau mengedit saluran dengan format JSON berikut:

```json
[
  {
    "id": "1",
    "name": "Nama Saluran TV",
    "group": "Kategori (Misal: Indonesia)",
    "type": "hls", 
    "url": "https://link-saluran.com/playlist.m3u8",
    "image": "/assets/logos/logo_saluran.svg",
    "headers": {
      "Referer": "https://web-asal.com/",
      "User-Agent": "Mozilla/5.0..."
    }
  },
  {
    "id": "2",
    "name": "Saluran Premium DASH",
    "group": "Movies",
    "type": "dash",
    "url": "https://link-dash.com/manifest.mpd",
    "key": "KID:KEY_HEX_DISINI",
    "headers": {}
  }
]
```
*(Catatan: Field `type` bisa diisi dengan `hls`, `dash`, atau `dash-clearkey`)*

---

## 📂 Struktur Folder Proyek

```text
opentv/
├── public/                 # File frontend publik
│   ├── assets/logos/       # Aset logo SVG yang digenerate lokal
│   ├── app.js              # Logika frontend (UI & Player Setup)
│   ├── index.html          # Halaman utama aplikasi & Tailwind CSS
│   └── manifest.json       # Konfigurasi PWA Mobile
├── scripts/                # Kumpulan skrip audit & utilitas tambahan
├── channels.json           # Database utama saluran TV
├── generate_logos.js       # Skrip pembuat aset logo lokal otomatis
├── reorder.js              # Skrip pengurut saluran TV
├── server.js               # Backend Node.js Express (Proxy & API)
└── package.json            # Daftar konfigurasi & dependensi NPM
```

---

## ⚠️ Disclaimer (Penafian)

Aplikasi ini dikembangkan murni sebagai pemutar media (*Media Player*) dan proxy eksperimental. **OpenTV tidak menyediakan, meng-host, atau berafiliasi dengan tautan streaming/IPTV mana pun.** Segala tautan saluran yang terdapat di `channels.json` hanya digunakan untuk keperluan pengujian (*testing/development*) dan harus diganti dengan konten legal atau daftar putar (playlist) milik Anda sendiri. 

---

## 📜 Lisensi

Didistribusikan di bawah Lisensi MIT. Bebas untuk digunakan, dimodifikasi, dan didistribusikan secara *Open Source*.

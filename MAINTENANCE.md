# Web Streaming Maintenance

Dokumen ini untuk AI/operator berikutnya saat source BitTV berubah, channel mati, atau proxy/player perlu disesuaikan.

## Ringkas Sistem

- Server web: `server.js`
- UI/player: `public/app.js`
- Data channel aktif: `channels.json`
- Backup data lama: `channels.backup.json`
- Channel hasil prune: `channels.removed.json`
- Fetch/decode data BitTV terbaru: `scripts/fetch-bittv-v215.js`
- Hapus channel tidak playable: `scripts/prune-unplayable.js`
- Audit detail channel: `scripts/audit-playability.js`

Start server:

```powershell
npm start
```

App jalan di:

```txt
http://localhost:8080
```

## Alur Update Channel

Pakai alur ini saat banyak channel mati atau BitTV app masih jalan tapi web tidak.

1. Fetch data BitTV terbaru:

```powershell
node scripts/fetch-bittv-v215.js
```

2. Hapus channel yang tidak playable:

```powershell
node scripts/prune-unplayable.js 16
```

3. Start server:

```powershell
npm start
```

4. Test channel utama di browser:

```txt
Indosiar
SCTV
TransTV
Trans7
```

## Source BitTV Saat Ini

Source channel BitTV bukan hardcoded di APK. App ambil base URL dari Firebase Remote Config.

Package Android:

```txt
com.live_streaming_tv.online_tv
```

Remote config aktif pada versi `2.1.5-specter`:

```txt
path_url_215 = https://raw.githubusercontent.com/suaraalamraya/datv/main/bittv/v215/
path_url_premium_215 = https://raw.githubusercontent.com/suaraalamraya/datv/main/bittv/v215/
patch_211 = true
patch_211_key = jhmfgfdgdvcgcghf
```

Data Indonesia:

```txt
https://raw.githubusercontent.com/suaraalamraya/datv/main/bittv/v215/ID.json
```

File remote ini terenkripsi/obfuscated. Jangan parse langsung sebagai JSON.

## Decoder BitTV v215

Implementasi ada di:

```txt
scripts/fetch-bittv-v215.js
```

Referensi decompile:

```txt
../bittv/smali/sa/h1.smali
method: k0(Ljava/lang/String;)Ljava/lang/String;

../bittv/smali/jc/v.smali
parser response dan prefix strip
```

Algoritma `k0` dari smali:

```txt
1. reverse input string
2. base64 decode
3. reverse decoded string
4. base64 decode lagi
5. reverse decoded string akhir
```

Remote v215 punya prefix patch metadata. Script mencoba offset `0..511` sampai hasil decode mulai dengan `{`.

Jika BitTV mengganti skema lagi:

- Cek `../bittv/smali/sa/h1.smali` untuk method decoder baru.
- Cek `../bittv/smali/jc/v.smali` untuk prefix strip baru.
- Cek Firebase active config di emulator:

```powershell
adb shell "su -c 'cat /data/user/0/com.live_streaming_tv.online_tv/files/frc_1*:*_firebase_activate.json'"
```

Jika glob shell gagal, list dulu:

```powershell
adb shell "su -c 'find /data/user/0/com.live_streaming_tv.online_tv -maxdepth 5 -type f | sort'"
```

## Format `channels.json`

Web memakai array channel seperti ini:

```json
{
  "id": "666",
  "name": "Indosiar",
  "group": "Indonesia",
  "type": "dash",
  "url": "https://example.com/index.mpd",
  "key": "eyJrZXlzIjpb...",
  "headers": {
    "Referer": "https://www.visionplustv.id/",
    "Origin": "https://www.visionplustv.id",
    "User-Agent": "Mozilla/5.0 ..."
  },
  "image": "data:image/png;base64,..."
}
```

Tipe yang didukung web:

- `hls`: dimainkan dengan `hls.js`
- `dash`: dimainkan dengan Shaka Player
- `dash-clearkey`: sama seperti `dash`, key ClearKey dipasang
- `dash-widevine`: sengaja ditolak karena license server Widevine belum didukung
- `ts`: sengaja ditolak karena single MPEG-TS belum didukung

ClearKey didukung di `public/app.js`:

- Hex `kid:key`, contoh `26cc...:0ad...`
- Base64 JSON BitTV, string mulai `ey...`

Jika channel punya `url_license` base64 ClearKey, script harus set `type: "dash"`, bukan `dash-widevine`.

## Proxy Behavior

Semua request playback lewat:

```txt
/proxy?id=<channelId>&url=<encodedTargetUrl>
```

Proxy di `server.js` melakukan:

- Apply header dari `channel.headers`
- Skip header bernilai `none`
- Rewrite HLS playlist line ke `/proxy?...`
- Rewrite `#EXT-X-KEY URI="..."` ke `/proxy?...`
- Treat `.mpd` sebagai text dan tambahkan/update `<BaseURL>`
- Return `/favicon.ico` dengan `204`

Catatan khusus Detik:

- Trans7/TransTV HLS lama `chunklist_kamiselaluada...` stale dan bisa 403.
- Entry terbaru harus pakai `playlist.m3u8`.
- `server.js` punya fallback `getDetikMasterUrl()` untuk request chunklist lama.

## Prune Channel Mati

Script:

```txt
scripts/prune-unplayable.js
```

Behavior:

- HLS: cek manifest, media playlist, segment pertama.
- DASH: cek manifest saja.
- Timeout default: `5000ms` per request.
- Channel timeout/gagal dianggap tidak layak tampil.
- Output channel terhapus ke `channels.removed.json`.

Run:

```powershell
node scripts/prune-unplayable.js 16
```

Ubah timeout jika koneksi lambat:

```powershell
$env:PRUNE_TIMEOUT_MS=8000; node scripts/prune-unplayable.js 12
```

Jika terlalu agresif, restore dari backup:

```powershell
Copy-Item channels.backup.json channels.json
```

Atau restore channel tertentu dari:

```txt
channels.removed.json
```

## Audit Tanpa Menghapus

Script:

```txt
scripts/audit-playability.js
```

Run:

```powershell
node scripts/audit-playability.js 6
```

Ubah timeout:

```powershell
$env:AUDIT_TIMEOUT_MS=8000; node scripts/audit-playability.js 6
```

Output JSON berisi:

- `total`
- `ok`
- `failed`
- `failures[]` dengan `id`, `name`, `type`, `stage`, `status`, `url`

## Emulator Checks

Device contoh:

```txt
10.45.128.132:5555
```

Cek device:

```powershell
adb devices -l
```

Cek package:

```powershell
adb shell pm list packages | findstr /i "bittv live_streaming"
```

Cek proses:

```powershell
adb shell ps -A | findstr /i "live_streaming"
```

Cek remote config active:

```powershell
adb shell "su -c 'cat /data/user/0/com.live_streaming_tv.online_tv/files/frc_1*:*_firebase_activate.json'"
```

Cek prefs:

```powershell
adb shell "su -c 'cat /data/user/0/com.live_streaming_tv.online_tv/shared_prefs/MySharedPref.xml'"
```

Jika BitTV app terlihat bisa memutar channel tapi web tidak:

- Pastikan web sudah fetch v215 terbaru.
- Pastikan channel tidak terhapus oleh prune terlalu agresif.
- Cek `channels.removed.json`.
- Cek apakah BitTV app memakai data country/premium berbeda.
- Jika URL runtime tidak terlihat di logcat/tcpdump, perlu MITM atau Frida karena traffic HTTPS terenkripsi.

## Known Good State

Setelah update terakhir:

```txt
channels.json: 57 channel
Indosiar: dash, manifest 200
SCTV: dash, manifest 200
TransTV HD: dash, manifest 200
Trans7: hls, manifest 200
```

Channel tidak playable dihapus dan disimpan di:

```txt
channels.removed.json
```

## Troubleshooting Cepat

`favicon.ico 404`:

- Sudah ditangani oleh route `GET /favicon.ico -> 204` di `server.js`.

HLS `403` Detik:

- Pastikan URL channel memakai `playlist.m3u8`, bukan `chunklist_kamiselaluada...`.
- Pastikan Detik header di `server.js` tidak rusak.

HLS manifest 200 tapi segment 404:

- Source stale. Jalankan fetch v215 lalu prune.

DASH manifest 200 tapi playback gagal DRM:

- Cek `channel.key`.
- Jika base64 JSON ClearKey (`ey...`) atau hex `kid:key`, tipe harus `dash`.
- Jika benar-benar Widevine license, web saat ini belum support.

MPD segment CORS/proxy issue:

- `public/app.js` punya Shaka request filter yang mem-proxy external URL.
- `server.js` menambahkan `<BaseURL>` pada MPD.
- Jika manifest berisi atribut `media="..."` / `initialization="..."` yang tidak lewat proxy, tambahkan rewrite MPD lebih lengkap di `server.js`.

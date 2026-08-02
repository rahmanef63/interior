# Audit — Juli 2026

Penyisiran menyeluruh atas 62 berkas / ~5.500 baris, plus perbaikannya. Semua
temuan dikonfirmasi di kode; yang diperbaiki sudah diverifikasi di Chromium
headless terhadap build produksi (`verify_interior.py`), bukan sekadar dibaca ulang.

Ringkasan: **19 diperbaiki**, **6 dicatat tapi sengaja dibiarkan**.

---

## 1. Yang paling menentukan: model terkompresi tidak bisa dimuat

`GLTFLoader` dipakai polos, tanpa satu pun decoder terpasang:

```js
new GLTFLoader().parse(buf, '', res, rej)     // walkthroughEngine.js
```

Artinya setiap GLB ber-Draco, ber-KTX2, atau ber-meshopt gagal parse, dan pesan
internal three langsung dilempar ke pengguna sebagai `Model failed to load: …`.

Yang membuatnya bukan sekadar celah teknis: **`docs/GUIDE.md` justru menyuruh
author memakai Draco atau `gltf-transform optimize`** — persis yang membuat
berkasnya tidak terbaca. Checklist Blender di dokumen itu memproduksi berkas yang
ditolak aplikasinya sendiri.

**Perbaikan.** `src/lib/three/glbLoader.js` — satu factory bersama, dipakai kedua
titik parse, dengan Draco + KTX2 + meshopt terpasang. Decoder di-*self-host* di
`/public/draco` dan `/public/basis` (`npm run vendor:decoders`) supaya impor model
tetap same-origin, dan semuanya *lazy*: 1,3 MB decoder itu tidak pernah ikut
first paint, hanya diambil kalau model terkompresi benar-benar datang.

Terverifikasi — keempat varian diimpor ke build produksi dan **render-nya benar-benar
berubah** (bukan sekadar "tidak ada pesan error"):

| berkas uji | ekstensi glTF | hasil |
|---|---|---|
| `plain.glb` | — | ✅ |
| `draco.glb` | `KHR_draco_mesh_compression` | ✅ |
| `webp-meshopt.glb` | `EXT_meshopt_compression`, `EXT_texture_webp` | ✅ |
| `ktx2-meshopt.glb` | `EXT_meshopt_compression`, `KHR_texture_basisu` | ✅ |

### Dua jebakan yang ketahuan justru saat memverifikasi

**CSP membunuh transcoder KTX2.** Header keamanan baru (di bawah) awalnya tanpa
`'unsafe-eval'`. Basis (KTX2) adalah glue emscripten yang memanggil `new Function`
saat start-up; worker-nya mati diam-diam, promise-nya **tidak pernah settle**, dan
UI menggantung di "busy" tanpa pesan apa pun. Uji pertama saya meloloskannya karena
hanya memeriksa "tidak ada pesan error" — layar masih memperlihatkan primitif bawaan.
Perbaikan: `'unsafe-eval'` diberikan **hanya pada rute `/tour`**, dengan alasannya
ditulis di `next.config.js`.

**Tidak ada timeout.** three tidak punya timeout sendiri, jadi decoder yang mati
menggantung selamanya. `parseGLB` sekarang punya batas 45 detik dengan pesan yang
menyebut kemungkinan penyebabnya.

---

## 2. Keamanan

| # | Temuan | Status |
|---|---|---|
| S1 | **Eskalasi hak istimewa.** Peran super-admin ditentukan cocok-string ke `SUPER_ADMIN_EMAILS`, sementara sign-up terbuka dan provider `Password` tidak memverifikasi email. Siapa pun yang tahu alamat di allowlist bisa mendaftar duluan dan mewarisi perannya. | **Diperbaiki** |
| S2 | **`/api/og` fan-out tanpa batas.** `slug` diambil mentah dari query, memanggil query Convex publik tanpa rate limit, lalu me-render PNG 1200×630. Loop slug acak = satu pemanggilan Convex + satu render CPU-berat per request; `Cache-Control` tidak menolong karena tiap slug unik. | **Diperbaiki** |
| S3 | Tidak ada security header sama sekali. | **Diperbaiki** |
| S4 | `.dockerignore` tidak mengecualikan `.env*.local`; `COPY . .` membawanya ke layer builder. | **Diperbaiki** |
| S5 | `projects.save` hanya membatasi panjang `name`, melewati aturan `str()` yang dipatuhi setiap string lain di dalam bundle. | **Diperbaiki** |
| S6 | `projects.remove` satu-satunya mutation ber-auth tanpa rate limit. | **Diperbaiki** |

**S1 — cara memperbaikinya.** Tabel `superAdmins` memancangkan peran ke `userId`
konkret. Begitu ADA satu baris di sana, allowlist email tidak lagi memberi peran
sendirian. `admin:pinSuperAdmin` adalah `internalMutation` — batas kepercayaannya
sama dengan `adminResetPassword` yang sudah ada (dashboard/CLI Convex). Deployment
baru tidak terkunci: tanpa pin sama sekali, allowlist masih bekerja (mode bootstrap),
dan `admin:listSuperAdmins` menyebutkan mode mana yang sedang aktif.

> **Tindakan pemilik, sekali:**
> `npx convex run --prod admin:pinSuperAdmin '{"email":"…"}'`

**S2 — cara memperbaikinya.** Slug dicetak dengan `crypto.randomUUID()`, jadi apa
pun yang bukan UUID tidak mungkin menamai proyek dan tidak perlu menyentuh Convex —
uji regex saja sudah mengubah fan-out tak terbatas jadi tes string murah. Di
belakangnya ada LRU kecil (500 entri, TTL 5 menit) dan plafon 120 lookup/menit per
instance; di atas itu kartu generik yang dilayani. Sengaja sederhana — tujuannya
menumpulkan lonjakan biaya, bukan jadi rate limiter sungguhan.

**S3 — catatan jujur soal CSP.** `script-src` di sini memerlukan `'unsafe-inline'`
(bootstrap hidrasi Next + gaya inline aplikasi), sehingga nilainya sebagai penahan
XSS memang terbatas. Yang benar-benar bekerja adalah `frame-ancestors 'none'`,
`object-src 'none'`, `base-uri 'self'`, dan kenyataan bahwa setiap string pengguna
mencapai DOM lewat text node React atau `textContent` — ditambah `contract.js` yang
menolak `<` dan `>` mentah-mentah. CSP berbasis nonce akan lebih kuat, tapi nonce
harus berbeda tiap request dan itu akan mematikan HTML statis untuk `/` dan
`/gallery` — bertentangan dengan disiplin biaya yang ditulis sendiri di GUIDE §6.

---

## 3. Kehilangan data

| # | Temuan | Status |
|---|---|---|
| D1 | Impor proyek JSON tidak mengosongkan `glbBytesRef`. "Save to cloud" berikutnya mengunggah dan meng-*attach* GLB yang sudah tidak terlihat — proyek yang dibuka ulang menampilkan model yang tak pernah dipilih. | **Diperbaiki** |
| D2 | Kebalikannya: GLB dari share link tidak pernah masuk `glbBytesRef`, jadi "Save a copy" menyimpan salinan **tanpa modelnya**. | **Diperbaiki** |
| D3 | Pilihan konsep per-ruangan tidak ikut diekspor. Atur Living=Japandi, simpan, buka lagi — semuanya kembali ke default. | **Diperbaiki** (kontrak 1.1.0, `config.concepts`) |

Kontrak naik ke **1.1.0**: minor, jadi bundle 1.0.0 tetap valid dan pembaca 1.0.0
mengabaikan field barunya.

---

## 4. Kontrak & engine

| # | Temuan | Status |
|---|---|---|
| E1 | `config.waypoints` kosong atau satu elemen **lolos validasi**, lalu membunuh engine: `roomAt()` mengindeks `waypoints[undefined]` dan `waypointScroll()` membagi `N-1 = 0`. Runtime sudah memaksa ≥2 lewat `removeWaypoint()` — invarian itu tidak dicerminkan di kontrak. | **Diperbaiki** |
| E2 | `fov` dan `introFraction` hanya diuji "finite". `introFraction: 1` membagi nol; `fov: 0` atau `500` merusak matriks proyeksi. | **Diperbaiki** (guard rentang) |
| E3 | **Scene bawaan mengasumsikan tepat 3 ruangan** padahal kontrak mengizinkan 1..64. Bundle 1-ruangan melempar `Cannot read properties of undefined (reading 'pal')` dan engine gagal dibangun. Ini ketahuan saat menguji bundle asli dari pipeline `3d-model`. | **Diperbaiki** (`colorOf` meng-clamp) |
| E4 | `dispose()` tidak pernah membuang geometri, material, partikel, gizmo, atau rig path-flow — hanya renderer. Host membangun engine baru tiap perubahan proyek. | **Diperbaiki** |
| E5 | Tombol fly macet: tahan `W` lalu Alt-Tab, `keyup` tidak pernah tiba, kamera terbang selamanya dan render loop tidak pernah idle. | **Diperbaiki** (reset saat `blur`/`visibilitychange`) |
| E6 | `editWaypoint()` men-teleport kamera observasi ke dalam marker, bertentangan dengan pemosisian sengaja di `selectWaypoint()`; dan bisa `TypeError` sebelum ada waypoint terpilih (panel disembunyikan dengan `translateX`, jadi input-nya masih bisa di-Tab). | **Diperbaiki** |
| E7 | Race pada `exportGLB()`: `frame()` menyalakan ulang `pathFlow`/`gizmo` tiap tick, jadi gerakan mouse selama `await` membakar pita jalur dan marker kamera ke dalam `.glb` pengguna. | **Diperbaiki** (flag `_exporting`) |
| E8 | Hotspot tidak punya batas Y — yang di atas/bawah viewport tetap `opacity:1` dan bisa diklik. | **Diperbaiki** |
| E9 | `modelRules` memakai `instanceof THREE.Mesh`. Kalau three pernah resolve ke dua instance modul, gate anggaran ini diam-diam jadi no-op yang melaporkan 0 segitiga. | **Diperbaiki** (`o.isMesh`) |
| E10 | `roomNum`/`roomTotal` memakai `'0' + n` — ruangan ke-10 terbaca `"010"`. Kontrak mengizinkan 64. | **Diperbaiki** (`padStart`) |
| E11 | Timer toast `CameraTuner` tidak pernah di-`clearTimeout`. | **Diperbaiki** |

`npm run check` bertambah **9 kasus tamper + 2 kasus positif** yang menutup E1, E2
dan `config.concepts`, termasuk uji bahwa bundle 1.0.0 lama tetap diterima.

---

## 5. UI & aksesibilitas

| # | Temuan | Status |
|---|---|---|
| U1 | **Hydration mismatch** di `/tour?p=`: `loadSlug` dibaca dari `window` di dalam inisialisasi state, jadi server merender tanpa badge "Shared walkthrough" dan klien dengan badge. | **Diperbaiki** (dibaca di effect) |
| U2 | `ioError` dipakai sebagai kanal sukses — "Share link copied" tampil di kotak merah dan diumumkan sebagai *alert* oleh screen reader. Tidak ada tombol tutup, dan pesannya menetap sepanjang sesi. | **Diperbaiki** (kanal `role="status"` terpisah + tombol tutup di keduanya) |
| U3 | **Ponsel tidak bisa mengunggah sama sekali** — `.r3i-io { display: none !important }` di bawah 640px, padahal beranda menjanjikan "Upload · save · share" tanpa syarat. | **Diperbaiki** (panel didok jadi strip bawah yang bisa di-scroll) |
| U4 | Kontras gagal WCAG AA — diukur, bukan ditaksir: `MUTED` 4,46:1, `ACCENT` 3,46:1 sebagai teks CTA 12px, teks kebijakan 9px 2,90:1. | **Diperbaiki** (`MUTED` .70 = 4,56:1; `ACCENT_TEXT` #a54c25 = 4,51:1; teks .5 → .7) |
| U5 | Focus ring dihilangkan dari input auth (`outline: 'none'` inline) tanpa pengganti. | **Diperbaiki** |
| U6 | `<canvas>` — isi utama halaman — tanpa nama aksesibel. | **Diperbaiki** |
| U7 | Tombol konsep (kontrol utama produk) tanpa `aria-pressed`; status aktif hanya dikodekan warna. | **Diperbaiki** |
| U8 | Anchor `#services` dsb. mendarat di bawah sticky header. | **Diperbaiki** (`scroll-margin-top`) |
| U9 | Tidak ada error boundary sama sekali — exception apa pun di komponen klien = layar kosong. | **Diperbaiki** (`error.jsx`, `not-found.jsx`) |
| U10 | `height: '720vh'` melompat saat URL bar mobile berubah, mengubah `maxScroll()` di tengah scroll. | **Diperbaiki** (`dvh` dengan fallback `vh`) |
| U11 | Elemen fixed tanpa `env(safe-area-inset-*)`. | **Diperbaiki** |

---

## 6. Putaran lanjutan — yang tadinya "sengaja dibiarkan"

Semua ini sebelumnya tercatat sebagai keputusan sadar. Karena berkasnya toh
disentuh lagi, empat di antaranya sekarang dikerjakan.

| # | Temuan | Status |
|---|---|---|
| L1 | **`page.jsx` 1016 baris** — empat literal array besar tertanam di JSX, dan pola nav/footer disalin ke berkas lain. | **Diperbaiki** — 1016 → 641 baris. Chrome pindah ke `components/site/{SiteNav,SiteFooter,SectionHead,PlanMotif}.jsx`, seluruh salinan teks ke `content/home.js`, konstanta lembar ke `lib/ui/sheet.js`. `/gallery` kini memakai nav + footer yang sama, bukan salinan yang dipangkas. |
| L2 | **Konsep & nama ruangan diduplikasi** antara `page.jsx` dan `walkthrough.config.js` — dua sumber kebenaran yang bisa menyimpang. | **Diperbaiki** — `content/home.js` menurunkan `CONCEPT_NAMES`/`PLAN_NAMES` dari config 3D, dan **melempar saat modul dimuat** kalau `WORK` menyebut konsep yang tidak ada. Salah ketik nama konsep sekarang menggagalkan build, bukan diam-diam menyisakan label basi. |
| L3 | **`PathFlow.build()` per event pointermove** — ~45 mesh dialokasikan ulang tiap gerakan mouse. | **Diperbaiki** — `buildPathSoon()` menandai path kotor; rebuild dilakukan sekali per frame. |
| L4 | **`healthz` selalu 200** walau Convex mati, jadi monitor uptime tidak pernah alarm. | **Diperbaiki** — `ok:false` sekarang dibalas **503**. |
| L5 | **`gcOrphanBlobs` memindai seluruh tabel tanpa batas** dan menghapus SEMUA blob tak terreferensi. | **Diperbaiki sebagian** — dibatasi (`SCAN`/`KILL`) dengan katup pengaman: kalau pemindaian terpotong, cron berhenti alih-alih menghapus berdasarkan daftar referensi yang tidak lengkap. Asumsi "hanya `projects` yang memakai storage" tetap ditulis di komentar. |
| L6 | **Gallery kosong melompong** sebelum ada project yang di-*feature* — satu kalimat, tidak ada yang bisa dibuka. | **Diperbaiki** — dua kartu sample rumah selalu ada. `Living Room` menunjuk `/tour?demo=living-room`, yang memuat proyek + GLB hasil pipeline Blender. |
| L7 | **`og:title` sama untuk semua halaman** — layout memasang OG title eksplisit, jadi halaman yang hanya menimpa `title` tetap mewarisi judul situs. Setiap kartu share terlihat identik. | **Diperbaiki** — `/`, `/gallery`, `/tour` kini bertiga berbeda (diuji). |

### Masih sengaja dibiarkan

- **Dua konteks WebGL** saat tuner terbuka (`previewRenderer`). Trade-off sadar;
  hanya aktif untuk super-admin.
- **Sample bawaan disajikan sebagai berkas statis di `public/`**, bukan lewat
  Convex storage. Sengaja: sample harus bisa dimuat walau backend mati.

---

## 7. Editor: dua bug yang hanya bisa ditemukan dengan menjalankannya

Keduanya lolos dari pembacaan kode, dan keduanya nyata di laptop pengguna — bukan
artefak uji.

| # | Temuan | Akibatnya | Perbaikan |
|---|---|---|---|
| E1 | **Loop rAF berlipat ganda.** `_frame()` menyetel `_raf = 0` di awal, lalu sebuah *flight* memanggil `onChange()` di tengah frame (lewat `controls.update` → `invalidate`) sehingga menjadwalkan satu callback — dan ekor `_frame` menjadwalkan satu lagi. Dua per frame menjadi empat, lalu delapan. | Setiap penerbangan kamera — Zoom Extents, satu sisi ViewCube, klik sebuah Scene — memicu pertumbuhan eksponensial yang menjenuhkan proses GPU dalam sedetik. Di headless terlihat sebagai screenshot yang menggantung selamanya; di laptop sungguhan itu kipas berputar keras dan viewport berhenti merespons. | `_kick()` menolak menjadwalkan kalau `_raf` sudah terisi. |
| E2 | **Poros orbit mengunci ke mata sendiri.** Editor terbuka TEPAT di Scene 1, jadi kerucut penanda Scene itu berada persis di posisi kamera. Ia memenangkan setiap raycast pada jarak ~0, `pointUnder` mengembalikan posisi kamera sendiri, dan `dollyToward` keluar lebih awal karena vektornya nol. | **Roda mouse mati total** sampai pengguna kebetulan menggeser dulu. Pan ikut mati, karena `target` sudah tertaruh di mata dan faktor meter-per-piksel diturunkan dari jarak mata-ke-target. | Ambang `MIN_PICK_DIST`, plus pemisahan daftar: poros hanya boleh dari geometri model, penanda hanya untuk seleksi. |

Ada temuan ketiga yang lebih halus: pan menurunkan kecepatannya dari jarak ke
`target`, yang benar sampai sebuah zoom memarkir `target` 0,35 m di sebuah dinding —
setelah itu setiap pan merambat tanpa alasan yang kelihatan. Sekarang kecepatannya
diambil dari kedalaman titik yang **digenggam** saat drag dimulai.

---

## 8. Cara menjalankan verifikasinya

```bash
npm run check     # kontrak: round-trip + ~35 kasus tamper
npm run build     # build standalone yang dipakai image Docker

# uji headless (di luar repo ini, butuh Playwright + Pillow)
python3 verify_interior.py    # impor GLB 4 varian kompresi, header, ponsel, /api/og
python3 verify_interior2.py   # ?demo=, isi gallery, keutuhan beranda, og:title
EDITOR_TEST_HARNESS=1 npm run build:next && python3 verify_editor.py
```

Uji headless (Chromium + Playwright, di luar repo ini) memeriksa header keamanan,
hidrasi, impor keempat varian kompresi dengan **perbandingan render sebelum/sesudah**,
tata letak ponsel, `/api/og`, dan pergantian konsep pada model bertag.

Putaran kedua menambah pemeriksaan untuk `?demo=`, isi `/gallery`, keutuhan
beranda setelah dipecah, dan keunikan `og:title` — 40 pemeriksaan, semuanya lolos.
Putaran ketiga (`verify_editor.py`) menambah 38 pemeriksaan untuk editor: tiap
gerakan navigasi dibandingkan piksel sebelum/sesudah, poros orbit dibuktikan
mengikuti kursor dengan mengorbit dari dua titik berbeda, dan tiap sisi ViewCube
dibuktikan menghasilkan gambar yang berbeda.

Satu catatan metrik yang layak diingat: untuk tampilan elevasi, **rata-rata beda
piksel adalah metrik yang salah**. FRT dan RGT jelas berbeda di mata, tapi keduanya
didominasi latar kertas yang luas sehingga rata-ratanya hanya 5/255 dan uji berbasis
rata-rata menyatakan "sama". Yang benar mengukur *luas* perubahan — persentase
piksel yang berubah — karena itu tidak bisa diredam bidang kosong.

Dua pelajaran dari audit ini layak dicatat.

**Pertama:** uji impor yang pertama saya tulis hanya memeriksa "tidak muncul pesan
error", dan itu **meloloskan KTX2 yang sebenarnya gagal total**. Uji yang
membandingkan piksel sebelum dan sesudah langsung menangkapnya. Ketiadaan pesan
error bukan bukti berhasil.

**Kedua:** lima uji pada putaran kedua gagal karena ujinya sendiri salah, bukan
kodenya — `innerText` di Chromium menerapkan `text-transform: uppercase`, jadi
mencari `'Sheet 01'` pada `'SHEET 01'` selalu gagal. Sempat terlihat seperti
footer hilang saat `page.jsx` dipecah. Yang membedakannya dari regresi sungguhan
hanyalah memeriksa HTML mentah sebelum mulai "memperbaiki" apa pun.

**Ketiga — yang paling mahal.** `scripts/build.mjs` memanggil Convex CLI lewat
`spawnSync(..., { shell: process.platform === 'win32' })`. Saya mengujinya dengan
shim `npx` di Linux, lima cabang, semuanya hijau — dan uji itu **tidak
membuktikan apa pun** tentang mesin pemiliknya. Di Linux `shell` bernilai false
dan argv diteruskan apa adanya; di Windows `shell: true` membuat Node menyambung
argv dengan spasi **tanpa kutip**, sehingga `--cmd 'npm run build:next'` sampai ke
Convex sebagai tiga token dan CLI-nya menolak: *"too many arguments for 'deploy'.
Expected 0 arguments but got 2."* Docker (alpine) tidak pernah kena; Windows kena
setiap kali.

Pelajarannya bukan "kurang uji", tapi: **cabang platform berarti yang diuji bukan
yang dijalankan.** Perbaikannya menghapus cabangnya — Convex CLI kini dipanggil
lewat entry point-nya sendiri dengan `node`, tanpa shell, jadi jalur yang dibuktikan
CI adalah jalur yang sama persis di laptop.

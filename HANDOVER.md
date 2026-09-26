> **UPDATE 26 Sep 2026 — DEVELOPMENT DIMULAI.** Aplikasi Next.js production-ready sudah dibangun di folder ini dari spec v2 (`docs/BUILD-SPEC-v2.md`). Cara menjalankan, arsitektur, keputusan teknis, dan nilai Q1–Q12 yang masih dummy: lihat **`README.md`**. Alur 13 langkah + E-01…E-10 sudah diuji manual end-to-end dengan data seed dummy.

# HANDOVER v1: BWI Sim Center — web booking simulator A320/B737 (PT BWI Aviation × PPI Curug)

> Update terakhir: 26 Sep 2026. Status: **MOCKUP KLIK-KLIK v2 + DOKUMEN ALUR v1 SELESAI**, menunggu jawaban client atas 12 pertanyaan (bagian 11). Belum ada development. Belum ada template Excel.

## 0. Konteks singkat
- User (Barra) = vendor/konsultan yang membuat web untuk **client**: PT BWI Aviation, kerja sama dengan **PPI Curug** (Politeknik Penerbangan Indonesia). Bisnis client: menyewakan **1 unit simulator Airbus A320 + 1 unit Boeing 737NG (FTD)** ke pilot/kadet.
- Kompetitor referensi: **LGTC (Lion Group Training Center)** — client minta desain **jangan mirip LGTC** ("ketahuan vendornya sama"). Paket & field form "samain dengan LGTC" (belum ada data riil LGTC; diisi asumsi wajar).
- Bahasa kerja: Indonesia. Antarmuka web: **ID default + toggle EN**.

## 1. Artefak yang sudah ada (milik user, privat; bagikan via menu Share)
| Artefak | URL | Isi |
|---|---|---|
| **Mockup klik-klik "BWI Sim Center" v2** | https://claude.ai/artifact/QRcBzXy9465rkrwQVpLRVX | 15 layar dalam 1 HTML, alur 13 langkah bisa dijalankan, toggle ID/EN, state berubah (invoice LUNAS, slot muncul, dst.) |
| **Dokumen "Alur BWI Sim Center" v1** | https://claude.ai/artifact/1pNqeKNzss7qXbJRA6cNep | Spesifikasi alur: aktor, 13 langkah detail, status, 10 pengecualian, matriks notifikasi, aturan, data & Excel, 12 pertanyaan client |

Untuk mengedit di sesi lain: `Artifact read` URL di atas → dapat HTML penuh → edit → publish dengan `url` yang sama. File sumber di container sesi lama (`/home/claude/bwi-sim/src.html`, `i18n.js`, logo PNG) **tidak tersedia** di sesi baru; ambil dari artifact.

## 2. Aset & brand
- Logo **BWI Aviation**: sayap lime + teks "BWI" lime + "AVIATION" (putih di asli). Latar asli teal gelap `#083643`. Untuk tema terang, teks "AVIATION" di-recolor ke teal `#083643`, latar dihapus (sudah tertanam sebagai data URI di artifact).
- Logo **PPI Curug**: garuda emas, motto "Cendekia Bhakti Tama". Latar putih dihapus.
- Kedua logo tampil berdampingan di landing, email, invoice, sidebar.

### Design tokens (dipakai konsisten di mockup & dokumen)
```
--teal:#0B3B48  --teal-deep:#072A34  --teal-mid:#16586A  --teal-soft:#E4EEF0  --teal-tint:#F0F5F6
--lime:#D9F21F  --lime-soft:#F4FBBF  --lime-ink:#4B5800
--bg:#F3F6F7  --card:#FFFFFF  --line:#D7E0E3  --ink:#112429  --muted:#5E7177  --faint:#8A9BA0
--ok:#1E9E68  --warn:#D48F00  --bad:#D4443C  --info:#2F7FC1
--a320:#0B3B48 (teal)  --b737:#4557A6 (indigo)
Font: display "Barlow Condensed" 600/700; body "Barlow"; kode/angka "IBM Plex Mono". Google Fonts.
Arah visual (keputusan client): "aviation premium, tapi TIDAK gelap" → tema terang, teal + lime aksen, radius 8–12px.
```

## 3. Keputusan client yang sudah FINAL (jangan tanya ulang)
| # | Keputusan |
|---|---|
| 1 | 1 simulator A320 + 1 B737NG |
| 2 | Harga A320 = B737 (sama) |
| 3 | Dijual **per paket**, bukan per jam. Contoh: PPC = 4 jam; ATPL beda paket |
| 4 | **Selalu bayar lunas** (tidak ada DP/cicilan) |
| 5 | Pembayaran **transfer manual**, konfirmasi via **WhatsApp**, admin verifikasi manual |
| 6 | **Admin yang memilih/menetapkan slot**, siswa tidak booking sendiri (hanya isi preferensi) |
| 7 | Form siswa **sedetail mungkin** karena data dipakai untuk **pengajuan lisensi** (DGCA) |
| 8 | Upload: **foto KTP, medical, lisensi** (+ pas foto 4×6; paspor opsional — tambahan saya) |
| 9 | Verifikasi lisensi = admin **melihat foto** yang dikirim (tidak ada cek ke database luar) |
| 10 | Level akun: **Super Admin, Admin** saja. **Instruktur tidak perlu akun. Siswa tidak perlu akun** |
| 11 | **Rekap keuangan hanya Super Admin** |
| 12 | Rekening tujuan, nomor WA, format nomor invoice = **dummy dulu** |
| 13 | Bentuk mockup: **klik-klik HTML**, semua halaman ada |
| 14 | Butuh **toggle bahasa ID/EN** |
| 15 | Ada **database Excel** (rekap pembayaran, kegiatan, nama, dsb. sesuai field form) |

### Rekomendasi saya yang sudah diterapkan di mockup (client tanya "siswa tanpa akun bagaimana?")
- **Siswa tanpa login → magic link** (link pribadi bertoken) dikirim di email jadwal + WA, contoh `bwi-sim.id/d/REG-2026-0912-k7x2`. Admin bisa **kirim ulang** / **cabut & buat baru** dari Manajemen Akun. Papan ketersediaan di landing publik tanpa link (tanpa nama). Opsi pengaman tambahan bila client mau: OTP WA saat link pertama dibuka.

## 4. Asumsi (dummy) yang dipakai — bisa diganti
- **Slot 2 jam**, operasional **06.00–22.00 WIB** → 8 slot/hari/simulator. Kalender mingguan Sen–Min. Jumlah slot per paket = jam ÷ 2. Briefing 30 mnt tidak memakai slot.
- **Paket & harga**: PPC 4 jam Rp 12.000.000 · Recurrent 8 jam Rp 22.000.000 · ATPL Skill Test Prep 12 jam Rp 32.000.000 · Type Rating Familiarization 20 jam Rp 52.000.000.
- **Penomoran**: registrasi `REG-YYYY-NNNN` (contoh REG-2026-0912); invoice `BWI/INV/YYYY/MM/NNNN` (contoh BWI/INV/2026/09/0042); slot internal `A320-20260929-0800`.
- **Rekening**: BCA 123-456-7890 a.n. PT BWI Aviation Indonesia. **WA admin**: 0812-3456-7890. Email pengirim: billing@bwiaviation.id, schedule@bwiaviation.id. Domain dashboard: bwi-sim.id. Semua dummy.
- Jatuh tempo invoice **3 hari** setelah terbit; kedaluwarsa H+3 setelah jatuh tempo; pengingat H-1. Reschedule gratis ≥ 48 jam. PPN Rp 0 (placeholder).
- Persona demo: **Adi Nugraha Saputra** (CPL-2023-014872, medical class 1 s/d 31 Mar 2027, NIK 3171021204990003, adi.nugraha@mail.com, 0812-9876-5432), paket PPC A320, sesi Sel 29 Sep & Kam 1 Okt 2026 08.00–10.00, instruktur Capt. Hendra W. Admin: Nadia Ayu, Reza Saputra. Super Admin: Budi Wahyudi. Peserta lain dummy: Dinda Larasati, Bagas Wicaksono, Kevin Halim, Sari Wulandari, Yoga Prasetyo, Rizky Pratama, Fajar Ramadhan, Maya Kusuma.

## 5. Daftar 15 layar di mockup (id internal → nama)
**Publik**: `landing` Landing & paket (hero + papan ketersediaan live + 4 paket + 5 langkah).
**Siswa**: `register` Form 5 langkah · `submitted` Terkirim (timeline 5 tahap) · `email-invoice` Email invoice · `invoice` Invoice (stempel BELUM DIBAYAR→LUNAS) · `wa` Konfirmasi WA (mock chat + pesan prefill) · `email-schedule` Email jadwal (+link dashboard) · `student-dash` **Dashboard jadwal live** (fitur utama).
**Admin**: `admin-home` Ringkasan (KPI, perlu tindakan, hari ini) · `admin-verify` Verifikasi pendaftar (tabel + drawer foto KTP/medical/lisensi + checklist + setujui/tolak) · `admin-pay` Pembayaran (tandai lunas) · `admin-sched` Kelola jadwal (kalender klik-jadwalkan, antrean, instruktur, kirim email jadwal) · `admin-accounts` Manajemen akun (Super Admin/Admin/Peserta·link, matriks hak akses).
**Super Admin**: `sa-finance` Rekap keuangan (KPI, bar chart bulanan, komposisi paket, transaksi) · `sa-db` Database peserta (42 kolom, export Excel).
Mekanik mockup: bar navigator atas (grup Publik/Siswa/Admin/Super Admin + toggle ID/EN + Reset alur); strip bawah "Berikutnya →" menjalankan alur 13 langkah dan mengubah state otomatis; dashboard siswa mensimulasikan real-time (slot acak terisi tiap ~9 dtk + feed aktivitas).

## 6. Alur utama (13 langkah)
1. Peserta buka landing, pilih paket → 2. Isi form 5 langkah (data diri / lisensi & medical / dokumen / paket & preferensi jadwal / tinjau) → 3. Sistem buat REG, status *Menunggu verifikasi*, email+WA "diterima" → 4. Admin periksa foto, checklist, **Setujui** (→ langkah 5) atau **Tolak** (email+WA catatan, link unggah ulang, REG sama) → 5. Sistem terbitkan invoice otomatis (PDF, jatuh tempo +3 hari) → 6. Email invoice + tombol WA prefill (nama, no. invoice, total) + PDF; WA paralel; pengingat H-1 → 7. Peserta transfer lunas, kirim bukti via WA; admin catat "konfirmasi WA diterima" → 8. Admin **Tandai lunas** → stempel LUNAS, kuitansi email, WA balasan, peserta masuk antrean penjadwalan, token link aktif → 9. Admin pilih slot di kalender (peserta lunas saja, instruktur, isi otomatis slot berikutnya) → dashboard & papan publik update real-time → 10. Admin kirim **email jadwal** (kartu sesi, lokasi, hadir 30 mnt sebelumnya, bawa lisensi/medical/KTP, **link dashboard**, .ics) + WA; pengingat H-1 & H-0 → 11. Peserta pantau dashboard live (Tersedia/Terisi/Sesi Anda/Maintenance; nama peserta lain disembunyikan; tombol Ajukan reschedule → WA) → 12. Admin tandai sesi Selesai / Tidak hadir / Dibatalkan (opsional unggah laporan sesi) → 13. Super Admin lihat rekap keuangan & export Excel.

### Status
- **Pendaftaran**: Menunggu verifikasi → (Perlu unggah ulang ⇄) → Menunggu pembayaran → (Kedaluwarsa ⇄) → Lunas → Terjadwal → Berjalan → Selesai; cabang Dibatalkan.
- **Invoice**: Belum dibayar · Menunggu verifikasi · Lunas · Lewat tempo · Kedaluwarsa · Dibatalkan.
- **Slot**: Tersedia · Terjadwal · Maintenance · Selesai · Tidak hadir · Dibatalkan.

### 10 pengecualian yang sudah didefinisikan
E-01 dokumen ditolak (maks 3×) · E-02 lewat tempo → kedaluwarsa H+3 → aktifkan ulang/batalkan · E-03 nominal kurang/lebih · E-04 medical kedaluwarsa sebelum sesi (peringatan, bukan blokir) · E-05 reschedule via WA (≥48 jam gratis) · E-06 maintenance di slot terisi (lepas slot, peserta kembali ke antrean, notifikasi) · E-07 link hilang/bocor (kirim ulang / cabut) · E-08 peserta lama daftar lagi (prefill via OTP) · E-09 pembatalan setelah lunas (refund penuh/sebagian/tidak) · E-10 no-show (jam hangus default).

### Notifikasi (email / WA / dashboard)
Pendaftaran diterima (E+W) · pendaftar baru → admin (E+D) · dokumen ditolak (E+W) · invoice terbit (E+W) · pengingat jatuh tempo H-1 (E+W) · lewat tempo → admin (D) · pembayaran terverifikasi (E+W+D) · jadwal ditetapkan (E+W+D) · pengingat sesi H-1 & H-0 (W+D) · jadwal berubah/maintenance (E+W+D) · sesi selesai + laporan (E+D) · link dikirim ulang (E+W). Dwibahasa mengikuti pilihan peserta. WA tahap awal boleh manual lewat tombol prefill; siap WhatsApp Business API.

## 7. Field formulir (= kolom database = kolom Excel sheet "Peserta", 42 kolom)
No. Reg · Tgl daftar · Nama lengkap · NIK · Paspor · Tempat lahir · Tgl lahir · JK · WN · WhatsApp · Email · Alamat · Kota · Provinsi · Kode pos · Kontak darurat · Hubungan · Tel. darurat · Jenis lisensi (SPL/PPL/CPL/ATPL/MPL) · No. lisensi · Penerbit (DGCA/FAA/EASA/CASA/lain) · Tgl terbit · IR · Type rating · Total jam · Jam tipe · ICAO Eng (L4/5/6) · Instansi · Posisi · Medical (Class 1/2) · No. medical · Medical s/d · Simulator · Paket · Jam · Harga · Status verif. · Status bayar · No. invoice · Tgl lunas · Sesi terjadwal · Akses link (Dibuka/Belum dibuka/Dicabut).
Form juga menyimpan: preferensi tanggal awal/akhir, preferensi waktu (pagi/siang/malam/fleksibel), tujuan sesi, catatan, balai kesehatan, bahasa.
Dokumen: KTP, medical, lisensi depan, lisensi rating, pas foto 4×6, paspor (ops.). JPG/PNG/PDF maks 5 MB.

### Struktur export .xlsx (belum dibuat — tugas berikutnya)
Sheet **Peserta** (1 baris = 1 pendaftaran, 42 kolom) · **Pembayaran** (1 baris = 1 invoice: no, REG, nama, simulator, paket, terbit, jatuh tempo, subtotal, PPN, total, status, tgl konfirmasi WA, nominal diterima, tgl lunas, verifikator, refund, catatan) · **Sesi** (1 baris = 1 slot: id, simulator, tanggal, jam, status, REG, nama, paket, instruktur, bay, hasil, catatan, diubah oleh) · **Ringkasan** opsional (per bulan). Baris 1–3 sheet pertama mencantumkan filter export. Nama file `bwi-sim_peserta_2026-09.xlsx`.

## 8. Entitas data
Peserta · Pendaftaran (REG, paket, preferensi, status, verifikator, token link + status link) · Dokumen (jenis, file, versi unggah ulang) · Invoice (nomor, tanggal, total, status, bukti, nominal diterima, selisih, verifikator, refund) · Slot/Sesi (simulator, tanggal, jam, status, REG, instruktur, bay, hasil, riwayat) · Akun admin (peran Admin/Super Admin) · Log aktivitas.

## 9. Hak akses
| Modul | Super Admin | Admin | Peserta |
|---|---|---|---|
| Verifikasi pendaftar | ✓ | ✓ | — |
| Pembayaran | ✓ | ✓ | lihat invoice sendiri |
| Kelola jadwal | ✓ | ✓ | lihat |
| Manajemen akun | ✓ | link peserta saja | — |
| Rekap keuangan | ✓ | — | — |
| Database & export Excel | ✓ | — | — |
| Harga & paket | ✓ | — | — |

## 10. Implementasi teknis mockup (kalau perlu edit)
- Satu file HTML, tanpa library. Layar = `<section class="screen" id="s-{id}">`, navigasi `go(id)` / atribut `data-go`. State global `S={verified,paid,scheduled,assigned,curSimS,curSimA}`; fungsi `approve()`, `markPaid()`, `syncSched()`, `renderAll()`, `renderCal(el,sim,mode)`. Kalender dibangun dari `GRID[sim]` (deterministik via `rnd(seed)`); slot Adi di `ADI=[{d:1,t:1},{d:3,t:1}]`.
- i18n: kamus `EN{}` (ID→EN, ~450 entri) + `EN_RX` (pola dinamis: "Langkah N dari M", "Pilih X", "N dtk lalu", dst.) + `EN_PART` (substitusi parsial hari/bulan). Fungsi `tr()`, `applyLang()` berjalan lewat TreeWalker atas text node + atribut placeholder/title/aria-label, dengan `MutationObserver` untuk node baru. Toggle `.langsw` → `setLang('id'|'en')`, tersimpan di localStorage `bwi-lang`. Toast lewat `tr()`.
- Logo tertanam sebagai data URI PNG (~150 KB). Fonts via Google Fonts.

## 11. PERTANYAAN UNTUK CLIENT (belum dijawab) — kunci sebelum development
Q1 durasi slot & jam operasional (asumsi 2 jam, 06–22) · Q2 nama instruktur ditampilkan ke peserta? (ya) · Q3 jatuh tempo & kedaluwarsa (3 hari, +3) · Q4 PPN? (0) · Q5 kebijakan reschedule <48 jam & no-show (hangus) · Q6 refund pembatalan setelah lunas (per kasus) · Q7 WA otomatis (API) atau manual prefill (manual dulu) · Q8 OTP saat buka link dashboard? (tidak) · Q9 domain & email pengirim (dummy) · Q10 bahasa default publik (ID) · Q11 laporan sesi PDF ke peserta masuk scope? (ya, opsional) · Q12 field tambahan pengajuan lisensi DGCA (sesuai form).

## 12. Langkah berikutnya (belum dikerjakan)
1. Kirim Q1–Q12 ke client; kunci jawaban → update mockup & dokumen alur.
2. Buat **template Excel** database (.xlsx, 4 sheet di atas) begitu field form final.
3. Bila client minta: versi Figma, atau estimasi/arsitektur teknis untuk developer (stack belum ditentukan).
4. Ganti semua dummy (rekening, WA, domain, harga, logo resolusi tinggi) saat data riil tersedia.

## Aturan kerja
Bahasa Indonesia; desain jangan mirip LGTC; tema terang; siswa & instruktur tanpa akun; semua angka/rekening/WA/no. invoice masih dummy dan ditandai "dummy" di UI; konfirmasi ke user sebelum menambah scope di luar flow client.

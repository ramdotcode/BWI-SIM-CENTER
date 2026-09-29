# Serah Terima & Garansi — BWI Sim Center

Dasar: `docs/DEAL_bwi_sim_center_TnC.md` + spec v2.1 bagian 0a. Vendor **Saptaloka Digital** → klien **PT BWI Aviation Indonesia**. Invoice SD/INV/2026/09/001 (Rp 20.000.000 belum pajak; termin 50% mulai / 50% serah terima), garansi 12 bulan sejak tag rilis `v1.0.0`. Kode sumber & desain menjadi milik klien setelah lunas.

> Dokumen ini **tidak** berisi kata sandi/secret. Kredensial diserahkan terpisah (password manager bersama atau berkas terenkripsi), lalu klien wajib mengganti kata sandi admin & merotasi secret setelah serah terima.

---

## 1. Register layanan pihak ketiga

Biaya tahun pertama (1 domain, hosting + database, storage dokumen, email pengirim) termasuk nilai kontrak; **tahun ke-2 dst., upgrade kapasitas, domain tambahan, WA Business API, SSL berbayar dibayar klien**. Vendor mengirim **pengingat perpanjangan 30 hari sebelum jatuh tempo** (isi kolom jatuh tempo di bawah supaya bisa dijadwalkan). Layanan berhenti karena tidak diperpanjang bukan garansi. Semua akun harus **atas nama klien** (email kantor klien sebagai pemilik; vendor cukup sebagai anggota/collaborator dan dikeluarkan setelah garansi).

| Layanan | Fungsi | Paket saat ini | Pemilik akun (harus klien) | Biaya/bln | Tgl mulai | Jatuh tempo / perpanjangan | Batas paket yang perlu dipantau |
|---|---|---|---|---|---|---|---|
| Domain `____` (Q9, dummy `bwi-sim.id`) | alamat web & email | — | ☐ | — | ☐ | ☐ (tahunan) | — |
| Vercel | hosting aplikasi + cron | Hobby → Pro bila komersial | ☐ | ☐ | ☐ | ☐ | Hobby: pemakaian non-komersial, cron hanya dijamin di rentang jam; Pro disarankan untuk produksi |
| Supabase (ref `rxydrqdryeeaqgjyakuf`, Singapura) | database PostgreSQL | Free → Pro | ☐ | ☐ | ☐ | ☐ | Free: 500 MB DB, project dijeda jika tidak aktif 7 hari, **tanpa backup harian** (lihat §4) |
| Cloudflare R2 (bucket `____`) | dokumen, PDF invoice, bukti bayar | pay-as-you-go (free 10 GB) | ☐ | ☐ | ☐ | — | storage > 10 GB / operasi > kuota gratis |
| Resend (atau SMTP lain) | email pengirim `billing@`, `schedule@` | Free | ☐ | ☐ | ☐ | — | Free: 3.000 email/bln, 100/hari; domain pengirim wajib diverifikasi (SPF/DKIM) |
| GitHub (repo `BWI-SIM-CENTER`) | kode sumber | Free | ☐ (transfer ke org/akun klien) | 0 | — | — | — |
| WhatsApp Business API (opsional) | WA otomatis (Q7) | **di luar lingkup** — pekerjaan & biaya tambahan klien | — | — | — | — | — |

**Status saat ini (29 Sep 2026):** Supabase, Vercel, dan GitHub masih dibuat di akun vendor (`ramdotcode`). Sebelum serah terima: transfer kepemilikan (Supabase → *Transfer project* ke organisasi klien; Vercel → *Transfer project* ke team klien; GitHub → *Transfer repository*), atau buat ulang di akun klien lalu migrasikan.

## 2. Checklist serah terima (wajib, spec 0a)

- [ ] **Akses admin**: akun Super Admin atas nama klien dibuat; akun seed dummy (`budi@`, `nadia@`, `reza@bwiaviation.id`) diganti/dinonaktifkan; kata sandi diganti saat login pertama.
- [ ] **Kode sumber**: repo ditransfer/diakses klien; tag `v1.0.0` dibuat pada commit yang lolos UAT.
- [ ] **Kredensial layanan pihak ketiga + jatuh tempo**: tabel §1 terisi lengkap; secret diserahkan terpisah (daftar env di bawah).
- [ ] **Panduan admin**: `docs/PANDUAN-ADMIN.md` (belum dibuat — alur verifikasi, pembayaran, jadwal, maintenance, akun/link peserta, keuangan & export, pengaturan).
- [ ] **Panduan backup/restore**: §4 dokumen ini.
- [ ] **Dokumentasi deploy**: `README.md` bagian "Deploy produksi".
- [ ] Nilai Q1–Q12 dikonfirmasi klien dan diisi di Admin → Pengaturan (tabel di `README.md`); rekening, WA admin, email pengirim, domain riil menggantikan dummy.
- [ ] Data seed dummy (peserta contoh) tidak ada di database produksi (`SEED_DEMO=false`).
- [ ] UAT 10 hari kerja (tanpa temuan tertulis = dianggap diterima; 2 putaran revisi tampilan/teks dalam lingkup) → berita acara serah terima → termin 50% kedua.
- [ ] Klien menerima panduan backup (§4) dan menyatakan bertanggung jawab atas backup data peserta setelah serah terima (UU PDP 27/2022).

Secret yang diserahkan (nilai tidak ditulis di sini): `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `TOKEN_PEPPER`, `JOB_SECRET`, `CRON_SECRET`, `STORAGE_ENCRYPTION_KEY`, `SMTP_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus login dashboard tiap layanan di §1.

> ⚠️ **`TOKEN_PEPPER` dan `STORAGE_ENCRYPTION_KEY` jangan pernah hilang/diganti sembarangan.** `TOKEN_PEPPER` dipakai untuk hash magic link → jika berubah, semua link dashboard peserta mati (harus "Cabut & buat baru" satu per satu). `STORAGE_ENCRYPTION_KEY` mengenkripsi salinan token (fitur "Kirim ulang link") dan file pada driver `local`.

## 3. Aturan masa garansi (12 bulan sejak `v1.0.0`)

- **Lingkup** = mockup klik-klik v2 + Dokumen Alur v1. Di luar itu = pekerjaan tambahan. **Tidak termasuk:** payment gateway, WA Business API otomatis, aplikasi mobile, akun login peserta/instruktur, integrasi pihak ketiga (DGCA/maskapai/akuntansi), konten pemasaran.
- Garansi = perbaikan bug agar sistem berjalan sesuai permintaan awal. **Tidak mengubah struktur data** (skema DB, kolom form, format Excel).
- **Target respons:** 1 hari kerja respons awal · 3 hari kerja kasus kritis · 10 hari kerja non-kritis.
- **Tidak dicakup garansi:** fitur baru, modifikasi oleh klien/pihak lain, gangguan hosting/domain/email/WA, perubahan kebijakan pihak ketiga, kehilangan data tanpa backup klien, peretasan yang bukan karena kode vendor. **Garansi gugur** bila klien memodifikasi kode atau memindah lingkungan (hosting/DB/storage) tanpa pemberitahuan.
- **Skema DB & kolom form terkunci** sejak serah terima. Perubahan hanya lewat **migrasi Prisma berversi** (`prisma/migrations/`) atas **permintaan tertulis + estimasi** (Rp 200.000/jam atau harga paket), disetujui dulu baru dikerjakan; termasuk penyesuaian Dokumen Alur. Pekerjaan tambahan mendapat garansi yang sama sejak serah terimanya.
- Setiap permintaan perubahan dari klien: **buat estimasi dulu, jangan langsung implementasi.**
- Perubahan nilai bisnis (harga paket, jam operasional, jatuh tempo, PPN, rekening, dll.) **bukan** perubahan struktur — klien ubah sendiri di Admin → Pengaturan tanpa deploy.
- Yang belum dikerjakan dalam 7 hari kerja (Tahap 5 lanjutan & Tahap 7) = pekerjaan tambahan bila klien menginginkannya: lihat "Belum dikerjakan" di `README.md` (Q8 OTP WA, WA provider fase 2, generator PDF laporan sesi, dll.).

## 4. Backup & restore

Setelah serah terima, **backup adalah tanggung jawab klien** (data peserta = tanggung jawab klien menurut UU PDP 27/2022; kehilangan data tanpa backup klien tidak dicakup garansi). Bagian ini adalah panduan backup yang wajib diberikan vendor.

### Database (Supabase)
Spec §17 meminta **backup DB harian**. Supabase Free **tidak** menyediakan backup harian yang bisa dipulihkan dari dashboard; Pro menyediakan backup harian 7 hari. Pilih salah satu:
1. **Upgrade Supabase Pro** (disarankan untuk produksi) → Database → Backups; atau
2. **Dump manual/terjadwal** dengan `pg_dump` memakai `DIRECT_URL` (Session pooler, port 5432):

```bash
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges --file "bwi-sim_$(date +%Y%m%d).dump"
```

Simpan hasil dump di lokasi terpisah dari Supabase (mis. bucket R2 kedua yang privat, atau drive kantor klien), simpan minimal 30 hari. Versi `pg_dump` harus ≥ versi Postgres Supabase.

**Restore** ke database kosong (project Supabase baru atau Postgres lain):

```bash
pg_restore --dbname "$DIRECT_URL_BARU" --no-owner --no-privileges --clean --if-exists bwi-sim_YYYYMMDD.dump
```

Lalu `npx prisma migrate status` (harus "up to date"), ganti `DATABASE_URL`/`DIRECT_URL` di Vercel, redeploy. Gunakan **`TOKEN_PEPPER` & `STORAGE_ENCRYPTION_KEY` yang sama** agar link peserta tetap berlaku.

### Dokumen (Cloudflare R2)
R2 tidak mem-backup objek otomatis. Salin berkala ke bucket/lokasi lain, mis. dengan `rclone`:

```bash
rclone sync r2:<bucket-produksi> r2:<bucket-backup> --exclude "incoming/**"
```

Restore = salin balik ke bucket produksi dengan path yang sama (kolom `storage_key`/`pdf_storage_key`/`proof_storage_key` di DB menunjuk path tersebut). PDF invoice juga bisa dibuat ulang dari data DB.

### Uji restore
Minimal sekali sebelum serah terima dan tiap 3 bulan: restore dump terakhir ke database uji, jalankan aplikasi lokal dengan `.env` yang menunjuk ke sana, buka Admin → Database dan satu dashboard peserta.

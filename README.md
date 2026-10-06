# BWI Sim Center

Web booking simulator **FTD Airbus A320 & Boeing 737NG** — PT BWI Aviation Indonesia × Politeknik Penerbangan Indonesia Curug.
Dibangun dari `docs/BUILD-SPEC-v2.md` (handover v2.1) dengan desain dari mockup artifact
[QRcBzXy9465rkrwQVpLRVX](https://claude.ai/artifact/QRcBzXy9465rkrwQVpLRVX).

> **Semua data seed & nilai bisnis default adalah DUMMY.** Nilai bertanda Q1–Q12 menunggu konfirmasi client (lihat tabel di bawah) dan bisa diubah tanpa deploy di **Admin → Pengaturan** (Super Admin).

> **Batasan komersial (`docs/DEAL_bwi_sim_center_TnC.md`):** lingkup = mockup v2 + Dokumen Alur v1; payment gateway, WA Business API, aplikasi mobile, akun peserta, integrasi pihak ketiga di luar lingkup; biaya layanan pihak ketiga tahun pertama ditanggung vendor, semua akun harus atas nama klien, skema DB & kolom form terkunci (perubahan = migrasi berversi + estimasi tertulis dulu), garansi 12 bulan sejak tag `v1.0.0`. Register layanan, checklist serah terima, aturan garansi, dan panduan backup/restore ada di **[`docs/SERAH-TERIMA.md`](docs/SERAH-TERIMA.md)**.

---

## Menjalankan secara lokal

Prasyarat: Node 20+ (diuji di Node 26), Docker.

```bash
docker compose up -d                 # Postgres (127.0.0.1:55433) + Mailpit (SMTP 1026, UI http://localhost:8026)
cp .env.example .env                 # lalu isi AUTH_SECRET, TOKEN_PEPPER, JOB_SECRET, STORAGE_ENCRYPTION_KEY
npm install
npm install-scripts approve @prisma/client @prisma/engines prisma esbuild @swc/core unrs-resolver   # npm ≥ 11
npx prisma migrate deploy
npm run db:seed                      # master data + data contoh DUMMY (SEED_DEMO=false untuk master saja)
npm run dev                          # http://localhost:3100
```

- Login admin seed: `budi@bwiaviation.id` (Super Admin), `nadia@bwiaviation.id` & `reza@bwiaviation.id` (Admin). Kata sandi awal ada di `prisma/seed.ts` (`SEED_ADMIN_PASSWORD`) — **ganti setelah login pertama**.
- Seed mencetak link dashboard peserta contoh (magic link) ke konsol. Semua email (invoice, jadwal, link) bisa dilihat di Mailpit.
- `npm run db:reset` mengulang database + seed.

Skrip lain: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:messages` (memastikan `messages/id.json` = `en.json`), `npm run jobs:run -- <job>`.

## Arsitektur

| Lapisan | Implementasi |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript, `next-intl` (`id` default tanpa prefix, `/en/...`) |
| UI | CSS komponen dari mockup (`app/globals.css`, `@layer components`) + token desain sebagai tema Tailwind v4 |
| DB | PostgreSQL + Prisma 6 (`prisma/schema.prisma`, kolom snake_case = field form = kolom Excel) |
| Auth admin | Sesi JWT HS256 (`jose`) di cookie httpOnly + bcrypt; middleware menjaga `/admin/**`, rute SA-only (`keuangan`, `database`, `pengaturan`) |
| Akses peserta | Magic link `/d/{REG-…}-{random 24 byte}`; hanya hash SHA-256+pepper yang divalidasi; token juga disimpan terenkripsi agar bisa "kirim ulang" (token sama) |
| Pembaruan data | **Default: ambil ulang otomatis tiap 15 menit** (`NEXT_PUBLIC_REFRESH_MINUTES`) + langsung saat tab dibuka kembali; tanpa koneksi terbuka (hemat kuota paket gratis). Mode lama SSE (Postgres `LISTEN/NOTIFY` → `/api/realtime`) tetap tersedia via `NEXT_PUBLIC_REALTIME_MODE=sse` |
| Dokumen | Storage privat: driver `local` (AES-256-GCM at-rest) atau `s3` (SSE); akses via URL bertanda tangan ≤ 5 menit; akses admin dicatat di `activity_log` |
| Email | SMTP (nodemailer), template dwibahasa di `lib/notify/templates.ts`, lampiran PDF invoice/kuitansi & `.ics` |
| WhatsApp | Fase 1 `MANUAL_PREFILL`: notifikasi berstatus `MANUAL` + tautan `wa.me` di panel Ringkasan admin. Fase 2: interface `WaSender` (contoh Fonnte, `WA_PROVIDER=fonnte`, `FONNTE_TOKEN`) |
| PDF | `@react-pdf/renderer` (`lib/pdf/invoice.tsx`), font Barlow/IBM Plex Mono di `assets/fonts`, stempel BELUM DIBAYAR/LUNAS, disimpan ulang tiap status berubah |
| Excel | `exceljs` (`lib/xlsx.ts`), kolom dari satu sumber `lib/columns.ts` |
| Job | `lib/jobs` — cron internal (`ENABLE_INTERNAL_CRON=true`, via `instrumentation.ts`) atau panggil `POST /api/jobs/{nama}` dengan header `X-JOB-SECRET` |

```
app/[locale]/(public)/{page, daftar, daftar/terkirim/[reg_no], d/[token], d/[token]/invoice/[invoice_no], unggah-ulang/[token]}
app/[locale]/admin/{login, (panel)/{page, verifikasi, pembayaran, jadwal, akun, keuangan, database, pengaturan}}
app/api/{public, admin, d, realtime, jobs, files}
lib/{services/*, notify/*, pdf, xlsx, columns, schemas, state-machine, tokens, realtime, storage, settings, format, jobs}
prisma/{schema.prisma, seed.ts} · messages/{id,en}.json · components/{public, participant, admin}
```

Status pendaftaran/invoice/slot hanya berubah lewat `lib/state-machine.ts`. Penomoran `REG-YYYY-NNNN` & `BWI/INV/YYYY/MM/NNNN` atomik (`counters`, `INSERT … ON CONFLICT … RETURNING`), tidak dipakai ulang.

### Job terjadwal (Asia/Jakarta)

| Job | Jadwal (WIB) | Endpoint |
|---|---|---|
| Generate slot 90 hari | 00:10 | `generate-slots` |
| Invoice lewat tempo → OVERDUE → EXPIRED | 00:20 | `expire-invoices` |
| Pengingat H-1 jatuh tempo | 09:00 | `invoice-reminders` |
| Pengingat sesi H-0 / H-1 (WA + dashboard) | 08:00 / 17:00 | `session-reminders-h0` / `-h1` |
| Bersih-bersih (token unggah ulang, unggahan yatim, OTP, retensi dokumen) | 01:30 | `cleanup` |
| Nonaktifkan link peserta selesai/batal > 90 hari | Senin 02:00 | `deactivate-tokens` |

## Deploy produksi: Vercel + Supabase (database) + Cloudflare R2 (dokumen)

Supabase Storage **tidak** dipakai. Driver `local` **tidak boleh** dipakai di Vercel (disk tidak permanen — aplikasi menolak start).

### 1. Supabase — database
Project Settings → Database → **Connect** → Connection string (URI):
- `DATABASE_URL` = **Transaction pooler** (port 6543) + `?pgbouncer=true&connection_limit=5&sslmode=require`
- `DIRECT_URL` = **Session pooler** (port 5432) + `?sslmode=require` — dipakai migrasi Prisma saat build **dan** koneksi `LISTEN` real-time.
- Karakter khusus di password di-URL-encode (`@`→`%40`, `#`→`%23`). Opsional `DB_SSL_CA_PATH` untuk verifikasi sertifikat.
- **Tutup Data API** (Project Settings → Data API): aplikasi tidak memakai anon key; tanpa ini tabel di schema `public` bisa diakses lewat API Supabase.

### 2. Cloudflare R2 — dokumen, PDF invoice, bukti bayar
1. R2 → **Create bucket** (mis. `bwi-docs`), jangan diberi akses publik.
2. R2 → **Manage API tokens** → *Object Read & Write* untuk bucket itu → catat Access Key ID & Secret, serta Account ID.
3. Bucket → Settings → **CORS policy** (browser mengunggah langsung ke R2):
   ```json
   [{ "AllowedOrigins": ["https://<domain-aplikasi>", "https://<project>.vercel.app"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
4. Bucket → Settings → **Object lifecycle rules**: hapus prefix `incoming/` setelah 1 hari (sisa unggahan mentah yang tidak selesai).
5. Env: `STORAGE_DRIVER="s3"`, `S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"`, `S3_REGION="auto"`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (`S3_SSE` kosong).

Alur unggah di mode ini: browser minta URL bertanda tangan → PUT langsung ke R2 (`incoming/…`, ukuran & tipe ikut ditandatangani) → server memvalidasi (mime sniffing, ≤ 5 MB, strip EXIF), menyimpan versi bersih ke `pending/…`, menghapus file mentah. Ini menghindari batas body 4,5 MB fungsi Vercel.

### 3. Vercel — aplikasi
1. Import repo di Vercel (framework Next.js, Node 22+). Build memakai skrip `vercel-build` = `prisma generate && prisma migrate deploy && next build` (migrasi otomatis tiap deploy).
2. Environment Variables (Production & Preview):
   `DATABASE_URL`, `DIRECT_URL`, `APP_URL` (domain final, dipakai di link email), `AUTH_SECRET`, `TOKEN_PEPPER`, `JOB_SECRET`, `CRON_SECRET` (acak; dipakai Vercel Cron), `STORAGE_ENCRYPTION_KEY`, `SMTP_URL` (SMTP riil, mis. Resend), `TZ=Asia/Jakarta`, `ENABLE_INTERNAL_CRON=false`, dan semua `S3_*` di atas.
3. **Cron** sudah didefinisikan di `vercel.json` (jadwal dalam **UTC** = WIB − 7): generate-slots 00:10, expire-invoices 00:20, cleanup 01:30, pengingat sesi 08:00 & 17:00, pengingat invoice 09:00, deactivate-tokens Senin 02:00 (semua WIB). Di paket Hobby, Vercel hanya menjamin cron berjalan dalam rentang jam yang sama.
4. Region fungsi `sin1` (Singapura) — pilih region Supabase yang sama/terdekat (Southeast Asia) agar latensi rendah.
5. Seed pertama kali dari laptop dengan `.env` produksi: `SEED_DEMO=false npm run db:seed` (master data + akun admin; ganti kata sandi admin setelah login).

### Batasan di Vercel yang perlu diketahui
- **Pembaruan data (paket gratis)**: Vercel Hobby memberi fungsi memori tetap 2 GB dan kuota 360 GB-jam/bulan (≈ 6 jam server aktif/hari); memori dihitung selama ada request berjalan. Koneksi SSE yang dibiarkan terbuka (tab admin/TV seharian) akan menghabiskan kuota dan Hobby lalu **menghentikan aplikasi hingga 30 hari**. Karena itu default-nya ambil ulang tiap 15 menit + saat tab dibuka kembali (perkiraan 3 layar TV + 3 admin: < 50 rb invocation & < 10 GB-jam/bulan). Kueri yang diambil ulang (kalender mingguan, Mode Layar) dibuat ramping agar egress Supabase Free (5 GB) aman. Aksi admin sendiri tetap langsung terlihat. Cek **Vercel → Usage** berkala.
- **Rate limit** masih in-memory per instance (lebih longgar di serverless). Untuk produksi ketat, ganti `lib/rate-limit.ts` ke Upstash Redis.
- Notifikasi (PDF + email) dijalankan setelah respons via `after()` (didukung Vercel).
- Backup: Supabase Free **tidak** punya backup harian (Pro: 7 hari); objek R2 tidak ter-backup otomatis. Prosedur `pg_dump`/`rclone` & restore: `docs/SERAH-TERIMA.md` §4.

### Alternatif tanpa Vercel
Server Node biasa (`npm run build && npm start`, Railway/Render/VPS) juga didukung; di sana driver `local` (disk terenkripsi) boleh dipakai asal disk permanen & di-backup.

## Perubahan CR-04 (6 Okt 2026, masukan klien)

| Masukan | Implementasi |
|---|---|
| Kontak darurat tidak perlu | Dihapus dari form, Excel, prefill. Kolom DB dibiarkan (nullable). |
| KTP atau paspor | Pilihan "Jenis identitas": KTP → NIK wajib (paspor opsional); Paspor → no. paspor wajib, NIK kosong. Dokumen identitas wajib mengikuti pilihan. Peserta lama dicocokkan via NIK, atau no. paspor bila tanpa NIK. |
| "Lainnya" = teks bebas | Kewarganegaraan, otoritas penerbit lisensi, type rating "Lainnya" → isian teks; nilai teks disimpan apa adanya. |
| Type rating A320 / B737 / Lainnya | Pilihan ATR 72 & "Belum ada" dihapus (kosong = belum ada). |
| Validity ILP seperti medical; validity lewat tidak bisa lanjut | Kolom baru `icao_valid_until` (wajib untuk Level 4/5, opsional Level 6). Medical/ILP yang sudah lewat **hari ini** memblokir langkah 2 (juga dicek server). Habis sebelum akhir preferensi jadwal → peringatan saja. |
| Lisensi langsung semua halaman | Satu unggahan "Lisensi (semua halaman)" (`LICENCE_FRONT`, disarankan 1 PDF ≤ 5 MB). `LICENCE_RATING` hanya untuk pendaftaran lama. |
| Pilihan simulator tanpa penjelasan | Teks deskripsi A320/B737 dihapus. |
| Sesuaikan paket (PC biasa & stand in) | 6 paket flyer 2026 di `prisma/packages.ts`; **jam simulator masih DUMMY**. Database berjalan: `npx tsx scripts/update-packages-2026.ts` (paket lama dinonaktifkan). |
| Invoice BWI saja, tanpa logo Curug | Logo & kalimat kerja sama Curug dihapus dari PDF invoice dan header email. Alamat di invoice = setting "Alamat perusahaan". |
| Preferensi tanggal sesuai yang sudah dibooking | Kalender ketersediaan per simulator (`/api/public/availability/days`): tanggal penuh & hari libur tidak bisa dipilih, tampil sisa sesi per hari. |
| Data personal + download per orang | Menu SA **Data personal** (`/admin/data-personal`) + tombol di drawer verifikasi: ZIP berisi Excel data diri (pas foto ditempel, riwayat pendaftaran, daftar dokumen) + semua dokumen terbaru per No. Reg. Unduhan dicatat (`export.participant_zip`). |

Juga diperbaiki: pilihan opsional (IR, ICAO, posisi, tujuan sesi) yang dibiarkan kosong sebelumnya ikut dianggap "Wajib diisi".

## Mode Layar (papan jadwal TV, CR-01)

Halaman `/layar/{token}` menampilkan jadwal simulator real-time untuk TV/monitor **tanpa login** (hari ini besar per simulator × sesi + 4 hari kerja berikutnya, jam WIB, tombol layar penuh, layar dijaga tetap menyala, ukuran huruf menyesuaikan layar).
- Link dibuat/disalin/dicabut oleh **Super Admin** di Admin → Manajemen akun → tab **Layar**. Tiap link punya opsi **tampilkan nama** (peserta, paket, instruktur, alasan maintenance); defaultnya **tanpa nama** — server tidak mengirim data pribadi sama sekali untuk link tanpa nama.
- Disimpan di tabel `settings` (`display_links`, hash token + salinan terenkripsi; `display_seen` = terakhir aktif) — tanpa tabel/migrasi baru. Link yang dicabut langsung menampilkan "Link layar tidak aktif".
- Pembaruan: SSE publik memicu ambil ulang data + ambil ulang tiap menit (status berlangsung/lewat, ganti hari).
- Perangkat yang disarankan: Chrome di TV box Android / mini PC (browser bawaan Smart TV sering terbatas).

## Nilai default yang MENUNGGU KONFIRMASI CLIENT (Q1–Q12)

Semua tersimpan di tabel `settings` dan bisa diubah di Admin → Pengaturan.

| # | Setting | Default dummy | Pertanyaan |
|---|---|---|---|
| Q1 | `session_times`, `work_days` | **Dijawab klien 1 Okt 2026:** 07:30–11:30 & 11:45–15:45, Senin–Jumat (1 sesi = 1 slot 4 jam) | Masih dikonfirmasi: 4 jam sudah termasuk briefing? Tanggal merah diblok manual (maintenance) |
| Q2 | `show_instructor_to_participant` | true | Nama instruktur ditampilkan ke peserta? |
| Q3 | `invoice_due_days`, `invoice_expire_days` | 3, 3 | Jatuh tempo & kedaluwarsa? |
| Q4 | `vat_percent` | 0 | PPN? |
| Q5 | `reschedule_free_hours`, `no_show_policy` | 48, `HOURS_FORFEITED` | Kebijakan < 48 jam & no-show? |
| Q6 | `refund_policy` | `PER_CASE` | Refund pembatalan setelah lunas? |
| Q7 | `wa_mode` | `MANUAL_PREFILL` | WA otomatis (API) atau manual? |
| Q8 | `dashboard_otp` | false | OTP saat buka link pertama? (**belum diimplementasikan**) |
| Q9 | `domain`, `sender_email_*` | bwi-sim.id, billing@/schedule@bwiaviation.id | Domain & email pengirim riil? |
| Q10 | `default_locale` | id | Bahasa default publik? |
| Q11 | `session_report_enabled` | true | Laporan sesi PDF ke peserta? (unggah manual oleh admin) |
| Q12 | kolom form | sesuai spec bagian 7 | Field tambahan untuk pengajuan lisensi DGCA? |

Data riil dari klien (6 Okt 2026, contoh invoice & flyer): rekening BCA 4972372777 a.n. PT BWI Trivindo Mandiri, WA admin 0811-1030-1000, alamat Jl. Horizon Broadway Blok M1 No. 11 Cisauk, email kontak business@bwiaviation.com (setting `contact_email`, tampil di invoice; berbeda dari alamat pengirim email), harga paket sesuai flyer. Masih dummy: jam simulator per paket, instruktur & admin seed, retensi dokumen 24 bulan, domain & pengirim email (Q9).

## Keputusan teknis yang berbeda dari spec (perlu diketahui vendor)

1. **Auth admin** memakai JWT `jose` + bcrypt buatan sendiri, bukan Auth.js — cukup untuk 2 peran credentials, lebih sedikit dependensi. Akun nonaktif langsung kehilangan akses (dicek ke DB tiap request).
2. **Unggah dokumen**: "URL bertanda tangan" mengarah ke endpoint server sendiri (`/api/public/uploads/put`, berlaku 10 menit), bukan langsung ke bucket, agar server bisa **mime sniffing, batas 5 MB, dan strip EXIF** sebelum menyimpan.
3. **Template email** berupa fungsi TypeScript (HTML inline-style), bukan React Email/MJML.
4. **Sheet Excel "Peserta" berisi 46 kolom**, bukan 42 seperti mockup: sesuai prinsip "field formulir = kolom Excel", ikut disertakan 5 field preferensi jadwal (sejak CR-04: tanpa 3 kolom kontak darurat, tambah "Identitas" & "ICAO s/d"). Kolom bisa disembunyikan di halaman Database.
5. **Job kedaluwarsa** mengikuti spec (UNPAID/AWAITING lewat tempo → OVERDUE), tetapi invoice yang **sudah punya konfirmasi WA/bukti** tidak otomatis dijadikan EXPIRED — diputuskan admin.
6. **Notifikasi** dikirim setelah respons (`after()` Next.js) agar aksi admin tidak menunggu render PDF/SMTP; setiap kiriman tetap dicatat di `notifications`.
7. Peserta lama (E-08): prefill data diri & lisensi setelah OTP email; **dokumen selalu wajib diunggah baru** per pendaftaran.
8. **Isian "Balai kesehatan penerbangan" (`medical_center`) dihapus dari form & Excel** (1 Okt 2026, masukan penguji: membingungkan, opsional). Kolom database `participants.medical_center` sengaja dibiarkan (nullable, tidak dipakai) agar tidak perlu migrasi.
9. **Pembaruan "real-time" diganti ambil ulang berkala (default 15 menit)** (2 Okt 2026, keputusan user: paket gratis; 2 sesi/hari tidak butuh pembaruan per detik). Spec meminta SSE + fallback polling; SSE tetap tersedia lewat `NEXT_PUBLIC_REALTIME_MODE=sse`. Label "LIVE" diganti "Update otomatis". Mode Layar juga mengambil ulang tepat di jam mulai/selesai sesi & tengah malam.
10. **CR-04 (6 Okt 2026, masukan klien)** — lihat bagian "Perubahan CR-04" di bawah. Kolom `participants.emergency_*` dibiarkan (nullable, tidak dipakai); `nik` boleh kosong untuk pemegang paspor.

## Belum dikerjakan / fase berikutnya

- Q8 OTP WA saat link pertama dibuka; WA provider fase 2 (Fonnte disediakan sebagai contoh, belum diuji dengan akun riil). **Menurut deal, WA Business API otomatis di luar lingkup** → hanya sebagai pekerjaan tambahan berbayar.
- Generator PDF laporan sesi (saat ini admin mengunggah PDF laporan pada "Tandai hasil sesi").
- Email ke admin (pendaftar baru) hanya berbahasa Indonesia.
- Kelengkapan serah terima (spec 0a): `docs/PANDUAN-ADMIN.md`, pengisian register layanan & transfer akun ke klien, backup DB harian terjadwal, tag `v1.0.0` — lihat checklist di `docs/SERAH-TERIMA.md`.
- Uji otomatis (unit/e2e) belum ada; alur 13 langkah & E-01…E-10 diuji manual (lihat di bawah).
- Logo resolusi tinggi/SVG dari client (saat ini PNG hasil ekstrak mockup di `public/brand`).

## Uji end-to-end yang sudah dijalankan (26 Sep 2026, data dummy)

1–3 form 5 langkah (draf localStorage, unggah 5 dokumen) → REG terbit, email + WA manual tercatat · 4–5 checklist wajib → setujui → invoice + PDF terkirim · E-03 nominal kurang tetap "Menunggu verifikasi" → 8 tandai lunas → kuitansi · 9 jadwalkan (isi otomatis 2 slot) → dashboard peserta lain berubah real-time tanpa nama · 10 email jadwal + link + .ics · 11 dashboard peserta (ID/EN, 400 px) · 12 hasil sesi → pendaftaran COMPLETED · 13 export Excel (SA; Admin → 403).
Pengecualian: E-01 tolak → unggah ulang (v2, link sekali pakai) · E-02 kedaluwarsa → aktifkan ulang (nomor sama) · E-05 pindah slot + `slot_history` · E-06 maintenance di slot terisi → peserta kembali ke antrean + notifikasi · E-07 rotasi link (link lama 404) · E-09 batal setelah lunas + refund (rekap menampilkan negatif) · CSRF (origin asing 403), API admin tanpa sesi 401, peserta tidak bisa membuka invoice orang lain.

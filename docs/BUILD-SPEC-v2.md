# HANDOVER v2 — BUILD SPEC: BWI Sim Center (web booking simulator A320/B737)

> Ringkasan padat dari handover v2 yang dikirim user 26 Sep 2026 (bagian 0, 3, 7, 15, 16 hampir verbatim; bagian lain diringkas). Status implementasi & deviasi: lihat `README.md`.
> Tujuan dokumen: **sesi/agen lain membangun web production-ready** dari nol tanpa membaca chat sebelumnya. Update: 26 Sep 2026. Status: desain & alur FINAL di sisi vendor; 12 pertanyaan client (bagian 15) belum dijawab — bangun dengan nilai default di sini, semua nilai itu harus **konfigurable** (env/tabel settings), bukan hardcode.

---

## 0. Ringkasan produk (baca ini dulu)
Web untuk **PT BWI Aviation × PPI Curug** yang menyewakan **1 unit FTD Airbus A320 + 1 unit FTD Boeing 737NG** ke pilot/kadet.
Alur bisnis: peserta isi form (tanpa akun) → admin verifikasi foto dokumen → invoice otomatis ke email → peserta transfer lunas & konfirmasi via WhatsApp → admin tandai lunas → **admin** menjadwalkan slot → email jadwal + **link dashboard pribadi** (magic link) → peserta pantau slot **real-time** → Super Admin lihat rekap keuangan & export Excel.

Prinsip yang tidak boleh dilanggar:
1. **Peserta & instruktur tidak punya akun login.** Peserta mengakses dashboard lewat link bertoken. Hanya Admin & Super Admin yang login.
2. **Admin yang memilih slot.** Peserta hanya mengisi preferensi.
3. **Bayar lunas**, transfer manual, verifikasi manual. Tidak ada payment gateway, DP, cicilan.
4. **Rekap keuangan & export Excel hanya Super Admin.**
5. Field formulir = kolom database = kolom Excel (satu sumber).
6. UI **dwibahasa ID (default) / EN**, tema **terang**, jangan menyerupai LGTC (Lion Group Training Center).

Referensi visual final (WAJIB dibaca sebelum coding UI): mockup klik-klik **https://claude.ai/artifact/QRcBzXy9465rkrwQVpLRVX** (15 layar, HTML tunggal). Dokumen alur naratif: **https://claude.ai/artifact/1pNqeKNzss7qXbJRA6cNep**.

## 1. Stack yang direkomendasikan
Next.js 15 (App Router) + TypeScript · Tailwind CSS + komponen sendiri · PostgreSQL + Prisma · Auth.js credentials + bcrypt (sesi JWT httpOnly) · Magic link token (`access_tokens`) · S3-compatible private bucket + URL bertanda tangan · SMTP/Resend, template dwibahasa · WhatsApp fase 1 `wa.me` prefill (manual), fase 2 provider di balik interface `WaSender` · SSE `/api/realtime` + fallback polling 15 dtk · PDF `@react-pdf/renderer` · Excel `exceljs` · Job via cron → `/api/jobs/*` bersecret · i18n `next-intl` (`id` default, `en`, cookie `NEXT_LOCALE`) · validasi `zod` · deploy Node + Postgres managed, domain dummy `bwi-sim.id`.

## 2. Aset & brand
Logo BWI Aviation (sayap + "BWI" lime `#D9F21F`; versi tema terang "AVIATION" teal) + logo PPI Curug (garuda emas), tampil bersama di landing, email, invoice, sidebar. Nama produk "BWI Sim Center". Footer: "PT BWI Aviation Indonesia × Politeknik Penerbangan Indonesia Curug".

## 3. Design tokens
```
teal #0B3B48 · teal-deep #072A34 · teal-mid #16586A · teal-soft #E4EEF0 · teal-tint #F0F5F6
lime #D9F21F · lime-soft #F4FBBF · lime-ink #4B5800
bg #F3F6F7 · card #FFFFFF · line #D7E0E3 · line-soft #E8EEF0 · ink #112429 · muted #5E7177 · faint #8A9BA0
ok #1E9E68 · warn #D48F00 · bad #D4443C · info #2F7FC1
A320 = teal · B737 = indigo #4557A6
Font: "Barlow Condensed" 600/700 · "Barlow" 400–700 · "IBM Plex Mono". Radius 8/12px. Tema TERANG saja.
Status pill ok/warn/bad/info/neutral/teal. Slot: free (hijau putus-putus) · busy (abu) · mine (teal + garis lime) · maint (kuning bergaris) · past (opacity .45).
```

## 4. Aktor & peran
SUPER_ADMIN (semua + rekap keuangan, export, paket/harga/settings, akun admin, log) · ADMIN (verifikasi, invoice, jadwal & maintenance, hasil sesi, notifikasi, link peserta) · Peserta (tanpa login; form publik; dashboard via token) · Publik (landing, paket, papan ketersediaan tanpa nama).

## 5. Skema database
Tabel: settings, simulators, packages, instructors, admin_users, participants, registrations, documents, invoices, slots (UNIQUE sim+date+start), slot_history, access_tokens, notifications, activity_log, counters. Harga & jam disalin (`*_snapshot`) ke registrations saat daftar. Nomor invoice tidak dipakai ulang.

## 6. Halaman & rute
Publik: `/`, `/daftar`, `/daftar/terkirim/[reg_no]`, `/d/[token]`, `/d/[token]/invoice/[invoice_no]`, `/unggah-ulang/[token]`.
Admin: `/admin/login`, `/admin`, `/admin/verifikasi`, `/admin/pembayaran`, `/admin/jadwal`, `/admin/akun`, `/admin/keuangan` (SA), `/admin/database` (SA), `/admin/pengaturan` (SA).
API: `/api/public/*`, `/api/d/[token]/*`, `/api/admin/*`, `/api/admin/export/{participants,finance}.xlsx` (SA), `/api/realtime` (SSE), `/api/jobs/*` (X-JOB-SECRET).

## 7. Formulir pendaftaran — 5 langkah
1 Data diri (full_name, nik 16 digit, passport_no, birth_place, birth_date, gender, nationality, whatsapp (+62), email, address, city, province, postal_code, emergency_name/relation/phone) · 2 Lisensi & medical (licence_type, licence_no, licence_authority, licence_issued_at, instrument_rating, type_ratings, total_hours, hours_on_type, icao_english, organization, position, medical_class, medical_no, medical_valid_until, medical_center) · 3 Dokumen JPG/PNG/PDF ≤ 5 MB (KTP*, MEDICAL*, LICENCE_FRONT*, LICENCE_RATING*, PHOTO* 4×6 merah, PASSPORT ops.) · 4 Paket & jadwal (simulator, package, pref_date_from/to, pref_time, purpose, notes) · 5 Tinjau & kirim (pernyataan). Peringatan (bukan blokir) jika medical berakhir sebelum pref_date_to. Draf di localStorage. Excel sheet "Peserta": No. Reg, Tgl daftar, semua field (kecuali dokumen), Simulator, Paket, Jam, Harga, Status verif., Status bayar, No. invoice, Tgl lunas, Sesi terjadwal, Akses link.

## 8. Magic link peserta
Token acak ≥ 24 byte, simpan hash SHA-256; format `{reg_no}-{random}` boleh untuk tampilan pendek. Dibuat saat registrasi, dikirim pertama di email jadwal. `opened_at` saat pertama dibuka. Admin: kirim ulang (token sama) / cabut & buat baru. Nonaktif 90 hari setelah COMPLETED/CANCELLED. Rate limit 60 req/menit/IP, `Referrer-Policy: no-referrer`, noindex. Dashboard tidak menampilkan nama peserta lain; dokumen via URL bertanda tangan 5 menit. Opsional Q8: OTP WA.

## 9. Kalender & real-time
Slot dari settings (120 mnt, 06:00–22:00 → 8 slot/hari/sim), job harian 90 hari ke depan. Jumlah slot = hours/(slot_minutes/60). Mingguan Sen–Min, tab simulator, hari ini disorot, lampau dipudarkan. Peserta: Tersedia / Terisi (tanpa nama) / Sesi Anda (+instruktur, Q2) / Maintenance. Admin: nama + instruktur. Setiap mutasi slot → event ke `public`, `admin`, `d:{registration}`; animasi kilat + feed aktivitas; fallback polling 15 dtk; indikator "LIVE · diperbarui X dtk lalu". Modal jadwalkan: peserta PAID/SCHEDULED dengan slot tersisa (simulator sama), instruktur aktif, isi otomatis slot berikutnya hari yang sama, opsi notifikasi. Maintenance di slot terisi: tampilkan terdampak → konfirmasi → lepas, kembali ke antrean (`affected_by_maintenance`), notifikasi. Hasil sesi: COMPLETED menambah progres; NO_SHOW jam hangus (Q5).

## 10. Notifikasi (email + WA), dwibahasa
registration_received · admin_new_registration · documents_rejected (link unggah ulang 7 hari) · invoice_issued (rekening, jatuh tempo, tombol WA prefill, PDF) · invoice_reminder (H-1) · invoice_overdue_admin · payment_verified (kuitansi) · schedule_assigned (kartu sesi, lokasi, hadir 30 mnt, bawa dokumen, link dashboard, .ics) · session_reminder (H-1 & H-0) · schedule_changed · session_completed · link_resent. WA prefill peserta: `Halo Admin BWI, saya {nama} ingin konfirmasi pembayaran invoice {no_invoice} sebesar {total}. Bukti transfer terlampir.` Reschedule: `Halo Admin BWI, saya {nama} ({reg_no}) ingin mengajukan reschedule sesi {tanggal jam}.`

## 11. Invoice
`BWI/INV/YYYY/MM/NNNN` (counter per bulan, atomik), due = issued + invoice_due_days, terbit otomatis saat approve. PDF A4 (logo, penagih, ditagihkan kepada, item, subtotal, PPN, total, rekening, instruksi WA, syarat; stempel BELUM DIBAYAR/LUNAS). Transisi UNPAID → AWAITING_VERIFICATION → PAID; UNPAID/AWAITING → OVERDUE (H+0) → EXPIRED (H+expire) → reactivate (nomor sama) atau CANCELLED. Nominal ≠ total → catat amount_received, tetap AWAITING (E-03). Refund dicatat pada invoice, tampil negatif di rekap.

## 12. Export Excel (SA)
`bwi-sim_{jenis}_{YYYY-MM}.xlsx`; baris 1–3 sheet pertama = filter + waktu export + nama SA. Sheet Peserta (header beku, autofilter, lebar otomatis, dd/mm/yyyy, #,##0), Pembayaran, Sesi, Ringkasan (per bulan: invoice terbit, lunas, nominal lunas, piutang, sesi A320/B737, utilisasi %). Rekap hanya invoice PAID dikurangi refund.

## 13. Job terjadwal
generate-slots 00:10 · invoice-reminders 09:00 · expire-invoices 00:20 · session-reminders 08:00 & 17:00 · deactivate-tokens mingguan · cleanup-reupload-tokens harian.

## 14. i18n
`messages/id.json` & `en.json`; toggle ID/EN di header publik & sidebar admin; cookie. Template email/WA/PDF dua bahasa; peserta memakai `participants.locale`. Format ID `Sel, 29 Sep 2026 · 08.00 WIB`, EN `Tue, 29 Sep 2026 · 08:00 WIB`; rupiah `Rp 12.000.000`.

## 15. Nilai default & pertanyaan client
Q1 slot 120 mnt, 06:00–22:00 · Q2 tampilkan instruktur = true · Q3 due 3 hari, expire 3 hari · Q4 PPN 0 · Q5 reschedule 48 jam, no-show HOURS_FORFEITED · Q6 refund PER_CASE · Q7 WA MANUAL_PREFILL · Q8 OTP false · Q9 bwi-sim.id, billing@/schedule@bwiaviation.id · Q10 id · Q11 laporan sesi true · Q12 kolom form sesuai bagian 7. Dummy: BCA 123-456-7890 a.n. PT BWI Aviation Indonesia; WA admin 0812-3456-7890. Paket (sama A320/B737): PPC 4 jam Rp 12.000.000 · Recurrent 8 jam Rp 22.000.000 · ATPL Skill Test Prep 12 jam Rp 32.000.000 · Type Rating Familiarization 20 jam Rp 52.000.000. Instruktur: Capt. Hendra Wijaya (A320), Capt. Andreas Lim (A320), FO Instr. Bagus Setiawan (B737). Admin: Budi Wahyudi (SA), Nadia Ayu, Reza Saputra. Persona uji: Adi Nugraha Saputra, CPL-2023-014872, NIK 3171021204990003, medical C1 s/d 2027-03-31, PPC A320.

## 16. Pengecualian (uji kasus)
E-01 dokumen ditolak (catatan wajib, link 7 hari, REG sama, reupload_count, ≥3 kontak manual) · E-02 lewat tempo → kedaluwarsa → aktifkan ulang/batalkan · E-03 nominal kurang/lebih · E-04 medical kedaluwarsa sebelum slot (peringatan) · E-05 reschedule via WA (lepas → pilih baru → schedule_changed, slot_history) · E-06 maintenance di slot terisi · E-07 link hilang/bocor · E-08 peserta lama daftar lagi (OTP → prefill; dokumen baru; REG baru; riwayat di admin) · E-09 batal setelah lunas (alasan + refund; slot dilepas) · E-10 no-show.

## 17. Non-fungsional
Dokumen di bucket privat, URL ≤ 5 menit, enkripsi at-rest, log akses admin; hapus otomatis N bulan setelah COMPLETED (default 24). Mime sniffing, ≤ 5 MB, strip EXIF. Zona waktu tunggal Asia/Jakarta. Aksesibilitas (fokus, label, teks di atas lime = teal-deep). Responsif sampai 400 px (kalender ponsel sembunyikan nama, slot 44 px). Semua aksi admin di activity_log. Backup DB harian.

## 18–19. Tahapan & alur 13 langkah
Fondasi → Pendaftaran → Verifikasi → Invoice → Jadwal → Dashboard + SSE + papan publik → Hasil sesi & pengecualian → Keuangan/Database/Excel/Pengaturan → WA fase 2, OTP (Q8), laporan sesi (Q11).
Alur uji: 1 landing → 2 form 5 langkah → 3 REG + notif → 4 approve/reject → 5 invoice otomatis → 6 email invoice + WA prefill → 7 konfirmasi WA dicatat → 8 tandai lunas → 9 jadwalkan (real-time) → 10 email jadwal + link + .ics → 11 dashboard live → 12 hasil sesi → 13 rekap & export.

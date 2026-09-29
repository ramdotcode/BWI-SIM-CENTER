# DEAL: BWI Sim Center — komitmen komersial (invoice Saptaloka Digital → PT BWI Aviation)

Dibuat 29 Sep 2026, FINAL 29 Sep 2026. Vendor: Saptaloka Digital (Barra, Bandung). Invoice SD/INV/2026/09/001 tgl 29 Sep 2026. Nilai: Rp 20.000.000 (belum pajak). Termin 50% mulai / 50% serah terima. Dokumen T&C final (PDF+DOCX berkop) sudah dikirim ke user. File ini ringkasan untuk pembangun; yang mengikat adalah dokumen T&C berkop.

## Komitmen yang mengikat pekerjaan pembangunan (WAJIB dipatuhi agen yang membangun web)

- **Lingkup** = mockup klik-klik v2 + Dokumen Alur v1 (lihat `docs/BUILD-SPEC-v2.md`). Di luar itu = pekerjaan tambahan berbayar.
- **Tidak termasuk:** payment gateway, WA Business API otomatis, aplikasi mobile, akun login peserta/instruktur, integrasi pihak ketiga (DGCA/maskapai/akuntansi), konten pemasaran.
- **Estimasi pengerjaan:** 7 hari kerja sejak desain disetujui tertulis DAN materi klien lengkap (logo HD, rekening, WA admin, domain, paket & harga final, jawaban Q1–Q12). → Prioritaskan Tahap 1–4 & 6 dari handover; Tahap 5 (pengecualian lanjutan) & 7 (WA API, OTP) hanya jika waktu tersisa atau sebagai pekerjaan tambahan.
- **Biaya pihak ketiga TAHUN PERTAMA** sudah termasuk dalam Rp 20 jt (tanpa batas nominal tertulis): 1 domain, hosting/server + database sesuai spesifikasi vendor, storage dokumen, layanan email pengirim. Semua atas nama klien, akses diserahkan saat serah terima. → Pembangun: pilih layanan hemat dengan tier yang bisa naik (Vercel Hobby/Pro, Neon/Supabase free→pro, R2, Resend free tier); catat kredensial & jatuh tempo di dokumen serah terima.
- **Tahun kedua dst.**, upgrade kapasitas, domain tambahan, WA Business API, SSL berbayar → dibebankan ke klien. Vendor mengirim pengingat perpanjangan 30 hari sebelum jatuh tempo. Layanan berhenti karena tidak diperpanjang = bukan garansi.
- **Garansi 12 bulan** sejak serah terima: perbaikan bug agar sistem berjalan sesuai permintaan awal. Perbaikan garansi tidak mengubah struktur data (skema DB, kolom form, format Excel).
- **Target respons garansi:** 1 hari kerja respons awal; 3 hari kerja kritis; 10 hari kerja non-kritis.
- **Garansi tidak mencakup:** fitur baru, modifikasi oleh klien/pihak lain, gangguan hosting/domain/email/WA, perubahan kebijakan pihak ketiga, kehilangan data tanpa backup klien, peretasan bukan karena kode vendor. Gugur bila klien memodifikasi kode / pindah lingkungan tanpa pemberitahuan.
- **UAT** 10 hari kerja; tanpa temuan tertulis = dianggap diterima. 2 putaran revisi tampilan/teks dalam lingkup.
- **Pekerjaan tambahan (pasal 7):** permintaan dikomunikasikan tertulis dulu → vendor beri estimasi waktu & biaya → dikerjakan setelah disetujui → tarif Rp 200.000/jam atau harga paket; perubahan struktur data termasuk penyesuaian dokumen alur & migrasi; pekerjaan tambahan dapat garansi sama sejak serah terimanya.
- **Kode sumber & desain** menjadi milik klien setelah lunas; vendor boleh pakai ulang komponen generik & cantumkan portofolio.
- **Data peserta** = tanggung jawab klien (UU PDP 27/2022); klien wajib backup setelah serah terima, vendor beri panduan backup.
- **Batas tanggung jawab** vendor = nilai yang telah dibayar. Perselisihan → musyawarah 30 hari → Pengadilan Negeri Tangerang.

## Implikasi teknis untuk pembangun

1. Kunci skema DB & kolom form sejak Tahap 1; perubahan setelah serah terima harus lewat migrasi berversi dan permintaan tertulis + estimasi (pasal 7).
2. Semua nilai bisnis di tabel `settings` (agar perubahan konfigurasi tidak dihitung "ubah struktur data").
3. Sertakan panduan backup + restore, dokumentasi deploy, dan daftar layanan pihak ketiga (akun, biaya, jatuh tempo perpanjangan) di serah terima.
4. Catat versi rilis (`v1.0.0` saat serah terima) sebagai titik awal garansi.
5. Jadwal 7 hari kerja: H1 fondasi+skema+auth · H2 form+unggah+verifikasi · H3 invoice+PDF+email · H4 kalender admin+penjadwalan · H5 dashboard peserta+SSE+magic link · H6 keuangan+database+Excel+i18n EN · H7 pengecualian inti (E-01, E-02, E-05, E-06), seed, deploy, UAT prep.
6. Setiap permintaan perubahan dari klien selama garansi: buat estimasi jam × Rp 200.000 sebelum mengerjakan; jangan langsung implementasi.

Status pemenuhan di repo: `docs/SERAH-TERIMA.md`.

// Seed BWI Sim Center. SEMUA data di sini DUMMY (label "[DUMMY]") — ganti dengan data riil client.
// Jalankan: npm run db:seed   (SEED_DEMO=false untuk hanya master data tanpa peserta contoh)
import "dotenv/config";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { PrismaClient, type DocumentKind, type Prisma } from "@prisma/client";
import { SETTING_DEFAULTS, slotStarts } from "../lib/settings";
import { encryptString, hashToken, randomToken } from "../lib/crypto";
import { addDays, dateOnly, todayJkt, wibInstant, ymd } from "../lib/format";
import { storage } from "../lib/storage";

const db = new PrismaClient();
const DEMO = process.env.SEED_DEMO !== "false";

// Kata sandi awal admin (DUMMY, wajib diganti setelah login pertama di produksi).
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "BwiSim-Dummy-2026!";

const PACKAGES = [
  {
    code: "ppc", sort: 1, hours: 4, price: 12_000_000n, highlight: false,
    name_id: "PPC – Pilot Proficiency Check", name_en: "PPC – Pilot Proficiency Check", short_id: "PPC", short_en: "PPC",
    description_id: "Untuk perpanjangan/pemeriksaan kecakapan. 2 sesi × 2 jam, termasuk briefing & debriefing.",
    description_en: "For proficiency renewal/check. 2 sessions × 2 h, including briefing & debriefing.",
    bullets_id: ["2 sesi × 2 jam", "Briefing 30 mnt/sesi", "Instruktur type-rated", "Laporan sesi digital"],
    bullets_en: ["2 sessions × 2 h", "30-min briefing per session", "Type-rated instructor", "Digital session report"],
  },
  {
    code: "rec", sort: 2, hours: 8, price: 22_000_000n, highlight: true,
    name_id: "Recurrent Training", name_en: "Recurrent Training", short_id: "Recurrent", short_en: "Recurrent",
    description_id: "Penyegaran prosedur normal & abnormal.", description_en: "Refresher on normal & abnormal procedures.",
    bullets_id: ["4 sesi × 2 jam", "Skenario abnormal/emergency", "LOFT 1 sesi", "Laporan sesi digital"],
    bullets_en: ["4 sessions × 2 h", "Abnormal/emergency scenarios", "1 LOFT session", "Digital session report"],
  },
  {
    code: "atpl", sort: 3, hours: 12, price: 32_000_000n, highlight: false,
    name_id: "ATPL Skill Test Preparation", name_en: "ATPL Skill Test Preparation", short_id: "ATPL Prep", short_en: "ATPL Prep",
    description_id: "Persiapan skill test ATPL / seleksi maskapai.", description_en: "Preparation for ATPL skill test / airline screening.",
    bullets_id: ["6 sesi × 2 jam", "Profil ujian DGCA", "Mock check ride", "Debrief video"],
    bullets_en: ["6 sessions × 2 h", "DGCA test profile", "Mock check ride", "Video debrief"],
  },
  {
    code: "trf", sort: 4, hours: 20, price: 52_000_000n, highlight: false,
    name_id: "Type Rating Familiarization", name_en: "Type Rating Familiarization", short_id: "TR Fam", short_en: "TR Fam",
    description_id: "Pengenalan sistem & prosedur sebelum type rating.", description_en: "Systems & procedures introduction before type rating.",
    bullets_id: ["10 sesi × 2 jam", "Ground briefing FCOM", "Normal procedures lengkap", "Sertifikat kehadiran"],
    bullets_en: ["10 sessions × 2 h", "FCOM ground briefing", "Complete normal procedures", "Certificate of attendance"],
  },
];

async function master() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }
  for (const s of [
    { code: "A320", name: "Airbus A320 FTD", bay: "Bay 1", level: "FTD Level 5" },
    { code: "B737", name: "Boeing 737NG FTD", bay: "Bay 2", level: "FTD Level 5" },
  ]) await db.simulator.upsert({ where: { code: s.code }, create: s, update: {} });
  for (const p of PACKAGES) {
    const { price, ...rest } = p;
    await db.package.upsert({ where: { code: p.code }, create: { ...rest, price_idr: price }, update: {} });
  }
  if ((await db.instructor.count()) === 0) {
    await db.instructor.createMany({
      data: [
        { name: "Capt. Hendra Wijaya", simulator_codes: ["A320"] },
        { name: "Capt. Andreas Lim", simulator_codes: ["A320"] },
        { name: "FO Instr. Bagus Setiawan", simulator_codes: ["B737"] },
      ],
    });
  }
  const hash = await bcrypt.hash(SEED_PASSWORD, 12);
  for (const a of [
    { name: "Budi Wahyudi", email: "budi@bwiaviation.id", role: "SUPER_ADMIN" as const },
    { name: "Nadia Ayu", email: "nadia@bwiaviation.id", role: "ADMIN" as const },
    { name: "Reza Saputra", email: "reza@bwiaviation.id", role: "ADMIN" as const },
  ]) await db.adminUser.upsert({ where: { email: a.email }, create: { ...a, password_hash: hash }, update: {} });
}

// ---------------- DEMO ----------------
type P = {
  name: string; nik: string; email: string; wa: string; city: string; prov: string; born: string; place: string; g: "M" | "F";
  lic: "CPL" | "ATPL" | "PPL" | "MPL" | "SPL"; licNo: string; hours: string; org: string; pos: string; med: string; loc?: "id" | "en"; tr?: string[];
};
const PEOPLE: P[] = [
  { name: "Adi Nugraha Saputra", nik: "3171021204990003", email: "adi.nugraha@mail.com", wa: "+6281298765432", city: "Jakarta Selatan", prov: "DKI Jakarta", born: "1999-04-12", place: "Jakarta", g: "M", lic: "CPL", licNo: "CPL-2023-014872", hours: "312.5", org: "PPI Curug – Alumni 2023", pos: "FRESH_GRADUATE", med: "2027-03-31" },
  { name: "Dinda Larasati", nik: "3275014508980002", email: "dinda.l@mail.com", wa: "+6281522334455", city: "Bekasi", prov: "Jawa Barat", born: "1998-08-05", place: "Bekasi", g: "F", lic: "CPL", licNo: "CPL-2022-011203", hours: "540", org: "Ex-Susi Air", pos: "FO", med: "2027-01-12" },
  { name: "Bagas Wicaksono", nik: "3374091201900001", email: "bagas.w@mail.com", wa: "+6281988776655", city: "Semarang", prov: "Jawa Tengah", born: "1990-01-12", place: "Semarang", g: "M", lic: "ATPL", licNo: "ATPL-2019-002211", hours: "4210", org: "Wings Air", pos: "CAPTAIN", med: "2026-09-30", tr: ["ATR72"] },
  { name: "Kevin Halim", nik: "3173052207970004", email: "kevin.h@mail.com", wa: "+6281766554433", city: "Jakarta Utara", prov: "DKI Jakarta", born: "1997-07-22", place: "Jakarta", g: "M", lic: "CPL", licNo: "CPL-2024-016690", hours: "256", org: "BIFA Bali", pos: "FRESH_GRADUATE", med: "2027-06-05", loc: "en" },
  { name: "Yoga Prasetyo", nik: "3273241509950002", email: "yoga.p@mail.com", wa: "+6282133445566", city: "Bandung", prov: "Jawa Barat", born: "1995-09-15", place: "Bandung", g: "M", lic: "CPL", licNo: "CPL-2020-008120", hours: "1120", org: "Freelance", pos: "FRESH_GRADUATE", med: "2027-02-15" },
  { name: "Sari Wulandari", nik: "3578011103960003", email: "sari.w@mail.com", wa: "+6281399887766", city: "Surabaya", prov: "Jawa Timur", born: "1996-03-11", place: "Surabaya", g: "F", lic: "CPL", licNo: "CPL-2021-009874", hours: "780.5", org: "Ex-Citilink cadet", pos: "FO", med: "2026-11-20" },
  { name: "Rizky Pratama", nik: "3171100107940001", email: "rizky.p@mail.com", wa: "+6281212123434", city: "Jakarta Selatan", prov: "DKI Jakarta", born: "1994-07-01", place: "Jakarta", g: "M", lic: "CPL", licNo: "CPL-2019-006543", hours: "1560", org: "Ex-TransNusa", pos: "FO", med: "2027-02-28" },
  { name: "Fajar Ramadhan", nik: "3603102003930005", email: "fajar.r@mail.com", wa: "+6285811223344", city: "Tangerang", prov: "Banten", born: "1993-03-20", place: "Tangerang", g: "M", lic: "ATPL", licNo: "ATPL-2021-003102", hours: "3480", org: "Ex-Sriwijaya", pos: "FO", med: "2027-04-10", tr: ["B737NG"] },
  { name: "Maya Kusuma", nik: "3201015506960001", email: "maya.k@mail.com", wa: "+6281355667788", city: "Bogor", prov: "Jawa Barat", born: "1996-06-15", place: "Bogor", g: "F", lic: "CPL", licNo: "CPL-2022-012377", hours: "690", org: "Ex-Lion cadet", pos: "FO", med: "2027-05-01" },
  { name: "Putri Anggraini", nik: "3172016012970002", email: "putri.a@mail.com", wa: "+6281277665544", city: "Jakarta Timur", prov: "DKI Jakarta", born: "1997-12-20", place: "Jakarta", g: "F", lic: "CPL", licNo: "CPL-2023-015501", hours: "402", org: "PPI Curug – Alumni 2022", pos: "FRESH_GRADUATE", med: "2027-01-30" },
];
const EXTRA_NAMES = ["Reza Firmansyah", "Andi Setiadi", "Nurul Hidayah", "Dimas Aryo", "Laras Putri", "Hafiz Maulana", "Citra Dewi", "Galih Pratama", "Intan Permata", "Joko Susilo", "Kurnia Sari", "Lutfi Hakim", "Mega Lestari", "Novan Saputra", "Oki Wijaya", "Prita Maharani", "Rangga Aditya", "Sinta Rahayu", "Taufik Hidayat", "Umar Said", "Vina Oktaviani", "Wahyu Nugroho", "Yuni Kartika", "Zaki Ramadhan"];

async function placeholder(kind: DocumentKind, name: string) {
  const label = { KTP: "KTP", MEDICAL: "MEDICAL CLASS 1", LICENCE_FRONT: "LICENCE · FRONT", LICENCE_RATING: "LICENCE · RATING", PHOTO: "PAS FOTO 4×6", PASSPORT: "PASSPORT" }[kind];
  const bg = kind === "PHOTO" ? "#C7362F" : "#DCE7EA";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="570"><rect width="100%" height="100%" rx="24" fill="${bg}"/><rect x="30" y="30" width="840" height="510" rx="18" fill="none" stroke="#0B3B48" stroke-width="4" stroke-dasharray="14 10"/><text x="60" y="110" font-family="Helvetica" font-size="44" font-weight="700" fill="#0B3B48">${label}</text><text x="60" y="180" font-family="Helvetica" font-size="32" fill="#16586A">${name}</text><text x="60" y="500" font-family="Helvetica" font-size="26" fill="#D4443C">DOKUMEN DUMMY — BUKAN DATA ASLI</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

async function demo() {
  if ((await db.registration.count()) > 0) {
    console.log("• Data demo sudah ada, dilewati (jalankan npm run db:reset untuk mengulang).");
    return;
  }
  const s = SETTING_DEFAULTS;
  const today = todayJkt();
  const sims = Object.fromEntries((await db.simulator.findMany()).map((x) => [x.code, x]));
  const pkgs = Object.fromEntries((await db.package.findMany()).map((x) => [x.code, x]));
  const ins = await db.instructor.findMany({ orderBy: { id: "asc" } });
  const insFor = (sim: string, i = 0) => { const l = ins.filter((x) => x.simulator_codes.includes(sim)); return l[i % l.length]!; };
  const admins = await db.adminUser.findMany({ orderBy: { id: "asc" } });
  const nadia = admins[1]!.id;
  const starts = slotStarts(s);

  // Slot: 1 Jan tahun ini s/d +90 hari
  const year = today.slice(0, 4);
  const from = `${year}-01-01`, to = addDays(today, s.slot_horizon_days);
  const data: Prisma.SlotCreateManyInput[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) for (const sim of Object.values(sims)) for (const t of starts) data.push({ simulator_id: sim.id, date: dateOnly(d), start_time: t.start, end_time: t.end });
  await db.slot.createMany({ data, skipDuplicates: true });

  let regN = 0;
  const invN: Record<string, number> = {};
  const links: string[] = [];

  async function makeParticipant(p: P) {
    return db.participant.create({
      data: {
        full_name: p.name, nik: p.nik, passport_no: null, birth_place: p.place, birth_date: dateOnly(p.born), gender: p.g, nationality: "ID",
        whatsapp: p.wa, email: p.email, address: `Jl. Contoh No. ${p.nik.slice(-2)} [DUMMY]`, city: p.city, province: p.prov, postal_code: "12730",
        emergency_name: "Kontak Darurat [DUMMY]", emergency_relation: "PARENT", emergency_phone: "+6281311223344",
        licence_type: p.lic, licence_no: p.licNo, licence_authority: "DGCA", licence_issued_at: dateOnly("2022-08-15"), instrument_rating: "VALID",
        type_ratings: p.tr ?? [], total_hours: p.hours, hours_on_type: p.tr?.length ? "1900" : "0", icao_english: "L4", organization: p.org, position: p.pos,
        medical_class: "C1", medical_no: `MED-1-2026-${p.nik.slice(-5)}`, medical_valid_until: dateOnly(p.med), medical_center: "Balai Kesehatan Penerbangan Jakarta", locale: p.loc ?? "id",
      },
    });
  }

  async function makeReg(o: {
    p: P; sim: "A320" | "B737"; pkg: string; createdAt: Date; status: Prisma.RegistrationCreateInput["status"]; invoice?: { status: Prisma.InvoiceCreateInput["status"]; issued: Date; paid?: Date; wa?: Date; overdue?: boolean };
    slots?: { date: string; start: string; status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" }[]; scheduleSent?: boolean; reupload?: { kinds: DocumentKind[]; note: string }; pref?: [string, string]; prefTime?: "MORNING" | "AFTERNOON" | "EVENING" | "FLEXIBLE"; opened?: boolean; notes?: string;
  }) {
    const part = (await db.participant.findUnique({ where: { nik: o.p.nik } })) ?? (await makeParticipant(o.p));
    const pkg = pkgs[o.pkg]!;
    const reg_no = `REG-${year}-${String(++regN + 870).padStart(4, "0")}`;
    const reg = await db.registration.create({
      data: {
        reg_no, participant_id: part.id, simulator_id: sims[o.sim]!.id, package_id: pkg.id, hours_snapshot: pkg.hours, price_snapshot: pkg.price_idr, package_name_snapshot: pkg.name_id,
        pref_date_from: o.pref ? dateOnly(o.pref[0]) : null, pref_date_to: o.pref ? dateOnly(o.pref[1]) : null, pref_time: o.prefTime ?? "MORNING", purpose: o.pkg === "ppc" ? "PPC" : o.pkg === "rec" ? "RECURRENT" : o.pkg === "atpl" ? "SKILL_TEST" : "FAMILIARIZATION",
        notes: o.notes ?? "[DUMMY] data contoh seed", status: o.status!, created_at: o.createdAt, verified_by: o.status === "PENDING_VERIFICATION" ? null : nadia,
        verified_at: o.status === "PENDING_VERIFICATION" ? null : new Date(o.createdAt.getTime() + 10 * 3600_000), schedule_sent_at: o.scheduleSent ? new Date(o.createdAt.getTime() + 30 * 3600_000) : null,
        rejection_note: o.reupload?.note ?? null, reupload_count: o.reupload ? 1 : 0,
      },
    });
    for (const kind of ["KTP", "MEDICAL", "LICENCE_FRONT", "LICENCE_RATING", "PHOTO"] as DocumentKind[]) {
      const key = `documents/${reg.id}/${kind.toLowerCase()}-v1.jpg`;
      await storage.put(key, await placeholder(kind, o.p.name), "image/jpeg");
      const rejected = o.reupload?.kinds.includes(kind);
      await db.document.create({ data: { registration_id: reg.id, kind, storage_key: key, original_name: `${kind.toLowerCase()}_${o.p.name.split(" ")[0]!.toLowerCase()}.jpg`, mime: "image/jpeg", size: 48_000, review: o.status === "PENDING_VERIFICATION" ? "PENDING" : rejected ? "REJECTED" : "OK", review_note: rejected ? o.reupload!.note : null, uploaded_at: o.createdAt } });
    }
    const raw = `${reg_no}-${randomToken(24)}`;
    await db.accessToken.create({ data: { registration_id: reg.id, purpose: "DASHBOARD", token_hash: hashToken(raw), token_enc: encryptString(raw), created_at: o.createdAt, opened_at: o.opened ? new Date() : null, last_seen_at: o.opened ? new Date() : null } });
    if (!o.p.email.endsWith("@mail.dummy") && (o.scheduleSent || o.status === "PENDING_VERIFICATION")) links.push(`${o.p.name.padEnd(22)} ${reg_no}  ${process.env.APP_URL ?? "http://localhost:3100"}/d/${raw}`);
    if (o.reupload) {
      const r2 = `${reg_no}-${randomToken(24)}`;
      await db.accessToken.create({ data: { registration_id: reg.id, purpose: "REUPLOAD", token_hash: hashToken(r2), token_enc: encryptString(r2), expires_at: new Date(Date.now() + 7 * 86400_000) } });
      links.push(`${o.p.name.padEnd(22)} unggah ulang  ${process.env.APP_URL ?? "http://localhost:3100"}/unggah-ulang/${r2}`);
    }
    if (o.invoice) {
      const iso = ymd(new Date(o.invoice.issued.getTime() + 7 * 3600_000));
      const mk = iso.slice(0, 7);
      invN[mk] = (invN[mk] ?? 0) + 1;
      const invoice_no = `BWI/INV/${iso.slice(0, 4)}/${iso.slice(5, 7)}/${String(invN[mk]! + (mk === today.slice(0, 7) ? 30 : 0)).padStart(4, "0")}`;
      const paid = o.invoice.status === "PAID";
      await db.invoice.create({
        data: {
          invoice_no, registration_id: reg.id, issued_at: o.invoice.issued, due_at: new Date(wibInstant(addDays(iso, s.invoice_due_days), "23:59").getTime() + 59_000),
          subtotal: pkg.price_idr, vat: 0n, total: pkg.price_idr, status: o.invoice.status!, wa_confirmed_at: o.invoice.wa ?? (paid ? o.invoice.paid : null),
          amount_received: paid ? pkg.price_idr : null, paid_at: o.invoice.paid ?? null, verified_by: paid ? (regN % 2 ? nadia : admins[2]!.id) : null,
          overdue_at: o.invoice.overdue ? new Date() : null, note: "[DUMMY]",
        },
      });
    }
    let k = 0;
    for (const sl of o.slots ?? []) {
      // Cari slot kosong mulai dari jam yang diminta (hindari bentrok antar data contoh).
      let target = null;
      for (let dd = 0; dd < 5 && !target; dd++) {
        target = await db.slot.findFirst({ where: { simulator_id: sims[o.sim]!.id, date: dateOnly(addDays(sl.date, dd)), start_time: { gte: dd ? "06:00" : sl.start }, status: "AVAILABLE" }, orderBy: { start_time: "asc" } });
      }
      if (!target) continue;
      await db.slot.update({
        where: { id: target.id },
        data: { status: sl.status, registration_id: reg.id, instructor_id: insFor(o.sim, k++ % 2 === 0 ? 0 : regN).id, updated_by: nadia, result_note: sl.status === "COMPLETED" ? "[DUMMY] Sesi berjalan baik." : null },
      });
    }
    return reg;
  }

  const ago = (days: number, hh = "10:00") => wibInstant(addDays(today, -days), hh);
  const mon = (() => { const d = dateOnly(today); const dow = (d.getUTCDay() + 6) % 7; return addDays(today, -dow); })();
  const nextMon = addDays(mon, 7);

  // Riwayat bulan-bulan sebelumnya (untuk rekap keuangan): pendaftaran selesai & lunas.
  const month = Number(today.slice(5, 7));
  const pkgCycle = ["ppc", "rec", "ppc", "atpl", "rec", "trf", "ppc", "rec", "atpl", "ppc"];
  let e = 0;
  for (let m = 1; m < month; m++) {
    const perMonth = 3 + ((m * 7) % 4);
    for (let i = 0; i < perMonth; i++, e++) {
      const nm = EXTRA_NAMES[e % EXTRA_NAMES.length]! + (e >= EXTRA_NAMES.length ? ` ${Math.floor(e / EXTRA_NAMES.length) + 1}` : "");
      const p: P = { name: nm, nik: `3${String(100000000000000 + e * 7919).slice(0, 15)}`, email: `${nm.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.dummy`, wa: `+62812${String(10000000 + e * 131).slice(0, 8)}`, city: "Jakarta", prov: "DKI Jakarta", born: "1995-05-05", place: "Jakarta", g: e % 3 ? "M" : "F", lic: "CPL", licNo: `CPL-2021-${String(10000 + e)}`, hours: String(300 + e * 17), org: "[DUMMY]", pos: "FO", med: "2027-06-30" };
      const d0 = `${year}-${String(m).padStart(2, "0")}-${String(2 + i * 4).padStart(2, "0")}`;
      const sim = e % 5 < 3 ? "A320" : "B737";
      const pk = pkgCycle[e % pkgCycle.length]!;
      const nSlots = pkgs[pk]!.hours / 2;
      const slots = Array.from({ length: nSlots }, (_, j) => ({ date: addDays(d0, 3 + Math.floor(j / 2)), start: starts[1 + (j % 2) + (e % 4)]!.start, status: "COMPLETED" as const }));
      await makeReg({ p, sim, pkg: pk, createdAt: wibInstant(d0, "09:00"), status: "COMPLETED", invoice: { status: "PAID", issued: wibInstant(d0, "14:00"), paid: wibInstant(addDays(d0, 1), "10:00") }, slots, scheduleSent: true });
    }
  }

  // Putri — selesai bulan lalu
  await makeReg({ p: PEOPLE[9]!, sim: "B737", pkg: "ppc", createdAt: ago(40), status: "COMPLETED", invoice: { status: "PAID", issued: ago(39), paid: ago(38) }, slots: [{ date: addDays(today, -33), start: "08:00", status: "COMPLETED" }, { date: addDays(today, -32), start: "08:00", status: "COMPLETED" }], scheduleSent: true, opened: true });
  // Fajar — B737 Recurrent, 2 selesai + 2 mendatang, jadwal terkirim
  await makeReg({ p: PEOPLE[7]!, sim: "B737", pkg: "rec", createdAt: ago(10), status: "IN_PROGRESS", invoice: { status: "PAID", issued: ago(9), paid: ago(9, "15:00") }, slots: [{ date: addDays(today, -2), start: "14:00", status: "COMPLETED" }, { date: addDays(today, -1), start: "12:00", status: "COMPLETED" }, { date: addDays(nextMon, 3), start: "14:00", status: "SCHEDULED" }, { date: addDays(nextMon, 4), start: "14:00", status: "SCHEDULED" }], scheduleSent: true, opened: true });
  // Maya — B737 ATPL Prep, 6 slot mendatang
  await makeReg({ p: PEOPLE[8]!, sim: "B737", pkg: "atpl", createdAt: ago(11), status: "SCHEDULED", invoice: { status: "PAID", issued: ago(10), paid: ago(8) }, slots: [0, 1, 2].flatMap((d) => [{ date: addDays(nextMon, d), start: "10:00", status: "SCHEDULED" as const }, { date: addDays(nextMon, d), start: "12:00", status: "SCHEDULED" as const }]), scheduleSent: true, opened: true });
  // Rizky — PPC A320, 1/2 selesai
  await makeReg({ p: PEOPLE[6]!, sim: "A320", pkg: "ppc", createdAt: ago(8), status: "IN_PROGRESS", invoice: { status: "PAID", issued: ago(8, "15:00"), paid: ago(7) }, slots: [{ date: addDays(today, -1), start: "08:00", status: "COMPLETED" }], scheduleSent: true, opened: true });
  // Sari — A320 TR Fam 20 jam, 4/10 slot
  await makeReg({ p: PEOPLE[5]!, sim: "A320", pkg: "trf", createdAt: ago(4), status: "IN_PROGRESS", invoice: { status: "PAID", issued: ago(4, "12:00"), paid: ago(4, "16:00") }, slots: [{ date: addDays(today, -2), start: "10:00", status: "COMPLETED" }, { date: addDays(today, -1), start: "10:00", status: "COMPLETED" }, { date: addDays(nextMon, 1), start: "14:00", status: "SCHEDULED" }, { date: addDays(nextMon, 2), start: "14:00", status: "SCHEDULED" }], scheduleSent: true, opened: true });
  // Yoga — invoice lewat tempo
  await makeReg({ p: PEOPLE[4]!, sim: "A320", pkg: "rec", createdAt: ago(6), status: "PENDING_PAYMENT", invoice: { status: "OVERDUE", issued: ago(5), overdue: true } });
  // Kevin — sudah konfirmasi WA, menunggu verifikasi bayar (EN)
  await makeReg({ p: PEOPLE[3]!, sim: "B737", pkg: "ppc", createdAt: ago(3), status: "PENDING_PAYMENT", invoice: { status: "AWAITING_VERIFICATION", issued: ago(2), wa: ago(1, "16:40") }, pref: [addDays(today, 3), addDays(today, 20)] });
  // Bagas — dokumen ditolak (E-01), medical hampir habis (E-04)
  await makeReg({ p: PEOPLE[2]!, sim: "A320", pkg: "rec", createdAt: ago(1, "07:52"), status: "REUPLOAD_REQUIRED", reupload: { kinds: ["LICENCE_RATING"], note: "Foto lisensi halaman rating buram, mohon unggah ulang." }, pref: [addDays(today, 2), addDays(today, 21)] });
  // Dinda — menunggu verifikasi
  await makeReg({ p: PEOPLE[1]!, sim: "B737", pkg: "atpl", createdAt: ago(1, "01:10"), status: "PENDING_VERIFICATION", pref: [addDays(today, 5), addDays(today, 25)] });
  // Adi — persona uji end-to-end (menunggu verifikasi)
  await makeReg({ p: PEOPLE[0]!, sim: "A320", pkg: "ppc", createdAt: ago(2, "22:41"), status: "PENDING_VERIFICATION", pref: [addDays(today, 2), addDays(today, 20)], notes: "[DUMMY] Ada rencana seleksi maskapai minggu ketiga bulan depan, mohon slot secepatnya." });

  // Terisi acak oleh peserta lain (tanpa pendaftaran nyata tidak diperbolehkan) → cukup dari data di atas.
  // Maintenance
  for (const [sim, d, st, reason] of [["A320", addDays(nextMon, 2), ["18:00", "20:00"], "Visual system [DUMMY]"], ["A320", addDays(nextMon, 6), ["06:00", "08:00"], "Preventive maint. [DUMMY]"], ["B737", addDays(nextMon, 6), ["06:00", "08:00"], "Preventive maint. [DUMMY]"]] as const) {
    for (const t of st) await db.slot.update({ where: { simulator_id_date_start_time: { simulator_id: sims[sim]!.id, date: dateOnly(d), start_time: t } }, data: { status: "MAINTENANCE", maintenance_reason: reason } });
  }

  await db.counter.upsert({ where: { key: `REG-${year}` }, create: { key: `REG-${year}`, value: regN + 870 }, update: { value: regN + 870 } });
  for (const [mk, n] of Object.entries(invN)) {
    const key = `INV-${mk}`;
    const v = n + (mk === today.slice(0, 7) ? 30 : 0);
    await db.counter.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
  console.log(`• Demo: ${regN} pendaftaran, ${Object.values(invN).reduce((a, b) => a + b, 0)} invoice.`);
  console.log("• Link dashboard/unggah-ulang contoh (DUMMY):\n  " + links.join("\n  "));
}

master()
  .then(() => (DEMO ? demo() : undefined))
  .then(() => console.log(`✓ Seed selesai. Login admin: budi@bwiaviation.id (SA) / nadia@bwiaviation.id (Admin) — kata sandi awal di prisma/seed.ts (SEED_ADMIN_PASSWORD).`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

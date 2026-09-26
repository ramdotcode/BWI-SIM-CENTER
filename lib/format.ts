// Format tanggal/jam/rupiah. Zona waktu tunggal: Asia/Jakarta (WIB, UTC+7, tanpa DST).
// Kolom @db.Date disimpan sebagai tengah malam UTC dan diperlakukan sebagai tanggal kalender.

export type Loc = "id" | "en";
const WIB_OFFSET_MS = 7 * 3600_000;

const DAYS = { id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const DAYS_LONG = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MONTHS = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export const dayShort = (i: number, l: Loc) => DAYS[l][i];
export const monthShort = (i: number, l: Loc) => MONTHS[l][i];
export const monthLong = (i: number, l: Loc) => MONTHS_LONG[l][i];

/** Tanggal kalender WIB sekarang, "YYYY-MM-DD". */
export function todayJkt(now = new Date()): string {
  return ymd(new Date(now.getTime() + WIB_OFFSET_MS));
}
/** Jam WIB sekarang, "HH:MM". */
export function nowTimeJkt(now = new Date()): string {
  const d = new Date(now.getTime() + WIB_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
/** Date (UTC midnight) → "YYYY-MM-DD" */
export function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** "YYYY-MM-DD" → Date UTC midnight (untuk kolom @db.Date) */
export function dateOnly(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
export function addDays(s: string, n: number): string {
  const d = dateOnly(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
/** Senin dari minggu yang memuat tanggal s. */
export function mondayOf(s: string): string {
  const d = dateOnly(s);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Senin
  return addDays(s, -dow);
}
/** Instan UTC untuk tanggal WIB + jam "HH:MM". */
export function wibInstant(date: string | Date, time = "00:00"): Date {
  const ds = typeof date === "string" ? date : ymd(date);
  return new Date(`${ds}T${time}:00+07:00`);
}
/** Instan → komponen tanggal WIB (sebagai Date UTC-shifted). */
function toWib(ts: Date): Date {
  return new Date(ts.getTime() + WIB_OFFSET_MS);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function fmtTime(hhmm: string, l: Loc): string {
  return l === "id" ? hhmm.replace(":", ".") : hhmm;
}

/** Kalender date (@db.Date atau "YYYY-MM-DD") → "Sel, 29 Sep 2026" */
export function fmtDate(d: Date | string, l: Loc, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const x = typeof d === "string" ? dateOnly(d) : d;
  const { weekday = false, year = true } = opts;
  const core = `${x.getUTCDate()} ${MONTHS[l][x.getUTCMonth()]}${year ? " " + x.getUTCFullYear() : ""}`;
  return weekday ? `${DAYS[l][x.getUTCDay()]}, ${core}` : core;
}
export function fmtDateLong(d: Date | string, l: Loc): string {
  const x = typeof d === "string" ? dateOnly(d) : d;
  return `${DAYS_LONG[l][x.getUTCDay()]}, ${x.getUTCDate()} ${MONTHS_LONG[l][x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}
/** Instan → tanggal WIB "29 Sep 2026" */
export function fmtTsDate(ts: Date, l: Loc, opts: { weekday?: boolean; year?: boolean } = {}): string {
  return fmtDate(toWib(ts), l, opts);
}
/** Instan → "Sel, 29 Sep 2026 · 08.00 WIB" */
export function fmtDateTime(ts: Date, l: Loc, opts: { weekday?: boolean; wib?: boolean } = {}): string {
  const w = toWib(ts);
  const t = fmtTime(`${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`, l);
  return `${fmtDate(w, l, { weekday: opts.weekday ?? true })} · ${t}${opts.wib === false ? "" : " WIB"}`;
}
/** Instan → "24 Sep 22.41" (ringkas, untuk tabel) */
export function fmtShortTs(ts: Date, l: Loc): string {
  const w = toWib(ts);
  return `${w.getUTCDate()} ${MONTHS[l][w.getUTCMonth()]} ${fmtTime(`${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`, l)}`;
}
/** dd/mm/yyyy (Excel / tabel database) */
export function fmtDmy(d: Date | null | undefined, isTs = false): string {
  if (!d) return "";
  const x = isTs ? toWib(d) : d;
  return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
}

export function rupiah(n: number | bigint | null | undefined): string {
  const v = Number(n ?? 0);
  const s = Math.abs(v).toLocaleString("id-ID", { maximumFractionDigits: 0 });
  return `${v < 0 ? "-" : ""}Rp ${s}`;
}
export function num(n: number | bigint): string {
  return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}
/** Ringkas: 12.000.000 → "12,0 jt" / "1,42 M" */
export function rupiahShort(n: number | bigint, l: Loc): string {
  const v = Number(n);
  const unitM = l === "id" ? "M" : "B";
  const unitJ = l === "id" ? "jt" : "M";
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toLocaleString(l === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 })} ${unitM}`;
  return `${(v / 1e6).toLocaleString(l === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ${unitJ}`;
}

/** Normalisasi nomor WA Indonesia → "+628xxxxxxxxx" */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (d.startsWith("8")) d = "62" + d;
  return "+" + d;
}
/** "+6281298765432" → "0812-9876-5432" */
export function prettyPhone(p: string | null | undefined): string {
  if (!p) return "";
  let d = p.replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}
export function waDigits(p: string): string {
  return p.replace(/\D/g, "");
}

export function relAgo(ts: Date, l: Loc, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - ts.getTime()) / 1000));
  const id = l === "id";
  if (s < 60) return id ? "baru saja" : "just now";
  const m = Math.round(s / 60);
  if (m < 60) return id ? `${m} mnt lalu` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return id ? `${h} jam lalu` : `${h} h ago`;
  const d = Math.round(h / 24);
  return id ? `${d} hari lalu` : `${d} days ago`;
}
/** Durasi menunggu ringkas: "14 jam" / "2 hari" */
export function waitDur(ts: Date, l: Loc, now = new Date()): string {
  const h = Math.max(0, Math.round((now.getTime() - ts.getTime()) / 3600_000));
  if (h < 1) return l === "id" ? "< 1 jam" : "< 1 h";
  if (h < 48) return l === "id" ? `${h} jam` : `${h} h`;
  const d = Math.round(h / 24);
  return l === "id" ? `${d} hari` : `${d} days`;
}

export function initials(name: string): string {
  return name
    .replace(/^(Capt\.|FO|Instr\.)\s*/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
/** "Adi Nugraha Saputra" → "Adi Nugraha S." */
export function shortName(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length <= 2) return name;
  return `${p.slice(0, -1).join(" ")} ${p[p.length - 1]![0]}.`;
}

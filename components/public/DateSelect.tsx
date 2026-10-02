"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { monthLong } from "@/lib/format";

/**
 * Pilihan tanggal 3 bagian (tanggal / bulan / tahun) untuk tanggal yang jauh dari hari ini
 * (lahir, terbit lisensi, masa berlaku medical) — tahun bisa dipilih langsung tanpa menggulir kalender.
 * Nilai keluar "YYYY-MM-DD", atau "" selama belum lengkap.
 */
export function DateSelect({
  id,
  value,
  onChange,
  years,
  l,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  years: number[];
  l: "id" | "en";
  invalid?: boolean;
}) {
  const t = useTranslations("form");
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? { y: m[1]!, m: String(Number(m[2])), d: String(Number(m[3])) } : { y: "", m: "", d: "" };
  };
  const [p, setP] = useState(() => parse(value));

  // Nilai dari luar (draf tersimpan, prefill peserta lama) menimpa pilihan; "" dari luar hanya mengosongkan bila pilihan sudah lengkap.
  useEffect(() => {
    const full = /^\d{4}-\d{2}-\d{2}$/.test(value);
    setP((cur) => (full ? parse(value) : cur.y && cur.m && cur.d ? { y: "", m: "", d: "" } : cur));
  }, [value]);

  const daysIn = p.y && p.m ? new Date(Date.UTC(Number(p.y), Number(p.m), 0)).getUTCDate() : 31;
  const update = (next: typeof p) => {
    if (next.d && Number(next.d) > (next.y && next.m ? new Date(Date.UTC(Number(next.y), Number(next.m), 0)).getUTCDate() : 31)) next = { ...next, d: "" };
    setP(next);
    onChange(next.y && next.m && next.d ? `${next.y}-${next.m.padStart(2, "0")}-${next.d.padStart(2, "0")}` : "");
  };
  const cls = `in ${invalid ? "invalid" : ""}`;

  return (
    <div className="datesel">
      <select id={id} className={cls} aria-label={t("dateDay")} aria-invalid={invalid} value={p.d} onChange={(e) => update({ ...p, d: e.target.value })}>
        <option value="">{t("dateDay")}</option>
        {Array.from({ length: daysIn }, (_, i) => String(i + 1)).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className={cls} aria-label={t("dateMonth")} aria-invalid={invalid} value={p.m} onChange={(e) => update({ ...p, m: e.target.value })}>
        <option value="">{t("dateMonth")}</option>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>{monthLong(i, l)}</option>)}
      </select>
      <select className={cls} aria-label={t("dateYear")} aria-invalid={invalid} value={p.y} onChange={(e) => update({ ...p, y: e.target.value })}>
        <option value="">{t("dateYear")}</option>
        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  );
}

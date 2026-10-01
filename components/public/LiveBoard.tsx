"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRealtime } from "../useRealtime";
import { dayShort, fmtTime, monthShort, dateOnly, workDaysLabel } from "@/lib/format";
import type { TodayBoard } from "@/lib/services/public";
import type { ViewStatus } from "@/lib/slot-view";

type Ev = { type: "slot"; sim: string; date: string; start: string; v: ViewStatus };

export function LiveBoard({ initial }: { initial: TodayBoard }) {
  const t = useTranslations("landing");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const [b, setB] = useState(initial);
  const [flash, setFlash] = useState<string | null>(null);
  useRealtime<Ev>(
    "public",
    (e) => {
      if (e.type !== "slot" || e.date !== b.date) return;
      setB((cur) => ({ ...cur, rows: cur.rows.map((r) => (r.start === e.start ? { ...r, cells: { ...r.cells, [e.sim]: e.v } } : r)) }));
      setFlash(`${e.sim}-${e.start}`);
      setTimeout(() => setFlash(null), 1000);
    },
    async () => {
      const r = await fetch(`/api/public/availability`).then((x) => x.json());
      setB(r);
    },
  );
  const d = dateOnly(b.date);
  const label = `${dayShort(d.getUTCDay(), l)} ${d.getUTCDate()} ${monthShort(d.getUTCMonth(), l)}`.toUpperCase();
  const cell = (v: string) => (v === "free" ? ["free", t("cellFree")] : v === "maint" ? ["mt", t("cellMaint")] : v === "past" ? ["busy", t("cellPast")] : ["busy", t("cellBusy")]);
  return (
    <div className="board" aria-label={t("boardAria")} id="ketersediaan">
      <div className="bh">
        <span>{t("boardTitle", { date: label })}</span>
        <span className="live">{tc("live")}</span>
      </div>
      <div className="rowb" style={{ borderTop: 0, color: "#8FB0B8", fontSize: 11 }}>
        <span />
        {b.sims.map((s) => (
          <span key={s} style={{ textAlign: "center" }}>{tc(`sim.${s}` as "sim.A320").toUpperCase()}</span>
        ))}
      </div>
      {b.closed && <div className="rowb" style={{ display: "block", color: "#B9D3D9", fontSize: 13 }}>{t("boardClosed")}</div>}
      {b.rows.map((r) => (
        <div className="rowb" key={r.start}>
          <span className="t">{fmtTime(r.start, l)}</span>
          {b.sims.map((s) => {
            const [cls, txt] = cell(r.cells[s] ?? "free");
            return (
              <span key={s} className={`cell ${cls} ${flash === `${s}-${r.start}` ? "slot flash" : ""}`} style={flash === `${s}-${r.start}` ? { minHeight: 0, border: 0, display: "block", padding: "6px 9px" } : undefined}>
                {txt}
              </span>
            );
          })}
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 11.5, color: "#8FB0B8", fontFamily: "var(--mono)" }}>
        {t("boardFoot", { h: b.settings.slot_minutes / 60, days: workDaysLabel(b.settings.work_days, l), start: fmtTime(b.settings.ops_start, l), end: fmtTime(b.settings.ops_end, l) })}
      </div>
    </div>
  );
}

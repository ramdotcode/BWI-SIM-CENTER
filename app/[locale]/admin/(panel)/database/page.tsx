import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { COLUMNS, cellText, regInclude } from "@/lib/columns";
import { regWhere } from "@/lib/xlsx";
import { monthLong, todayJkt } from "@/lib/format";
import { FilterSelect, SearchBox } from "@/components/admin/FilterBar";
import { ColumnPicker } from "@/components/admin/ColumnPicker";

const PAGE = 25;
const STATUSES = ["PENDING_VERIFICATION", "REUPLOAD_REQUIRED", "PENDING_PAYMENT", "EXPIRED", "PAID", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default async function Database({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage("SUPER_ADMIN");
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.db");
  const tc = await getTranslations("common");
  const te = await getTranslations("enums");
  const tr = await getTranslations("enums.role");
  const cur = todayJkt();
  const period = sp.period ?? "all";
  const f = { period, sim: sp.sim, status: STATUSES.includes(sp.status ?? "") ? sp.status : undefined, q: sp.q?.trim() || undefined };
  const where = regWhere(f);
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, rows] = await Promise.all([db.registration.count({ where }), db.registration.findMany({ where, include: regInclude, orderBy: { created_at: "desc" }, skip: (page - 1) * PAGE, take: PAGE })]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const visible = sp.cols ? COLUMNS.filter((c, i) => i < 3 || sp.cols!.split(",").includes(c.key)) : COLUMNS;
  const periods: [string, string][] = [["all", t("periodAll")]];
  for (let i = 0, y = Number(cur.slice(0, 4)), m = Number(cur.slice(5, 7)); i < 12; i++) {
    periods.push([`${y}-${String(m).padStart(2, "0")}`, `${monthLong(m - 1, l)} ${y}`]);
    if (--m === 0) { m = 12; y--; }
  }
  periods.push([cur.slice(0, 4), `${cur.slice(0, 4)}`]);
  const qs = new URLSearchParams(Object.entries({ period, sim: f.sim ?? "", status: f.status ?? "", q: f.q ?? "" }).filter(([, v]) => v));
  const pageHref = (p: number) => { const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); q.set("page", String(p)); return `/admin/database?${q}`; };
  let left = 0;
  const stickyLeft = [0, 130, 220].map((w) => (left += w) - w);
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow"><span className="role sa">{tr("SUPER_ADMIN")}</span></div>
          <h2 style={{ marginTop: 6 }}>{t("title")}</h2>
        </div>
        <div className="dbtoolbar">
          <ColumnPicker label={t("columns")} allLabel={t("columnsAll", { n: COLUMNS.length })} columns={COLUMNS.slice(3).map((c) => ({ key: c.key, label: l === "id" ? c.id : c.en }))} />
          <FilterSelect name="period" label={t("period")} value={period} options={periods} />
          <FilterSelect name="sim" label="Sim" value={f.sim ?? ""} options={[["", tc("all")], ["A320", "A320"], ["B737", "B737"]]} />
          <FilterSelect name="status" label="Status" value={f.status ?? ""} options={[["", tc("all")], ...STATUSES.map((s) => [s, te(`registrationStatus.${s}`)] as [string, string])]} />
          <SearchBox placeholder={t("searchPh")} width={180} />
          <a className="btn xls sm" href={`/api/admin/export/participants.xlsx?${qs}`}>{t("export")}</a>
        </div>
      </div>
      <div className="callout info" style={{ marginBottom: 14 }}>{t("callout")}</div>
      <div className="card">
        <div className="tbl tight">
          <table>
            <thead>
              <tr>{visible.map((c, i) => <th key={c.key} className={i < 3 ? "sticky-col" : ""} style={i < 3 ? { left: stickyLeft[i], minWidth: [130, 220, 150][i] } : undefined}>{l === "id" ? c.id : c.en}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {visible.map((c, i) => (
                    <td key={c.key} className={`${c.type === "mono" || c.type === "money" ? "mono" : ""} ${i < 3 ? "sticky-col" : ""}`} style={i < 3 ? { left: stickyLeft[i] } : c.type === "money" || c.type === "number" ? { textAlign: "right" } : undefined}>
                      {cellText(c, r) || <span className="faint">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row between wrap" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-soft)" }}>
          <span className="small muted">{tc("showing", { n: rows.length, total })} · {t("scrollHint")}</span>
          <div className="row">
            {page > 1 ? <Link className="btn xs ghost" href={pageHref(page - 1)}>‹</Link> : <span className="btn xs ghost" aria-disabled style={{ opacity: 0.4 }}>‹</span>}
            <span className="small mono">{page} / {pages}</span>
            {page < pages ? <Link className="btn xs ghost" href={pageHref(page + 1)}>›</Link> : <span className="btn xs ghost" aria-disabled style={{ opacity: 0.4 }}>›</span>}
          </div>
        </div>
      </div>
    </>
  );
}

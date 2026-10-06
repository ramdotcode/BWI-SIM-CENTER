import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, prettyPhone, todayJkt, ymd } from "@/lib/format";
import { REG_PILL } from "@/lib/ui";
import { SearchBox } from "@/components/admin/FilterBar";

const PAGE = 25;

/** Data personal per orang (CR-04): daftar peserta + unduh ZIP (Excel data diri + dokumen). Khusus SA. */
export default async function DataPersonal({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage("SUPER_ADMIN");
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.people");
  const tc = await getTranslations("common");
  const te = await getTranslations("enums");
  const tr = await getTranslations("enums.role");
  const q = sp.q?.trim();
  const where: Prisma.ParticipantWhereInput = q
    ? { OR: [{ full_name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { nik: { contains: q } }, { passport_no: { contains: q, mode: "insensitive" } }, { licence_no: { contains: q, mode: "insensitive" } }] }
    : {};
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, rows] = await Promise.all([
    db.participant.count({ where }),
    db.participant.findMany({
      where,
      orderBy: { updated_at: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { registrations: { orderBy: { created_at: "desc" }, select: { reg_no: true, status: true, created_at: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const today = todayJkt();
  const pageHref = (p: number) => `/admin/data-personal?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow"><span className="role sa">{tr("SUPER_ADMIN")}</span></div>
          <h2 style={{ marginTop: 6 }}>{t("title")}</h2>
        </div>
        <div className="dbtoolbar">
          <SearchBox placeholder={t("searchPh")} width={240} />
        </div>
      </div>
      <div className="callout info" style={{ marginBottom: 14 }}>{t("callout")}</div>
      <div className="card">
        {rows.length === 0 ? (
          <div className="bd"><div className="empty">{tc("noData")}</div></div>
        ) : (
          <div className="tbl">
            <table>
              <thead>
                <tr><th>{t("colName")}</th><th>{t("colId")}</th><th>{t("colLicence")}</th><th>{t("colMedical")}</th><th>{t("colIcao")}</th><th>{t("colLast")}</th><th>{t("colCount")}</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const last = p.registrations[0];
                  const medBad = ymd(p.medical_valid_until) < today;
                  const icaoBad = p.icao_valid_until ? ymd(p.icao_valid_until) < today : false;
                  return (
                    <tr key={p.id}>
                      <td><b>{p.full_name}</b><div className="small muted">{p.email} · {prettyPhone(p.whatsapp)}</div></td>
                      <td className="small">{p.nik ? <>KTP<div className="mono muted">{p.nik}</div></> : <>{te("docKind.PASSPORT")}<div className="mono muted">{p.passport_no}</div></>}</td>
                      <td>{p.licence_type}<div className="small muted mono">{p.licence_no}</div></td>
                      <td className="small" style={medBad ? { color: "var(--bad)" } : undefined}>{fmtDate(p.medical_valid_until, l)}{medBad ? ` · ${t("expired")}` : ""}</td>
                      <td className="small" style={icaoBad ? { color: "var(--bad)" } : undefined}>
                        {p.icao_english ? te(`icao.${p.icao_english}`) : "—"}
                        {p.icao_valid_until && <div>{fmtDate(p.icao_valid_until, l)}{icaoBad ? ` · ${t("expired")}` : ""}</div>}
                      </td>
                      <td>{last ? <><span className="mono">{last.reg_no}</span><div><span className={`pill ${REG_PILL[last.status]}`}>{te(`registrationStatus.${last.status}`)}</span></div></> : "—"}</td>
                      <td className="mono" style={{ textAlign: "center" }}>{p.registrations.length}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <a className="btn xs xls" href={`/api/admin/participants/${p.id}/export`} title={t("downloadTitle")} download>{t("download")}</a>
                          <a className="btn xs ghost" href={`/api/admin/participants/${p.id}/pdf`} title={t("downloadPdfTitle")} download>{t("downloadPdf")}</a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="row between wrap" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-soft)" }}>
          <span className="small muted">{tc("showing", { n: rows.length, total })}</span>
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

import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtShortTs, prettyPhone } from "@/lib/format";
import { REG_PILL } from "@/lib/ui";
import { docProgress } from "@/lib/schemas";
import { FilterSelect, SearchBox } from "@/components/admin/FilterBar";
import { VerifyDrawer } from "@/components/admin/VerifyDrawer";

const ST: Record<string, Prisma.RegistrationWhereInput> = {
  pending: { status: "PENDING_VERIFICATION" },
  reupload: { status: "REUPLOAD_REQUIRED" },
  verified: { status: { notIn: ["PENDING_VERIFICATION", "REUPLOAD_REQUIRED"] } },
  all: {},
};

export default async function Verifikasi({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.verify");
  const te = await getTranslations("enums");
  const tc = await getTranslations("common");
  const s = await getSettings();
  const st = sp.st && ST[sp.st] ? sp.st : "pending";
  const q = sp.q?.trim();
  const where: Prisma.RegistrationWhereInput = {
    ...ST[st],
    ...(sp.sim === "A320" || sp.sim === "B737" ? { simulator: { code: sp.sim } } : {}),
    ...(q ? { OR: [{ reg_no: { contains: q, mode: "insensitive" } }, { participant: { full_name: { contains: q, mode: "insensitive" } } }, { participant: { email: { contains: q, mode: "insensitive" } } }, { participant: { nik: { contains: q } } }] } : {}),
  };
  const rows = await db.registration.findMany({
    where,
    include: { participant: true, package: true, simulator: true, documents: { where: { superseded: false } } },
    orderBy: st === "pending" ? { created_at: "asc" } : { created_at: "desc" },
    take: 100,
  });
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("title")}</h2>
        </div>
        <div className="row wrap">
          <FilterSelect name="st" label={t("filterStatus")} value={st} options={[["pending", te("registrationStatus.PENDING_VERIFICATION")], ["reupload", te("registrationStatus.REUPLOAD_REQUIRED")], ["verified", l === "id" ? "Lolos" : "Passed"], ["all", tc("all")]]} />
          <FilterSelect name="sim" label={t("filterSim")} value={sp.sim ?? ""} options={[["", tc("all")], ["A320", "A320"], ["B737", "B737"]]} />
          <SearchBox placeholder={t("searchPh")} />
        </div>
      </div>
      <div className="card">
        {rows.length === 0 ? <div className="bd"><div className="empty">{tc("noData")}</div></div> : (
          <div className="tbl">
            <table>
              <thead><tr><th>{t("colReg")}</th><th>{t("colParticipant")}</th><th>{t("colLicence")}</th><th>{t("colMedical")}</th><th>{t("colDocs")}</th><th>{t("colPackage")}</th><th>{t("colReceived")}</th><th>{t("colStatus")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const p = r.participant;
                  const medBad = r.pref_date_to ? p.medical_valid_until < r.pref_date_to : false;
                  const dp = docProgress(r.documents.filter((d) => !d.superseded && d.review !== "REJECTED").map((d) => d.kind));
                  const pending = r.status === "PENDING_VERIFICATION";
                  const q2 = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
                  q2.set("reg", String(r.id));
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.reg_no}</td>
                      <td><b>{p.full_name}</b><div className="small muted">{p.email} · {prettyPhone(p.whatsapp)}</div></td>
                      <td>{p.licence_type}<div className="small muted mono">{p.licence_no}</div></td>
                      <td>{te(`medicalClass.${p.medical_class}`)}<div className="small muted" style={medBad ? { color: "var(--bad)" } : undefined}>{t("medUntil", { date: fmtDate(p.medical_valid_until, l) })}{medBad ? " ⚠" : ""}</div></td>
                      <td className="mono">{dp.n}/{dp.total}</td>
                      <td><span className={`chip ${r.simulator.code.toLowerCase()}`}>{r.simulator.code}</span> {r.package.short_id} {r.hours_snapshot}{l === "id" ? "j" : "h"}</td>
                      <td className="small">{fmtShortTs(r.created_at, l)}</td>
                      <td>
                        <span className={`pill ${REG_PILL[r.status]}`}>{te(`registrationStatus.${r.status}`)}</span>
                        {r.reupload_count >= s.reupload_manual_threshold && <div className="small" style={{ color: "var(--bad)", marginTop: 3 }}>{t("manualContact", { n: s.reupload_manual_threshold })}</div>}
                      </td>
                      <td><Link href={`/admin/verifikasi?${q2.toString()}`} className={`btn xs ${pending ? "" : "ghost"}`} scroll={false}>{pending ? t("btnCheck") : t("btnView")}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <VerifyDrawer />
    </>
  );
}

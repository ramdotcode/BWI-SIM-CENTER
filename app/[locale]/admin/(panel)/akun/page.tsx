import type { Prisma } from "@prisma/client";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtShortTs, initials, relAgo } from "@/lib/format";
import { REG_PILL } from "@/lib/ui";
import { SearchBox } from "@/components/admin/FilterBar";
import { AdminEditor, LinkActions } from "@/components/admin/AccountsClient";

export default async function Akun({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const me = await requireAdminPage();
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.accounts");
  const te = await getTranslations("enums");
  const tc = await getTranslations("common");
  const tab = sp.tab === "peserta" ? "peserta" : "admin";
  const isSA = me.role === "SUPER_ADMIN";
  const q = sp.q?.trim();

  const admins = tab === "admin" ? await db.adminUser.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }] }) : [];
  const where: Prisma.RegistrationWhereInput = q ? { OR: [{ reg_no: { contains: q, mode: "insensitive" } }, { participant: { full_name: { contains: q, mode: "insensitive" } } }, { participant: { email: { contains: q, mode: "insensitive" } } }] } : {};
  const regs = tab === "peserta" ? await db.registration.findMany({ where, include: { participant: true, access_tokens: { where: { purpose: "DASHBOARD" }, orderBy: { created_at: "desc" } } }, orderBy: { created_at: "desc" }, take: 100 }) : [];
  const tokenState = (ts: { opened_at: Date | null; revoked_at: Date | null; last_seen_at: Date | null }[]) => {
    const active = ts.find((x) => !x.revoked_at);
    if (!ts.length) return { k: "NONE", pill: "neutral", seen: null };
    if (!active) return { k: "REVOKED", pill: "bad", seen: ts[0]!.last_seen_at };
    return active.opened_at ? { k: "OPENED", pill: "ok", seen: active.last_seen_at } : { k: "UNOPENED", pill: "neutral", seen: null };
  };
  const tick = (v: string) => (v === "✓" ? <b style={{ color: "var(--ok)" }}>✓</b> : <span className={v === "—" ? "faint" : "small"}>{v}</span>);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("title")}</h2>
        </div>
        <div className="row wrap">
          <div className="tabs">
            <Link href="/admin/akun" className={tab === "admin" ? "on" : ""}>{t("tabAdmin")}</Link>
            <Link href="/admin/akun?tab=peserta" className={tab === "peserta" ? "on" : ""}>{t("tabParticipants")}</Link>
          </div>
          {tab === "admin" ? <AdminEditor canEdit={isSA} label={t("addAdmin")} /> : <SearchBox placeholder={tc("search")} width={220} />}
        </div>
      </div>
      <div className="grid sched-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 320px", alignItems: "start" }}>
        <div className="card">
          {tab === "admin" ? (
            <div className="tbl">
              {!isSA && <div className="banner warn" style={{ margin: 12 }}>{t("saOnly")}</div>}
              <table>
                <thead><tr><th>{t("colName")}</th><th>{t("colEmail")}</th><th>{t("colRole")}</th><th>{t("colLast")}</th><th style={{ textAlign: "right" }}>{t("colActive")}</th></tr></thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td><span className="row"><span className="avatar sm" style={a.role === "ADMIN" ? { background: "var(--teal-mid)" } : undefined}>{initials(a.name)}</span><b>{a.name}</b></span></td>
                      <td className="small">{a.email}</td>
                      <td><span className={`role ${a.role === "SUPER_ADMIN" ? "sa" : "ad"}`}>{te(`role.${a.role}`)}</span></td>
                      <td className="small">{a.last_login_at ? relAgo(a.last_login_at, l) : t("never")}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {isSA ? <AdminEditor row={{ id: a.id, name: a.name, email: a.email, role: a.role, active: a.active }} canEdit label={tc("edit")} self={a.id === me.id} /> : <span className={`pill ${a.active ? "ok" : "neutral"}`}>{a.active ? tc("yes") : tc("no")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tbl">
              <table>
                <thead><tr><th>{t("colName")}</th><th>{t("colReg")}</th><th>{t("colLink")}</th><th>{t("colLast")}</th><th /></tr></thead>
                <tbody>
                  {regs.map((r) => {
                    const s = tokenState(r.access_tokens);
                    return (
                      <tr key={r.id}>
                        <td><span className="row"><span className="avatar sm" style={{ background: "var(--faint)" }}>{initials(r.participant.full_name)}</span><span><b>{r.participant.full_name}</b><div className="small muted">{r.participant.email}</div></span></span></td>
                        <td><span className="mono small">{r.reg_no}</span><div><span className={`pill xs ${REG_PILL[r.status]}`}>{te(`registrationStatus.${r.status}`)}</span></div></td>
                        <td><span className={`pill ${s.pill}`}>{te(`tokenStatus.${s.k}` as "tokenStatus.OPENED")}</span></td>
                        <td className="small">{s.seen ? fmtShortTs(s.seen, l) : <span className="faint">{t("notOpened")}</span>}</td>
                        <td><LinkActions regId={r.id} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card pad stack" style={{ gap: 14 }}>
          <div className="eyebrow">{t("tabMatrix")}</div>
          <div className="tbl">
            <table className="small">
              <thead><tr><th>{t("matrixModule")}</th><th>SA</th><th>Admin</th><th>{te("role.PARTICIPANT").split(" ")[0]}</th></tr></thead>
              <tbody>
                {[
                  [t("mVerify"), "✓", "✓", "—"],
                  [t("mPay"), "✓", "✓", t("viewOnly")],
                  [t("mSched"), "✓", "✓", t("viewOnly")],
                  [t("mAccounts"), "✓", t("linkParticipants"), "—"],
                  [t("mFinance"), "✓", "—", "—"],
                  [t("mDb"), "✓", "—", "—"],
                  [t("mPrice"), "✓", "—", "—"],
                ].map((r, i) => (
                  <tr key={r[0]}><td>{i >= 4 ? <b>{r[0]}</b> : r[0]}</td><td>{tick(r[1]!)}</td><td>{tick(r[2]!)}</td><td>{tick(r[3]!)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">{t("matrixNote")}</p>
        </div>
      </div>
    </>
  );
}

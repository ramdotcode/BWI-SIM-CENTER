import { cookies } from "next/headers";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import { Logo } from "@/components/Logo";
import { verifyPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Konfirmasi — hanya tampil sekali (cookie 1 jam dari submit). Setelahnya peserta memakai link dashboard dari email. */
export default async function Terkirim({ params }: { params: Promise<{ locale: string; reg_no: string }> }) {
  const { locale, reg_no } = await params;
  setRequestLocale(locale);
  const l = (await getLocale()) as "id" | "en";
  const c = verifyPayload<{ reg: string; name: string; email: string }>((await cookies()).get("bwi_submitted")?.value ?? "");
  if (!c || c.reg !== reg_no) redirect({ href: "/", locale });
  const reg = await db.registration.findUnique({ where: { reg_no }, select: { created_at: true } });
  const t = await getTranslations("submitted");
  const first = c!.name.split(/\s+/)[0];
  return (
    <div className="pub" style={{ maxWidth: 720 }}>
      <div className="head"><Logo /></div>
      <div className="card pad" style={{ textAlign: "center", padding: "40px 28px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--lime)", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: 28 }}>✈</div>
        <div className="eyebrow">{t("eyebrow")}</div>
        <h2 style={{ marginTop: 6 }}>{t("title", { name: first })}</h2>
        <p className="muted" style={{ maxWidth: "48ch", margin: "12px auto 0" }}>
          {t("desc")} <b className="mono" style={{ color: "var(--ink)" }}>{c!.email}</b>.
        </p>
        <div className="mono" style={{ marginTop: 18, display: "inline-block", background: "var(--teal-tint)", padding: "8px 14px", borderRadius: 8, fontSize: 14 }}>
          {t("regNo")} <b>{reg_no}</b>
        </div>
        <p className="small faint" style={{ marginTop: 14 }}>{t("note")}</p>
      </div>
      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>{t("timeline")}</div>
        <div className="timeline">
          <div className="st done"><span className="n">✓</span><div><div className="t">{t("t1")}</div><div className="d">{reg ? fmtDateTime(reg.created_at, l) : ""}</div></div></div>
          <div className="st now"><span className="n">2</span><div><div className="t">{t("t2")}</div><div className="d">{t("t2d")}</div></div></div>
          <div className="st"><span className="n">3</span><div><div className="t">{t("t3")}</div><div className="d">{t("t3d")}</div></div></div>
          <div className="st"><span className="n">4</span><div><div className="t">{t("t4")}</div><div className="d">{t("t4d")}</div></div></div>
          <div className="st"><span className="n">5</span><div><div className="t">{t("t5")}</div><div className="d">{t("t5d")}</div></div></div>
        </div>
      </div>
    </div>
  );
}

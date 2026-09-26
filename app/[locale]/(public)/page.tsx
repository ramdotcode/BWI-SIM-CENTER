import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { PublicFooter, PublicHeader } from "@/components/public/PublicHeader";
import { LiveBoard } from "@/components/public/LiveBoard";
import { activePackages, todayBoard } from "@/lib/services/public";
import { getSettings } from "@/lib/settings";
import { rupiah } from "@/lib/format";
import { waLink } from "@/lib/notify/wa";

export const dynamic = "force-dynamic";

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("landing");
  const [board, pkgs, s] = await Promise.all([todayBoard(), activePackages(), getSettings()]);
  const slotH = s.slot_minutes / 60;
  return (
    <div className="land">
      <PublicHeader />
      <section className="hero">
        <div>
          <div className="eyebrow" style={{ color: "var(--teal-mid)" }}>{t("eyebrow")}</div>
          <h1 style={{ marginTop: 10 }}>
            {t("h1a")}
            <br />
            <em>{t("h1b")}</em>
            <br />
            {t("h1c")}
          </h1>
          <p className="lead">{t("lead")}</p>
          <div className="cta">
            <Link href="/daftar" className="btn lime" style={{ padding: "13px 22px", fontSize: 15 }}>{t("ctaStart")}</Link>
            <a href="#ketersediaan" className="btn ghost" style={{ padding: "13px 22px", fontSize: 15 }}>{t("ctaAvail")}</a>
          </div>
          <div className="row wrap" style={{ marginTop: 26, gap: 22, fontSize: 13, color: "var(--muted)" }}>
            <span>{t("usp1")}</span>
            <span>{t("usp2")}</span>
            <span>{t("usp3")}</span>
          </div>
        </div>
        <LiveBoard initial={board} />
      </section>

      <section className="pkgs" id="paket">
        <div className="row between wrap" style={{ marginBottom: 16 }}>
          <div>
            <div className="eyebrow">{t("pkgEyebrow")}</div>
            <h2 style={{ marginTop: 4 }}>{t("pkgTitle")}</h2>
          </div>
        </div>
        <div className="grid">
          {pkgs.map((p) => {
            const name = l === "id" ? p.short_id : p.short_en;
            const bullets = ((l === "id" ? p.bullets_id : p.bullets_en) as string[]) ?? [];
            return (
              <div key={p.id} className={`card pkg ${p.highlight ? "hi" : ""}`}>
                {p.highlight && <span className="ribbon">{t("pkgPopular")}</span>}
                <span className="h">{name}</span>
                <span className="hrs">{t("pkgHours", { h: p.hours, s: Math.ceil(p.hours / slotH) })}</span>
                <span className="small muted">{l === "id" ? p.description_id : p.description_en}</span>
                <ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                <span className="pr">
                  {rupiah(p.price_idr)} <small>{l === "id" ? "/ paket" : "/ package"}</small>
                </span>
                <Link href={`/daftar?paket=${p.code}`} className={`btn ${p.highlight ? "lime" : "soft"} sm`} style={{ justifyContent: "center" }}>
                  {t("pkgPick", { name })}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="howto" aria-label={t("stepsEyebrow")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div className="h" key={n}>
            <span className="k">0{n}</span>
            <span className="t">{t(`s${n}t` as "s1t")}</span>
            <span className="d">{t(`s${n}d` as "s1d")}</span>
          </div>
        ))}
      </section>

      <section id="status" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 50px" }}>
        <div className="card pad row between wrap" style={{ background: "var(--teal-tint)" }}>
          <div style={{ maxWidth: "70ch" }}>
            <h3>{t("statusTitle")}</h3>
            <p className="muted small" style={{ marginTop: 6 }}>{t("statusDesc")}</p>
          </div>
          <a className="btn wa" href={waLink(s.wa_admin_number, t("statusWaText"))} target="_blank" rel="noopener noreferrer">💬 {t("statusWa")}</a>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "../Logo";
import { LangSwitch } from "../LangSwitch";
import { Suspense } from "react";

export async function PublicHeader({ cta = true }: { cta?: boolean }) {
  const t = await getTranslations();
  return (
    <div className="topnav pub-top">
      <Link href="/" aria-label="BWI Sim Center"><Logo ppi={false} h={40} /></Link>
      <div className="partner" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
        <span>{t("common.partnerWith")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ppi-curug.png" alt="PPI Curug" style={{ height: 34 }} />
        <span style={{ fontWeight: 600, color: "var(--teal)" }}>PPI Curug</span>
      </div>
      <div className="row wrap">
        <Suspense><LangSwitch /></Suspense>
        {cta && (
          <>
            <Link href="/#status" className="btn ghost sm">{t("landing.checkStatus")}</Link>
            <Link href="/daftar" className="btn lime sm">{t("landing.book")}</Link>
          </>
        )}
      </div>
    </div>
  );
}

export async function PublicFooter() {
  const t = await getTranslations();
  return (
    <footer className="foot-pub">
      <span>© {new Date().getFullYear()} {t("common.legal")}</span>
      <Link href="/admin/login" style={{ color: "var(--muted)" }}>{t("landing.adminLogin")}</Link>
    </footer>
  );
}

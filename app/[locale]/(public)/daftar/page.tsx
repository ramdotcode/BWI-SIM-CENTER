import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { RegisterForm } from "@/components/public/RegisterForm";
import { activePackages } from "@/lib/services/public";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pendaftaran" };

export default async function Daftar({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ paket?: string; sim?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("form");
  const [pkgs, s] = await Promise.all([activePackages(), getSettings()]);
  return (
    <div className="pub">
      <div className="head">
        <Link href="/" className="row"><Logo /></Link>
        <div className="row wrap" style={{ gap: 16 }}>
          <div>
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>{t("title")}</h2>
          </div>
          <Suspense><LangSwitch /></Suspense>
        </div>
      </div>
      <div className="callout info" style={{ marginBottom: 18 }}>{t("intro")}</div>
      <RegisterForm
        packages={pkgs.map((p) => ({ code: p.code, name: l === "id" ? p.name_id : p.name_en, short: l === "id" ? p.short_id : p.short_en, hours: p.hours, price: Number(p.price_idr) }))}
        slotHours={s.slot_minutes / 60}
        uploadMaxMb={Math.min(20, Math.max(1, Number(s.upload_max_mb) || 5))}
        initialPkg={pkgs.some((p) => p.code === sp.paket) ? sp.paket : undefined}
        initialSim={sp.sim === "B737" || sp.sim === "A320" ? sp.sim : undefined}
      />
    </div>
  );
}

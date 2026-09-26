import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { ReuploadForm } from "@/components/public/ReuploadForm";
import { resolveToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/notify/wa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unggah ulang", robots: { index: false }, referrer: "no-referrer" };

/** E-01: unggah ulang dokumen yang ditolak (token khusus 7 hari, REG sama). */
export default async function Reupload({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("reupload");
  const te = await getTranslations("enums.docKind");
  const s = await getSettings();
  const tok = await resolveToken(decodeURIComponent(token), "REUPLOAD");
  const reg = tok ? await db.registration.findUnique({ where: { id: tok.registration_id }, include: { participant: true, documents: { where: { superseded: false, review: "REJECTED" } } } }) : null;
  return (
    <div className="pub" style={{ maxWidth: 720 }}>
      <div className="head">
        <Logo />
        <Suspense><LangSwitch /></Suspense>
      </div>
      <div className="card pad stack" style={{ gap: 14 }}>
        <div>
          <div className="eyebrow">{t("eyebrow")}{reg ? ` · ${reg.reg_no}` : ""}</div>
          <h2 style={{ marginTop: 4 }}>{t("title")}</h2>
        </div>
        {!reg || reg.status !== "REUPLOAD_REQUIRED" ? (
          <>
            <div className="banner warn">{reg ? t("nothing") : t("expired", { days: s.reupload_token_days })}</div>
            <a className="btn wa" style={{ alignSelf: "flex-start" }} href={waLink(s.wa_admin_number, l === "id" ? "Halo Admin BWI, link unggah ulang dokumen saya tidak bisa dibuka." : "Hello BWI Admin, my document re-upload link does not work.")} target="_blank" rel="noopener noreferrer">💬 WhatsApp admin</a>
          </>
        ) : (
          <>
            <p className="muted">{t("desc")}</p>
            {reg.rejection_note && <div className="callout"><b>{t("note")}:</b> {reg.rejection_note}</div>}
            <ReuploadForm token={decodeURIComponent(token)} kinds={reg.documents.map((d) => ({ kind: d.kind, label: te(d.kind), note: d.review_note }))} />
          </>
        )}
      </div>
    </div>
  );
}

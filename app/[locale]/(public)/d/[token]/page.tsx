import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ParticipantDashboard } from "@/components/participant/Dashboard";
import { participantFromToken } from "@/lib/participant";
import { participantDashboard } from "@/lib/services/dashboard";
import { HttpError } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Dashboard peserta via magic link (tanpa login). */
export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  let regId: number;
  try {
    regId = (await participantFromToken(await headers(), token, true)).registration_id;
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const data = await participantDashboard(regId, locale === "en" ? "en" : "id");
  return <ParticipantDashboard token={decodeURIComponent(token)} initial={JSON.parse(JSON.stringify(data))} />;
}

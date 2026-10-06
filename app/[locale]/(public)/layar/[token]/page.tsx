import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { DisplayBoard } from "@/components/public/DisplayBoard";
import { resolveDisplay } from "@/lib/display";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { displayBoard } from "@/lib/services/display-board";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jadwal Simulator", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Mode Layar (CR-01): papan jadwal real-time untuk TV/monitor, via link khusus tanpa login. */
export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!rateLimit(`layar:${clientIp(await headers())}`, 60, 60_000).ok) notFound();
  const link = await resolveDisplay(token, true);
  if (!link) notFound();
  const data = await displayBoard(true);
  return <DisplayBoard token={decodeURIComponent(token)} initial={JSON.parse(JSON.stringify(data))} label={link.label} />;
}

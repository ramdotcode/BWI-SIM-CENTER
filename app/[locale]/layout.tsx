import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import { ToastProvider } from "@/components/Toast";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-barlow", display: "swap" });
const barlowC = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--f-barlow-c", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BWI Sim Center", template: "%s · BWI Sim Center" },
  description: "Sewa sesi Flight Training Device Airbus A320 & Boeing 737NG — PT BWI Aviation × PPI Curug.",
  icons: { icon: "/brand/ppi-curug.png" },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={`${barlow.variable} ${barlowC.variable} ${plex.variable}`}>
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

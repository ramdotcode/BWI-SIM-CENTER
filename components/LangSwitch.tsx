"use client";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { useTransition } from "react";

export function LangSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const go = (l: "id" | "en") => {
    if (l === locale) return;
    document.cookie = `NEXT_LOCALE=${l};path=/;max-age=31536000;samesite=lax`;
    const q = sp.toString();
    start(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { locale: l, scroll: false }));
  };
  return (
    <div className="langsw" aria-label="Bahasa / Language" aria-busy={pending}>
      <button type="button" className={locale === "id" ? "on" : ""} onClick={() => go("id")}>ID</button>
      <button type="button" className={locale === "en" ? "on" : ""} onClick={() => go("en")}>EN</button>
    </div>
  );
}

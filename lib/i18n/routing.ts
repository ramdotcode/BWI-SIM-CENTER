import { defineRouting } from "next-intl/routing";

export const locales = ["id", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "id",
  localePrefix: "as-needed",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
  localeDetection: false,
});

import "server-only";
import id from "@/messages/id.json";
import en from "@/messages/en.json";
import type { AppLocale } from "./routing";

type Dict = Record<string, unknown>;
const DICTS: Record<AppLocale, Dict> = { id, en };

/** Penerjemah sederhana untuk konteks non-React (email, WA, PDF, Excel). */
export function translator(locale: AppLocale, ns?: string) {
  const root = ns ? (get(DICTS[locale], ns) as Dict) : DICTS[locale];
  const fallback = ns ? (get(DICTS.id, ns) as Dict) : DICTS.id;
  return (key: string, vars?: Record<string, string | number>) => {
    let s = (get(root, key) ?? get(fallback, key) ?? key) as string;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

function get(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Dict)[k] : undefined), o);
}

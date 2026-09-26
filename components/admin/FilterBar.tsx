"use client";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { useEffect, useState } from "react";

/** Filter berbasis query string (server component membaca searchParams). */
export function FilterSelect({ name, label, options, value }: { name: string; label: string; options: [string, string][]; value: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const path = usePathname();
  return (
    <label className="filter" style={{ padding: 0, border: 0, background: "transparent" }}>
      <select
        className="filter"
        aria-label={label}
        value={value}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          if (e.target.value) q.set(name, e.target.value);
          else q.delete(name);
          q.delete("page");
          router.replace(`${path}?${q.toString()}`);
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {label}: {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchBox({ placeholder, width = 240 }: { placeholder: string; width?: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const path = usePathname();
  const [v, setV] = useState(sp.get("q") ?? "");
  useEffect(() => {
    const h = setTimeout(() => {
      if ((sp.get("q") ?? "") === v) return;
      const q = new URLSearchParams(sp.toString());
      if (v) q.set("q", v);
      else q.delete("q");
      q.delete("page");
      router.replace(`${path}?${q.toString()}`);
    }, 350);
    return () => clearTimeout(h);
  }, [v, sp, path, router]);
  return <input className="in" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} style={{ width }} aria-label={placeholder} />;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

/** Filter kolom tabel database (3 kolom pertama selalu tampil & sticky). */
export function ColumnPicker({ label, allLabel, columns }: { label: string; allLabel: string; columns: { key: string; label: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const cur = sp.get("cols")?.split(",").filter(Boolean) ?? columns.map((c) => c.key);
  const [sel, setSel] = useState<string[]>(cur);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const apply = (keys: string[]) => {
    const q = new URLSearchParams(sp.toString());
    if (keys.length === columns.length) q.delete("cols");
    else q.set("cols", keys.join(","));
    router.replace(`${path}?${q}`);
    setOpen(false);
  };
  return (
    <div className="menu" ref={ref}>
      <button className="filter" onClick={() => setOpen((o) => !o)}>
        {label}: <b>{cur.length === columns.length ? allLabel : `${cur.length + 3}`}</b> ▾
      </button>
      {open && (
        <div className="pop" style={{ maxHeight: 360, overflow: "auto", left: 0, right: "auto" }}>
          <div className="row" style={{ padding: 6, gap: 6 }}>
            <button className="btn xs ghost" onClick={() => setSel(columns.map((c) => c.key))}>✓ all</button>
            <button className="btn xs ghost" onClick={() => setSel([])}>✕</button>
            <button className="btn xs" style={{ marginLeft: "auto" }} onClick={() => apply(sel)}>OK</button>
          </div>
          {columns.map((c) => (
            <label key={c.key} className="row small" style={{ padding: "4px 10px", gap: 8 }}>
              <input type="checkbox" checked={sel.includes(c.key)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, c.key] : s.filter((x) => x !== c.key)))} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "../useRealtime";

/** Admin: setiap event (pendaftar baru, invoice, slot) memicu refresh data server (debounce 1,5 dtk). */
export function AdminLive() {
  const router = useRouter();
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtime<{ type: string }>(
    "admin",
    (e) => {
      if (e.type === "slot" && typeof window !== "undefined" && window.location.pathname.includes("/admin/jadwal")) return; // kalender menambal sendiri
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => router.refresh(), 1500);
    },
    () => router.refresh(),
  );
  return null;
}

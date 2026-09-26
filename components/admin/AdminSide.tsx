"use client";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { LangSwitch } from "../LangSwitch";
import { initials } from "@/lib/format";

const NAV: { href: string; key: string; icon: React.ReactNode; count?: "verify" | "pay" | "wa"; sa?: boolean }[] = [
  { href: "/admin", key: "home", icon: <><path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" /></>, count: "wa" },
  { href: "/admin/verifikasi", key: "verify", icon: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>, count: "verify" },
  { href: "/admin/pembayaran", key: "pay", icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>, count: "pay" },
  { href: "/admin/jadwal", key: "sched", icon: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></> },
  { href: "/admin/akun", key: "accounts", icon: <><circle cx="9" cy="8" r="4" /><path d="M1 21a8 8 0 0 1 16 0M17 4a4 4 0 0 1 0 8M23 21a8 8 0 0 0-6-7.7" /></> },
  { href: "/admin/keuangan", key: "finance", icon: <><path d="M3 3v18h18" /><path d="M7 15l4-5 4 3 5-7" /></>, sa: true },
  { href: "/admin/database", key: "db", icon: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>, sa: true },
  { href: "/admin/pengaturan", key: "settings", icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, sa: true },
];

export function AdminSide({ admin, counts }: { admin: { name: string; role: "ADMIN" | "SUPER_ADMIN" }; counts: Record<"verify" | "pay" | "wa", number> }) {
  const t = useTranslations("admin");
  const path = usePathname();
  const isSA = admin.role === "SUPER_ADMIN";
  return (
    <aside className="side">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bwi-aviation.png" alt="BWI" />
        <div>
          <div className="who">Sim Center</div>
          <div className="sub">{t(`brandSub.${admin.role}`)}</div>
        </div>
      </div>
      {NAV.filter((n) => !n.sa || isSA).map((n) => {
        const on = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        const c = n.count ? counts[n.count] : 0;
        return (
          <Link key={n.href} href={n.href} className={`nav ${on ? "on" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{n.icon}</svg>
            {t(`nav.${n.key}` as "nav.home")}
            {n.sa ? <span className="cnt" style={{ background: "var(--teal-deep)", color: "var(--lime)" }}>SA</span> : c ? <span className="cnt">{c}</span> : null}
          </Link>
        );
      })}
      <div className="row" style={{ justifyContent: "center", marginTop: "auto", padding: "6px 0" }}>
        <Suspense><LangSwitch /></Suspense>
      </div>
      <div className="user" style={{ marginTop: 0 }}>
        <span className="avatar">{initials(admin.name)}</span>
        <div className="grow">
          <div style={{ fontWeight: 600, fontSize: 14 }}>{admin.name}</div>
          <div className="small muted">{t(`roleDesc.${admin.role}`)}</div>
          <button
            className="logout"
            onClick={async () => {
              await fetch("/api/admin/auth/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
          >
            {t("logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}

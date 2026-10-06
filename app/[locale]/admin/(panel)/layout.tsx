import type { ReactNode } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminSide } from "@/components/admin/AdminSide";
import { AdminLive } from "@/components/admin/AdminLive";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function PanelLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireAdminPage();
  const [verify, pay, wa] = await Promise.all([
    db.registration.count({ where: { status: "PENDING_VERIFICATION" } }),
    db.invoice.count({ where: { status: { in: ["AWAITING_VERIFICATION", "OVERDUE"] } } }),
    db.notification.count({ where: { channel: "WA", status: "MANUAL" } }),
  ]);
  return (
    <div className="shell adm-shell">
      <AdminSide admin={{ name: admin.name, role: admin.role }} counts={{ verify, pay, wa }} />
      <main className="main">
        <AdminLive />
        {children}
      </main>
    </div>
  );
}

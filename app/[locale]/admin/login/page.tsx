import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function Login({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "min(420px,100%)" }}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <Logo h={36} ppiH={32} />
          <Suspense><LangSwitch /></Suspense>
        </div>
        <Suspense><LoginForm /></Suspense>
      </div>
    </div>
  );
}

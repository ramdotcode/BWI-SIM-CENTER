"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.code === "locked" ? t("locked", { s: String(j.error).split(":")[1] ?? "60" }) : t("bad"));
      setBusy(false);
      return;
    }
    const next = sp.get("next");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  }
  return (
    <form className="card pad stack" style={{ gap: 14, padding: 26 }} onSubmit={submit}>
      <div>
        <h2>{t("title")}</h2>
        <p className="small muted" style={{ marginTop: 6 }}>{t("desc")}</p>
      </div>
      <div className="field">
        <label htmlFor="em">{t("email")}</label>
        <input id="em" className="in" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pw">{t("password")}</label>
        <input id="pw" className="in" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </div>
      {err && <div className="banner bad">{err}</div>}
      <button className="btn" disabled={busy} aria-busy={busy} style={{ justifyContent: "center" }}>{t("submit")}</button>
    </form>
  );
}

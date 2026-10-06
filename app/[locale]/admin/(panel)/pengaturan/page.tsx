import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, SETTING_META } from "@/lib/settings";
import { InstructorsEditor, PackagesEditor, SettingsForm, SimulatorsEditor } from "@/components/admin/SettingsClient";
import { DisplayLinks } from "@/components/admin/AccountsClient";
import { displayPath, displaySeen, listDisplayLinks } from "@/lib/display";
import { fmtShortTs } from "@/lib/format";

export default async function Pengaturan({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage("SUPER_ADMIN");
  const sp = await searchParams;
  const t = await getTranslations("admin.settings");
  const tr = await getTranslations("enums.role");
  const td = await getTranslations("accountsDisplay");
  const l = (await getLocale()) as "id" | "en";
  const tab = ["paket", "instruktur", "simulator", "layar"].includes(sp.tab ?? "") ? sp.tab! : "sistem";
  const tabs: [string, string][] = [["sistem", t("tabGeneral")], ["paket", t("tabPackages")], ["instruktur", t("tabInstructors")], ["simulator", t("tabSims")], ["layar", td("tab")]];
  const displays = tab === "layar" ? await (async () => {
    const [links, seen] = await Promise.all([listDisplayLinks(), displaySeen()]);
    return links.map((x) => ({ id: x.id, label: x.label, show_names: x.show_names, path: displayPath(x), created: fmtShortTs(new Date(x.created_at), l), seen: seen[x.id] ? fmtShortTs(new Date(seen[x.id]!), l) : null }));
  })() : [];
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow"><span className="role sa">{tr("SUPER_ADMIN")}</span></div>
          <h2 style={{ marginTop: 6 }}>{t("title")}</h2>
        </div>
        <div className="tabs">
          {tabs.map(([k, label]) => <Link key={k} href={k === "sistem" ? "/admin/pengaturan" : `/admin/pengaturan?tab=${k}`} className={tab === k ? "on" : ""}>{label}</Link>)}
        </div>
      </div>
      {tab === "sistem" && <SettingsForm values={JSON.parse(JSON.stringify(await getSettings(true)))} meta={SETTING_META} />}
      {tab === "paket" && <PackagesEditor packages={(await db.package.findMany({ orderBy: { sort: "asc" } })).map((p) => ({ ...p, price_idr: Number(p.price_idr), bullets_id: p.bullets_id as string[], bullets_en: p.bullets_en as string[] }))} slotMinutes={(await getSettings()).slot_minutes} />}
      {tab === "instruktur" && <InstructorsEditor instructors={await db.instructor.findMany({ orderBy: { name: "asc" } })} />}
      {tab === "simulator" && <SimulatorsEditor sims={await db.simulator.findMany({ orderBy: { code: "asc" } })} />}
      {tab === "layar" && <div className="card"><DisplayLinks rows={displays} /></div>}
    </>
  );
}

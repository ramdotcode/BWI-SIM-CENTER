import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, SETTING_META } from "@/lib/settings";
import { InstructorsEditor, PackagesEditor, SettingsForm, SimulatorsEditor } from "@/components/admin/SettingsClient";

export default async function Pengaturan({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage("SUPER_ADMIN");
  const sp = await searchParams;
  const t = await getTranslations("admin.settings");
  const tr = await getTranslations("enums.role");
  const tab = ["paket", "instruktur", "simulator"].includes(sp.tab ?? "") ? sp.tab! : "sistem";
  const tabs: [string, string][] = [["sistem", t("tabGeneral")], ["paket", t("tabPackages")], ["instruktur", t("tabInstructors")], ["simulator", t("tabSims")]];
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
      {tab === "paket" && <PackagesEditor packages={(await db.package.findMany({ orderBy: { sort: "asc" } })).map((p) => ({ ...p, price_idr: Number(p.price_idr), bullets_id: p.bullets_id as string[], bullets_en: p.bullets_en as string[] }))} />}
      {tab === "instruktur" && <InstructorsEditor instructors={await db.instructor.findMany({ orderBy: { name: "asc" } })} />}
      {tab === "simulator" && <SimulatorsEditor sims={await db.simulator.findMany({ orderBy: { code: "asc" } })} />}
    </>
  );
}

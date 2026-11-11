import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { requireAdminPage } from "@/lib/auth";
import { availableYears } from "@/lib/services/finance";
import { todayJkt } from "@/lib/format";
import { FilterSelect } from "@/components/admin/FilterBar";
import { IncomeTab } from "./IncomeTab";
import { ExpenseTab } from "./ExpenseTab";
import { ProfitTab } from "./ProfitTab";

const TABS = ["pemasukan", "pengeluaran", "laba-rugi"] as const;

/** Keuangan (Super Admin): Pemasukan · Pengeluaran · Gabungan/laba rugi (revisi klien Nov 2026, poin 10). */
export default async function Keuangan({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage("SUPER_ADMIN");
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.finance");
  const tr = await getTranslations("enums.role");
  const cy = Number(todayJkt().slice(0, 4));
  const year = Number(sp.year) || cy;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "pemasukan";
  const years = await availableYears();
  const labels: Record<(typeof TABS)[number], string> = { pemasukan: t("tabIncome"), pengeluaran: t("tabExpense"), "laba-rugi": t("tabProfit") };
  const href = (k: string) => `/admin/keuangan?${new URLSearchParams({ ...(k === "pemasukan" ? {} : { tab: k }), ...(sp.year ? { year: String(year) } : {}) }).toString()}`.replace(/\?$/, "");
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow"><span className="role sa">{tr("SUPER_ADMIN")}</span></div>
          <h2 style={{ marginTop: 6 }}>{t("title")}</h2>
        </div>
        <div className="row wrap">
          <FilterSelect name="year" label={t("period")} value={String(year)} options={years.map((y) => [String(y), String(y)])} />
          <a className="btn xls sm" href={`/api/admin/export/finance.xlsx?year=${year}`}>{t("export")}</a>
        </div>
      </div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map((k) => <Link key={k} href={href(k)} className={tab === k ? "on" : ""}>{labels[k]}</Link>)}
      </div>
      {tab === "pemasukan" && <IncomeTab year={year} cy={cy} l={l} />}
      {tab === "pengeluaran" && <ExpenseTab year={year} cy={cy} l={l} sp={sp} />}
      {tab === "laba-rugi" && <ProfitTab year={year} l={l} />}
    </>
  );
}

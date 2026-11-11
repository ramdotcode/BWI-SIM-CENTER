import { getTranslations } from "next-intl/server";
import { expenseData } from "@/lib/services/expenses";
import { financeData } from "@/lib/services/finance";
import { getSettings } from "@/lib/settings";
import { monthLong, rupiahShort } from "@/lib/format";
import { FilterSelect } from "@/components/admin/FilterBar";
import { ExpensesTable } from "@/components/admin/ExpensesClient";
import { Big, MonthBars } from "./MonthBars";

/** Tab Pengeluaran — dicatat manual oleh Super Admin (revisi klien Nov 2026, poin 10). */
export async function ExpenseTab({ year, cy, l, sp }: { year: number; cy: number; l: "id" | "en"; sp: Record<string, string | undefined> }) {
  const t = await getTranslations("admin.finance");
  const month = sp.month && /^\d{1,2}$/.test(sp.month) && Number(sp.month) >= 1 && Number(sp.month) <= 12 ? Number(sp.month) - 1 : undefined;
  const category = sp.cat || undefined;
  const [d, fin, s] = await Promise.all([expenseData(year, { month, category }), financeData(year), getSettings()]);
  const curMonth = fin.curMonth;
  const count = year === cy ? curMonth + 1 : 12;
  const income = fin.months.reduce((a, m) => a + m.net, 0);
  const ratio = income > 0 ? Math.round((d.total / income) * 100) : null;
  const top = d.categories[0];
  const catOptions = [...new Set([...s.expense_categories, ...d.categories.map((c) => c.name)])];
  const colors = ["var(--bad)", "var(--warn)", "var(--teal-mid)", "var(--b737)", "var(--teal)", "var(--ok)", "var(--faint)"];
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card kpi"><span className="eyebrow">{t("expKpiYtd", { year })}</span><Big text={rupiahShort(d.total, l)} color="var(--bad)" /><span className="d">{t("expKpiYtdD", { n: d.count })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiMonth", { month: `${monthLong(curMonth, l)} ${year}` })}</span><Big text={rupiahShort(d.months[curMonth] ?? 0, l)} /><span className="d">{t("expKpiMonthD")}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("expKpiTop")}</span><span className="v" style={{ fontSize: 24, lineHeight: 1.15 }}>{top ? top.name : "—"}</span><span className="d">{top ? t("expKpiTopD", { pct: top.pct, amount: rupiahShort(top.amount, l) }) : t("expEmpty")}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("expKpiRatio")}</span><span className="v">{ratio == null ? "—" : `${ratio}%`}</span><span className="d">{t("expKpiRatioD")}</span></div>
      </div>
      <div className="grid sched-grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", marginBottom: 18 }}>
        <div className="card">
          <div className="hd"><h3>{t("expChart")}</h3><span className="small muted">{t("chartUnit", { year })}</span></div>
          <div className="bd chart">
            <MonthBars series={[{ label: t("tabExpense"), color: "var(--bad)", values: d.months }]} count={count} highlight={year === cy ? curMonth : null} l={l} aria={t("expChart")} />
          </div>
        </div>
        <div className="card">
          <div className="hd"><h3>{t("expByCat")}</h3><span className="small muted">{year}</span></div>
          <div className="bd stack" style={{ gap: 12 }}>
            {d.categories.length === 0 && <div className="empty">{t("expEmpty")}</div>}
            {d.categories.map((c, i) => (
              <div className="stack" style={{ gap: 5 }} key={c.name}>
                <div className="row between small"><span>{c.name}</span><b className="mono">{rupiahShort(c.amount, l)} · {c.pct}%</b></div>
                <div className="prog"><i style={{ width: `${c.pct}%`, background: colors[i % colors.length] }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="hd" style={{ flexWrap: "wrap", gap: 10 }}>
          <h3>{t("expList")}</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <FilterSelect name="month" label={t("month")} value={month == null ? "" : String(month + 1)} options={[["", t("allMonths")], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), monthLong(i, l)] as [string, string])]} />
            <FilterSelect name="cat" label={t("category")} value={category ?? ""} options={[["", t("allCategories")], ...catOptions.map((c) => [c, c] as [string, string])]} />
          </div>
        </div>
        <ExpensesTable rows={d.rows} total={d.rowsTotal} categories={s.expense_categories} defaultDate={year === cy ? undefined : `${year}-12-31`} />
      </div>
    </>
  );
}

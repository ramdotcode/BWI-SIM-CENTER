import { monthLong, monthShort, num } from "@/lib/format";

type Series = { label: string; color?: string; values: number[] };

/** Grafik batang per bulan (Rp juta). 1 seri: bulan berjalan disorot lime; ≥ 2 seri: batang berdampingan + legenda. */
export function MonthBars({ series, count, highlight, l, aria }: { series: Series[]; count: number; highlight: number | null; l: "id" | "en"; aria: string }) {
  const W = 640, H = 260, pl = 44, pb = 34, pt = 16, pr = 10;
  const max = Math.max(1, ...series.flatMap((s) => s.values.slice(0, count).map((v) => v / 1e6)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const bw = (W - pl - pr) / Math.max(count, 1);
  const n = series.length;
  const gw = bw * (n > 1 ? 0.76 : 0.6);
  return (
    <>
      {n > 1 && (
        <div className="legend" style={{ marginBottom: 8 }}>
          {series.map((s) => <span key={s.label}><i style={{ background: s.color, borderColor: s.color }} />{s.label}</span>)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((v) => {
          const y = pt + (H - pt - pb) * (1 - v / top);
          return (
            <g key={v}>
              <line className="axis" x1={pl} x2={W - pr} y1={y} y2={y} />
              <text className="lbl" x={pl - 8} y={y + 4} textAnchor="end">{v}</text>
            </g>
          );
        })}
        {Array.from({ length: count }, (_, i) => {
          const x0 = pl + i * bw + (bw - gw) / 2;
          const w = gw / n;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const raw = s.values[i] ?? 0;
                const v = raw / 1e6;
                const h = (H - pt - pb) * (Math.max(0, v) / top), y = pt + (H - pt - pb) - h, x = x0 + si * w;
                const cls = n === 1 ? `bar ${i === highlight ? "cur" : ""}` : undefined;
                return (
                  <g key={si}>
                    <rect className={cls} style={n > 1 || s.color ? { fill: n === 1 && i === highlight ? undefined : s.color } : undefined} x={x} y={y} width={n > 1 ? w - 2 : w} height={h} rx={3}><title>{`${monthLong(i, l)} · ${s.label}: Rp ${num(raw)}`}</title></rect>
                    {n === 1 && <text className="lbl" x={x + w / 2} y={y - 5} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 600 }}>{Math.round(v)}</text>}
                  </g>
                );
              })}
              <text className="lbl" x={x0 + gw / 2} y={H - pb + 16} textAnchor="middle">{monthShort(i, l)}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** "12,5 jt" dipecah jadi angka besar + satuan kecil (gaya KPI yang sudah ada). */
export function Big({ text, color }: { text: string; color?: string }) {
  const [v, u] = text.split(" ");
  return <span className="v" style={color ? { color } : undefined}>{v} <span style={{ fontSize: 18, color: "var(--faint)" }}>{u}</span></span>;
}

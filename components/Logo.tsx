/* eslint-disable @next/next/no-img-element */
export function Logo({ ppi = true, h = 38, ppiH = 34 }: { ppi?: boolean; h?: number; ppiH?: number }) {
  return (
    <span className="row" style={{ gap: 12 }}>
      <img src="/brand/bwi-aviation.png" alt="BWI Aviation" style={{ height: h, width: "auto" }} />
      {ppi && <img src="/brand/ppi-curug.png" alt="PPI Curug" style={{ height: ppiH, width: "auto" }} />}
    </span>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { fmtShortTs } from "@/lib/format";

type Item = { id: number; template: string; name: string; reg: string; at: string | Date; link: string; text: string };

export function WaOutbox({ items }: { items: Item[] }) {
  const t = useTranslations("admin.home");
  const te = useTranslations("enums.template");
  const l = useLocale() as "id" | "en";
  const router = useRouter();
  const [done, setDone] = useState<number[]>([]);
  const list = items.filter((i) => !done.includes(i.id));
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="hd">
        <h3>{t("waOutbox")}</h3>
        <span className="pill teal">{list.length}</span>
      </div>
      <div className="bd stack" style={{ gap: 8 }}>
        <p className="small muted">{t("waOutboxD")}</p>
        {list.length === 0 ? <div className="empty">{t("waEmpty")}</div> : list.map((i) => (
          <div key={i.id} className="row between wrap" style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>{i.name}</b> <span className="small muted mono">{i.reg}</span> · <span className="small">{te(i.template as "invoice_issued")}</span>
              <div className="small faint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.text}</div>
            </div>
            <div className="row">
              <span className="small faint mono">{fmtShortTs(new Date(i.at), l)}</span>
              <a className="btn wa xs" href={i.link} target="_blank" rel="noopener noreferrer">{t("waOpen")}</a>
              <button className="btn ghost xs" onClick={async () => { await fetch(`/api/admin/notifications/${i.id}/sent`, { method: "POST" }); setDone((d) => [...d, i.id]); router.refresh(); }}>{t("waMarkSent")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

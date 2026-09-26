"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ACCEPT, api, fmtSize, uploadFile, type Uploaded } from "../upload";
import { useToast } from "../Toast";

export function ReuploadForm({ token, kinds }: { token: string; kinds: { kind: string; label: string; note: string | null }[] }) {
  const t = useTranslations("reupload");
  const tf = useTranslations("form");
  const toast = useToast();
  const [files, setFiles] = useState<Record<string, Uploaded | "busy" | undefined>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <div className="banner ok">{t("done")}</div>;
  const ready = kinds.every((k) => files[k.kind] && files[k.kind] !== "busy");
  return (
    <div className="stack" style={{ gap: 12 }}>
      {kinds.map((k) => {
        const f = files[k.kind];
        const ok = f && f !== "busy";
        return (
          <label key={k.kind} className={`upload ${ok ? "done" : ""}`} style={{ position: "relative", cursor: "pointer" }}>
            <div className="ic">📄</div>
            <div className="grow">
              <b>{k.label}</b> <span style={{ color: "var(--bad)" }}>*</span>
              <div className="small muted">{ok ? `${f.name} · ${fmtSize(f.size)}` : f === "busy" ? tf("uploading") : k.note ?? ""}</div>
            </div>
            {ok && <span className="pill ok">{tf("uploaded")}</span>}
            <span className="btn ghost sm">{ok ? tf("replaceFile") : tf("chooseFile")}</span>
            <input
              type="file"
              accept={ACCEPT}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFiles((x) => ({ ...x, [k.kind]: "busy" }));
                try {
                  const u = await uploadFile(file, k.kind);
                  setFiles((x) => ({ ...x, [k.kind]: u }));
                } catch (err) {
                  toast(`${tf("uploadFailed")}: ${(err as Error).message}`);
                  setFiles((x) => ({ ...x, [k.kind]: undefined }));
                }
              }}
            />
          </label>
        );
      })}
      <button
        className="btn lime"
        disabled={!ready || busy}
        style={{ alignSelf: "flex-end" }}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/public/reupload/${encodeURIComponent(token)}`, { body: { files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, (v as Uploaded).id])) } });
            setDone(true);
          } catch (e) {
            toast((e as Error).message);
          }
          setBusy(false);
        }}
      >
        {t("submit")}
      </button>
    </div>
  );
}

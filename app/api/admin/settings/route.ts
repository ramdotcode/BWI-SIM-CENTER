import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { SETTING_DEFAULTS, SETTING_META, setSettings, type SettingKey } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const b = await body(req, z.record(z.string(), z.unknown()));
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if (!(k in SETTING_DEFAULTS)) continue;
    const m = SETTING_META[k as SettingKey];
    if (m.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(422, `${k}: angka tidak valid`);
      patch[k] = n;
    } else if (m.type === "boolean") patch[k] = !!v;
    else if (m.type === "time") {
      if (!/^\d{2}:\d{2}$/.test(String(v))) throw new HttpError(422, `${k}: format HH:MM`);
      patch[k] = String(v);
    } else if (m.type === "enum") {
      if (!m.options!.includes(String(v))) throw new HttpError(422, `${k}: pilihan tidak valid`);
      patch[k] = String(v);
    } else if (m.type === "list") patch[k] = (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim()).filter(Boolean);
    else patch[k] = String(v).trim();
  }
  const mins = (patch.slot_minutes as number) ?? undefined;
  if (mins !== undefined && (mins < 30 || mins > 480)) throw new HttpError(422, "Durasi slot 30–480 menit");
  await setSettings(patch);
  await logActivity({ type: "ADMIN", id: a.id }, "settings.updated", "settings", null, patch);
  return json({ ok: true });
});

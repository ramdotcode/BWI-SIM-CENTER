import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { getSettings, parseSessions, SETTING_DEFAULTS, SETTING_META, setSettings, type SettingKey } from "@/lib/settings";
import { pruneSlots } from "@/lib/services/slots";
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
      if (k === "upload_max_mb" && (n < 1 || n > 20)) throw new HttpError(422, "Batas ukuran file harus 1–20 MB");
      patch[k] = n;
    } else if (m.type === "boolean") patch[k] = !!v;
    else if (m.type === "time") {
      if (!/^\d{2}:\d{2}$/.test(String(v))) throw new HttpError(422, `${k}: format HH:MM`);
      patch[k] = String(v);
    } else if (m.type === "enum") {
      if (!m.options!.includes(String(v))) throw new HttpError(422, `${k}: pilihan tidak valid`);
      patch[k] = String(v);
    } else if (m.type === "sessions") {
      const raw = (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim()).filter(Boolean);
      const ss = parseSessions(raw);
      if (!ss.length || ss.length !== raw.length) throw new HttpError(422, `${k}: format tiap sesi HH:MM-HH:MM, pisahkan koma`);
      const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      const len = toMin(ss[0]!.end) - toMin(ss[0]!.start);
      if (ss.some((x) => toMin(x.end) - toMin(x.start) !== len)) throw new HttpError(422, `${k}: semua sesi harus sama panjang`);
      if (len < 30 || len > 480) throw new HttpError(422, `${k}: durasi sesi 30–480 menit`);
      if (ss.some((x, i) => i > 0 && x.start < ss[i - 1]!.end)) throw new HttpError(422, `${k}: sesi tidak boleh tumpang tindih`);
      patch[k] = ss.map((x) => `${x.start}-${x.end}`);
    } else if (m.type === "days") {
      const days = [...new Set((Array.isArray(v) ? v : String(v).split(",")).map(Number))].filter((x) => Number.isInteger(x) && x >= 1 && x <= 7).sort();
      if (!days.length) throw new HttpError(422, `${k}: pilih minimal 1 hari`);
      patch[k] = days;
    } else if (m.type === "list") patch[k] = (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim()).filter(Boolean);
    else patch[k] = String(v).trim();
  }
  const cur = await getSettings(true);
  const scheduleChanged = ["session_times", "work_days"].some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(cur[k as SettingKey]));
  await setSettings(patch);
  // Slot kosong mendatang yang tidak lagi sesuai jam sesi / hari kerja dihapus; slot terisi tetap.
  if (scheduleChanged) await pruneSlots();
  await logActivity({ type: "ADMIN", id: a.id }, "settings.updated", "settings", null, patch);
  return json({ ok: true });
});

import { handler, json } from "@/lib/api";
import { availabilityDays } from "@/lib/services/public";

export const dynamic = "force-dynamic";
/** Kalender preferensi jadwal di form: jumlah sesi kosong per tanggal untuk simulator terpilih. */
export const GET = handler(async (req: Request) => {
  const sim = new URL(req.url).searchParams.get("sim") === "B737" ? "B737" : "A320";
  return json(await availabilityDays(sim), { headers: { "cache-control": "no-store" } });
});

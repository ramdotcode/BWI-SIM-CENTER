import { handler, json } from "@/lib/api";
import { todayBoard } from "@/lib/services/public";

export const dynamic = "force-dynamic";
export const GET = handler(async () => json(await todayBoard(), { headers: { "cache-control": "no-store" } }));

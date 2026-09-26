import "server-only";
import { db, type DbOrTx } from "./db";

export type Actor = { type: "ADMIN" | "SYSTEM" | "PARTICIPANT"; id?: number | null };
export const SYSTEM: Actor = { type: "SYSTEM" };

export async function logActivity(actor: Actor, action: string, entity: string, entityId: string | number | null, meta: Record<string, unknown> = {}, tx: DbOrTx = db) {
  await tx.activityLog.create({
    data: { actor_type: actor.type, actor_id: actor.id ?? null, action, entity, entity_id: entityId == null ? null : String(entityId), meta: JSON.parse(JSON.stringify(meta, (_k, v) => (typeof v === "bigint" ? Number(v) : v))) },
  });
}

import "server-only";
import { db } from "./db";
import { HttpError } from "./auth";

/** Klaim unggahan sementara (bukti bayar/refund, laporan sesi) → storage key permanen. */
export async function claimUpload(id: string | undefined | null, kinds: string[]): Promise<string | undefined> {
  if (!id) return undefined;
  const u = await db.pendingUpload.findUnique({ where: { id } });
  if (!u || u.claimed || !kinds.includes(u.kind)) throw new HttpError(422, "Unggahan tidak valid, silakan unggah ulang");
  await db.pendingUpload.update({ where: { id }, data: { claimed: true } });
  return u.storage_key;
}

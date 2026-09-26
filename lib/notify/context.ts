import "server-only";
import { db } from "../db";

/** Memuat semua data pendaftaran yang dibutuhkan template notifikasi / PDF / dashboard. */
export async function loadRegCtx(registrationId: number) {
  return db.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: {
      participant: true,
      package: true,
      simulator: true,
      invoices: { orderBy: { issued_at: "desc" } },
      documents: { where: { superseded: false }, orderBy: { kind: "asc" } },
      slots: {
        where: { status: { in: ["SCHEDULED", "COMPLETED", "NO_SHOW"] } },
        include: { instructor: true },
        orderBy: [{ date: "asc" }, { start_time: "asc" }],
      },
    },
  });
}
export type RegCtx = Awaited<ReturnType<typeof loadRegCtx>>;

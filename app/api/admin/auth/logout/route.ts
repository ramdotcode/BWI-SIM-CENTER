import { handler, json } from "@/lib/api";
import { assertSameOrigin, endSession } from "@/lib/auth";

export const POST = handler(async () => {
  await assertSameOrigin();
  await endSession();
  return json({ ok: true });
});

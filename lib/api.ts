import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { HttpError } from "./auth";

export function json(data: unknown, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

/** Bungkus handler: HttpError/ZodError → JSON error yang rapi. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) return json({ error: "Data tidak valid", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
      console.error(e);
      return json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => {
    throw new HttpError(400, "Body JSON tidak valid");
  });
  return schema.parse(raw);
}

import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const db = g.__prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (process.env.NODE_ENV !== "production") g.__prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
export type DbOrTx = typeof db | Tx;

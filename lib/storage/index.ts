import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { encrypt, decrypt, signPayload, verifyPayload } from "../crypto";

/**
 * Penyimpanan dokumen privat.
 * - local: file di STORAGE_LOCAL_DIR, terenkripsi AES-256-GCM (at-rest), diakses lewat /api/files dengan URL bertanda tangan.
 * - s3: bucket privat S3-compatible (AWS S3 / R2 / MinIO) + presigned URL. Tidak dipakai untuk Supabase Storage.
 */
export interface Storage {
  readonly mode: "local" | "s3";
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, ttlSec?: number, opts?: { download?: string; mime?: string }): Promise<string>;
  /** Hanya s3: URL PUT langsung dari browser (melewati batas body 4,5 MB Vercel). */
  presignPut?(key: string, mime: string, size: number, ttlSec?: number): Promise<string>;
}

class LocalStorage implements Storage {
  readonly mode = "local" as const;
  dir = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  private file(key: string) {
    const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "");
    return path.join(this.dir, safe + ".enc");
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, encrypt(data));
  }
  async get(key: string) {
    return decrypt(await fs.readFile(this.file(key)));
  }
  async remove(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
  async signedUrl(key: string, ttlSec = 300, opts: { download?: string; mime?: string } = {}) {
    const t = signPayload({ k: key, d: opts.download, m: opts.mime }, ttlSec);
    return `/api/files?t=${encodeURIComponent(t)}`;
  }
}

class S3Storage implements Storage {
  readonly mode = "s3" as const;
  c = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
  });
  bucket = process.env.S3_BUCKET ?? "";
  async put(key: string, data: Buffer, mime: string) {
    // S3_SSE=AES256 untuk AWS/MinIO; R2 sudah terenkripsi at-rest, header dikosongkan.
    const sse = process.env.S3_SSE === "AES256" ? { ServerSideEncryption: "AES256" as const } : {};
    await this.c.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: mime, ...sse }));
  }
  async get(key: string) {
    const r = await this.c.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async remove(key: string) {
    await this.c.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async signedUrl(key: string, ttlSec = 300, opts: { download?: string } = {}) {
    return getSignedUrl(
      this.c,
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: opts.download ? `attachment; filename="${opts.download}"` : "inline" }),
      { expiresIn: ttlSec },
    );
  }
  async presignPut(key: string, mime: string, size: number, ttlSec = 600) {
    // ContentLength & ContentType ikut ditandatangani → R2 menolak file dengan ukuran/tipe berbeda.
    return getSignedUrl(this.c, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime, ContentLength: size }), { expiresIn: ttlSec, signableHeaders: new Set(["content-type", "content-length"]) });
  }
}

function create(): Storage {
  if (process.env.STORAGE_DRIVER === "s3") return new S3Storage();
  // Disk Vercel tidak permanen: dokumen akan hilang. Wajib pakai R2/S3 di sana.
  if (process.env.VERCEL) throw new Error("STORAGE_DRIVER harus 's3' (Cloudflare R2) di Vercel");
  return new LocalStorage();
}
const g = globalThis as unknown as { __storage?: Storage };
export const storage: Storage = (g.__storage ??= create());

/** Verifikasi token URL bertanda tangan untuk driver local. */
export function verifyFileToken(t: string) {
  return verifyPayload<{ k: string; d?: string; m?: string }>(t);
}

/**
 * Kirim file hasil generate (ZIP/PDF) ke browser. Fungsi Vercel membatasi respons maks 4,5 MB, jadi di mode s3
 * file disimpan sementara di `incoming/exports/…` (dihapus otomatis oleh lifecycle R2 `incoming/` 1 hari)
 * lalu browser diarahkan ke URL unduh bertanda tangan 5 menit. Mode local: langsung dikirim.
 */
export async function deliverFile(req: Request, data: Uint8Array, filename: string, mime: string): Promise<Response> {
  if (storage.mode === "s3") {
    const key = `incoming/exports/${randomUUID()}/${filename}`;
    await storage.put(key, Buffer.from(data), mime);
    return Response.redirect(new URL(await storage.signedUrl(key, 300, { download: filename, mime }), req.url), 302);
  }
  return new Response(new Uint8Array(data), { headers: { "content-type": mime, "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" } });
}

import "server-only";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { HttpError } from "./auth";
import { getSettings } from "./settings";

/** Batas ukuran 1 file (setting upload_max_mb, 1–20 MB; CR-05). */
export async function uploadLimit(): Promise<{ bytes: number; mb: number }> {
  const s = await getSettings();
  const mb = Math.min(20, Math.max(1, Number(s.upload_max_mb) || 5));
  return { bytes: mb * 1024 * 1024, mb };
}
export const tooLarge = (mb: number) => new HttpError(413, `Ukuran file melebihi batas ${mb} MB`, "too_large");
const ALLOWED = new Set(["image/jpeg", "image/png", "application/pdf"]);

/**
 * Validasi unggahan: mime sniffing (bukan percaya header), ≤ batas upload_max_mb,
 * gambar di-normalisasi orientasinya & di-strip EXIF/metadata (sharp default tidak menyalin metadata).
 */
export async function sanitizeUpload(buf: Buffer, opts: { allowPdf?: boolean } = {}): Promise<{ data: Buffer; mime: string; ext: string }> {
  if (buf.length === 0) throw new HttpError(400, "File kosong", "empty");
  const lim = await uploadLimit();
  if (buf.length > lim.bytes) throw tooLarge(lim.mb);
  const ft = await fileTypeFromBuffer(buf);
  if (!ft || !ALLOWED.has(ft.mime) || (ft.mime === "application/pdf" && opts.allowPdf === false)) throw new HttpError(415, "Format harus JPG, PNG, atau PDF", "bad_type");
  if (ft.mime === "application/pdf") return { data: buf, mime: ft.mime, ext: "pdf" };
  const img = sharp(buf, { failOn: "error" }).rotate();
  const data = ft.mime === "image/png" ? await img.png({ compressionLevel: 8 }).toBuffer() : await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return { data, mime: ft.mime, ext: ft.ext };
}

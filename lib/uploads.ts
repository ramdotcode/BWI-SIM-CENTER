import "server-only";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { HttpError } from "./auth";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "application/pdf"]);

/**
 * Validasi unggahan: mime sniffing (bukan percaya header), ≤ 5 MB,
 * gambar di-normalisasi orientasinya & di-strip EXIF/metadata (sharp default tidak menyalin metadata).
 */
export async function sanitizeUpload(buf: Buffer, opts: { allowPdf?: boolean } = {}): Promise<{ data: Buffer; mime: string; ext: string }> {
  if (buf.length === 0) throw new HttpError(400, "File kosong", "empty");
  if (buf.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "Ukuran file melebihi 5 MB", "too_large");
  const ft = await fileTypeFromBuffer(buf);
  if (!ft || !ALLOWED.has(ft.mime) || (ft.mime === "application/pdf" && opts.allowPdf === false)) throw new HttpError(415, "Format harus JPG, PNG, atau PDF", "bad_type");
  if (ft.mime === "application/pdf") return { data: buf, mime: ft.mime, ext: "pdf" };
  const img = sharp(buf, { failOn: "error" }).rotate();
  const data = ft.mime === "image/png" ? await img.png({ compressionLevel: 8 }).toBuffer() : await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return { data, mime: ft.mime, ext: ft.ext };
}

// Fallback untuk rute di luar [locale].
import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="id">
      <body style={{ fontFamily: "system-ui", padding: 40 }}>
        <h1>404</h1>
        <p>Halaman tidak ditemukan.</p>
        <Link href="/">Ke beranda</Link>
      </body>
    </html>
  );
}

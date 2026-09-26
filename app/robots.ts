import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/d/", "/en/d/", "/admin", "/en/admin", "/unggah-ulang/", "/en/unggah-ulang/", "/api/", "/daftar/terkirim/"] }] };
}

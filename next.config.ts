import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const privateHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Font & logo dibaca dari disk saat membuat PDF/email → wajib ikut ke fungsi Vercel.
  outputFileTracingIncludes: { "/api/**": ["./assets/fonts/**", "./public/brand/**"] },
  serverExternalPackages: ["@react-pdf/renderer", "exceljs", "sharp", "pg", "node-cron", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/d/:path*", headers: privateHeaders },
      { source: "/en/d/:path*", headers: privateHeaders },
      { source: "/unggah-ulang/:path*", headers: privateHeaders },
      { source: "/en/unggah-ulang/:path*", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/en/admin/:path*", headers: privateHeaders },
      { source: "/api/d/:path*", headers: privateHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);

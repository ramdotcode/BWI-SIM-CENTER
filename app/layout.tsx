import type { ReactNode } from "react";
import "./globals.css";

// Layout akar minimal; <html> dirender di app/[locale]/layout.tsx (pola next-intl).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

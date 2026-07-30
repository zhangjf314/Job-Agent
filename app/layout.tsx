import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { BRAND } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.productNameZh,
  description: `${BRAND.productNameZh} · ${BRAND.productNameEn}`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

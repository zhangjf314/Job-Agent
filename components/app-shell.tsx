import React from "react";
import { MainNav } from "@/components/main-nav";
import { PortfolioDemoBanner } from "@/components/portfolio-demo-banner";
import { BRAND } from "@/lib/branding";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PortfolioDemoBanner />
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-semibold">{BRAND.productNameZh}</div>
            <div className="text-sm text-muted-foreground">{BRAND.productNameEn}</div>
          </div>
          <MainNav />
        </div>
      </header>
      {children}
    </div>
  );
}
